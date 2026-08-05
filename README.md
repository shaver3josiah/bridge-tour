# Bridge Tour

Self-hosted 360° virtual tours for bridge inspection. Drop your panoramas in,
walk the structure, mark the defects, and hand over a tour that runs from a
folder — on your own machine, with no account, no monthly plan, no upload cap,
and no vendor watermark to pay to remove.

Built for the job an inspector actually has: come back from a structure with
forty photos and a notebook, and leave with a record somebody can walk through
a year later.

## Run it

Needs **Python 3**. Nothing else — no `pip install`, no build step, no
`node_modules`. The server is standard library only and the app is one HTML
file with its viewer vendored in.

Double-click **`start.bat`**, or:

```bash
python server.py
```

Then open <http://localhost:7360>. A sample tour is copied in on first run so
there is something to walk through before you own any 360 photos; delete it
whenever, and it stays deleted.

## What it does

**Takes the photos you actually have.** A true 2:1 equirectangular export is
the ideal case, but a phone sweep, a Google "Photo Sphere", or an ordinary
snapshot all become scenes — each mapped onto however much of the sphere it
really covers, read from GPano metadata where the camera wrote it and guessed
from the aspect ratio where it did not. What a photo does not cover takes its
sky and ground colours from the photo itself rather than showing black.

**Links itself together.** *Connect scenes for me* chains the walk from EXIF
GPS where the photos carry it and from capture order where they do not, aiming
each arrow at an opening the photo suggests is walkable rather than at a raw
bearing. Every link is two-way, so there are no dead ends.

**Knows which way each photo faces — even when the camera didn't.** A compass
heading comes from EXIF `GPSImgDirection`, from a photo sphere's XMP, or from
where the sun sits in the frame (which no amount of steel can deflect, unlike a
magnetic compass on a bridge). Failing all three, bearings are carried between
photos that share a skyline, or read off links you placed by hand — and every
one of them is a draggable arrow on the plan.

**Draws a plan of the walk.** Every photo becomes a dot on a plate ruled in
metres, positioned by GPS, by hand, or laid along the walk's own axis as an
honest guess you can drag home. Links are drawn between the dots, one-way ones
dashed so a dead end is visible before anybody walks into it. Defect counts
ride on the photos that carry them.

**Records an inspection.** NBIS photo stops, elements and stations, nine defect
types with the measurement fields each one needs, a defect register that
exports as CSV in the same columns as the field-sketch tool, and a printable
photo log.

**Exports as a folder, imports as one too.** One ZIP containing a
self-contained website: unzip it onto Netlify, S3, a shared drive, or any web
server, and the tour runs with no server of ours anywhere in the picture. The
same zip is the backup — *Import tour* on the home page brings it back whole,
so a laptop swap or a colleague's copy is one round trip.

**Hard to lose work.** Deleted tours sit in `tours/.trash` for 30 days.
Start the server with `--lan` and the Share panel shows a link phones on the
same wifi can open.

Full walkthrough: **[docs/TOUR.md](docs/TOUR.md)**.

## The plan view

[`design/plan-view-20.html`](design/plan-view-20.html) is the plan plate
carrying a whole twenty-photo bridge, as a self-contained page that needs no
server — the fastest way to see how it reads at the size a real job makes it.
Open it in a browser; drag the arrows.

It is generated from the app's own stylesheet and geometry rather than drawn by
hand, so it cannot drift from what ships:

```bash
node design/plan_preview.mjs
```

## Tests

```bash
node tests/tour_pano_test.mjs
```

The panorama, bearing, plan and defect-register maths, lifted out of
`tour/index.html` so the checks run against the code that ships rather than a
copy of it. Needs Node; everything else needs only Python.

```bash
python tests/tour_smoke_test.py
python tests/test_stdlib_boot.py
```

The server API end to end, and a guard that the whole thing still boots on a
machine with no third-party Python libraries at all.

`test.bat` runs all three.

## Honest limits

- Phone GPS is good to a few metres, so a plan built from it is a sketch. Drag
  the dots; the plate says which ones were measured and which were guessed.
- Bearings carried between photos need the two to share a view. Photos of
  repetitive structure — a row of identical piers — are refused rather than
  matched, because a confident answer there is a 180°-wrong one.
- The vehicle mark is a coloured-mass finder with a plausible width, not a
  classifier. It will point at a skip or a site cabin just as happily.

## Licence

MIT. See [LICENSE](LICENSE).
