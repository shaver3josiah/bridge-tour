from __future__ import annotations

import argparse
import base64
import importlib
import json
import os
import queue
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import threading
import time
import urllib.parse
import zipfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional



VERSION = "1.0.0"
REPO_ROOT = Path(__file__).resolve().parent
def slugify(name: str) -> str:
    lowered = name.strip().lower()
    chars = [c if c.isalnum() else "-" for c in lowered]
    slug = "".join(chars)
    while "--" in slug:
        slug = slug.replace("--", "-")
    slug = slug.strip("-")
    return slug or "tour"


TOUR_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
TOURS_IO_LOCK = threading.Lock()


def get_tours_dir() -> Path:
    """Where tours live. Beside the app by default, so a clone is entirely
    self-contained and moving the folder moves the work with it. BRIDGE_TOUR_HOME
    overrides that for anyone who wants their tours on another drive — and it is
    what the tests set, so a test run can never touch real work."""
    override = os.environ.get("BRIDGE_TOUR_HOME")
    if override:
        return Path(override) / "tours"
    return REPO_ROOT / "tours"


def tour_dir(tour_id: str) -> Optional[Path]:
    if not TOUR_ID_RE.match(tour_id):
        return None
    return get_tours_dir() / tour_id


def load_tour(tour_id: str) -> Optional[dict]:
    tdir = tour_dir(tour_id)
    if tdir is None:
        return None
    path = tdir / "tour.json"
    with TOURS_IO_LOCK:
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None


def save_tour(tour: dict) -> None:
    tdir = tour_dir(tour["id"])
    if tdir is None:
        raise ValueError(f"bad tour id {tour['id']!r}")
    path = tdir / "tour.json"
    with TOURS_IO_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        _write_tour(path, tour)


TOUR_SCHEMA_VERSION = 1


def _write_tour(path: Path, tour: dict) -> None:
    """Serialise a tour. Caller must already hold TOURS_IO_LOCK.

    Every write goes through here, so the version stamp goes here too rather
    than at each of the three call sites that would have to remember it. The
    field is a marker for a future reader, not a gate: nothing refuses a
    document for lacking it, because every tour written before today lacks it
    and they all still load.
    """
    tour["v"] = TOUR_SCHEMA_VERSION
    path.write_text(json.dumps(tour, indent=2), encoding="utf-8")


def save_tour_if_current(tour: dict, seen: Optional[str]) -> Optional[dict]:
    """Write a tour only if nobody else wrote it since the client last read.

    Compare-and-swap under ONE hold of the lock. The version this replaces did
    the reading in handle_tour_save and the writing in save_tour, each taking
    and releasing the lock separately, with the request's own body read sitting
    in between. Every request gets its own thread (ThreadingHTTPServer), so two
    editors posting the same `updated` both passed the comparison and the later
    write silently won — which is the exact loss the comparison was added to
    prevent. Reading the body is still done by the caller, outside the lock; it
    waits on a client and must not hold the tours directory while it does.

    Returns the written document, or None when the client is working from a
    version that is no longer on disk.
    """
    tdir = tour_dir(tour["id"])
    if tdir is None:
        raise ValueError(f"bad tour id {tour['id']!r}")
    path = tdir / "tour.json"
    with TOURS_IO_LOCK:
        # A delete can land between the caller's load_tour and this lock. The
        # old code shrugged (current = {}) and then mkdir'd the folder back
        # into existence — a ghost tour whose media was already in the trash.
        # Gone is gone: the client gets the same 409 a stale save gets, and
        # the tour it was editing is in tours/.trash if they want it back.
        if not path.exists():
            return None
        try:
            current = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            current = {}
        # A payload with no "updated" at all is a first save or a non-browser
        # client and is let through unchanged, as it always was.
        if seen and current.get("updated") and seen != current["updated"]:
            return None
        tour["created"] = current.get("created", tour.get("created"))
        tour["updated"] = datetime.now(timezone.utc).isoformat()
        path.parent.mkdir(parents=True, exist_ok=True)
        _write_tour(path, tour)
    return tour


def list_tours() -> list[dict]:
    root = get_tours_dir()
    if not root.exists():
        return []
    items = []
    for entry in root.iterdir():
        candidate = entry / "tour.json"
        if candidate.exists():
            try:
                items.append(json.loads(candidate.read_text(encoding="utf-8")))
            except Exception:
                continue
    items.sort(key=lambda item: item.get("updated", ""), reverse=True)
    return items


def new_tour(name: str) -> dict:
    slug = slugify(name)
    tour_id = f"{slug}-{secrets.token_hex(3)}"
    now = datetime.now(timezone.utc).isoformat()
    tour = {
        "id": tour_id,
        "name": name,
        "created": now,
        "updated": now,
        "settings": {},
        "scenes": [],
    }
    save_tour(tour)
    return tour


# Two things must not be collected: an upload that has not been referenced by a
# save yet (confirmed data-loss race), and media belonging to a scene the editor
# can still bring back with undo. The undo stack lives in memory, so it never
# outlives the page; a day covers any single editing session with room to spare,
# and orphans still get collected on the first save after that.
PRUNE_GRACE_SECONDS = 24 * 60 * 60


def seed_sample_tour() -> None:
    """On FIRST run only, drop one ready-made demo tour into the tours folder so
    a new user has something to walk through before they own any 360 photos.
    Pure file copy — the sample panoramas ship in the repo, so this needs no
    camera and no image libraries.

    Deleting the sample is the user saying they are done with it, so a marker
    file records that and the sample never comes back. Without it, every
    restart re-created a tour the user had already thrown away."""
    src = REPO_ROOT / "tour" / "sample"
    if not (src / "tour.json").exists():
        return
    tours = get_tours_dir()
    seeded = tours / ".sample-seeded"
    dest = tours / "sample-tour"
    if seeded.exists() or dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest)
    seeded.write_text("the sample tour has been placed once; delete this to get it back\n", encoding="utf-8")


def prune_tour_files(tour: dict) -> None:
    """Delete uploaded files no longer referenced anywhere in the tour doc."""
    tdir = tour_dir(tour["id"])
    files_dir = tdir / "files" if tdir else None
    if files_dir is None or not files_dir.exists():
        return
    # ponytail: substring check against the JSON blob; safe because filenames
    # are server-generated hex tokens, revisit if filenames ever become user-chosen
    blob = json.dumps(tour)
    now = time.time()
    for f in files_dir.iterdir():
        if f.name in blob:
            continue
        try:
            if now - f.stat().st_mtime < PRUNE_GRACE_SECONDS:
                continue
        except OSError:
            continue
        f.unlink(missing_ok=True)


def parse_content_type(header: str) -> tuple[str, dict[str, str]]:
    parts = header.split(";")
    main = parts[0].strip()
    params: dict[str, str] = {}
    for part in parts[1:]:
        if "=" in part:
            key, _, value = part.strip().partition("=")
            params[key.strip().lower()] = value.strip().strip('"')
    return main, params


def iter_multipart(body: bytes, boundary: str):
    delimiter = ("--" + boundary).encode("utf-8")
    for segment in body.split(delimiter)[1:-1]:
        if segment.startswith(b"\r\n"):
            segment = segment[2:]
        if segment.endswith(b"\r\n"):
            segment = segment[:-2]
        header_blob, sep, content = segment.partition(b"\r\n\r\n")
        if not sep:
            continue
        headers_text = header_blob.decode("utf-8", errors="replace")
        disposition = ""
        for line in headers_text.split("\r\n"):
            if line.lower().startswith("content-disposition"):
                disposition = line
        if not disposition:
            continue
        _, params = parse_content_type(disposition.split(":", 1)[1])
        yield params.get("name", ""), params.get("filename"), content


def parse_multipart(body: bytes, boundary: str) -> dict[str, dict]:
    fields: dict[str, dict] = {}
    for name, filename, content in iter_multipart(body, boundary):
        fields[name] = {"filename": filename, "content": content}
    return fields


def cors_headers(handler: "Handler") -> None:
    # Echo only local origins instead of "*": the API has destructive routes
    # (DELETE), so arbitrary websites must not pass a CORS preflight against it.
    # Non-browser clients (phone app, curl, Colab scripts) send no Origin header
    # and are unaffected — CORS is a browser-only gate.
    if not handler.path.startswith("/api"):
        return
    origin = handler.headers.get("Origin", "")
    host = urllib.parse.urlsplit(origin).hostname or ""
    if host in ("127.0.0.1", "localhost", "::1"):
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")


def send_json(handler: "Handler", status: int, payload) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def send_error(handler: "Handler", status: int, error: str, detail: str = "") -> None:
    send_json(handler, status, {"error": error, "detail": detail})


def send_bytes(handler: "Handler", status: int, data: bytes, content_type: str) -> None:
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(data)))
    cors_headers(handler)
    handler.end_headers()
    handler.wfile.write(data)


def send_file(handler: "Handler", path: Path, content_type: str) -> None:
    if not path.exists() or not path.is_file():
        send_error(handler, 404, "not_found", f"{path.name} not found")
        return
    # streamed, not read whole: a panorama runs to tens of MB
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(path.stat().st_size))
    cors_headers(handler)
    handler.end_headers()
    with path.open("rb") as source:
        shutil.copyfileobj(source, handler.wfile, 64 * 1024)


def read_body(handler: "Handler") -> bytes:
    length = int(handler.headers.get("Content-Length", 0) or 0)
    if length <= 0:
        return b""
    return handler.rfile.read(length)


def read_json_body(handler: "Handler") -> Optional[dict]:
    raw = read_body(handler)
    if not raw:
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


REPO_FILE_TYPES = {
    ".ipynb": "application/x-ipynb+json",
    ".md": "text/markdown; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
}


def handle_repo_file(handler: "Handler", folder: str, name: str) -> None:
    safe_name = Path(name).name
    if safe_name != name or safe_name.startswith("."):
        send_error(handler, 404, "not_found", "file not found")
        return
    path = REPO_ROOT / folder / safe_name
    content_type = REPO_FILE_TYPES.get(path.suffix.lower(), "application/octet-stream")
    send_file(handler, path, content_type)


_LAN_CACHE: Optional[list[str]] = None


def lan_addresses() -> list[str]:
    """Best-effort list of this machine's LAN addresses, for the Share panel.
    A UDP connect never sends a packet; it just makes the OS pick the outward
    interface, which is the address a phone on the same wifi can reach.

    Cached for the process lifetime: gethostbyname_ex is a real resolver
    call, and on a box whose own hostname does not resolve locally it can
    stall for the DNS timeout. Once is survivable; once per health request
    is a dead share panel in exactly the LAN mode this exists for."""
    global _LAN_CACHE
    if _LAN_CACHE is not None:
        return _LAN_CACHE
    found: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("192.0.2.1", 9))  # TEST-NET-1: never routed, never sent
            addr = probe.getsockname()[0]
            if addr and not addr.startswith("127."):
                found.append(addr)
    except OSError:
        pass
    # The probe follows the default route, and under a full-tunnel VPN that is
    # the tunnel — an address no phone on the site wifi can reach. The name
    # lookup surfaces the machine's other interfaces so the real wifi address
    # is at least in the list; the panel shows the first and names the rest.
    try:
        for addr in socket.gethostbyname_ex(socket.gethostname())[2]:
            if addr and not addr.startswith("127.") and addr not in found:
                found.append(addr)
    except OSError:
        pass
    _LAN_CACHE = found
    return found


SERVE_LAN = False


def handle_health(handler: "Handler") -> None:
    send_json(handler, 200, {"ok": True, "app": "bridge-tour", "version": VERSION, "port": handler.server.server_address[1], "lan": lan_addresses() if SERVE_LAN else []})


MAX_TOUR_UPLOAD_BYTES = 64 * 1024 * 1024

TOUR_FILE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
}


def handle_tour_app(handler: "Handler") -> None:
    send_file(handler, REPO_ROOT / "tour" / "index.html", "text/html; charset=utf-8")


def handle_tours_list(handler: "Handler") -> None:
    send_json(handler, 200, {"tours": list_tours()})


def handle_tours_create(handler: "Handler") -> None:
    payload = read_json_body(handler)
    if payload is None:
        send_error(handler, 400, "bad_request", "invalid json body")
        return
    name = str(payload.get("name") or "untitled tour").strip() or "untitled tour"
    send_json(handler, 200, new_tour(name))


def handle_tour_get(handler: "Handler", tour_id: str) -> None:
    tour = load_tour(tour_id)
    if tour is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    send_json(handler, 200, tour)


def handle_tour_save(handler: "Handler", tour_id: str) -> None:
    existing = load_tour(tour_id)
    if existing is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    payload = read_json_body(handler)
    if payload is None or not isinstance(payload.get("scenes"), list):
        send_error(handler, 400, "bad_request", "expected a tour doc with a scenes list")
        return
    # Two editors on one tour used to overwrite each other in silence, because a
    # save posts the WHOLE document. If the client is working from a version
    # that is no longer the one on disk, refuse rather than clobber; the client
    # keeps its edits and decides. The comparison and the write happen under one
    # hold of the lock inside save_tour_if_current — see the note there for why
    # doing them separately did not actually stop the clobbering.
    payload["id"] = tour_id
    written = save_tour_if_current(payload, payload.get("updated"))
    if written is None:
        send_error(
            handler,
            409,
            "stale",
            "this tour was changed somewhere else since you loaded it",
        )
        return
    prune_tour_files(written)
    send_json(handler, 200, written)


TRASH_KEEP_DAYS = 30


def trash_dir() -> Path:
    return get_tours_dir() / ".trash"


def prune_trash() -> None:
    """Old deletions go for good; recent ones survive a regret. Runs at boot,
    not on a timer - a laptop tool restarts often enough."""
    root = trash_dir()
    if not root.exists():
        return
    cutoff = time.time() - TRASH_KEEP_DAYS * 24 * 60 * 60
    for entry in root.iterdir():
        try:
            if entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
        except OSError:
            continue


def handle_tour_delete(handler: "Handler", tour_id: str) -> None:
    """Confirmed-then-regretted used to have no recourse: delete was the one
    truly unrecoverable action in the app. Now it is a move into tours/.trash,
    kept for TRASH_KEEP_DAYS. Everything else still sees a deletion - the id
    regex refuses dotted names, so nothing in .trash is reachable over the API,
    and list_tours only reads direct children. Getting one back is a folder
    move, and docs/TOUR.md says so."""
    tdir = tour_dir(tour_id)
    if tdir is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    dest = trash_dir() / (tour_id + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    moved = False
    with TOURS_IO_LOCK:  # a save holds this while writing; never move mid-write
        if not (tdir / "tour.json").exists():
            send_error(handler, 404, "not_found", "tour not found")
            return
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            # os.rename, not shutil.move: .trash lives inside tours/, so this
            # is always a same-volume rename. move's failure fallback is a full
            # copy of the tour — gigabytes of work this global lock must never
            # be held across, and its half-copied wreckage in the trash was
            # worse than the plain erase below.
            os.rename(tdir, dest)
            moved = True
        except OSError:
            pass
    if moved:
        # A rename keeps the directory's own mtime — roughly when the tour was
        # CREATED — and pruning by that would give any tour older than the
        # keep window a zero-day regret period. Stamped in its OWN try, not
        # the rename's: the clock the prune reads must be the clock the
        # delete set, whatever else goes wrong around it.
        try:
            os.utime(dest, None)
        except OSError:
            pass
    else:
        # a locked file (antivirus, an open explorer window) must not leave the
        # tour half-moved and still listed — fall back to erasing, outside the
        # lock, because rmtree of a big tour takes seconds
        shutil.rmtree(tdir, ignore_errors=True)
    send_json(handler, 200, {"ok": True})


def handle_tour_file_upload(handler: "Handler", tour_id: str) -> None:
    tour = load_tour(tour_id)
    if tour is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    content_type = handler.headers.get("Content-Type", "")
    if "multipart/form-data" not in content_type:
        send_error(handler, 400, "bad_request", "expected multipart/form-data")
        return
    length = int(handler.headers.get("Content-Length", 0) or 0)
    if length > MAX_TOUR_UPLOAD_BYTES:
        send_error(handler, 413, "too_large", f"upload exceeds {MAX_TOUR_UPLOAD_BYTES // (1024 * 1024)}MB limit")
        handler.close_connection = True  # body was never read; keep-alive would misparse it
        return
    _, params = parse_content_type(content_type)
    fields = parse_multipart(read_body(handler), params.get("boundary", ""))
    file_field = fields.get("file")
    if file_field is None or not file_field.get("filename"):
        send_error(handler, 400, "bad_request", "missing file field")
        return
    ext = Path(file_field["filename"]).suffix.lower()
    if ext not in TOUR_FILE_TYPES:
        send_error(handler, 400, "bad_type", f"expected one of {sorted(TOUR_FILE_TYPES)}")
        return
    name = f"{secrets.token_hex(8)}{ext}"
    files_dir = tour_dir(tour_id) / "files"
    files_dir.mkdir(parents=True, exist_ok=True)
    (files_dir / name).write_bytes(file_field["content"])
    send_json(handler, 200, {"file": name, "url": f"/api/tours/{tour_id}/files/{name}"})


def handle_tour_duplicate(handler: "Handler", tour_id: str) -> None:
    tour = load_tour(tour_id)
    if tour is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    fresh = new_tour(f"{tour['name']} copy")
    src_files = tour_dir(tour_id) / "files"
    if src_files.exists():
        shutil.copytree(src_files, tour_dir(fresh["id"]) / "files")
    dup = dict(tour)
    dup.update(id=fresh["id"], name=fresh["name"], created=fresh["created"], updated=fresh["updated"])
    save_tour(dup)
    send_json(handler, 200, dup)


EXPORT_README = """This folder is a self-contained Bridge Tour website.

Host it on any static file host (GitHub Pages, Netlify, S3/R2, nginx...)
and open index.html from there. Opening index.html straight from disk will
NOT work: browsers block ES modules on file:// pages. For a quick local
look, run any static server in this folder, e.g.:

    python -m http.server 8000

then visit http://localhost:8000
"""


def export_manifest(tour: dict) -> dict:
    """What this zip is, so a folder found in three years still explains itself.

    An inspection deliverable that cannot say which structure it is, when it was
    walked and who walked it is an archive of anonymous photographs. Everything
    here is derived from the tour rather than asked for again, so it cannot
    disagree with the record it ships beside.
    """
    # Defensive about shape on purpose: handle_tour_save only validates that
    # "scenes" is a list, so a hand-edited or third-party doc can put anything
    # inside it. Before this, one non-dict scene raised AttributeError and took
    # the WHOLE export down with a 500 — a regression against the pre-change
    # export, which never looked inside the document at all.
    scenes = [s for s in (tour.get("scenes") or []) if isinstance(s, dict)]
    defects = [
        h
        for s in scenes
        for h in (s.get("hotspots") or [])
        if isinstance(h, dict) and h.get("type") == "defect"
    ]
    inspection = tour.get("inspection")
    if not isinstance(inspection, dict):
        inspection = {}
    return {
        "app": "bridge-tour",
        "tour": {"id": tour.get("id"), "name": tour.get("name")},
        "inspection": {
            "structureId": inspection.get("structureId"),
            "date": inspection.get("date"),
            "inspectedBy": inspection.get("by"),
            "sheet": inspection.get("sheet"),
        },
        "counts": {
            "scenes": len(scenes),
            "defects": len(defects),
            # which of the eleven NBIS stops carry at least one photo
            "photoStopsCovered": len(
                {s["stop"] for s in scenes if isinstance(s.get("stop"), str)}
            ),
        },
        "defectCodes": sorted(
            (h["code"] for h in defects if isinstance(h.get("code"), str)),
            key=lambda c: int(c[1:]) if c[1:].isdigit() else 0,
        ),
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "viewer": {"photoSphereViewer": "5.14.3", "three": "0.184.0"},
        "note": (
            "360 capture supplements the inspection record; it does not replace "
            "hands-on NBIS judgement or access requirements."
        ),
    }


def handle_tour_export(handler: "Handler", tour_id: str) -> None:
    """Zip a tour into a static site: viewer html + vendored libs + media."""
    tour = load_tour(tour_id)
    if tour is None:
        send_error(handler, 404, "not_found", "tour not found")
        return
    html = (REPO_ROOT / "tour" / "index.html").read_text(encoding="utf-8")
    # import-map addresses must be absolute or start with / ./ ../ — bare
    # "vendor/x.js" is rejected by the spec, so rewrite to "./vendor/x.js"
    html = html.replace("/tour/vendor/", "./vendor/")
    html = html.replace(
        "<body>",
        f"<body>\n<script>window.BRIDGE_STATIC_TOUR = {json.dumps(tour)};</script>",
        1,
    )
    # built on disk, not in memory: a tour of 40 panoramas is gigabytes
    fd, tmp_name = tempfile.mkstemp(suffix=".zip", prefix="orbit-export-")
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("index.html", html)
            z.writestr("README.txt", EXPORT_README)
            z.writestr("manifest.json", json.dumps(export_manifest(tour), indent=2))
            # the full doc, not just the manifest summary: this is what makes an
            # export importable again - the site is also the backup
            z.writestr("tour.json", json.dumps(tour, indent=2))
            for f in sorted((REPO_ROOT / "tour" / "vendor").iterdir()):
                if f.suffix in (".js", ".css"):
                    z.write(f, f"vendor/{f.name}")
            files_dir = tour_dir(tour_id) / "files"
            if files_dir.exists():
                for f in sorted(files_dir.iterdir()):
                    z.write(f, f"files/{f.name}")
        handler.send_response(200)
        handler.send_header("Content-Type", "application/zip")
        handler.send_header("Content-Disposition", f'attachment; filename="{tour_id}.zip"')
        handler.send_header("Content-Length", str(tmp_path.stat().st_size))
        cors_headers(handler)
        handler.end_headers()
        with tmp_path.open("rb") as source:
            shutil.copyfileobj(source, handler.wfile, 64 * 1024)
    finally:
        tmp_path.unlink(missing_ok=True)


MAX_IMPORT_BYTES = 1024 * 1024 * 1024  # a 40-photo bridge walk runs to hundreds of MB


class _AbortImport(Exception):
    """Carries the refusal (status, code, message) out of the copy loop, so the
    cleanup can run BEFORE the response is sent. The first version sent the
    error inline and cleaned up in the handler — and a client that reacted to
    the 413 immediately could list the tours while rmtree was still chewing
    through the half-written file, and see the orphan mid-deletion."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def handle_tour_import(handler: "Handler") -> None:
    """The other half of export.zip: feed one back in and the tour returns -
    a laptop swap, a colleague's copy, or the backup that outlived the machine.

    Spooled to disk rather than read into memory, because a real tour zip is
    hundreds of MB and ZipFile needs a seekable file anyway. Only files/* and
    tour.json are read out of it; index.html, vendor and anything else in the
    zip are ignored, so a tampered or merely unusual zip can add nothing the
    server would ever serve. Every media file must be referenced by the doc,
    carry an extension a tour can contain, and decompress inside the same
    per-file cap the upload route enforces — plus a total budget, because a
    zip's size on the wire says nothing about its size on disk."""
    length = int(handler.headers.get("Content-Length", 0) or 0)
    if length <= 0:
        send_error(handler, 411, "length_required", "Content-Length required")
        return
    if length > MAX_IMPORT_BYTES:
        send_error(handler, 413, "too_large", "import exceeds 1GB")
        handler.close_connection = True  # body was never read; keep-alive would misparse it
        return
    content_type = handler.headers.get("Content-Type", "")
    if content_type and "zip" not in content_type and "octet-stream" not in content_type:
        # A soft guard, honestly sized: it refuses the no-preflight content
        # types a hostile page can send blind (text/plain, the form
        # encodings) — the decompression budgets below are the real defense.
        # An ABSENT header stays welcome, because the browser omits it when a
        # picked file has no extension mapping, which is exactly a backup
        # that lost its .zip suffix in transit — and that file imported fine
        # before this gate existed.
        send_error(handler, 400, "bad_request", "expected a zip upload")
        handler.close_connection = True
        return
    fd, spool_name = tempfile.mkstemp(suffix=".zip")
    os.close(fd)  # reopened below; a held descriptor would block the unlink on Windows
    spool_path = Path(spool_name)
    try:
        # spooled INSIDE the try: a client that aborts mid-upload raises out
        # of rfile.read, and the half-written spool must not outlive it
        with open(spool_path, "wb") as spool:
            remaining = length
            while remaining > 0:
                chunk = handler.rfile.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                spool.write(chunk)
                remaining -= len(chunk)
        if remaining > 0:
            send_error(handler, 400, "truncated", "upload ended before Content-Length bytes")
            handler.close_connection = True
            return
        try:
            zf = zipfile.ZipFile(spool_path)
        except zipfile.BadZipFile:
            send_error(handler, 400, "bad_zip", "that file is not a zip")
            return
        with zf:
            names = set(zf.namelist())
            doc = None
            # file_size is the member's own declared decompressed size; a lying
            # header is caught later by the counted copy, but reading the doc
            # is a full in-memory decompress, so the claim is checked first.
            if "tour.json" in names and zf.getinfo("tour.json").file_size <= 8 * 1024 * 1024:
                try:
                    doc = json.loads(zf.read("tour.json").decode("utf-8"))
                except Exception:
                    doc = None
            if doc is None and "index.html" in names and zf.getinfo("index.html").file_size <= 64 * 1024 * 1024:
                # exports made before tour.json rode along inline the doc into
                # the page; recover it from there rather than turning them away
                page = zf.read("index.html").decode("utf-8", "replace")
                m = re.search(r"window\.BRIDGE_STATIC_TOUR\s*=\s*(\{.*?\});</script>", page, re.DOTALL)
                if m:
                    try:
                        doc = json.loads(m.group(1))
                    except Exception:
                        doc = None
            if not isinstance(doc, dict) or not isinstance(doc.get("scenes"), list):
                send_error(handler, 400, "bad_import",
                           "no readable tour.json in this zip - is it a Bridge Tour export?")
                return
            fresh = new_tour(str(doc.get("name") or "Imported tour"))
            tdir = tour_dir(fresh["id"])
            # Everything from here on sits inside the cleanup try: the tour
            # exists on disk the moment new_tour returns, so from that moment
            # any failure — even the mkdir — must take the orphan with it.
            try:
                files_dir = tdir / "files"
                files_dir.mkdir(parents=True, exist_ok=True)
                # Containment is "referenced anywhere in the doc", the same
                # rule prune_tour_files lives by — scene photos and thumbs,
                # but also hotspot close-ups, narration clips, background
                # audio, the logo. An allowlist of specific fields silently
                # dropped all but the first two, which was data loss on the
                # exact backup path this route exists for.
                blob = json.dumps(doc)
                budget = MAX_IMPORT_BYTES  # decompressed total; DEFLATE reaches 1000:1
                copied = 0
                for name in names:
                    if not name.startswith("files/"):
                        continue
                    base = Path(name).name
                    if not base or base != name[len("files/"):] or base not in blob:
                        continue
                    if Path(base).suffix.lower() not in TOUR_FILE_TYPES:
                        raise _AbortImport(400, "bad_import",
                                           f"{base} is not a file type a tour can contain")
                    # counted by hand: a zip member's size header can lie, so
                    # the budget is enforced on the bytes that actually arrive
                    written = 0
                    with zf.open(name) as src, open(files_dir / base, "wb") as out:
                        while True:
                            chunk = src.read(64 * 1024)
                            if not chunk:
                                break
                            written += len(chunk)
                            budget -= len(chunk)
                            if written > MAX_TOUR_UPLOAD_BYTES or budget < 0:
                                raise _AbortImport(413, "too_large",
                                                   f"{base} decompresses past the size a tour file may be")
                            out.write(chunk)
                    copied += 1
                doc["id"] = fresh["id"]
                doc["created"] = fresh["created"]
                doc["updated"] = datetime.now(timezone.utc).isoformat()
                save_tour(doc)
            except Exception as exc:
                # whatever went wrong — bomb, corrupt member, disk full — the
                # half-imported tour must not survive as an orphan. Cleanup
                # FIRST, response second: the moment the client hears the
                # refusal it may list the tours, and it must not see the corpse.
                shutil.rmtree(tdir, ignore_errors=True)
                if isinstance(exc, _AbortImport):
                    send_error(handler, exc.status, exc.code, exc.message)
                else:
                    send_error(handler, 400, "bad_import", "a file inside the zip could not be read")
                return
            send_json(handler, 200, {"ok": True, "id": doc["id"], "files": copied})
    finally:
        spool_path.unlink(missing_ok=True)


def handle_tour_file_get(handler: "Handler", tour_id: str, name: str) -> None:
    tdir = tour_dir(tour_id)
    safe_name = Path(name).name
    if tdir is None or safe_name != name:
        send_error(handler, 404, "not_found", "file not found")
        return
    content_type = TOUR_FILE_TYPES.get(Path(safe_name).suffix.lower(), "application/octet-stream")
    send_file(handler, tdir / "files" / safe_name, content_type)


GET_ROUTES: list[tuple[re.Pattern, object]] = [
    (re.compile(r"^/$"), lambda h, m: handle_tour_app(h)),
    (re.compile(r"^/tour$"), lambda h, m: handle_tour_app(h)),
    (re.compile(r"^/tour/view/([^/]+)$"), lambda h, m: handle_tour_app(h)),
    (re.compile(r"^/tour/vendor/([^/]+)$"), lambda h, m: handle_repo_file(h, "tour/vendor", m.group(1))),
    (re.compile(r"^/docs/([^/]+)$"), lambda h, m: handle_repo_file(h, "docs", m.group(1))),
    (re.compile(r"^/design/([^/]+)$"), lambda h, m: handle_repo_file(h, "design", m.group(1))),
    (re.compile(r"^/api/health$"), lambda h, m: handle_health(h)),
    (re.compile(r"^/api/tours$"), lambda h, m: handle_tours_list(h)),
    (re.compile(r"^/api/tours/([^/]+)/files/([^/]+)$"), lambda h, m: handle_tour_file_get(h, m.group(1), m.group(2))),
    (re.compile(r"^/api/tours/([^/]+)/export\.zip$"), lambda h, m: handle_tour_export(h, m.group(1))),
    (re.compile(r"^/api/tours/([^/]+)$"), lambda h, m: handle_tour_get(h, m.group(1))),
]

POST_ROUTES: list[tuple[re.Pattern, object]] = [
    (re.compile(r"^/api/tours$"), lambda h, m: handle_tours_create(h)),
    (re.compile(r"^/api/tours/import$"), lambda h, m: handle_tour_import(h)),
    (re.compile(r"^/api/tours/([^/]+)/files$"), lambda h, m: handle_tour_file_upload(h, m.group(1))),
    (re.compile(r"^/api/tours/([^/]+)/duplicate$"), lambda h, m: handle_tour_duplicate(h, m.group(1))),
    (re.compile(r"^/api/tours/([^/]+)$"), lambda h, m: handle_tour_save(h, m.group(1))),
]

DELETE_ROUTES: list[tuple[re.Pattern, object]] = [
    (re.compile(r"^/api/tours/([^/]+)$"), lambda h, m: handle_tour_delete(h, m.group(1))),
]


class Handler(BaseHTTPRequestHandler):
    server_version = f"BridgeTour/{VERSION}"
    protocol_version = "HTTP/1.1"

    def _dispatch(self, routes: list[tuple[re.Pattern, object]]) -> None:
        path = urllib.parse.urlsplit(self.path).path
        for pattern, func in routes:
            match = pattern.match(path)
            if match:
                try:
                    func(self, match)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                except Exception as exc:
                    send_error(self, 500, "internal_error", str(exc))
                return
        send_error(self, 404, "not_found", f"no route for {path}")

    def do_GET(self) -> None:
        self._dispatch(GET_ROUTES)

    def do_POST(self) -> None:
        self._dispatch(POST_ROUTES)

    def do_DELETE(self) -> None:
        self._dispatch(DELETE_ROUTES)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        cors_headers(self)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        pass


def build_server(port: int, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    parser = argparse.ArgumentParser(description="Bridge Tour server")
    parser.add_argument("--port", type=int, default=7360)
    parser.add_argument(
        "--lan",
        action="store_true",
        help="also listen on the local network, so a phone or tablet on the same wifi can open the tour (default: localhost only)",
    )
    args = parser.parse_args()
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    global SERVE_LAN
    SERVE_LAN = args.lan
    seed_sample_tour()
    prune_trash()
    server = build_server(args.port, host)
    print(f"Bridge Tour serving on http://127.0.0.1:{args.port}", flush=True)
    if args.lan:
        print(f"LAN mode: also reachable at http://<this-machine's-IP>:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
