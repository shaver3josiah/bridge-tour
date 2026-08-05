"""Regression guard: Bridge Tour must run on a machine with NO third-party
Python libraries at all.

That is the promise on the front of the README — "needs Python 3, nothing
else" — and it is the kind of promise that rots silently. One `import requests`
for something convenient and a fresh clone stops starting for anybody who was
not told to pip install first. Nobody notices on a dev machine, because a dev
machine has everything.

The check runs the whole app in a clean subprocess — import, build a server,
answer two real requests — and then asks which modules that actually loaded.
Anything resolving into site-packages is a third-party dependency the README
does not admit to, and it is named in the failure.

Written this way on purpose. The obvious version, cutting site-packages out of
sys.path before importing, does not test the app: it breaks the interpreter,
because stdlib codecs like `encodings.idna` are imported lazily and the
truncated path takes them down first. Observing what loaded is both stricter
and honest — it catches a third-party import anywhere in the run, including one
that only happens while serving.
"""
from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    child = textwrap.dedent(
        f"""
        import os, sys, json, tempfile, threading, urllib.request
        sys.path.insert(0, r"{REPO_ROOT}")
        os.environ["BRIDGE_TOUR_HOME"] = tempfile.mkdtemp(prefix="bridge_boot_")

        import server

        srv = server.build_server(0)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        port = srv.server_address[1]
        with urllib.request.urlopen(f"http://127.0.0.1:{{port}}/api/health", timeout=5) as r:
            assert '"ok": true' in r.read().decode().lower()
        with urllib.request.urlopen(f"http://127.0.0.1:{{port}}/tour", timeout=5) as r:
            assert "Bridge Tour" in r.read().decode("utf-8", "replace")
        srv.shutdown()

        # what did all of that actually load?
        outside = sorted({{
            name for name, mod in list(sys.modules.items())
            if getattr(mod, "__file__", None)
            and ("site-packages" in mod.__file__ or "dist-packages" in mod.__file__)
        }})
        print(json.dumps(outside))
        """
    )
    result = subprocess.run([sys.executable, "-c", child], capture_output=True, text=True)
    out = (result.stdout + result.stderr).strip()
    if result.returncode != 0:
        print(f"FAIL the app did not boot and serve:\n{out}")
        return 1
    third_party = json.loads(out.splitlines()[-1])
    if third_party:
        print(f"FAIL these are not standard library: {', '.join(third_party)}")
        return 1
    print("PASS boots and serves using only the standard library")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
