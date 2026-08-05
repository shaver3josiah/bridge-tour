"""Run the panorama profiler over real photos and print what it read.

The pointing-arm, face and hi-vis readings are heuristics with thresholds, and
thresholds tuned on synthetic fixtures are tuned on the fixture author's
imagination. This runs the SHIPPING code — lifted out of tour/index.html the
same way the unit tests lift it — over whatever photos are in tests/field/,
and prints the bearing each one produced and which signal produced it.

    python tests/field_check.py [folder]

Needs Node (to run the app's own helpers) and Pillow (to decode the photos).
Neither is needed to run Bridge Tour itself; this is a bench tool.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# The profiler works on a 256-wide decode, exactly as preparePano does in the
# browser — same width, same aspect handling, so a bearing printed here is the
# bearing the editor would store.
PROFILE_WIDTH = 256

DRIVER = r"""
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const src = html.slice(html.indexOf('/* --- pure helpers begin'), html.indexOf('/* --- pure helpers end'));
const DECL = /^(?:function (\w+)\(|const (\w+) =|let (\w+) =)/gm;
const names = [];
for (let m; (m = DECL.exec(src)); ) names.push(m[1] || m[2] || m[3]);
const H = await import('data:text/javascript,' + encodeURIComponent(
  `${src}\nexport { ${names.join(', ')} };`));

const shots = JSON.parse(readFileSync(process.argv[3], 'utf8'));
const out = [];
for (const shot of shots) {
  const image = { width: shot.w, height: shot.h, data: new Uint8ClampedArray(shot.data) };
  const hFov = Math.abs(shot.aspect - 2) > 0.04
    ? Math.min(360, Math.round(60 * shot.aspect)) : 360;
  const p = H.panoProfile(image, { hFov });
  const open = H.openingView(p);
  out.push({
    name: shot.name, hFov,
    facing: p.facing, facingFrom: p.facingFrom,
    person: p.person ? { yaw: p.person.yaw, alt: p.person.alt, facingCamera: !!p.person.facingCamera } : null,
    opens: open ? { yaw: open.yaw, from: open.from } : null,
  });
}
console.log(JSON.stringify(out));
"""


def main() -> int:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "tests" / "field"
    photos = sorted(
        f for f in folder.glob("*")
        if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not photos:
        print(f"No photos in {folder}. Drop some 360 exports there and re-run.")
        return 0
    try:
        from PIL import Image
    except ImportError:
        print("This bench tool needs Pillow to decode photos:  pip install pillow")
        return 1

    shots = []
    for f in photos:
        im = Image.open(f).convert("RGBA")
        w, h = im.size
        nh = max(8, round(PROFILE_WIDTH / (w / h)))
        small = im.resize((PROFILE_WIDTH, nh))
        shots.append({
            "name": f.name, "w": PROFILE_WIDTH, "h": nh,
            "aspect": w / h, "data": list(small.tobytes()),
        })

    with tempfile.TemporaryDirectory() as tmp:
        shots_path = Path(tmp) / "shots.json"
        shots_path.write_text(json.dumps(shots), encoding="utf-8")
        driver = Path(tmp) / "driver.mjs"
        driver.write_text(DRIVER, encoding="utf-8")
        try:
            result = subprocess.run(
                ["node", str(driver), str(REPO_ROOT / "tour" / "index.html"), str(shots_path)],
                capture_output=True, text=True, check=False,
            )
        except FileNotFoundError:
            print("This bench tool needs Node to run the app's own helpers.")
            return 1
    if result.returncode != 0:
        print(result.stdout + result.stderr)
        return 1

    rows = json.loads(result.stdout.splitlines()[-1])
    width = max(len(r["name"]) for r in rows)
    print(f"{'photo'.ljust(width)}  {'opens':>7}  {'from':<7}  read")
    print("-" * (width + 34))
    for r in rows:
        opens = f"{r['opens']['yaw']:7.1f}" if r["opens"] else "      -"
        frm = r["opens"]["from"] if r["opens"] else "-"
        read = []
        if r["facing"] is not None:
            read.append(f"{r['facingFrom']} {r['facing']:.1f}deg")
        if r["person"]:
            turned = "facing camera" if r["person"]["facingCamera"] else "back turned"
            read.append(f"hi-vis {r['person']['yaw']:.1f}deg at {r['person']['alt']:.0f}deg, {turned}")
        print(f"{r['name'].ljust(width)}  {opens}  {frm:<7}  {', '.join(read) or 'nothing'}")
    print()
    print("`from` is which signal won: arm = somebody pointed, gaze = they were")
    print("facing the camera so the view turned around, person = hi-vis with their")
    print("back turned, facing = the crown of a head underfoot.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
