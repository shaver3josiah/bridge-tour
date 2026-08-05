from __future__ import annotations

import http.client
import io
import json
import os
import re
import sys
import zipfile
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

TEMP_HOME = Path(tempfile.mkdtemp(prefix="orbit_tour_smoke_"))
os.environ["BRIDGE_TOUR_HOME"] = str(TEMP_HOME)

import server as orbit_server

PORT = 7362
BASE = f"http://127.0.0.1:{PORT}"

PASS_COUNT = 0
FAIL_COUNT = 0


def check(condition: bool, message: str) -> None:
    global PASS_COUNT, FAIL_COUNT
    if condition:
        PASS_COUNT += 1
        print(f"PASS {message}")
    else:
        FAIL_COUNT += 1
        print(f"FAIL {message}")


def http_json(method: str, path: str, payload=None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def http_json_allow_error(method: str, path: str, payload=None):
    try:
        return http_json(method, path, payload)
    except urllib.error.HTTPError as exc:
        body = exc.read()
        try:
            return exc.code, json.loads(body.decode("utf-8"))
        except Exception:
            return exc.code, {"error": "unknown", "detail": body.decode("utf-8", "replace")}


def http_upload(path: str, filename: str, content: bytes):
    boundary = "BridgeTourSmokeBoundary"
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
            b"Content-Type: application/octet-stream\r\n\r\n",
            content,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def http_status(path: str) -> int:
    try:
        with urllib.request.urlopen(BASE + path, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code


def main() -> int:
    server = orbit_server.build_server(PORT)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    status, created = http_json("POST", "/api/tours", {"name": "Smoke Tour"})
    check(status == 200 and created["id"].startswith("smoke-tour-"), "create tour")
    tid = created["id"]

    status, listed = http_json("GET", "/api/tours")
    check(any(t["id"] == tid for t in listed["tours"]), "tour appears in list")

    status, fetched = http_json("GET", f"/api/tours/{tid}")
    check(status == 200 and fetched["id"] == tid and fetched["scenes"] == [], "get tour returns doc")

    status, up1 = http_upload(f"/api/tours/{tid}/files", "pano.jpg", b"\xff\xd8fakejpg")
    check(status == 200 and up1["file"].endswith(".jpg"), "upload pano file")
    status, up2 = http_upload(f"/api/tours/{tid}/files", "orphan.jpg", b"\xff\xd8orphan")
    check(status == 200, "upload orphan file")

    status, _ = http_upload(f"/api/tours/{tid}/files", "evil.exe", b"MZ")
    check(status == 400, "reject non-image upload")

    doc = dict(created)
    doc["scenes"] = [{"id": "s1", "name": "Scene 1", "file": up1["file"], "hotspots": []}]
    status, saved = http_json("POST", f"/api/tours/{tid}", doc)
    check(status == 200 and saved["updated"] > saved["created"], "save tour doc")

    check(http_status(f"/api/tours/{tid}/files/{up1['file']}") == 200, "referenced file survives save")
    check(http_status(f"/api/tours/{tid}/files/{up2['file']}") == 200, "fresh orphan survives save (prune grace window)")

    # a second editor holding the version we just replaced must not clobber it
    status, _ = http_json_allow_error("POST", f"/api/tours/{tid}", doc)
    check(status == 409, "a save from a stale version is refused, not silently applied")
    # a well-behaved client carries the stamp the server just handed back
    doc["updated"] = saved["updated"]

    orphan_path = TEMP_HOME / "tours" / tid / "files" / up2["file"]
    old = time.time() - (orbit_server.PRUNE_GRACE_SECONDS + 60)
    os.utime(orphan_path, (old, old))
    status, saved = http_json("POST", f"/api/tours/{tid}", doc)
    check(status == 200, "second save accepted")
    doc["updated"] = saved["updated"]
    check(http_status(f"/api/tours/{tid}/files/{up2['file']}") == 404, "aged orphan pruned on save")
    check(http_status(f"/api/tours/{tid}/files/{up1['file']}") == 200, "referenced file still survives")

    status, _ = http_json_allow_error("POST", f"/api/tours/{tid}", {"scenes": "nope"})
    check(status == 400, "reject doc without scenes list")

    # the sequential stale-save check above cannot fail: posting one request
    # after another always serialises, so it never touches the lock under real
    # contention. Real editors collide at the same instant, so fire eight of
    # them at once, all carrying the SAME "updated" stamp, and let the lock
    # sort it out.
    status, race_created = http_json("POST", "/api/tours", {"name": "Race Tour"})
    race_id = race_created["id"]
    status, race_doc = http_json("GET", f"/api/tours/{race_id}")
    status, race_saved = http_json("POST", f"/api/tours/{race_id}", race_doc)
    check(status == 200, "race tour saved once, to establish the version everyone will race against")
    check(race_saved.get("v") == 1, "a successful save stamps the schema version")
    race_updated = race_saved["updated"]

    RACE_N = 8
    race_barrier = threading.Barrier(RACE_N)
    race_results: list = [None] * RACE_N

    def race_save(i: int) -> None:
        payload = dict(race_saved, name=f"Racer {i}", updated=race_updated)
        body = json.dumps(payload).encode("utf-8")
        # http_json goes through urllib's shared default opener, which is not
        # something to bet this test's own correctness on under real
        # concurrency; give each thread its own raw connection instead.
        conn = http.client.HTTPConnection("127.0.0.1", PORT, timeout=30)
        race_barrier.wait()  # released together, or this proves nothing
        conn.request(
            "POST",
            f"/api/tours/{race_id}",
            body=body,
            headers={"Content-Type": "application/json"},
        )
        resp = conn.getresponse()
        race_results[i] = resp.status
        resp.read()
        conn.close()

    racers = [threading.Thread(target=race_save, args=(i,)) for i in range(RACE_N)]
    for racer in racers:
        racer.start()
    for racer in racers:
        racer.join()

    check(
        race_results.count(200) == 1 and race_results.count(409) == RACE_N - 1,
        "only one of eight simultaneous saves wins; the rest are refused",
    )
    winner = race_results.index(200) if 200 in race_results else -1
    status, race_final = http_json("GET", f"/api/tours/{race_id}")
    check(
        winner >= 0 and race_final["name"] == f"Racer {winner}" and race_final["updated"] > race_updated,
        "the document on disk after the race is the winner's payload, stamped with a newer updated",
    )
    http_json("DELETE", f"/api/tours/{race_id}")

    status, copy = http_json("POST", f"/api/tours/{tid}/duplicate")
    check(status == 200 and copy["id"] != tid and copy["name"].endswith("copy"), "duplicate tour")
    check(copy["scenes"] == saved["scenes"], "duplicate keeps scenes")
    check(http_status(f"/api/tours/{copy['id']}/files/{up1['file']}") == 200, "duplicate copies media files")
    http_json("DELETE", f"/api/tours/{copy['id']}")

    with urllib.request.urlopen(BASE + f"/api/tours/{tid}/export.zip", timeout=60) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        names = z.namelist()
        index = z.read("index.html").decode("utf-8")
        manifest = json.loads(z.read("manifest.json").decode("utf-8"))
    check("index.html" in names and "README.txt" in names, "export has index + readme")
    # provenance: a folder found in three years has to explain itself
    check("manifest.json" in names, "export carries a provenance manifest")
    check(manifest["app"] == "orbit-tour" and manifest["tour"]["id"] == tid,
          "manifest names the app and the tour")
    check(manifest["counts"]["scenes"] == len(doc["scenes"]),
          "manifest scene count matches the document")
    check("exportedAt" in manifest and manifest["viewer"]["photoSphereViewer"] == "5.14.3",
          "manifest stamps the export time and the viewer version")
    check(f"files/{up1['file']}" in names, "export bundles media")
    check(any(n.startswith("vendor/") and n.endswith(".js") for n in names), "export bundles vendor js")
    check(
        "/tour/vendor/" not in index
        and 'href="./vendor/psv-core.css"' in index
        and '"./vendor/three.module.js"' in index,
        "export rewrites vendor paths to spec-valid relative urls",
    )
    check("window.BRIDGE_STATIC_TOUR" in index and up1["file"] in index, "export inlines tour doc")

    # everything above only reads the zip's table of contents; none of it proves
    # the exported viewer would actually load. Unzip it for real and look inside.
    static_match = re.search(r"window\.BRIDGE_STATIC_TOUR\s*=\s*(\{.*?\});</script>", index, re.DOTALL)
    check(static_match is not None, "exported index.html has a parseable inline tour doc")
    embedded = json.loads(static_match.group(1)) if static_match else {}
    check(
        embedded.get("id") == tid and len(embedded.get("scenes") or []) == len(saved["scenes"]),
        "inlined tour doc is the same tour, with the same scene count, as the one exported",
    )

    # a renamed or dropped vendor file would leave the importmap pointing at
    # nothing the browser can fetch; catch that here instead of in the console.
    importmap_match = re.search(r'<script type="importmap">\s*(\{.*?\})\s*</script>', index, re.DOTALL)
    check(importmap_match is not None, "exported index.html has a parseable importmap")
    importmap = json.loads(importmap_match.group(1)) if importmap_match else {}
    vendor_imports = list(importmap.get("imports", {}).values())
    check(
        bool(vendor_imports) and all(t.startswith("./vendor/") and t[2:] in names for t in vendor_imports),
        "every module the importmap maps to is actually inside the zip",
    )

    check("/tour/vendor/" not in index, "no absolute vendor path survives the export rewrite")

    # a document can point at media the export forgot to bundle; walk it and check
    for scene in embedded.get("scenes") or []:
        if not isinstance(scene, dict):
            continue
        for field in ("file", "thumb"):
            value = scene.get(field)
            if value:
                check(f"files/{value}" in names, f"exported zip bundles the scene's {field} ({value})")
    embedded_settings = embedded.get("settings") or {}
    for field in ("logo", "audio"):
        value = embedded_settings.get(field)
        if value:
            check(f"files/{value}" in names, f"exported zip bundles the settings {field} ({value})")

    status, _ = http_json_allow_error("POST", "/api/tours/no-such-tour-000/duplicate", {})
    check(status == 404, "duplicate of missing tour is 404")
    check(http_status("/api/tours/no-such-tour-000/export.zip") == 404, "export of missing tour is 404")
    check(http_status("/api/tours/BadID/export.zip") == 404, "export rejects malformed id")

    status, _ = http_json_allow_error("GET", "/api/tours/..")
    check(status == 404, "path traversal id rejected")
    status, _ = http_json_allow_error("GET", "/api/tours/BadID")
    check(status == 404, "id failing TOUR_ID_RE rejected")

    conn = http.client.HTTPConnection("127.0.0.1", PORT, timeout=30)
    conn.putrequest("POST", f"/api/tours/{tid}/files")
    conn.putheader("Content-Type", "multipart/form-data; boundary=x")
    conn.putheader("Content-Length", str(999_000_000))
    conn.endheaders()
    resp = conn.getresponse()
    check(resp.status == 413, "oversize upload rejected by Content-Length")
    conn.close()

    status, _ = http_json("DELETE", f"/api/tours/{tid}")
    check(status == 200, "delete tour")
    status, _ = http_json_allow_error("GET", f"/api/tours/{tid}")
    check(status == 404, "tour gone after delete")

    app_path = REPO_ROOT / "tour" / "index.html"
    if app_path.exists():
        req = urllib.request.Request(BASE + "/tour")
        with urllib.request.urlopen(req, timeout=30) as resp:
            check(resp.status == 200 and b"<" in resp.read(), "tour app served at /tour")
    else:
        print("SKIP tour app not built yet")

    server.shutdown()
    print(f"\n{PASS_COUNT} passed, {FAIL_COUNT} failed")
    return 1 if FAIL_COUNT else 0


if __name__ == "__main__":
    raise SystemExit(main())
