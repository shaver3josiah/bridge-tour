# Bridge Tour

A self-hosted replacement for Kuula.co Pro. Your 360° photos become an
explorable virtual tour that lives on your machine, embeds in any website,
and exports as a folder you can host anywhere.

Nothing is uploaded to a third party, there is no monthly plan, no upload
cap, and no vendor watermark to pay to remove.

## Start it

Needs only **Python 3** — no libraries to install, no `setup.ps1`.

Double-click **`start.bat`**. It starts the server and opens the app. If Python
isn't installed it tells you where to get it. That's the whole setup.

Or from a terminal:

```bash
python server.py
```

It opens itself in your browser, normally at <http://localhost:7370>. If
something else already holds that port it steps to the next free one and
prints which; `--port` pins it, `--no-browser` skips the auto-open.

On first run a **"Sample Apartment"** tour is copied in so you have something
to walk through before you own any 360 photos. Delete it whenever — it's a
normal tour, and deleting it sticks: it won't come back on the next start.
Deleting anything — a tour, a scene, a hotspot — is two clicks on purpose:
the button turns into **Confirm delete?** (a scene or hotspot just says
**Confirm?**) and only fires if you click it again within a few seconds.
And a deleted tour is not gone: it moves to `tours/.trash` and stays there
for 30 days from the moment you deleted it. Getting one back: move its folder
up one level into `tours/`, rename it to drop the `-20260805T…Z` timestamp the
delete appended, and restart. Delete was the one truly unrecoverable action in
the app, and now it is not.

**Import tour**, next to *New tour*, accepts the `export.zip` this app
produces and brings the whole tour back — scenes, defects, photos. The export
is not just the shareable site; it is the backup, and a laptop swap or a
colleague's copy is one round trip through it.

## Make a tour

1. **New tour** — name it, and the editor opens.
2. **Drop photos** into the left panel. Each becomes a scene — nothing is
   turned away for its shape any more:
   - A true 2:1 equirectangular photo (the Insta360 export) is still the
     ideal case, and becomes a full 360×180 sphere.
   - A photo carrying GPano metadata (Google Camera's "Photo Sphere", some
     phone panoramas) has its exact covered slice read straight out of the
     metadata — no guessing.
   - A phone sweep panorama (a wide strip, no metadata) has its width
     guessed from its aspect ratio and mapped onto the matching patch of
     sphere. The guess can be corrected afterwards — see the next step —
     and whatever it doesn't cover is filled with the sky and ground
     colours taken from the photo itself, rather than left black.
   - An ordinary snapshot becomes a small window in the sphere.

   A JPEG, PNG, or WebP photo uploads exactly as it came off the camera —
   none of those are re-encoded. HEIC/HEIF photos, and anything else only
   some browsers can decode, are converted to JPEG in the browser before
   upload, at quality 0.95 and capped to whatever this machine's graphics can
   hold as a texture (beyond that the viewer would scale it down anyway), so
   an exported tour renders everywhere it's shared. Some browsers — Chrome on
   Windows, for one — cannot decode HEIC at all; the editor's error message
   explains how to get JPEGs off an iPhone instead. Scene thumbnails in the
   list are sharp even on a high-density screen.

   A photo that fails to upload no longer pops its own toast that erases the
   one before it — failures collect into a single persistent line under the
   drop zone, grouped by reason rather than by file, so a folder of HEICs
   that all fail the same way on Windows reads as one sentence with a count
   instead of a flurry of vanishing messages. That line says what kind of
   file is wanted and whether the server is reachable, instead of the
   server's raw internal file-type list or a bare "Failed to fetch".
3. **Correct the shape, if it needs it.** Whichever scene you're editing,
   the sidebar's **This scene** section shows two sliders: **Width**, how
   many degrees across the photo covers (30–360, the sphere reshapes live
   as you drag), and **Tilt**, the elevation of the photo's centre, for a
   shot aimed up or down. A note underneath states the resulting coverage,
   for example "Covers 200° across and 40° up and down. The rest takes its
   sky and ground from the photo." There's no separate vertical
   field-of-view control:
   an equirectangular projection shares one degrees-per-pixel scale across
   both axes, so the vertical coverage follows from the width and the
   photo's own aspect ratio. The same section also states the photo's actual
   pixel dimensions and whether it uploaded untouched or got converted, and
   warns you if it's wider than this machine's graphics can hold.
4. **Connect the scenes.** Click **+ Link**: the hotspot follows your
   pointer around the panorama — already showing the shape, size, and
   opacity it will actually have — until you click the spot where the way
   there is. The hotspot panel then opens asking which scene it leads to,
   starting on *Choose a scene…* rather than guessing; until you pick one,
   the marker's tooltip reads "Not connected yet — click to choose a scene."
   The same cursor-following placement is used for *Info* and *URL*
   hotspots (next step) and for **Move**.

   For laying out a whole floor at speed, **Build links** is the quicker
   alternative: it arms a target scene first, so you click doorway after
   doorway without opening a panel each time. Click **Build links** to enter
   build mode. A blue bar appears under the toolbar reading *Walk to*, with a
   row of scene chips — thumbnail and name, ticked if this scene already
   links there. Click a chip to arm it, then click the spot in the panorama
   where the way there is. Build mode stays on afterwards, so you can keep placing
   links — walking the tour scene to scene, laying arrows as you go —
   without opening a menu each time, and it survives switching scenes.
   **Add the way back too**, ticked by default, also creates the reverse
   link in the target scene, so you never get a one-way dead end. Escape,
   or **Done linking**, exits build mode. Clicking into the part of a
   partial panorama the photo doesn't cover, or onto an existing hotspot
   while a link is armed, both used to do nothing — the first now says the
   photo doesn't reach that far, the second now places the link there anyway.

   Every photo dropped in is also read for the directions in it that look
   walkable — a doorway, a hallway, an opening — and any link the automatic
   linker places is nudged onto the nearest of those guesses instead of
   aiming at a raw bearing or the middle of the photo.

   Rather than placing every link by hand, **Connect scenes for me** in the
   left panel takes a guess, and the sidebar prints which of two tiers it
   used. With two or more photos carrying an EXIF GPS fix, it links each
   scene to its two nearest neighbours within 60 metres; if those photos
   also recorded a compass heading (GPSImgDirection), each arrow is aimed
   from it, otherwise the sidebar says the directions are guessed. Phone GPS
   is only good to a few metres, so it's worth checking each arrow anyway.
   With no GPS at all, it chains the scenes in the order they were added —
   the order the walk was shot in — and any photo with no location is
   chained to its list neighbours so it never drops out of the tour. Every
   link is made both ways, existing links are never duplicated, and the
   whole run is one Ctrl+Z.

   Two things sharpen those arrows without a compass. **The sun**: a photo
   that carries a GPS fix and a UTC timestamp (GPSDateStamp/GPSTimeStamp, not
   the zone-less DateTimeOriginal) and has the sun visible in frame gets its
   true heading from where the sun sits, because the sun's real bearing at
   that time and place is calculable to a hundredth of a degree. This matters
   on a steel structure, where a magnetic compass can read tens of degrees
   out: measured on generated fixtures, the recovered heading landed within
   1° of truth. It never overwrites a heading the camera recorded — where the
   camera wrote a *magnetic* bearing and the sun disagrees by more than 15°,
   the scene panel shows both and leaves the call to you. Nothing is claimed
   unless the bright thing in frame is at the height the sun must actually be
   at, which is what stops a floodlight or a reflection off water being read
   as the sun. **Shared landmarks**: two photos that see the same piers and
   parapet can measure how far one is turned from the other, which aims the
   return arrow properly instead of assuming both photos face the same way.
   It refuses far more often than it answers — a repeating row of piers or a
   featureless soffit gets no answer at all rather than a confident wrong one.

   It also runs on its own right after a drop
   of photos that don't yet connect to anything, so a tour never sits
   unlinked just because nobody clicked the button — it steps aside once the
   arriving scenes already have links, so it won't fight you mid-edit.

   A small red dot next to a scene in the list means nothing links to it
   yet (and it isn't the start scene) — it would be unreachable in the
   finished tour. A line under the list also states how many scenes that
   is, in case the dot itself is easy to miss.
5. **Add detail.** *+ Info* and *+ URL* place the same way as
   a link — click the button, click the spot in the panorama — and then open
   a panel: a title, text, an image, and an audio clip for Info; an external
   page (opened in a new tab) for URL. Click any hotspot — a link arrow
   included — to reopen this same panel and choose its look: a row of shapes
   (Circle, Square, Diamond, Ring, Dot, and, for a link only, Arrow on the
   floor — the viewer's own arrow, which is the one shape that lies flat on
   the ground; Square is the default for links, Circle for the rest), a Size
   slider, and an Opacity slider. Hotspots stand upright facing you rather
   than lying on the path, and a link's arrow points up — forward, the way
   you'd walk. Leave all three untouched and a hotspot looks exactly as it
   always did. The next hotspot you place — by hand or
   via Connect scenes for me — inherits whatever the last one was styled as,
   so a look gets chosen once rather than forty times.

   To reposition a hotspot, press it and drag — the panorama holds still and
   the hotspot follows your pointer, touch included. The grab area reaches
   18px beyond the hotspot itself, so even the smallest dot has a target
   worth touching, and hovering one glows to show it. One drag is one Undo.
   A press and release with no movement in between opens the panel instead
   of doing nothing. **Move**, in the same panel, is kept as the way to do
   it without a pointer.
6. **Mark the defects.** Every defect panel has **+ Another like this**:
   it places the next defect of the same type and measurements on your next
   click, and keeps going — ten spalls on one soffit are ten clicks, not ten
   panel round-trips. The code and the note are never copied (the code is the
   register's primary key), and Escape stops the run. Each mark's panel is one
   click away whenever one of the ten needs its own note.
7. **Aim each scene.** Drag to the view a visitor should land on, then
   *Set start view from here*.

   Until you do, a photo opens on whichever of two readings it supports,
   rather than on the middle of the file: someone in hi-vis standing out in
   the scene, who on an inspection is usually at the thing being inspected;
   or, failing that, whichever way whoever held the camera was looking, read
   off the top of their head at the base of the photo. A hi-vis hit at the
   base of the photo is the person holding the stick — they are directly
   below the camera, so their bearing points at nothing, and it is discarded
   rather than aimed at. The sidebar says which reading a scene used, and
   *Set start view from here* replaces it for good.
8. **Try it, then share.** **Start tour**, in the toolbar, saves and runs the
   real viewer in a frame right over the editor, so you can click through
   your own links and come back — **Back to editing**, or Escape, closes it.
   **Preview tour**, in the Share panel, opens the same tour in a separate
   tab instead, the right one to send someone else to look at.

In the Share panel, when the server was started with `--lan`
(`python server.py --lan`, from any machine on the site wifi), a second link
appears that phones and tablets on the same network can open directly — the
address is the machine's own wifi address, worked out for you. Without
`--lan` the panel says how to turn it on. Under the export button, the panel
also says where the zip can go: Netlify Drop for a free public link, or any
web host.

First-time visitors to a shared tour get one sentence — *Drag to look
around · click an arrow to walk through* — which disappears the moment they
do either, or after eight seconds, and never comes back on that browser.

Everything saves as you work — the status under the tour name reads
*Saving…* then *Saved*. A failed save retries on its own and says so.

## Record an inspection

Bridge Tour also speaks the vocabulary of the field-sketch tool, so one
structure's 360 record and its sketch register can be read side by side.

**The title block.** Under the tour name, **Inspection** holds the same four
fields the sketch tool asks for — Structure ID, inspection date, inspected by,
sheet. The date fills itself in from the first photo's EXIF capture time if you
leave it empty, and never overwrites one you typed.

**Tagging a photo.** *This scene* gains three fields: the **required photo
stop** it covers, the **element** in view (free text, with the usual bridge
vocabulary as suggestions), and the **station**, written the way stations are
written — `2+50`.

**Defects.** **+ Defect** places a marker where the defect is, numbered `D1`,
`D2`, `D3` across the whole tour. The marker wears its own code in a red ring so
a reviewer can call out "D7" without opening anything. The nine types and their
measurement increments are the sketch tool's exactly: a spall takes a depth
(1/4, 1/2, 1, 2, over 2 in) and a *reinforcement exposed* tick; a crack or map
cracking takes a width (hairline, 1/16, 1/8, 1/4, over 1/4 in); the rest are
recorded by note and photo, because that is all the sketch tool measures either.
Switching a defect's type clears a measurement that no longer applies, so a
register never carries a number nobody typed.

**Coverage.** The Inspection panel lists the eleven NBIS photo stops and ticks
each one that has a photo filed against it. A tick means *filed*, not *shown* —
this cannot see a bearing. 360 capture supplements the inspection record; it
does not replace hands-on judgement.

**The paperwork.** The Share panel offers **Download defect register (CSV)** —
Code, Type, Measure, Scene, Photo stop, Element, Station, Note, sorted so D9
comes before D10 — and **Print photo log**, which lays out one row per defect
with its photo, code, measure and station under the title block, for Print to
PDF. Both are built in the browser from the tour document, so they need no
server: in a **standalone export** the same two appear in the viewer's own
toolbar, whenever the tour carries any defects. That matters, because the
export is the folder an owner actually archives — a zip holding the walk but
neither the register nor the log would be a slideshow, not a record.

## Getting around a big tour

A forty-panorama bridge is a maze, so:

- **Ctrl+K** jumps to any scene or defect by name, station, element or code.
- The scene list **groups itself by photo stop** past eight scenes.
- **Plan view**, under the scene list — or full size over the panorama via
  the toolbar's **Map** button (**M**), which is the comfortable place to do
  everything below — draws the structure's own long axis and
  places every photo around it, north up, with the site's real proportions and
  the distance across it. Three kinds of dot, told apart by their drawing and
  counted in the note underneath: solid for a GPS fix, hollow and dashed for a
  photo placed by capture order because it had no fix, filled for one you moved
  yourself. **Drag any dot** to put a photo where it actually stood — the
  correction is stored in metres, so a later photo widening the site rescales
  the plate without sliding anything you have already fixed. *Undo my
  placements* clears them all. A guessed dot is a starting position, never a
  surveyed coordinate, and the plate says so.
  **Every link the tour has is drawn between the dots**, so the walk reads as a
  route rather than a scatter. A pair that walks both ways is a plain line; a
  link placed one way only is dashed and carries an arrow on the end that
  works, because from the far side it is a dead end. Links touching the photo
  you are editing are picked out in the accent colour.
  **Drop one dot on another and the two get connected**, both ways, in one
  gesture — while the drag is over another photo the dot springs back home and
  a dashed line follows the cursor, so the plate says which of the two things
  is about to happen. The outgoing arrow is aimed at the real bearing between
  the two positions whenever the photo also knows which way it was facing, and
  falls back to the same opening-finding the automatic pass uses when it does
  not. One Ctrl+Z undoes it. A dot too crowded to pick up is still a perfectly
  good thing to drop on, so linking never hits the pickable cap.
  **Click a link to cut it.** Both directions go, because half a cut pair
  leaves a one-way link nobody asked for. Ctrl+Z puts it back. Pointer only —
  the hotspot panel's delete button is the keyboard equivalent.
  The structure is drawn as a deck — a band with kerbs and an abutment tick
  across each end — along that long axis.
  **The grid is ruled in metres**, at a round 1-2-5 step, with a scale bar and
  a north mark to step distances off against. Without a GPS fix anywhere there
  is no scale to state and no north to know — and hand-tidying the dots does
  not change that — so it falls back to plain quarters, drops the north mark,
  and says so. Two real fixes are what size the site; correcting a GPS dot by
  hand keeps the scale they established.
  **A photo carrying defects wears the count**, so the register's findings sit
  on the ground they were found on rather than only in a flat CSV. **A photo
  nothing links to gets a red ring** — it is in the record but not in the walk.
  That reachability now has one definition shared with the scene list and the
  pre-share check; the scene list used to disagree with the other two and put
  an orphan dot on the very photo a visitor would land on whenever no start
  scene had been chosen.
  **Every photo wears an arrow for the way it looks, and you can turn it.**
  The direction is the same heading-plus-view-yaw sum the viewer's compass
  needle uses. It is a filled dart whose tip sits two dot-diameters out, sized
  off the dot rather than off the plate, so zooming never inflates the arrows
  away from the marks they belong to. The photo you are editing has its arrow
  in the accent colour and the rest are quiet; a photo that never recorded a
  heading gets a hollow one instead, exactly as a hollow dot means "guessed" —
  "not aimed yet" must not look like "aimed due north". Hollow arrows appear
  only on the photos you can currently pick up, since a handle nobody can reach
  is just clutter.
  **Drag an arrow round to say which way that photo faces**, or focus it and
  press the arrow keys (Shift for 15° instead of 5°). That is the only way to
  give a bearing to a tour whose camera never recorded one, and it feeds
  everything a recorded bearing feeds: the viewer's compass starts working, the
  plan aims new link arrows at real bearings, and the vehicle crossing gains
  another sighting. Ctrl+Z undoes a turn. Where a hand aim overrules a bearing
  the camera measured, the number it replaced is kept and printed in **This
  scene**, so a measurement is never silently lost.
  **A photo opens where somebody pointed.** Whoever holds the stick stands
  directly under the camera, so their head lands at the base of the frame — and
  if they throw an arm out at what they want photographed, that is the one
  instruction in the picture aimed at whoever reads it a year later. The
  editor reads it: everything belonging to a person underfoot sits near the
  nadir, and how far above the nadir a thing appears is how far it reaches out
  from them on the ground, so the direction bare skin climbs furthest is the
  fist. The scene opens on that bearing, level with the horizon.

  Failing a pointed arm, it looks for somebody in hi-vis standing out in the
  scene — and which way they are TURNED flips where it aims. Back to the
  camera and they are looking onward past themselves, so it aims at them and
  beyond, which on an inspection is the thing they walked over to. Facing the
  camera and they are looking back down the way you came, so what held their
  attention is behind you: it turns around.

  Telling those two apart cannot be done on skin. Hair cropped to the scalp is
  skin, so the back of a head passes a colour test for a face without
  difficulty — which would turn every photo of somebody walking away by 180°.
  What a face has that the back of a head has not is a **dark bar across it**:
  sunglasses on a site in daylight, or failing those the shadow of brow and
  eye sockets, with lit cheek and jaw below. That arrangement is the one the
  back of a scalp never makes. It needs the head to be worth more than a
  handful of pixels, so it declines on anybody far enough away to be small in
  frame rather than tossing a coin.

  Failing all of that, it reads the crown of the head underfoot — from
  directly above, the only skin up there is the face, and it sits at the
  bearing they are turned to. **This scene** always says which reading it
  used.

  It refuses rather than guesses when nobody is under the camera at all: rust,
  bare timber and dry soil all pass a colour test for skin, and one stain in
  one direction has exactly the shape of an arm. The cheap question that
  separates them is whether a person is there — which on a bridge is worn by
  law, and in a living room means it will decline and use the head instead.

  **Bearings fill themselves in.** A photo that has none gets one worked out
  from two means that need nothing from the camera. This is not a button: it
  runs whenever the evidence changes — photos arriving, links being drawn, a
  photo moved to where it stood, an arrow turned by hand, and once when a tour
  is opened, so tours made before any of this existed get their bearings the
  first time you open them.
  - *Shared views.* Two photos of the same place taken a few metres apart
    share their skyline, and the editor already measures how far one is turned
    from the other (the same matching that aims return arrows). So a bearing on
    one photo carries to every photo that shares a view with it, and onward
    from there — aiming a single arrow by hand can give a whole walk its
    bearings. It travels at most three photos from a known one, because each
    hop adds a little angle error, and it refuses any pair the matcher is not
    sure about, including the row-of-identical-piers case where a confident
    answer would be 180° wrong.
  - *The plan itself.* A link you placed by hand says "the way to B is over
    there", and the plan says where B is; the difference is this photo's
    bearing. Only a link whose angle somebody actually aimed counts — clicked,
    dragged, or taken off a real compass bearing. An arrow the automatic linker
    guessed is a perfectly good way to walk to the next photo and no evidence at
    all about which way this one faces; reading one back would guess an arrow off
    nothing, derive a bearing off the arrow, then present the result as worked
    out. Links carrying no mark at all — every link in every tour built before
    this — count as guesses, because most of them were. Both photos also have to
    be really placed (GPS or your own hand, never a capture-order placeholder)
    and at least 10 m apart, since phone GPS is good to a few metres and a
    bearing across a 4 m baseline is mostly the error in where the two dots
    stand. Two links that disagree by more than 25° produce nothing rather than
    an average.

  A photo whose neighbours cannot agree about it within 20° gets nothing rather
  than the winner of a coin toss: the search takes the best route and stops,
  which is right when there is one route and wrong when there are several.

  When bearings are worked out as a tour opens, the sidebar says how many
  and where they came from, and that Ctrl+Z takes the lot back — quiet, but
  never invisible. Each derived arrow's tooltip names its source ("carried 2
  photos from one that knows", "read off the map"), and the further a bearing
  travelled to reach a photo, the more the wording suggests a glance.

  On the plate, a photo set aside for carrying a fix from somewhere else gets
  a warning chip under the note — one click selects it, so dragging it home is
  the next motion.

  It only ever fills silence. A bearing the camera recorded, or one you turned
  by hand, is never touched — what it replaces is not a different answer but no
  answer at all: no compass in the viewer, no real angle on the plan, link
  arrows aimed by guesswork. A *derived* bearing does move, though, because the
  thing it was derived from can: turn one arrow by hand and everything that
  inherited from it re-follows, rather than being left pointing at an answer its
  own source has since moved away from. A derived bearing whose evidence has
  gone is *withdrawn* rather than left standing, so tightening these rules takes
  the bearings the looser ones produced back off the plate instead of leaving
  them there for ever. **This scene** says which means produced each one, every
  result is a turnable arrow, and Ctrl+Z undoes it.

  The expensive half — correlating every pair of photos — is cached on the
  photos themselves, which is what makes running it this often affordable: a
  photo's stored profile is written once at upload and never touched again, so
  each pair is measured once for the life of the editor rather than on every
  change.
  The full-size map's header carries three controls for working a crowded
  plate. **Zoom** grows it up to 4×. **Pinch on a trackpad**, or Ctrl+scroll,
  does the same thing about the pointer — what is under the cursor stays under
  it — and the slider follows along as the readout. Two fingers with no
  modifier is an ordinary scroll and pans the plate, as it always did; nothing
  intercepts it. The pointer anchor is exact in any direction the plate is big
  enough to scroll, and on a wide window that is up-and-down from the start but
  side-to-side only past about 2.4×, below which the plate still fits across
  the map and grows from its middle instead. **Labels**
  chooses what each dot says under itself — name, photo stop, station, or
  nothing. Past twelve photos it starts on *None*, because at twenty the names
  overlap into a smear (seven overlapping pairs on a 500px plate, none of them
  readable) and the note says so rather than letting them quietly vanish; on a
  bridge the station is usually the caption you wanted anyway. **Move only**
  turns off the drop-to-link half of a drag: the no-mode default is right for
  six photos, where you can see what you are about to hit, but at twenty the
  dots are close enough that a move keeps landing on a neighbour and drawing a
  link nobody asked for. None of the three is saved into the tour — they
  describe how you are working, not what the tour contains.

  [design/plan-view-20.html](../design/plan-view-20.html) is the whole plate
  carrying a twenty-photo bridge, as one self-contained page that needs no
  server: the fastest way to see whether a change reads at the size a real job
  makes it. Rebuild it with `node design/plan_preview.mjs` after changing the
  plate — it lifts the stylesheet and the pure helpers straight out of
  `tour/index.html`, so its geometry and colours are the ones that ship.
  If two or more photos both see the plant on the deck and both know which way
  they were facing, the bearings are crossed and the vehicle is drawn as a
  truck. Near-parallel bearings cross at a point far too sensitive to be worth
  anything, so those are refused rather than drawn.
- The viewer shows a **compass** whenever a photo has a heading — recorded by
  the camera, or worked out from the sun (below).
- **Hotspots never sit on top of each other.** An automatic arrow steps aside
  if its bearing is already taken, and any that still collide on screen —
  two defects on the same spall, or a tour built before that fix — are spread
  apart where they are *drawn*. The stored angle never moves, so the register,
  the CSV and the photo log are unaffected, and no mark is ever displaced
  further than its own radius, so it always still covers the point it marks.
- Picking a scene puts it in the address bar, so a link can point at one exact
  scene rather than the front door.
- **Order by capture time** puts a folder drop back into the order it was walked.

The pre-share check also watches photo-stop coverage: once any photo is
assigned a stop, it lists the stops that still have none — while the site is
still reachable and a missing Bearings photo costs a walk, not a second visit.

Press **?** for the full list of keyboard shortcuts.

## Away from a desk

The editor works on a tablet: below 960px, or on any touch screen, the sidebar
becomes a drawer and every control grows to a 44px target. The app follows your
system's light or dark setting — the chrome turns to paper in daylight, while
the panorama keeps dark surroundings in both, because that is how a photograph
is shown.

## Share it

| What | Where |
|---|---|
| Link | Share panel → **Link** → Copy. Anyone on your network can open it. |
| Website embed | Share panel → **Embed** → Copy the `<iframe>`. Already carries the permissions gyroscope, VR, and fullscreen need. |
| Standalone site | Share panel → **Download standalone site**. |

The standalone export is the one Kuula never gives you: a zip holding the
viewer, the rendering libraries, and your photos. Unzip it onto GitHub Pages,
Netlify, S3, or any web server and the tour runs with no Bridge Tour server, no
Python, and no network calls home. Opening `index.html` straight from disk
will not work — browsers block ES modules on `file://` — so serve the folder,
even locally:

```bash
python -m http.server 8000
```

## Viewer features

Autorotate with adjustable speed, little-planet intro that unfolds into the
scene, scene gallery, gyroscope look-around on phones, stereo VR mode,
fullscreen, background audio with a mute control, and your logo in the corner
with an optional link. Reduced-motion settings are respected: the intro and
autorotate stay off, manual controls all still work. The little-planet intro
is also skipped automatically when the start scene is a partial panorama —
there is no nadir to unfold from.

## Where things live

```
tour/index.html      the whole app — home, editor, viewer
tour/vendor/         Photo Sphere Viewer 5.14.3 + three.js 0.184.0, pinned
tours/<tour-id>/     tour.json + files/  (gitignored: this is your content)
```

Version pins and upgrade rules are in `tour/vendor/VERSIONS.md`. The
libraries are lockstepped — bump them together or not at all.

## API

| Method | Path | Does |
|---|---|---|
| GET | `/api/tours` | list |
| POST | `/api/tours` | create `{name}` |
| GET | `/api/tours/<id>` | fetch one |
| POST | `/api/tours/<id>` | save the whole doc |
| DELETE | `/api/tours/<id>` | move tour to `tours/.trash` (30 days) |
| POST | `/api/tours/<id>/duplicate` | copy tour + media |
| POST | `/api/tours/<id>/files` | upload media (multipart `file`) |
| GET | `/api/tours/<id>/files/<name>` | serve media |
| GET | `/api/tours/<id>/export.zip` | standalone static site + `manifest.json` provenance |

Uploads are capped at 64 MB and limited to jpg/png/webp/mp3/m4a/ogg on the
wire — HEIC and any other non-web-safe image is converted to JPEG in the
browser before it uploads, so this list is unchanged even though the editor
now accepts photos it wouldn't have before. Files
stop being served once nothing in the tour references them, but only after a
day of going unreferenced — long enough that a just-uploaded photo is never
collected before the editor saves a reference to it, and that undoing a scene
deletion always finds its photo still there. Deleting a tour moves it to `tours/.trash`, kept for 30 days
from the deletion.

## Checks

Everything, in one command:

```bash
test.bat
```

Runs all three suites in order, prints each one's output rather than swallowing
it, and exits non-zero if any of them fails. Node is optional — if it is not
installed the panorama and plan-view maths are reported as skipped, and skipped
still counts as a failure so the gap cannot pass unnoticed. The three can still
be run one at a time:

```bash
python tests/tour_smoke_test.py
```

45 checks across the tour API: CRUD, upload validation, the prune grace
window, path-traversal and malformed-id rejection, oversize rejection,
duplicate, the export bundle's contents and its provenance manifest, and the
409 a save from a stale version now gets instead of silently overwriting a
second editor.

Two of those groups are newer and worth naming. The stale-save check no longer
posts its two saves one after another — the one interleaving that cannot fail —
but fires eight simultaneous saves through a barrier, all carrying the same
`updated`, and requires exactly one 200 and seven 409s. Against the previous
implementation, which compared and wrote under two separate holds of the lock,
that check fails on roughly two runs in five with several winners at once.
And the export is no longer checked only by its table of contents: the zip is
opened, the injected `window.BRIDGE_STATIC_TOUR` is parsed and matched against
the tour, every import-map target is required to be present in the zip, and
every media file the document references is required to have been bundled.

```bash
node tests/tour_pano_test.mjs
```

282 checks on the coverage geometry, GPano XMP reading, EXIF GPS parsing (from
JPEG APP1, and now PNG eXIf and WebP EXIF chunks too, plus the UTC timestamp
the sun reading needs), bearing maths, the walkable-direction guess that
suggests where hotspots go, the solar position (against published Meeus worked
examples and an independent IAU SOFA/ERFA chain), the landmark matcher and its
refusals, the plant-on-the-deck finder and the shadow it must not mistake for
one, the bearing crossing and its refusal to cross near-parallel lines, the
hotspot separation geometry, the defect register's measurement phrasing and
code numbering, the CSV writer (including the leading `=` Excel would otherwise
execute), and the plan-view projection including the drag round-trip.

This suite lifts its subjects straight out of `tour/index.html` — the block
between the two `pure helpers` marker comments — so a copy here could never
drift from the real thing. The list of what to lift is no longer written by
hand: every top-level declaration in the fence is found by regex and exported
under its own name, which removed two hand-maintained lists that had already
drifted from the source and from each other. Two guards keep that honest. A
name used below but no longer in the fence throws before any check runs, rather
than reading as `undefined` and letting a check pass for the wrong reason. And
every *function* in the fence must be mentioned by at least one check, so a
helper cannot be added and then quietly never exercised. Functions only,
because the only way to satisfy that gate for a private tuning constant is to
assert that the constant equals itself, which locks in the one number it exists
to let somebody change. The handful of parser internals exercised only through
their public entry point are listed in `INDIRECT`, and a name left there after
its helper is deleted is itself a failing check.

```bash
python tests/test_stdlib_boot.py
```

The one check on the property the whole install story rests on: that the server
imports and serves with numpy and Pillow absent. It guards the lazy-import
boundary that keeps the 360 tours running on a machine that never ran the splat
pipeline's setup.

### The tour document

`tests/fixtures/tour-v1.json` is one tour carrying every field the code reads —
tour, settings, inspection, all sixteen scene fields and all of the hotspot
fields across a link, an info, a url and three defects. It is the schema, and it
is executable: the pure-helper suite runs the real readers over it, so a field
that gets renamed or dropped fails a check instead of quietly becoming
`undefined` somewhere. A schema document nobody updates is worse than none; this
one cannot go stale without going red.

Saved documents carry `v: 1`. Nothing refuses a document for lacking it — every
tour written before today lacks it and they all still load — it is a marker for
whoever has to write the first migration.

`python tests/seed_demo_tour.py` builds a demo tour with three generated
panoramas and a hotspot ring, useful for looking at the viewer without a
camera handy.

`python tests/seed_mixed_tour.py` builds one photo of each shape — a full
equirect, a phone sweep, a GPano photo sphere, and a plain snapshot — each
carrying EXIF GPS, so the editor can be exercised without owning a phone or a
360 camera. `--files-only` writes just the JPEGs.

## Security posture

The server binds `127.0.0.1` unless started with `--lan`. The API answers
cross-origin requests only from localhost, so a random website you visit
cannot reach in and delete your tours. There is no login: anything that can
reach the port can edit. On a shared or public network, put it behind a
reverse proxy with auth rather than exposing the port directly.
