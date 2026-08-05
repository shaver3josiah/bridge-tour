/* Checks the panorama-shape and photo-metadata maths that Bridge Tour's editor
 * runs on every uploaded photo. These are pure functions with no DOM in them,
 * so they are lifted straight out of tour/index.html rather than duplicated —
 * a copy here would drift from the real thing and start passing while the app
 * broke.
 *
 *   node tests/tour_pano_test.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'tour', 'index.html'), 'utf8');

/* The block is fenced by marker comments in the source. If either marker is
   removed this throws instead of quietly testing nothing. */
const OPEN = '/* --- pure helpers begin';
const CLOSE = '/* --- pure helpers end';
const from = html.indexOf(OPEN);
const to = html.indexOf(CLOSE);
if (from < 0 || to < 0 || to < from) {
  throw new Error('tour/index.html no longer fences its pure-helper block — see the markers named in this test');
}
const source = html.slice(from, to);

/* There used to be two hand-written lists here: a required-names check that
   looked for the literal text "function NAME" (so nine helpers written as
   `const NAME = ...` could vanish from the fence without this test ever
   noticing) and a hand-written export statement (which could omit a helper,
   or export one — clamp did exactly this — that nobody then destructured
   into scope). The two drifted from the source and from each other on their
   own schedules, and both failures were silent. Instead, every top-level
   declaration in the fenced block is found by regex and exported under its
   own name, so there is only one list, and it is never more than one read of
   the source out of date. Only top-level declarations count: the pattern is
   anchored to the start of a line, and every declaration written directly in
   this fence sits at column 0 — an indented `const` or `function` belongs to
   another function's body, not the module's surface (checked by hand against
   this fence before relying on it: every one of the ~70 top-level names sits
   at column 0, and every nested one is indented). */
const DECL = /^(?:function (\w+)\(|const (\w+) =|let (\w+) =)/gm;
const names = [];
const fnNames = [];
for (let m; (m = DECL.exec(source)); ) {
  names.push(m[1] || m[2] || m[3]);
  if (m[1]) fnNames.push(m[1]);
}

/* If the regex stops matching — the fence markers move, the block gets
   wrapped in an IIFE, the formatting changes — this notices by the derived
   list shrinking drastically rather than by checks quietly vanishing. 30 is
   comfortably below the ~70 names the fence currently yields, so ordinary
   growth of the block never trips it, but losing the fence entirely would. */
if (names.length < 30) {
  throw new Error(
    `only ${names.length} top-level declarations were found in the fenced block, too few to be real — ` +
    'the derivation regex or the fence markers are probably broken, and silently exporting nothing would ' +
    'make every check below vanish instead of fail'
  );
}

const helpers = await import(
  'data:text/javascript,' + encodeURIComponent(`${source}\nexport { ${names.join(', ')} };`)
);

/* Only the names the checks below actually reference need pulling into local
   scope — destructuring all of the derived exports would just import noise,
   since most of them are tuning constants private to one function (SUN_MIN_ALT,
   VEHICLE_MIN_LUM and the like). But this list is still written by hand, so a
   rename in tour/index.html could otherwise leave a name destructured as
   undefined rather than erroring, and a check comparing against undefined can
   pass for the wrong reason instead of failing outright. Checking membership
   against the derived export list first turns that into one loud error before
   any check runs, rather than a quiet, misleading pass. */
const USED = [
  'isPartial', 'vFovOf', 'panoDataFor', 'gpanoCoverage', 'readGps', 'bearing', 'metresBetween', 'wrap180',
  'panoProfile', 'guessNavigableYaws', 'openingView', 'snapToWay', 'deriveHeadings', 'PLAN_MAX_SPAN_M',
  'sunPosition', 'solarHeading', 'correlateYaw', 'yawBetween', 'packProfile', 'unpackProfile',
  'principalAxis', 'triangulate', 'separateMarks',
  'fmtIn', 'defectMeasure', 'defectNeedsMeasure', 'nextDefectCode', 'DEFECT_TYPES', 'DEFECT_MEASURE',
  'DEPTH_STEPS', 'WIDTH_STEPS', 'csvCell', 'registerCsv', 'planPositions', 'planEdges', 'planBearing',
  'tourDefects', 'defectCounts', 'niceMetres', 'facingBearing', 'aimFromPoint', 'headingForAim', 'AIM_DART',
  'strandedScenes',
];
const missingFromExports = USED.filter(name => !(name in helpers));
if (missingFromExports.length) {
  throw new Error(`destructured below but not among the derived exports: ${missingFromExports.join(', ')}`);
}
const {
  isPartial, vFovOf, panoDataFor, gpanoCoverage, readGps, bearing, metresBetween, wrap180,
  panoProfile, guessNavigableYaws, openingView, snapToWay, deriveHeadings, PLAN_MAX_SPAN_M,
  sunPosition, solarHeading, correlateYaw, yawBetween, packProfile, unpackProfile,
  principalAxis, triangulate, separateMarks,
  fmtIn, defectMeasure, defectNeedsMeasure, nextDefectCode, DEFECT_TYPES, DEFECT_MEASURE,
  DEPTH_STEPS, WIDTH_STEPS, csvCell, registerCsv, planPositions, planEdges, planBearing,
  tourDefects, defectCounts, niceMetres, facingBearing, aimFromPoint, headingForAim, AIM_DART,
  strandedScenes,
} = helpers;

/* --- checks begin here (tests/tour_pano_test.mjs coverage check reads up to
   this marker and no further back). The coverage check near the end of this
   file searches only from this point onward, so a helper's name merely
   appearing in the derivation or the destructuring above can never count as
   the helper having been exercised: the destructuring names every helper this
   file uses, by construction, and cutting that scaffolding out of the search
   is the only way "destructured but never actually asserted against" is
   distinguishable from "checked". --- */
let failures = 0;
function check(ok, label) {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`);
  if (!ok) failures++;
}
const near = (a, b, tol = 1e-6) => Number.isFinite(a) && Math.abs(a - b) <= tol;

/* ---------- what counts as partial ---------- */

check(!isPartial({}), 'a scene with no pano block is a full sphere');
check(!isPartial({ pano: { hFov: 360 } }), 'hFov 360 is a full sphere, not a crop');
check(isPartial({ pano: { hFov: 180 } }), 'hFov 180 is partial');
check(near(vFovOf(180, 4000, 2000), 90), 'vertical fov follows from the aspect ratio');

/* ---------- panoData geometry ---------- */

/* A full sphere still hands PSV an object, carrying a zeroed pose: a photo
   whose XMP claims a compass heading would otherwise have its whole sphere
   silently rotated, leaving two different meanings of yaw in one tour. */
const full = panoDataFor({})({ width: 4000, height: 2000 });
check(full.croppedWidth === undefined && full.fullWidth === undefined,
  'a full sphere overrides no geometry, so XMP and the image still decide it');
check(full.poseHeading === 0 && full.posePitch === 0 && full.poseRoll === 0,
  'a full sphere is handed a zeroed pose so PSV cannot pre-rotate it');

const half = panoDataFor({ pano: { hFov: 180 } })({ width: 4000, height: 2000 });
check(half.fullWidth === 8000 && half.fullHeight === 4000,
  'a 180 degree photo implies a sphere twice its width');
check(half.croppedWidth === 4000 && half.croppedHeight === 2000, 'the crop keeps the real pixel size');
check(half.croppedX === 2000, 'the crop sits centred horizontally');
check(half.croppedY === 1000, 'with no tilt the horizon lands mid-image');
check(half.poseHeading === 0 && half.posePitch === 0 && half.poseRoll === 0,
  'a partial photo is handed a zeroed pose too');

const tilted = panoDataFor({ pano: { hFov: 180, pitch: 30 } })({ width: 4000, height: 2000 });
check(tilted.croppedY === 333, 'tilting the photo up moves the crop up the sphere');
check(tilted.croppedY < half.croppedY, 'a positive tilt always sits higher than none');

/* PSV logs a warning and silently repairs an out-of-range crop, so keep it in range here */
const extreme = panoDataFor({ pano: { hFov: 60, pitch: 80 } })({ width: 3000, height: 1000 });
check(extreme.croppedY >= 0, 'an extreme tilt is clamped rather than pushed off the sphere');
check(extreme.croppedY + extreme.croppedHeight <= extreme.fullHeight,
  'the crop never runs past the bottom of the sphere');

const wide = panoDataFor({ pano: { hFov: 350 } })({ width: 4000, height: 1000 });
check(wide.croppedX >= 0 && wide.croppedX + wide.croppedWidth <= wide.fullWidth,
  'a nearly-complete sweep still fits inside its sphere');

/* ---------- GPano XMP ---------- */

const xmp = (extra = '') => `<x:xmpmeta><rdf:RDF><rdf:Description
  GPano:FullPanoWidthPixels="8000"
  GPano:FullPanoHeightPixels="4000"
  GPano:CroppedAreaImageWidthPixels="4000"
  GPano:CroppedAreaImageHeightPixels="1000"
  ${extra}/></rdf:RDF></x:xmpmeta>`;

const centred = gpanoCoverage(xmp('GPano:CroppedAreaLeftPixels="2000" GPano:CroppedAreaTopPixels="1500"'));
check(near(centred.hFov, 180), 'XMP states the width outright, no guessing');
check(near(centred.pitch, 0), 'a crop centred on the equator reads as no tilt');

const high = gpanoCoverage(xmp('GPano:CroppedAreaLeftPixels="2000" GPano:CroppedAreaTopPixels="1000"'));
check(near(high.pitch, 22.5), 'a crop above the equator reads as a positive tilt');

check(gpanoCoverage('<x:xmpmeta>nothing useful</x:xmpmeta>') === null,
  'XMP without the GPano numbers is ignored');

check(centred.heading === undefined, 'no PoseHeadingDegrees means no heading is invented');
const facing = gpanoCoverage(xmp('GPano:CroppedAreaTopPixels="1500" GPano:PoseHeadingDegrees="217.5"'));
check(near(facing.heading, 217.5), 'a photo sphere states its compass heading in XMP, and it is read');
const wrapped = gpanoCoverage(xmp('GPano:CroppedAreaTopPixels="1500" GPano:PoseHeadingDegrees="-45"'));
check(near(wrapped.heading, 315), 'a negative heading folds into 0-360 like a compass');

/* element form, which Google Camera writes instead of attributes */
const asElements = gpanoCoverage(
  '<GPano:FullPanoWidthPixels>8000</GPano:FullPanoWidthPixels>' +
  '<GPano:FullPanoHeightPixels>4000</GPano:FullPanoHeightPixels>' +
  '<GPano:CroppedAreaImageWidthPixels>2000</GPano:CroppedAreaImageWidthPixels>' +
  '<GPano:CroppedAreaImageHeightPixels>1000</GPano:CroppedAreaImageHeightPixels>');
check(asElements !== null && near(asElements.hFov, 90), 'GPano written as elements reads the same as attributes');

/* ---------- EXIF GPS ----------
   Hand-built so the byte offsets are checked against something known. A
   mistake anywhere in the IFD walk lands somewhere random and returns
   nonsense, which is exactly the failure this test exists to catch. */

/* Offsets are COMPUTED from the entry list rather than hand-counted, so adding
   a tag cannot silently overlap the data of the one before it. An earlier
   version used literal offsets and every new tag meant re-deriving them. */
function buildJpegWithGps({ latRef = 'N', lonRef = 'W', heading = 123.4,
  headingRef = null, utcDate = null, utcHms = null } = {}) {
  /* [tag, type, count, payload]; ASCII of 4 bytes or fewer rides inline */
  const entries = [
    [1, 2, 2, latRef], [2, 5, 3, [[40, 1], [26, 1], [30, 1]]],
    [3, 2, 2, lonRef], [4, 5, 3, [[79, 1], [59, 1], [0, 1]]],
    [17, 5, 1, [[Math.round(heading * 10), 10]]],
  ];
  if (headingRef) entries.push([16, 2, 2, headingRef]);
  if (utcHms) entries.push([7, 5, 3, utcHms.map(n => [Math.round(n), 1])]);
  if (utcDate) entries.push([29, 2, utcDate.length + 1, utcDate]);

  const n = entries.length;
  const DATA = 26 + 2 + n * 12 + 4;               // GPS IFD start + header + entries + terminator
  let need = 0;
  for (const [, type, count, payload] of entries) {
    if (type === 5) need += count * 8;
    else if (typeof payload === 'string' && count > 4) need += count;
  }
  const TIFF = DATA + need;
  const buf = new ArrayBuffer(2 + 4 + 6 + TIFF);
  const v = new DataView(buf);
  let o = 0;
  v.setUint16(o, 0xFFD8); o += 2;                 // SOI
  v.setUint16(o, 0xFFE1); o += 2;                 // APP1
  v.setUint16(o, 2 + 6 + TIFF); o += 2;           // segment length, includes itself
  for (const ch of 'Exif\0\0') { v.setUint8(o++, ch.charCodeAt(0)); }
  const T = o;                                    // TIFF header base

  v.setUint16(T, 0x4949);                         // "II" — little endian from here on
  v.setUint16(T + 2, 42, true);
  v.setUint32(T + 4, 8, true);                    // IFD0 starts 8 bytes in

  v.setUint16(T + 8, 1, true);                    // IFD0: one entry
  v.setUint16(T + 10, 0x8825, true);              //   GPS IFD pointer
  v.setUint16(T + 12, 4, true);                   //   LONG
  v.setUint32(T + 14, 1, true);
  v.setUint32(T + 18, 26, true);                  //   -> GPS IFD at TIFF+26
  v.setUint32(T + 22, 0, true);                   // no IFD1

  const G = T + 26;
  v.setUint16(G, n, true);
  let at = DATA;
  entries.forEach(([tag, type, count, payload], i) => {
    const e = G + 2 + i * 12;
    v.setUint16(e, tag, true);
    v.setUint16(e + 2, type, true);
    v.setUint32(e + 4, count, true);
    if (type === 2 && count <= 4) {               // short ASCII lives inline
      for (let k = 0; k < payload.length; k++) v.setUint8(e + 8 + k, payload.charCodeAt(k));
      v.setUint8(e + 8 + payload.length, 0);
    } else if (type === 2) {                      // long ASCII is out of line
      v.setUint32(e + 8, at, true);
      for (let k = 0; k < payload.length; k++) v.setUint8(T + at + k, payload.charCodeAt(k));
      v.setUint8(T + at + payload.length, 0);
      at += count;
    } else {                                      // rationals never fit inline
      v.setUint32(e + 8, at, true);
      payload.forEach(([num, den], k) => {
        v.setUint32(T + at + k * 8, num, true);
        v.setUint32(T + at + k * 8 + 4, den, true);
      });
      at += count * 8;
    }
  });
  v.setUint32(G + 2 + n * 12, 0, true);           // end of the GPS IFD
  return buf;
}

const gps = readGps(buildJpegWithGps());
check(gps !== null, 'GPS is found inside a JPEG APP1 segment');
check(near(gps.lat, 40.4416667, 1e-6), `latitude reads back as degrees (got ${gps?.lat})`);
check(near(gps.lon, -79.9833333, 1e-6), `a west longitude comes back negative (got ${gps?.lon})`);
check(near(gps.heading, 123.4, 1e-6), `the compass heading survives the rational (got ${gps?.heading})`);

/* The same TIFF block, rehoused in the other two containers a browser can
   decode. A JPEG-only parser returns null for both and the GPS silently
   vanishes, which looks identical to a photo that never had a fix. */

function tiffOf(jpeg) {
  /* the builder above puts the TIFF at a fixed offset: SOI + marker + len + "Exif\0\0" */
  return jpeg.slice(2 + 2 + 2 + 6);
}

function wrapPng(tiff) {
  const out = new ArrayBuffer(8 + 12 + tiff.byteLength + 12);
  const v = new DataView(out);
  v.setUint32(0, 0x89504E47); v.setUint32(4, 0x0D0A1A0A);      // PNG signature
  v.setUint32(8, tiff.byteLength);                              // eXIf chunk length
  for (const [i, ch] of [...'eXIf'].entries()) v.setUint8(12 + i, ch.charCodeAt(0));
  new Uint8Array(out, 16).set(new Uint8Array(tiff));
  return out;
}

function wrapWebp(tiff, withPrefix) {
  const payload = tiff.byteLength + (withPrefix ? 6 : 0);
  const pad = payload % 2;
  const out = new ArrayBuffer(12 + 8 + payload + pad);
  const v = new DataView(out);
  const put = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  put(0, 'RIFF'); v.setUint32(4, out.byteLength - 8, true); put(8, 'WEBP');
  put(12, 'EXIF'); v.setUint32(16, payload, true);
  let at = 20;
  if (withPrefix) { put(at, 'Exif'); v.setUint8(at + 4, 0); v.setUint8(at + 5, 0); at += 6; }
  new Uint8Array(out, at).set(new Uint8Array(tiff));
  return out;
}

const tiff = tiffOf(buildJpegWithGps());
const fromPng = readGps(wrapPng(tiff));
check(fromPng !== null && near(fromPng.lat, 40.4416667, 1e-6), 'GPS is found in a PNG eXIf chunk');
const fromWebp = readGps(wrapWebp(tiff, false));
check(fromWebp !== null && near(fromWebp.lon, -79.9833333, 1e-6), 'GPS is found in a WebP EXIF chunk');
const fromWebpPrefixed = readGps(wrapWebp(tiff, true));
check(fromWebpPrefixed !== null && near(fromWebpPrefixed.heading, 123.4, 1e-6),
  'a WebP that kept the JPEG-style Exif\\0\\0 prefix reads the same');

const south = readGps(buildJpegWithGps({ latRef: 'S', lonRef: 'E' }));
check(south.lat < 0 && south.lon > 0, 'the hemisphere refs flip the signs the other way');

/* ---- the UTC instant, which is what makes a sun angle possible ----
   DateTimeOriginal is a local wall clock with no zone, so it cannot be turned
   into a sun position without guessing an offset — and an hour of guess is
   fifteen degrees of azimuth. GPSDateStamp and GPSTimeStamp are UTC by
   definition, which is why the solar compass reads these and not that. */
check(gps.utc === undefined, 'a photo with no GPS timestamp claims no instant');
const stamped = readGps(buildJpegWithGps({ utcDate: '2024:07:04', utcHms: [15, 30, 45] }));
check(stamped.utc === Date.parse('2024-07-04T15:30:45Z'),
  `GPSDateStamp and GPSTimeStamp read back as one UTC instant (got ${stamped?.utc})`);
check(readGps(buildJpegWithGps({ utcHms: [15, 30, 45] })).utc === undefined,
  'a time with no date is not enough to place the sun, so nothing is claimed');
check(readGps(buildJpegWithGps({ utcDate: '2024:07:04' })).utc === undefined,
  'and a date with no time is not either');

/* 'T' true / 'M' magnetic. On a steel structure that difference is the whole
   point of reading the sun at all, so it must survive the parse. */
check(gps.headingRef === 'T', 'a heading with no ref stated is taken as true north');
check(readGps(buildJpegWithGps({ headingRef: 'M' })).headingRef === 'M',
  'a magnetic heading is recorded as magnetic, not silently trusted as true');

check(readGps(new ArrayBuffer(64)) === null, 'a buffer that is not a JPEG yields nothing');
const bare = new ArrayBuffer(4);
new DataView(bare).setUint16(0, 0xFFD8);
check(readGps(bare) === null, 'a JPEG with no EXIF yields nothing rather than throwing');

/* a truncated read must not walk off the end — this is what the head-slice does in practice */
const whole = buildJpegWithGps();
let survived = true;
for (let cut = 8; cut < whole.byteLength; cut += 7) {
  try { readGps(whole.slice(0, cut)); } catch (err) { survived = false; console.log(`   threw at ${cut}: ${err.message}`); break; }
}
check(survived, 'every truncation of the file parses or gives up, never throws');

/* ---------- bearings ---------- */

check(near(bearing({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 0, 1e-9), 'due north is 0 degrees');
check(near(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }), 90, 1e-9), 'due east is 90 degrees');
check(near(bearing({ lat: 0, lon: 0 }, { lat: -1, lon: 0 }), 180, 1e-9), 'due south is 180 degrees');
check(near(bearing({ lat: 0, lon: 0 }, { lat: 0, lon: -1 }), 270, 1e-9), 'due west is 270 degrees');

/* the arrow back must face the arrow out — this is the sign error that would
   silently mirror an entire tour */
const a = { lat: 40.4416, lon: -79.9833 };
const b = { lat: 40.4417, lon: -79.9833 };
check(near(Math.abs(wrap180(bearing(a, b) - bearing(b, a))), 180, 0.01),
  'the return bearing is the reverse of the outgoing one');

check(near(metresBetween({ lat: 0, lon: 0 }, { lat: 0.001, lon: 0 }), 111.19, 0.1),
  'a thousandth of a degree of latitude is about 111 metres');
check(metresBetween(a, a) === 0, 'a scene is zero metres from itself');

check(wrap180(190) === -170, 'wrap180 folds past the half turn');
check(wrap180(-190) === 170, 'wrap180 folds the other way too');
check(wrap180(0) === 0, 'wrap180 leaves a straight-ahead angle alone');

/* ---------- guessing where you can walk ----------
   Synthetic panoramas: a flat wall with one deliberate anomaly in it. The
   claim under test is that the anomaly is found whichever direction it departs
   in, because scoring darkness alone would only ever work indoors. */

function pano(paint, W = 256, H = 128) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = paint(x, y, W, H);
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data };
}

const yawOfColumn = (x, W = 256) => wrap180((x + 0.5) / W * 360 - 180);
const nearestTo = (yaws, target) =>
  yaws.length ? yaws.reduce((a, b) => (Math.abs(wrap180(b - target)) < Math.abs(wrap180(a - target)) ? b : a)) : null;

/* the two now compose: one read of the pixels, then the reading of the bands */
const waysOf = (image, count = 3, opts = {}) => guessNavigableYaws(panoProfile(image, opts), count);

/* an unlit doorway in a bright wall */
const darkGap = waysOf(pano((x, y) => (x >= 180 && x < 196 ? 20 : 150)), 3);
check(darkGap.length > 0, 'a dark opening in a bright wall is found at all');
check(darkGap.length && Math.abs(wrap180(nearestTo(darkGap, yawOfColumn(188)))) < 200
  && Math.abs(wrap180(nearestTo(darkGap, yawOfColumn(188)) - yawOfColumn(188))) <= 12,
  `the dark opening is located within 12 degrees (got ${darkGap}, wanted near ${yawOfColumn(188).toFixed(1)})`);

/* the same wall, but the doorway opens onto daylight — darkness alone would
   miss this. Confined to eye level, because a real doorway does not reach the
   zenith, and anything that does is glare rather than a way through. */
const brightGap = waysOf(pano((x, y, W, H) => (x >= 60 && x < 76 && y > H * 0.35 ? 240 : 90)), 3);
check(brightGap.length > 0, 'a bright opening in a dark wall is found too, not just a dark one');
check(brightGap.length && Math.abs(wrap180(nearestTo(brightGap, yawOfColumn(68)) - yawOfColumn(68))) <= 12,
  `the bright opening is located within 12 degrees (got ${brightGap}, wanted near ${yawOfColumn(68).toFixed(1)})`);

/* a featureless scene must admit it has nothing to say rather than inventing */
check(waysOf(pano(() => 128)).length === 0,
  'a flat featureless panorama returns no suggestions at all');
check(panoProfile({ width: 0, height: 0, data: new Uint8ClampedArray(0) }) === null,
  'an empty image profiles as null rather than throwing');
check(guessNavigableYaws(null).length === 0, 'no profile yields no suggestions');

/* the sun is bright and is not a doorway: a hot blob high in the sky is excluded */
const sunOnly = waysOf(pano((x, y, W, H) => (y < H * 0.22 && x >= 120 && x < 136 ? 255 : 120)));
check(sunOnly.length === 0, 'a blazing sun in the sky is not offered as somewhere to walk');

/* wrap-around: an opening straddling the seam is one suggestion, not two */
const seam = waysOf(pano((x, y, W) => ((x >= W - 8 || x < 8) ? 20 : 150)), 3);
check(seam.length === 1, `an opening across the 0/360 seam counts once, not twice (got ${seam.length})`);

/* suggestions never crowd each other past what the viewer would dim anyway */
const many = waysOf(pano((x) => ([30, 45, 120, 200].some(c => x >= c && x < c + 10) ? 20 : 150)), 4);
const tooClose = many.some((a, i) => many.some((b, j) => i !== j && Math.abs(wrap180(a - b)) < 45));
check(!tooClose, `suggestions stay at least 45 degrees apart (got ${many})`);

/* ---------- finding the sun in the frame ----------
 * The solar compass is only as good as this: an error in the sun's column is a
 * degree-for-degree error in the heading it produces. */

const sunPano = (cols, rows) => pano((x, y) =>
  (x >= cols[0] && x < cols[1] && y >= rows[0] && y < rows[1]) ? 255 : 120);

/* a 12x8 blob well inside the sky band, centred on column 125.5, row 23.5 */
const sunFound = panoProfile(sunPano([120, 132], [20, 28])).sun;
check(sunFound !== null, 'a blazing blob in the sky is identified as the sun');
check(sunFound && near(sunFound.yaw, -2.81, 2),
  `the sun's bearing within the frame is read off its column (got ${sunFound?.yaw})`);
check(sunFound && near(sunFound.alt, 56.25, 2),
  `and its height above the horizon off its row (got ${sunFound?.alt})`);

/* THE 180-DEGREE BUG. A sun straddling the seam has half its pixels near
   column 0 and half near 255. Averaging those column NUMBERS puts it at 127 —
   the far side of the sphere — and every heading derived from it is 180
   degrees wrong while looking perfectly reasonable. The circular mean is the
   only thing standing between this feature and a confidently mirrored tour. */
const seamSun = panoProfile(pano((x, y, Wp) =>
  ((x >= Wp - 6 || x < 6) && y >= 20 && y < 28) ? 255 : 120)).sun;
check(seamSun !== null, 'a sun across the 0/360 seam is still found');
check(seamSun && Math.abs(seamSun.yaw) > 170,
  `and it is placed at the seam, not at the far side of the sphere (got ${seamSun?.yaw})`);

/* an overcast sky is uniformly bright and contains no sun; treating its
   brightest pixel as one would blank the panorama on every dull day */
check(panoProfile(pano((x, y, Wp, Hp) => (y < Hp * 0.4 ? 200 : 90))).sun === null,
  'flat overcast contains no sun, however bright it is overall');

/* ---------- somebody standing in the shot ---------- */

function rgbPano(paint, Wp = 256, Hp = 128) {
  const data = new Uint8ClampedArray(Wp * Hp * 4);
  for (let y = 0; y < Hp; y++) {
    for (let x = 0; x < Wp; x++) {
      const [r, g, b] = paint(x, y, Wp, Hp);
      const i = (y * Wp + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { width: Wp, height: Hp, data };
}
const CONCRETE = [122, 124, 126];
const VEST = [210, 255, 40];

const inspector = panoProfile(rgbPano((x, y, Wp, Hp) =>
  (x >= 74 && x < 82 && y > Hp * 0.55 && y < Hp * 0.78) ? VEST : CONCRETE)).person;
check(inspector !== null, 'a hi-vis vest in an otherwise grey scene is found');
/* The contract is "the view lands ON the person", not on one nominated pixel
   of them — a vest eight columns wide subtends eleven degrees, and which
   column inside it wins is not something worth pinning down. */
const vestFrom = wrap180(74.5 / 256 * 360 - 180);
const vestTo = wrap180(81.5 / 256 * 360 - 180);
check(inspector && inspector.yaw >= vestFrom - 1 && inspector.yaw <= vestTo + 1,
  `and the view is aimed somewhere on them, ${vestFrom.toFixed(1)} to ${vestTo.toFixed(1)} (got ${inspector?.yaw})`);

check(panoProfile(rgbPano(() => CONCRETE)).person === null,
  'a scene with nobody in it suggests no direction at all');
/* the localisation test: rust on a girder, or a whole field of dry grass, is
   the same colour everywhere. Only a vest is orange in ONE place. */
check(panoProfile(rgbPano(() => [190, 150, 60])).person === null,
  'a uniformly rust-coloured scene is not mistaken for a person standing somewhere');

/* ---------- the one holding the camera ----------
 * They stand underfoot, so their head lands at the base of the frame and what
 * the photo shows is the crown of it. Aiming AT them is aiming at nothing —
 * directly below the camera every column is the same place — but the face on
 * that crown points somewhere, and that is worth reading.
 *
 * Rows 103 and below are the sliver under UNDERFOOT_ALT in a 256x128 equirect. */

const SKIN = [205, 150, 120];
/* neither colour may be mistaken for the other, or every check below is
   measuring the wrong detector */
check(panoProfile(rgbPano((x, y, Wp, Hp) =>
  (x >= 184 && x < 216 && y >= 118) ? VEST : CONCRETE)).facing === null,
  'a hi-vis vest is not read as a face');
check(panoProfile(rgbPano((x, y, Wp, Hp) =>
  (x >= 74 && x < 82 && y > Hp * 0.55 && y < Hp * 0.78) ? SKIN : CONCRETE)).person === null,
  'and a face is not read as a hi-vis vest');

const crown = panoProfile(rgbPano((x, y) => (x >= 184 && x < 216 && y >= 118) ? SKIN : CONCRETE)).facing;
const crownYaw = wrap180(200 / 256 * 360 - 180);
check(crown !== null, 'skin on the crown of a head at the base of the frame is found');
check(crown !== null && Math.abs(wrap180(crown - crownYaw)) <= 3,
  `and it reads as the bearing that skin sits at, ${crownYaw.toFixed(1)} (got ${crown})`);

/* THE SEAM AGAIN. Half the face near column 0 and half near 255 averages, as
   plain column numbers, to the far side of the sphere — the tour would open
   pointing exactly backwards and look entirely deliberate doing it. */
const seamFace = panoProfile(rgbPano((x, y, Wp) =>
  ((x >= Wp - 16 || x < 16) && y >= 118) ? SKIN : CONCRETE)).facing;
check(seamFace !== null && Math.abs(seamFace) > 174,
  `a face across the 0/360 seam is placed at the seam, not opposite it (got ${seamFace})`);

/* the refusals, which matter more than the finds: a wrong bearing here opens
   every scene of a tour facing the wrong way */
check(panoProfile(rgbPano(() => CONCRETE)).facing === null,
  'bare concrete underfoot is not a face');
check(panoProfile(rgbPano(() => [190, 150, 60])).facing === null,
  'a timber deck is skin-coloured all the way round, so it is refused rather than averaged');
check(panoProfile(rgbPano((x, y) =>
  ((x < 32 || (x >= 128 && x < 160)) && y >= 103) ? SKIN : CONCRETE)).facing === null,
  'skin in two opposite directions points nowhere, and says so instead of splitting the difference');
/* a phone strip that never looks below the parapet has no underfoot at all,
   and its clamped last row must not be mistaken for one */
check(panoProfile(rgbPano(() => SKIN), { hFov: 90 }).facing === null,
  'a narrow strip that never looks down that far reports no facing');

/* ---------- somebody punching at what they want photographed ----------
 * The field photos this was built from: an inspector directly under the
 * camera, hi-vis on, one arm thrown out at the thing worth a picture. The
 * crown of the head is a small disc at the very bottom of the frame; the bare
 * forearm and fist climb out of the sleeve toward the horizon, at ONE azimuth.
 * So the reading is reach, not colour: the direction skin climbs furthest.
 *
 * Rows below 82 in a 256x128 equirect are the band an outstretched arm can
 * land in (ARM_BAND_ALT = -25 degrees); rows below 103 are underfoot. */

const HEAD_ROWS = [120, 128];   /* a crown, hard against the nadir */
const ARM_ROWS = [86, 128];     /* a limb climbing out toward the horizon */
const inBand = (y, rows) => y >= rows[0] && y < rows[1];

/* vest all round the nadir + a head disc + one arm out at column 200 */
const pointing = (armFrom, armTo, opts = {}) => rgbPano((x, y, Wp, Hp) => {
  const across = (a, b) => (a <= b ? (x >= a && x < b) : (x >= a || x < b));
  if (!opts.noArm && across(armFrom, armTo) && inBand(y, ARM_ROWS)) return SKIN;
  if (across(96, 160) && inBand(y, HEAD_ROWS)) return SKIN;          /* the face on the crown */
  if (!opts.noVest && y >= 112) return VEST;                          /* shoulders, all round */
  return CONCRETE;
});

const armAt = (from, to) => panoProfile(pointing(from, to));
const punch = armAt(196, 212);
const punchYaw = wrap180(204 / 256 * 360 - 180);
check(punch.facingFrom === 'arm', `an outstretched arm is read as an arm (got ${punch.facingFrom})`);
check(punch.facing !== null && Math.abs(wrap180(punch.facing - punchYaw)) <= 6,
  `and the bearing is the fist's, ${punchYaw.toFixed(1)} (got ${punch.facing})`);

/* THE EDGE BIAS. A fist is several columns wide, so the crest of the reach is
   a plateau; taking the first column that hits the maximum hands back its
   leading edge instead of its middle — every bearing wrong by half an arm,
   always the same way, which is the kind of error that looks like a
   calibration problem for a year. */
const wideFist = armAt(180, 228);
check(wideFist.facing !== null && Math.abs(wrap180(wideFist.facing - wrap180(204 / 256 * 360 - 180))) <= 6,
  `a wide fist reads from the middle of the crest, not its edge (got ${wideFist.facing})`);

/* the seam, again: an arm thrown out across 0/360 must not average to the
   opposite side of the sphere */
const seamArm = armAt(248, 8);
check(seamArm.facingFrom === 'arm' && Math.abs(seamArm.facing) > 172,
  `an arm across the 0/360 seam points at the seam (got ${seamArm.facing})`);

/* no arm: the crown is all there is, and the face rule takes over rather than
   calling the head's own outline a punch */
const noArm = panoProfile(pointing(0, 0, { noArm: true }));
check(noArm.facingFrom === 'face',
  `with no arm out, the head is read as a head (got ${noArm.facingFrom})`);
check(noArm.facing !== null && Math.abs(wrap180(noArm.facing - wrap180(128 / 256 * 360 - 180))) <= 8,
  `and it still says which way the face is turned (got ${noArm.facing})`);

/* THE REFUSAL THAT MATTERS. Rust, bare timber and dry soil all pass a colour
   test for skin. One stain in one direction has exactly the shape of an arm,
   and the only cheap thing separating them is whether a person is there at
   all — which on a bridge is worn by law. */
const noPerson = panoProfile(pointing(196, 212, { noVest: true }));
check(noPerson.facingFrom !== 'arm',
  'a skin-coloured stain with nobody under the camera is not read as a pointing arm');

/* and the arm beats the head when both are there: the punch is deliberate,
   the tilt of a head is an inference */
check(punch.facing !== null && Math.abs(wrap180(punch.facing - wrap180(128 / 256 * 360 - 180))) > 30,
  'the arm wins over the face it disagrees with, because one of them is a decision');

/* the plate opens on it, and says which signal it read */
const aimedByArm = openingView(punch);
check(aimedByArm?.from === 'arm' && Math.abs(wrap180(aimedByArm.yaw - punchYaw)) <= 6,
  `the scene opens where the fist points (got ${aimedByArm?.from} ${aimedByArm?.yaw})`);

/* ---------- which of those two aims the scene ---------- */

const inspectorProfile = panoProfile(rgbPano((x, y, Wp, Hp) =>
  (x >= 74 && x < 82 && y > Hp * 0.55 && y < Hp * 0.78) ? VEST : CONCRETE));
check(openingView(inspectorProfile)?.from === 'person',
  'somebody in hi-vis out in the scene still wins the opening view');
check(openingView(inspectorProfile)?.yaw === inspectorProfile.person.yaw,
  'and the view opens at their bearing');

/* THE BUG THIS FIXES. A vest at the base of the frame is the operator, not a
   second inspector: they are directly below, so their column is not a bearing
   to anything, and the old guess aimed the scene at it with a straight face. */
const operator = panoProfile(rgbPano((x, y) => (x >= 40 && x < 48 && y >= 118) ? VEST : CONCRETE));
check(operator.person !== null, 'the operator underfoot is still seen');
check(operator.person && operator.person.alt < -55,
  `and is known to be underfoot rather than standing at something (got ${operator.person?.alt})`);
check(openingView(operator) === null,
  'so nothing is aimed at them, and no opening view is claimed at all');

/* same operator, this time with a face on show: now there is something to say */
const looking = panoProfile(rgbPano((x, y) =>
  (x >= 40 && x < 48 && y >= 118) ? VEST
    : (x >= 184 && x < 216 && y >= 118) ? SKIN : CONCRETE));
const aim = openingView(looking);
check(aim?.from === 'facing', 'with nobody else in shot, the scene opens the way the operator was looking');
check(aim && Math.abs(wrap180(aim.yaw - crownYaw)) <= 3,
  `pointed where their face is turned, ${crownYaw.toFixed(1)} (got ${aim?.yaw})`);
check(aim?.pitch === 0, 'and level, since what they were looking at is out there, not underfoot');

check(openingView(panoProfile(rgbPano(() => CONCRETE))) === null,
  'an empty scene is opened at no particular angle rather than a made-up one');
check(openingView(null) === null, 'and a photo that could not be profiled at all does not throw');

/* ---------- the big thing standing on the deck ----------
 * Not a truck classifier and not claimed to be: what it finds is a wide mass
 * below the horizon that is brighter or more saturated than the deck itself.
 * The tests that matter are the refusals, because a wrong bearing here drags a
 * triangulated position across the site. */

const DECK = [118, 116, 114];   /* weathered concrete */
const PLANT = [236, 238, 240];  /* a white fleet body */
/* rows below the horizon in a 256x128 equirect are y > 64 */
const onDeck = (from, to, colour) => rgbPano((x, y, Wp, Hp) =>
  (x >= from && x < to && y > Hp * 0.55 && y < Hp * 0.78) ? colour : DECK);

const truck = panoProfile(onDeck(100, 140, PLANT)).vehicle;
check(truck !== null, 'a pale vehicle body on a concrete deck is found');
check(truck && truck.yaw >= wrap180(100 / 256 * 360 - 180) - 3
   && truck.yaw <= wrap180(140 / 256 * 360 - 180) + 3,
  `and the bearing points at it (got ${truck?.yaw})`);
check(truck && truck.width > 40 && truck.width < 70,
  `and its width is reported in degrees, near the 56 it spans (got ${truck?.width})`);

check(panoProfile(rgbPano(() => DECK)).vehicle === null,
  'an empty deck holds no vehicle');
/* THE FALSE POSITIVE THIS IS BUILT AROUND. A vehicle casts a shadow of similar
   width; only counting departures that are BRIGHTER or more saturated keeps
   the bearing on the truck instead of splitting it toward the shadow. */
check(panoProfile(onDeck(100, 140, [58, 57, 56])).vehicle === null,
  'a dark shadow on the deck is not reported as a vehicle');
/* width gates: a cone is too narrow to be plant, and a wholesale exposure
   shift across the deck is not an object at all */
check(panoProfile(onDeck(120, 126, PLANT)).vehicle === null,
  'a traffic cone is too narrow to be plant');
check(panoProfile(rgbPano((x, y, Wp, Hp) => (y > Hp * 0.55 ? PLANT : DECK))).vehicle === null,
  'a deck that is bright end to end is an exposure shift, not a vehicle');

/* the seam again: plant parked across 0/360 must read as ONE object */
const seamTruck = panoProfile(rgbPano((x, y, Wp, Hp) =>
  ((x >= Wp - 20 || x < 20) && y > Hp * 0.55 && y < Hp * 0.78) ? PLANT : DECK)).vehicle;
check(seamTruck !== null, 'plant parked across the seam is still found');
check(seamTruck && Math.abs(seamTruck.yaw) > 168,
  `and reads as one object at the seam, not two at the edges (got ${seamTruck?.yaw})`);

/* ---------- keeping hotspots clickable ----------
 * Only pixels move here. The stored yaw and pitch — what the register, the CSV
 * and the photo log read — are never touched, so the guarantee worth asserting
 * is that a mark still covers the point it marks. */

const box = (x, y, w = 40) => ({ x, y, w, h: w });
const applied = marks => separateMarks(marks).map((o, i) => ({
  x: marks[i].x + o.dx, y: marks[i].y + o.dy, w: marks[i].w, h: marks[i].h, o,
}));
const clashes = boxes => {
  let n = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (Math.abs(boxes[i].x - boxes[j].x) < (boxes[i].w + boxes[j].w) / 2
       && Math.abs(boxes[i].y - boxes[j].y) < (boxes[i].h + boxes[j].h) / 2) n++;
    }
  }
  return n;
};

check(separateMarks([]).length === 0, 'nothing to separate does not throw');
const alone = separateMarks([box(10, 10)]);
check(alone[0].dx === 0 && alone[0].dy === 0, 'a lone mark is never moved');

/* already clear: must be left exactly alone, or every pan would jitter */
const clear = separateMarks([box(0, 0), box(300, 0), box(0, 300)]);
check(clear.every(o => o.dx === 0 && o.dy === 0), 'marks that already clear each other are not touched');

/* THE CASE FROM THE REAL TOUR: two auto-links on one bearing, pixel-identical.
   With no direction to push along, a naive relaxation leaves them stacked. */
const stacked = applied([box(200, 200), box(200, 200)]);
check(clashes(stacked) === 0, 'two marks at the very same spot are pulled apart');
check(stacked.every(m => Math.hypot(m.o.dx, m.o.dy) > 0), 'both of them move, not just one');

/* Three on one spot cannot ALL clear each other: they would need centres 44px
   apart while each stays within 20px of the shared point, and 3 points on a
   20px circle are at most ~35px apart. The cap wins that argument on purpose.
   What must still hold is that every mark ends up somewhere of its own with
   exposed area to press, rather than three pins hiding under one. */
const trio = applied([box(200, 200), box(200, 200), box(200, 200)]);
const spread = (bs) => {
  let worst = Infinity;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) worst = Math.min(worst, Math.hypot(bs[i].x - bs[j].x, bs[i].y - bs[j].y));
  }
  return worst;
};
/* The contract that decides whether this feature works at all: a mark's OWN
   CENTRE must not end up underneath another mark. Centre clear means there is
   always somewhere to press that belongs to this hotspot and no other — which
   is the whole point, and is achievable under the cap where "no overlap at
   all" is not. */
const centresClear = bs => bs.every((m, i) => bs.every((o, j) =>
  i === j || Math.abs(m.x - o.x) >= o.w / 2 || Math.abs(m.y - o.y) >= o.h / 2));
check(centresClear(trio), `a stack of three fans out so each keeps its own centre (closest pair ${spread(trio).toFixed(1)}px)`);
check(new Set(trio.map(m => `${m.x.toFixed(1)},${m.y.toFixed(1)}`)).size === 3,
  'and all three end up somewhere of their own');
check(centresClear(applied([box(50, 50), box(50, 50), box(50, 50), box(50, 50)])),
  'and so does a stack of four, which is the most the cap can fit');

/* partial overlap resolves along the shorter axis */
const nudgedPair = applied([box(100, 100), box(120, 100)]);
check(clashes(nudgedPair) === 0, 'a partly overlapping pair is separated');
check(Math.abs(nudgedPair[0].y - 100) < 0.01 && Math.abs(nudgedPair[1].y - 100) < 0.01,
  'and separated sideways, the way they were already offset, not vertically');

/* THE HONESTY GUARANTEE. However crowded it gets, a mark may never travel far
   enough to stop covering the point it marks — a defect pin off its defect is
   worse than one you have to zoom in to separate. */
const crowd = [];
for (let i = 0; i < 12; i++) crowd.push(box(200, 200));
const crowded = applied(crowd);
check(crowded.every(m => Math.hypot(m.o.dx, m.o.dy) <= 40 * 0.5 + 1e-9),
  'no mark is ever moved further than its own radius, however crowded');
check(crowded.every(m => Number.isFinite(m.x) && Number.isFinite(m.y)),
  'and a heavy pile-up stays finite rather than flying apart');

/* Different sizes: each mark is capped by ITS OWN radius, so a 24px pin can
   only give 12px and a 96px one 48px — 60px between them where clearing would
   need 64px. They end up touching rather than stacked, and, importantly, the
   small one is not dragged halfway across the photo to satisfy the big one. */
const mixedSize = applied([box(100, 100, 24), box(100, 100, 96)]);
check(Math.hypot(mixedSize[0].o.dx, mixedSize[0].o.dy) <= 12 + 1e-9,
  'a small mark is capped by its own radius, not its neighbour’s');
check(Math.hypot(mixedSize[1].o.dx, mixedSize[1].o.dy) <= 48 + 1e-9,
  'and the large one by its own');
check(spread(mixedSize) > 24, `and they still part enough to press (${spread(mixedSize).toFixed(1)}px)`);

/* ---------- crossing the sightings ---------- */

/* two photos 20 m apart, both seeing something at a bearing that crosses */
const cross = triangulate([
  { x: 0, y: 0, bearing: 45 },
  { x: 20, y: 0, bearing: 315 },
]);
check(cross && near(cross.x, 10, 1e-6) && near(cross.y, 10, 1e-6),
  `two bearings cross where they actually meet (got ${cross && `${cross.x.toFixed(2)},${cross.y.toFixed(2)}`})`);

/* bearings are clockwise from north, same as everything else here */
const due = triangulate([
  { x: 0, y: 0, bearing: 90 },    /* due east  */
  { x: 30, y: -30, bearing: 0 },  /* due north */
]);
check(due && near(due.x, 30, 1e-6) && near(due.y, 0, 1e-6),
  `due east from one and due north from another meet at the corner (got ${due && `${due.x.toFixed(2)},${due.y.toFixed(2)}`})`);

/* THE ONE THAT MATTERS. Nearly parallel bearings cross at a point enormously
   sensitive to a fraction of a degree — the classic way a confident-looking
   triangulation lands miles away. It must refuse, not answer. */
check(triangulate([{ x: 0, y: 0, bearing: 90 }, { x: 0, y: 1, bearing: 90.4 }]) === null,
  'two near-parallel bearings refuse to name a crossing');
check(triangulate([{ x: 0, y: 0, bearing: 90 }, { x: 0, y: 40, bearing: 270 }]) === null,
  'and so do two bearings pointing straight at each other along one line');
check(triangulate([{ x: 0, y: 0, bearing: 45 }]) === null, 'one sighting is not a crossing');
check(triangulate([]) === null && triangulate(undefined) === null, 'no sightings does not throw');

/* more sightings should sharpen, not break: a third that agrees keeps it put */
const three = triangulate([
  { x: 0, y: 0, bearing: 45 }, { x: 20, y: 0, bearing: 315 }, { x: 10, y: -10, bearing: 0 },
]);
check(three && near(three.x, 10, 0.5) && near(three.y, 10, 0.5),
  `a third agreeing sighting keeps the answer put (got ${three && `${three.x.toFixed(2)},${three.y.toFixed(2)}`})`);

/* snapping keeps the direction we already believed in when nothing is near */
check(snapToWay(0, []) === 0, 'with no suggestions the original angle is kept');
check(snapToWay(0, [140, -150]) === 0, 'a suggestion beyond the tolerance is ignored');
check(snapToWay(0, [25, 140]) === 25, 'a suggestion within tolerance wins');
check(snapToWay(0, [40, -12, 80]) === -12, 'the closest suggestion wins, not the first');
check(snapToWay(170, [-175]) === -175, 'snapping works across the seam');

/* ---------- the defect register ----------
 * These numbers are a contract with the sibling field-sketch tool
 * (android/app/src/main/assets/bridge-sketch.html). If the two ever phrase a
 * measurement differently, one inspection produces two disagreeing registers,
 * so the phrasing is asserted, not just the arithmetic. */

check(DEFECT_TYPES.length === 9, 'nine defect types, matching the field sketch');
check(DEFECT_TYPES[0] === 'Spall' && DEFECT_TYPES.includes('Exposed reinforcement'),
  'the type names are the sketch tool\'s, not paraphrased');
check(DEPTH_STEPS.map(s => s[0]).join() === '0.25,0.5,1,2,3', 'depth increments are 1/4, 1/2, 1, 2, over 2');
check(WIDTH_STEPS.map(s => s[0]).join() === '0.01,0.0625,0.125,0.25,0.375',
  'width increments are hairline, 1/16, 1/8, 1/4, over 1/4');

check(fmtIn(0.01) === 'hairline', 'the hairline sentinel is a word, not a hundredth of an inch');
check(fmtIn(0.375) === 'over 1/4 in', 'the open-ended width bucket reads as over 1/4 in');
check(fmtIn(3) === 'over 2 in', 'the open-ended depth bucket reads as over 2 in');
check(fmtIn(0.0625) === '1/16 in', 'a sixteenth renders as a fraction');
check(fmtIn(0.125) === '1/8 in', 'an eighth reduces');
check(fmtIn(0.5) === '1/2 in', 'a half reduces');
check(fmtIn(1) === '1 in', 'a whole inch drops the fraction');
check(fmtIn(2) === '2 in', 'two whole inches drop the fraction');
check(fmtIn(1.5) === '1 1/2 in', 'an inch and a half is a mixed number, the way the sketch tool words it');
check(fmtIn(2.75) === '2 3/4 in', 'and the fraction still reduces past two inches');
check(fmtIn(1.0625) === '1 1/16 in', 'a sixteenth over an inch keeps its sixteenth');
check(fmtIn(0) === '' && fmtIn(undefined) === '', 'no measurement renders as nothing, not NaN');

check(defectMeasure({ defect: 'Spall', depthIn: 0.5 }) === '1/2 in deep', 'a spall reads as a depth');
check(defectMeasure({ defect: 'Spall', depthIn: 2, rebar: true }) === '2 in deep, reinforcement exposed',
  'exposed reinforcement is appended the way the sketch tool phrases it');
check(defectMeasure({ defect: 'Crack', widthIn: 0.01 }) === 'hairline wide', 'a crack reads as a width');
check(defectMeasure({ defect: 'Efflorescence' }) === '', 'a type with no measurement measures nothing');
/* the field that no longer applies must not leak into the register */
check(defectMeasure({ defect: 'Crack', depthIn: 2, widthIn: 0.125 }) === '1/8 in wide',
  'a stale depth on a crack is ignored, not printed');

check(defectNeedsMeasure({ defect: 'Spall' }), 'a spall with no depth is flagged');
check(!defectNeedsMeasure({ defect: 'Spall', depthIn: 0.25 }), 'a spall with a depth is not flagged');
check(!defectNeedsMeasure({ defect: 'Patch' }), 'a type that takes no measurement is never flagged');

check(nextDefectCode([]) === 'D1', 'the first defect in an empty tour is D1');
check(nextDefectCode(undefined) === 'D1', 'a tour with no scenes still yields D1');
check(nextDefectCode([{ hotspots: [{ type: 'link' }] }]) === 'D1', 'links do not consume defect numbers');
check(nextDefectCode([{ hotspots: [{ code: 'D1' }] }, { hotspots: [{ code: 'D2' }] }]) === 'D3',
  'codes run across the whole tour, not per scene');
/* deleting D2 must not hand D3's number to the next defect and collide */
check(nextDefectCode([{ hotspots: [{ code: 'D1' }, { code: 'D3' }] }]) === 'D4',
  'a gap left by a deleted defect is not reused');

/* ---------- the exported register ---------- */

check(csvCell('plain') === 'plain', 'an ordinary cell is not quoted');
check(csvCell('a,b') === '"a,b"', 'a comma forces quoting');
check(csvCell('say "hi"') === '"say ""hi"""', 'an embedded quote is doubled');
check(csvCell('line\r\nbreak') === '"line\r\nbreak"', 'a newline stays inside one quoted cell');
/* Excel executes a leading =, + or @ however the cell is quoted */
check(csvCell('=SUM(A1:A9)') === "'=SUM(A1:A9)", 'a leading = is defused with an apostrophe');
check(csvCell('+1') === "'+1", 'a leading + is defused');
check(csvCell('@x') === "'@x", 'a leading @ is defused');
/* Excel parses a leading minus as a formula exactly as it does '='. The
   Measure column is generated and can never start with one, but Note, Scene,
   Element and Station are free text and can. */
check(csvCell("-2+3+cmd|'/C calc'!A0") === "'-2+3+cmd|'/C calc'!A0",
  'a leading minus is defused too — the free-text columns can carry one');
check(csvCell(undefined) === '' && csvCell(null) === '', 'a missing value is an empty cell, not "undefined"');

const sampleTour = {
  scenes: [
    { name: 'Bay 2', stop: 'Underside', element: 'Soffit', station: '3+00', hotspots: [
      { type: 'defect', code: 'D10', defect: 'Crack', widthIn: 0.01, note: 'Transverse' },
      { type: 'link', target: 'x' },
    ] },
    { name: 'Pier 1', stop: 'Pier faces', element: 'Pier, column', station: '2+50', hotspots: [
      { type: 'defect', code: 'D9', defect: 'Spall', depthIn: 2, rebar: true, note: 'At the joint, "wet"' },
      { type: 'info', title: 'note' },
    ] },
  ],
};
const csvLines = registerCsv(sampleTour).split('\r\n');
check(csvLines[0] === 'Code,Type,Measure,Scene,Photo stop,Element,Station,Note',
  'the header matches the field sketch register columns');
check(csvLines.length === 3, 'only defects become rows — links and info hotspots do not');
check(csvLines[1].startsWith('D9,'), 'D9 sorts before D10 numerically, not as text');
check(csvLines[1] === 'D9,Spall,"2 in deep, reinforcement exposed",Pier 1,Pier faces,"Pier, column",2+50,"At the joint, ""wet"""',
  'a full defect row round-trips measure, element and a quoted note');
check(csvLines[2] === 'D10,Crack,hairline wide,Bay 2,Underside,Soffit,3+00,Transverse',
  'the second row carries its own scene metadata');
check(registerCsv({ scenes: [] }).split('\r\n').length === 1, 'a tour with no defects exports just the header');
check(registerCsv(undefined).split('\r\n').length === 1, 'a missing tour does not throw');
/* ---------- the sun as a compass ----------
 * Reference azimuths and altitudes are from an independent IAU SOFA/ERFA chain
 * (erfa.epv00 + ab + pnm06a + gst06a), itself checked against Meeus Example
 * 25.b to 0.05 arcsec. The tolerance here is 0.05 deg, twice the largest
 * deviation measured over 200,000 random samples — tight enough that a sign
 * error or a dropped term fails it, loose enough never to fail on rounding. */

const SUN_CASES = [
  ['2000-06-21T18:00:00Z', 40, -105, 137.14360, 68.9149, 'Boulder, northern summer solstice'],
  ['2000-12-21T18:00:00Z', 40, -105, 165.20636, 25.1181, 'Boulder, northern winter solstice'],
  ['2025-03-20T09:01:00Z', 51.478, 0, 126.49673, 25.3363, 'Greenwich, March equinox'],
  ['2050-07-10T02:00:00Z', -33.8688, 151.2093, 0.16458, 33.9174, 'Sydney, southern winter noon'],
  ['2075-09-05T15:00:00Z', 0, -78.5, 78.06159, 56.2619, 'Quito, on the equator'],
  ['2100-12-21T11:00:00Z', 59.914, 10.752, 176.55853, 6.6024, 'Oslo, sun only 6.6 deg up'],
  ['2099-08-08T16:45:00Z', -60, -60, 350.27939, 13.6993, 'latitude -60, southern winter'],
];
for (const [iso, lat, lon, az, alt, label] of SUN_CASES) {
  const got = sunPosition(Date.parse(iso), lat, lon);
  check(near(got.azimuth, az, 0.05) && near(got.altitude, alt, 0.05),
    `${label}: sun at ${az.toFixed(2)} deg / ${alt.toFixed(2)} up ` +
    `(got ${got.azimuth.toFixed(2)} / ${got.altitude.toFixed(2)})`);
}

/* The convention checks. Each of these fails loudly on a whole class of bug
   that the accuracy cases above would also catch, but far less legibly. */
const noonN = sunPosition(Date.parse('2025-06-21T12:00:00Z'), 40, 0).azimuth;
check(noonN > 170 && noonN < 190, `northern local noon puts the sun due SOUTH (got ${noonN.toFixed(1)})`);
const noonS = sunPosition(Date.parse('2025-06-21T12:00:00Z'), -33, 0).azimuth;
check(noonS < 15 || noonS > 345, `southern local noon puts the sun due NORTH (got ${noonS.toFixed(1)})`);
const morning = sunPosition(Date.parse('2025-03-20T08:00:00Z'), 40, 0).azimuth;
const evening = sunPosition(Date.parse('2025-03-20T16:00:00Z'), 40, 0).azimuth;
check(morning > 80 && morning < 140, `the morning sun is in the EAST (got ${morning.toFixed(1)})`);
check(evening > 220 && evening < 280, `the evening sun is in the WEST (got ${evening.toFixed(1)})`);
/* longitude east-positive: 30 degrees east sees noon two hours earlier */
check(sunPosition(Date.parse('2025-03-20T12:00:00Z'), 0, 15).azimuth > 180
   && sunPosition(Date.parse('2025-03-20T12:00:00Z'), 0, -15).azimuth < 180,
  'longitude enters east-positive: the sun is already past noon to the east');
/* the leap day is the platform's job, but a calendar bug here would jump a degree */
const leapA = sunPosition(Date.parse('2024-02-28T12:00:00Z'), 45, 0).azimuth;
const leapB = sunPosition(Date.parse('2024-03-01T12:00:00Z'), 45, 0).azimuth;
check(Math.abs(leapA - leapB) < 1, 'the sun does not jump across a leap day');

/* ---- turning that into the photo's heading ---- */

const AT = Date.parse('2000-06-21T18:00:00Z'); /* Boulder: sun at 137.14, 68.91 up */
const boulder = { lat: 40, lon: -105, utc: AT };
/* the sun sits dead centre of the frame, so the frame faces the sun */
check(near(solarHeading({ yaw: 0, alt: 68.91 }, boulder), 137.14, 0.05),
  'a sun in the middle of the frame means the frame faces the sun');
/* the sun 90 deg to the RIGHT of centre means the centre is 90 deg anticlockwise of it */
check(near(solarHeading({ yaw: 90, alt: 68.91 }, boulder), 47.14, 0.05),
  'a sun to the right of centre puts the centre anticlockwise of the sun');
check(near(solarHeading({ yaw: -90, alt: 68.91 }, boulder), 227.14, 0.05),
  'and a sun to the left puts it clockwise, wrapping into 0-360');

/* the guard that makes this trustworthy: the formula says how high the sun is,
   so a bright thing at the wrong height is not the sun and gets no answer */
check(solarHeading({ yaw: 0, alt: 10 }, boulder) === null,
  'a bright blob 59 degrees below where the sun actually is claims nothing');
check(solarHeading({ yaw: 0, alt: 68.91 }, { ...boulder, utc: undefined }) === null,
  'no UTC instant means no solar heading — a local wall clock will not do');
check(solarHeading(null, boulder) === null, 'no sun found means no heading');
check(solarHeading({ yaw: 0, alt: 0 }, { lat: 40, lon: -105, utc: Date.parse('2000-06-22T04:00:00Z') }) === null,
  'a sun below the horizon is refused, however bright the blob');

/* ---------- matching two photos by their landmarks ---------- */

const W = 256;
/* A profile shaped like something a camera actually produces: big features on
   top of the fine texture every real surface has. The texture is not decoration
   — the matching REFUSES a profile too smooth to correlate, and a bare sum of
   gaussians on a flat baseline crosses its own mean only four times, which no
   photograph of concrete and steel ever does. An earlier version of this test
   used the bare version and read the refusal as a bug in the matcher. */
const bumpy = (shift = 0, gain = 1, lift = 0) => {
  const out = new Float64Array(W).fill(140);
  /* three unlike features: a pier, a parked truck, a gap in the parapet */
  for (const [c, w, h] of [[30, 9, -70], [96, 20, 45], [180, 5, -100]]) {
    for (let k = -3 * w; k <= 3 * w; k++) out[(c + k + W) % W] += h * Math.exp(-(k * k) / (w * w));
  }
  /* deterministic pseudo-texture, so the test result never depends on a seed */
  for (let i = 0; i < W; i++) {
    out[i] += 9 * Math.sin(i * 1.7) + 6 * Math.sin(i * 0.41 + 2) + 5 * Math.sin(i * 3.3 + 1);
  }
  const rolled = new Float64Array(W);
  for (let i = 0; i < W; i++) rolled[(i + shift) % W] = out[i] * gain + lift;
  return rolled;
};

const clean = correlateYaw(bumpy(), bumpy(37));
check(clean.shiftColumns === 37, `a known 37-column turn is recovered exactly (got ${clean.shiftColumns})`);
/* 0.35 is the bar yawBetween applies before it will use an answer. Asserting
   the shipping threshold rather than a rounder number keeps this test honest:
   surface texture legitimately costs confidence, and a match that clears the
   gate is the whole claim being made. */
check(clean.confidence >= 0.35, `and clears the confidence gate (got ${clean.confidence})`);
check(correlateYaw(bumpy(), bumpy(37, 1.5, 20)).shiftColumns === 37,
  'a photo shot brighter still matches: the profiles are normalised first');

/* A row of identical piers correlates perfectly at every pier spacing and
   picks an arbitrary one — measured 180 degrees wrong. Bridges are full of
   repeating structure, so this refusal is not hypothetical. */
const piers = new Float64Array(W), piersTurned = new Float64Array(W);
for (let i = 0; i < W; i++) piers[i] = 140 + 60 * Math.cos(2 * Math.PI * i / 32);
for (let i = 0; i < W; i++) piersTurned[(i + 37) % W] = piers[i];
check(correlateYaw(piers, piersTurned).confidence < 0.1,
  'evenly spaced piers refuse to name a turn rather than naming the wrong one');

check(correlateYaw(new Float64Array(W).fill(7), bumpy()).confidence === 0, 'a flat profile matches nothing');
check(correlateYaw(null, null).confidence === 0, 'a missing profile does not throw');
check(correlateYaw(bumpy(), new Float64Array(8)).confidence === 0, 'mismatched lengths refuse');

/* THE ONE THAT MATTERS. Two photos with a single broad feature each — a deck
   soffit, a flat overcast horizon — share nothing, but their correlation is one
   smooth lobe with no rival to beat. Read naively that scores FULL confidence
   at a 180-degree error. Measured at 1.0000 before the input precondition was
   added, which is why the guard is on the profile and not on the threshold. */
const oneLobe = at => {
  const out = new Float64Array(W).fill(120);
  for (let k = -60; k <= 60; k++) out[(at + k + W) % W] += 60 * Math.exp(-(k * k) / (30 * 30));
  return out;
};
const smoothPair = correlateYaw(oneLobe(20), oneLobe(200));
check(smoothPair.confidence === 0,
  `two unrelated near-flat photos claim NOTHING (got confidence ${smoothPair.confidence})`);

/* the two bands together, which is the only way this is allowed to be used */
const sceneOf = (wallShift, floorShift, hFov) => ({
  prof: packProfile({ W, wall: bumpy(wallShift), floor: bumpy(floorShift) }),
  ...(hFov ? { pano: { hFov } } : {}),
});
const agreed = yawBetween(sceneOf(0, 0), sceneOf(37, 37));
check(agreed && near(agreed.degrees, wrap180(37 * 360 / W), 0.01),
  `two agreeing bands give the turn in degrees (got ${agreed && agreed.degrees})`);
check(yawBetween(sceneOf(0, 0), sceneOf(37, 120)) === null,
  'bands that disagree about the turn refuse rather than picking one');
check(yawBetween(sceneOf(0, 0), sceneOf(37, 37, 180)) === null,
  'photos covering different amounts of sphere are not comparable');
check(yawBetween({}, sceneOf(0, 0)) === null, 'a scene with no stored profile refuses');

/* ---- the profile survives the round trip it is stored through ---- */
const packed = packProfile({ W, wall: bumpy(), floor: bumpy(11) });
check(typeof packed === 'string' && packed.length > 100, 'a profile packs to a string');
const back = unpackProfile(packed);
check(back && back.W === W, 'and unpacks to the same width');
check(back && correlateYaw(back.wall, bumpy(37)).shiftColumns === 37,
  'a byte per column loses nothing the matching can see');
check(unpackProfile(null) === null && unpackProfile('') === null && unpackProfile('!!!') === null,
  'a missing or corrupt profile unpacks to null rather than throwing');
check(packProfile(null) === null, 'nothing to pack packs to nothing');

/* ---------- plan view geometry ---------- */

const geoScene = (id, lat, lon) => ({ id, geo: { lat, lon } });
check(planPositions([]) === null, 'no scenes plots nothing');
check(planPositions(undefined) === null, 'a missing list does not throw');
check(planPositions([geoScene('a', 40, -75)]) === null, 'one photo is not a plan');

/* a north-south pair: north must sit ABOVE south on screen */
const ns = planPositions([geoScene('s', 40.0000, -75), geoScene('n', 40.0010, -75)]);
check(ns.pts.length === 2, 'two located photos plot');
check(ns.pts.find(p => p.id === 'n').v < ns.pts.find(p => p.id === 's').v, 'north plots above south');
check(near(ns.pts.find(p => p.id === 'n').u, 0.5, 0.02) && near(ns.pts.find(p => p.id === 's').u, 0.5, 0.02),
  'a due north-south pair shares one column');
check(ns.scaled && ns.pts.every(p => p.kind === 'gps'), 'a fully located tour is to scale and all GPS');

/* an east-west pair: east must sit RIGHT of west */
const ew = planPositions([geoScene('w', 40, -75.0010), geoScene('e', 40, -75.0000)]);
check(ew.pts.find(p => p.id === 'e').u > ew.pts.find(p => p.id === 'w').u, 'east plots right of west');

/* every photo standing on one fix must not divide by zero */
const same = planPositions([geoScene('a', 40, -75), geoScene('b', 40, -75), geoScene('c', 40, -75)]);
check(same.pts.length === 3 && same.pts.every(p => Number.isFinite(p.u) && Number.isFinite(p.v)),
  'identical fixes stay finite instead of collapsing to NaN');
check(same.pts.every(p => near(p.u, 0.5, 1e-6) && near(p.v, 0.5, 1e-6)), 'identical fixes stack at the centre');

/* the site keeps its own proportions: a long thin walk is not stretched square */
const strip = planPositions([geoScene('a', 40, -75), geoScene('b', 40, -74.999), geoScene('c', 40.00002, -75)]);
const us = strip.pts.map(p => p.u), vs = strip.pts.map(p => p.v);
check((Math.max(...us) - Math.min(...us)) > (Math.max(...vs) - Math.min(...vs)) * 5,
  'a long east-west walk stays long rather than being stretched to fill the box');
check(strip.pts.every(p => p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1), 'every dot lands inside the box');
check(strip.span >= 1, 'the span is reported in metres and never below the one-metre floor');

/* ---- the guessed layout, which is new: a photo with no fix is placed rather
   than dropped, but it is placed as a GUESS and says so ---- */
const mixed = planPositions([geoScene('a', 40, -75), geoScene('b', 40, -74.999), { id: 'c' }]);
check(mixed.pts.length === 3, 'a photo with no fix is still placed on the plan');
check(mixed.pts.find(p => p.id === 'c').kind === 'guess', 'and it is labelled a guess, not a position');
check(mixed.pts.filter(p => p.kind === 'gps').length === 2, 'the located ones stay labelled gps');

/* ---- ONE BAD FIX MUST NOT TAKE THE PLATE DOWN WITH IT ----
   A phone hands back the lock it had, not the lock it should have: one photo in
   a set comes back from a previous site or with a zeroed rational. That used to
   blow the span past the sanity cap and draw NOTHING — nine good photos hidden
   by the tenth, which is a worse failure than the wrong map it was guarding
   against, because it hides the evidence instead of the error. */
const withStray = planPositions([
  geoScene('a', 40.4416, -79.9833),
  geoScene('b', 40.4417, -79.9831),
  geoScene('c', 40.4418, -79.9829),
  geoScene('bad', 41.9, -80.9),           /* ~180 km away: a stale lock */
]);
check(withStray.pts.length === 4, 'every photo is still plotted, including the one with the bad fix');
check(withStray.pts.filter(p => p.kind === 'gps').length === 3,
  'the three that agree keep their measured positions');
check(withStray.pts.find(p => p.id === 'bad').kind === 'guess',
  'and the stray is demoted to a guess rather than believed');
check(withStray.strays.length === 1 && withStray.strays[0].id === 'bad',
  'the plan says which photo it set aside, so the note can name it');
check(withStray.strays[0].away > 100000, `and how far off it was (got ${withStray.strays[0]?.away} m)`);
check(withStray.span < PLAN_MAX_SPAN_M,
  `the span is back to the size of the real site (got ${Math.round(withStray.span)} m)`);
check(withStray.scaled, 'and three good fixes still size the plate');

/* the median is what makes that work: a MEAN centre would be dragged toward the
   outlier by the outlier, and with two photos would sit exactly between them
   and call both of them strays */
const twoFarApart = planPositions([geoScene('a', 40.4416, -79.9833), geoScene('bad', 41.9, -80.9)]);
check(twoFarApart.pts.length === 2, 'two photos a long way apart are both still plotted');
check(twoFarApart.strays.length <= 1, 'and they are not both thrown out as strays');

const noneLocated = planPositions([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
check(noneLocated.pts.length === 3, 'a tour with no GPS at all still gets a plan to correct');
check(!noneLocated.scaled, 'but it is explicitly NOT to scale, because nothing here knows the size');
check(noneLocated.pts.every(p => p.kind === 'guess'), 'and every dot on it is a guess');
check(!noneLocated.oriented, 'and with no fix the plate does not claim to know north');

/* Dragging dots is how a GPS-less layout gets corrected, and the drop stores
   metres read out of the nominal frame. Two of those are still not a
   measurement — the plan must not flip to "scaled" because a human tidied it. */
const draggedBlind = planPositions([
  { id: 'a', plan: { x: 5, y: 0 } },
  { id: 'b', plan: { x: -5, y: 0 } },
]);
check(!draggedBlind.scaled, 'two hand-placed dots with no GPS anywhere do not invent a scale');
check(!draggedBlind.oriented, 'nor a north');

/* The other side of that coin: hand-correcting a GPS dot must not surrender
   the scale, because the fixes that sized the frame are still in the photos. */
const corrected = planPositions([
  { id: 'a', geo: { lat: 40, lon: -75 }, plan: { x: 3, y: 4 } },
  { id: 'b', geo: { lat: 40, lon: -75.001 }, plan: { x: 60, y: -2 } },
]);
check(corrected.scaled, 'hand-correcting both GPS dots keeps the scale the fixes established');
check(corrected.oriented, 'and the north they established');

/* a hand-placed position outranks GPS, because a human said so */
const dragged = planPositions([
  { id: 'a', geo: { lat: 40, lon: -75 }, plan: { x: 100, y: 0 } },
  geoScene('b', 40, -75.001),
]);
check(dragged.pts.find(p => p.id === 'a').kind === 'manual', 'a dragged photo is marked manual');
check(dragged.pts.find(p => p.id === 'a').u > dragged.pts.find(p => p.id === 'b').u,
  'and it plots where it was dragged to, not where its GPS says');

/* Metres in, metres out. The drag handler stores what toMetres returns and the
   next render puts the dot back through toBox, so a dot dropped somewhere must
   redraw in the same place — otherwise every correction slides on save. */
const roundTrip = planPositions([geoScene('a', 40, -75), geoScene('b', 40, -75.001)]);
const anchor = roundTrip.pts.find(p => p.id === 'a');
const asMetres = roundTrip.toMetres(anchor.u, anchor.v);
const redrawn = planPositions([
  { id: 'a', geo: { lat: 40, lon: -75 }, plan: asMetres },
  geoScene('b', 40, -75.001),
]).pts.find(p => p.id === 'a');
check(near(redrawn.u, anchor.u, 1e-6) && near(redrawn.v, anchor.v, 1e-6),
  `a dot dropped where it already was redraws in the same place (${anchor.u.toFixed(4)} -> ${redrawn.u.toFixed(4)})`);

/* the drawn structure follows the long axis of whatever is pinned down */
const axis = principalAxis([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }]);
check(near(Math.abs(axis.dx), 1, 1e-6) && near(axis.dy, 0, 1e-6), 'an east-west row of photos gives an east-west axis');
const axisNS = principalAxis([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }]);
check(near(axisNS.dx, 0, 1e-6) && near(Math.abs(axisNS.dy), 1, 1e-6), 'a north-south row gives a north-south axis');
check(Number.isFinite(principalAxis([{ x: 3, y: 3 }]).dx), 'one point does not produce NaN for an axis');
const deckSpan = Math.hypot(strip.deck.to.u - strip.deck.from.u, strip.deck.to.v - strip.deck.from.v);
check(deckSpan > 0.1 && strip.deck.from.u >= -0.01 && strip.deck.to.u <= 1.01,
  'the drawn structure spans the plate and stays inside it');

/* ---------- the links drawn on the plan ---------- */

const link = to => ({ type: 'link', target: to });
const pts3 = planPositions([geoScene('a', 40, -75), geoScene('b', 40, -74.999), geoScene('c', 40, -74.998)]).pts;

check(planEdges([], pts3).length === 0 && planEdges(undefined, undefined).length === 0,
  'no scenes and no positions draw no lines');

/* A->B and B->A is ONE line: two drawn on top of each other read as one anyway */
const paired = planEdges([
  { id: 'a', hotspots: [link('b')] },
  { id: 'b', hotspots: [link('a')] },
  { id: 'c' },
], pts3);
check(paired.length === 1, 'a pair linked both ways is one line, not two');
check(paired[0].both, 'and it is marked as walkable in both directions');

/* one arrow only: still one line, but it knows which end works */
const oneWay = planEdges([{ id: 'a', hotspots: [link('c')] }, { id: 'b' }, { id: 'c' }], pts3);
check(oneWay.length === 1 && !oneWay[0].both, 'a link placed one way only is not marked both');
check(oneWay[0].from.id === 'a' && oneWay[0].to.id === 'c', 'and the arrow points the way that works');
const backOnly = planEdges([{ id: 'a' }, { id: 'b' }, { id: 'c', hotspots: [link('a')] }], pts3);
check(backOnly[0].from.id === 'c' && backOnly[0].to.id === 'a',
  'the arrow follows the link, not the order the ids happen to sort in');

/* the things that must not draw a line to nowhere */
check(planEdges([{ id: 'a', hotspots: [link('gone')] }, { id: 'b' }], pts3).length === 0,
  'a link to a deleted scene draws nothing');
check(planEdges([{ id: 'a', hotspots: [link('a')] }, { id: 'b' }], pts3).length === 0,
  'a link to itself draws nothing');
check(planEdges([{ id: 'a', hotspots: [{ type: 'defect', target: 'b' }] }, { id: 'b' }], pts3).length === 0,
  'a defect is not a link, whatever else it carries');
check(planEdges([{ id: 'a', hotspots: [link('b'), link('b')] }, { id: 'b' }], pts3).length === 1,
  'two arrows from the same photo to the same photo are still one line');

/* the bearing the plan hands a new link. x east, y north, north up. */
check(near(planBearing({ x: 0, y: 0 }, { x: 0, y: 10 }), 0, 1e-9), 'due north reads as 0');
check(near(planBearing({ x: 0, y: 0 }, { x: 10, y: 0 }), 90, 1e-9), 'due east reads as 90');
check(near(planBearing({ x: 0, y: 0 }, { x: 0, y: -10 }), 180, 1e-9), 'due south reads as 180');
check(near(planBearing({ x: 0, y: 0 }, { x: -10, y: 0 }), 270, 1e-9), 'due west reads as 270, never negative');

/* ---------- what the plate has to say about itself ---------- */

/* the grid and the scale bar are drawn at a round number of metres, from the
   1-2-5 sequence, big enough to be worth reading and small enough to fit */
check(niceMetres(100) === 20, '100 m across gets a 20 m grid');
check(niceMetres(40) === 10, '40 m gets 10 m');
check(niceMetres(4) === 1, '4 m gets 1 m');
check(niceMetres(0.4) < 1 && niceMetres(0.4) > 0, 'a plate under a metre still gets a positive step');
check(niceMetres(3000) === 500, 'a viaduct gets a 500 m grid rather than 750 lines');
check([1, 2, 5].includes(niceMetres(2000) / Math.pow(10, Math.floor(Math.log10(niceMetres(2000))))),
  'every step is a 1, a 2 or a 5 — never a 3 or a 7');
for (const bad of [0, -50, NaN, undefined, Infinity]) {
  check(Number.isFinite(niceMetres(bad)) && niceMetres(bad) > 0,
    `a span of ${bad} still yields a finite positive step rather than a NaN grid`);
}
for (const span of [3, 17, 61, 240, 999, 4321]) {
  check(niceMetres(span) * 3 <= span,
    `a ${span} m plate gets a step that fits across it at least three times, so a grid is a grid`);
}

/* ---------- defects, per photo, for the plan ---------- */

const defect = code => ({ type: 'defect', code });
check(defectCounts({ scenes: [] }).size === 0, 'a tour with no scenes counts nothing');
check(defectCounts(null).size === 0, 'a missing tour does not throw');
const counted = defectCounts({ scenes: [
  { id: 'a', hotspots: [defect('D1'), defect('D2'), link('b')] },
  { id: 'b', hotspots: [link('a')] },
  { id: 'c' },
] });
check(counted.get('a') === 2, 'two defects on one photo count as two');
check(!counted.has('b') && !counted.has('c'),
  'a photo with no defects is absent rather than present as a zero');

/* ---------- which way the photo was looking ---------- */

/* heading is where the camera pointed when the shutter fired; view.yaw is how
   far the tour turns it on open. The plan needs the sum, wrapped to a compass. */
check(facingBearing({ geo: { heading: 90 }, view: { yaw: 30 } }) === 120, 'heading plus view yaw');
check(facingBearing({ geo: { heading: 350 }, view: { yaw: 30 } }) === 20, 'and it wraps past north');
check(facingBearing({ geo: { heading: 90 } }) === 90, 'no view yaw means the photo opens where it was shot');
check(facingBearing({ geo: { heading: 10 }, view: { yaw: -30 } }) === 340, 'a negative yaw never reads as negative');
check(facingBearing({ view: { yaw: 30 } }) === null, 'no heading means no wedge, not a wedge pointing north');
check(facingBearing({}) === null && facingBearing(null) === null, 'nothing known draws nothing');
check(facingBearing({ geo: { heading: 0 }, view: { yaw: 0 } }) === 0,
  'due north is 0, not null — a real heading of zero is not a missing heading');

/* ---------- turning that arrow by hand ----------
 * The plan draws one arrow per photo and lets it be dragged round. Two pieces
 * of maths stand between the gesture and the stored bearing, and a sign error
 * in either is invisible on screen: every arrow would still point somewhere
 * perfectly plausible and every one of them would be wrong. */

/* plate coordinates: u right, v DOWN, north up */
const at = (u, v) => ({ u, v });
const mid = at(0.5, 0.5);
check(aimFromPoint(mid, at(0.5, 0.2)) === 0, 'dragging straight up the plate is due north');
check(aimFromPoint(mid, at(0.8, 0.5)) === 90, 'to the right is east');
check(aimFromPoint(mid, at(0.5, 0.9)) === 180, 'downwards is south');
check(aimFromPoint(mid, at(0.1, 0.5)) === 270,
  'and to the left is 270, not -90 — a bearing is never negative');
check(Math.round(aimFromPoint(mid, at(0.7, 0.3))) === 45, 'the diagonals land where they should');

/* THE ROUND TRIP, which is the whole contract: turn an arrow to a bearing,
   store what headingForAim says to store, and the plan must read that same
   bearing back out. The opening yaw is the trap — it is added on the way out,
   so it has to come off on the way in, and any tour whose scenes open anywhere
   but dead ahead would otherwise be aimed wrong by twice it. */
for (const yaw of [0, 30, -30, 179, -179]) {
  for (const aim of [0, 45, 90, 200, 359]) {
    const s = { view: { yaw } };
    s.geo = { heading: headingForAim(s, aim) };
    const back = facingBearing(s);
    if (Math.abs(wrap180(back - aim)) > 0.01) {
      check(false, `aiming at ${aim} with an opening yaw of ${yaw} reads back as ${back}`);
    }
  }
}
check(true, 'an arrow turned to a bearing reads back as that bearing, at every opening yaw');

check(headingForAim({ view: { yaw: 30 } }, 10) === 340,
  'the stored heading wraps rather than going negative');
check(headingForAim({}, 90) === 90 && headingForAim(null, 90) === 90,
  'a photo with no opening view stores the bearing as given');

/* The dart is a constant path now, turned by a CSS rotation, so there is no
   per-frame geometry left to get wrong. Its PROPORTIONS are still a claim,
   though — "tip two dot-diameters out, tail clear of the dot" — and those are
   what a careless edit would quietly break. Drawn in a box four diameters
   square, so one diameter is 25 units and the dot's own edge is 12.5 out. */
const dartPts = [];
{
  const n = AIM_DART.match(/-?\d+(?:\.\d+)?/g).map(Number);
  for (let i = 0; i < n.length; i += 2) dartPts.push({ x: n[i], y: n[i + 1] });
}
check(dartPts.length === 4, `the dart is four points (got ${dartPts.length})`);
check(dartPts[0].x === 50 && dartPts[0].y === 0,
  'its tip is 50 units up the centreline — two dot-diameters, which is the proportion asked for');
const dartTail = Math.max(...dartPts.map(q => q.y));
check(dartTail > 12.5 && dartTail < 35,
  `and its tail stops clear of the 12.5-unit dot without floating off into the plate (got ${dartTail})`);
const xs = dartPts.map(q => q.x);
check(Math.abs(Math.max(...xs) + Math.min(...xs) - 100) < 0.01,
  'it is symmetric about that centreline, or every photo would look slightly off to one side of where it points');
check(dartPts.filter(q => q.y > 0 && q.y < dartTail).length === 2,
  'and it is notched rather than a plain triangle — the two barbs sit ahead of the tail');

/* ---------- working out the bearings nobody recorded ----------
 * Two means that do not need the camera to have known anything: carrying a
 * bearing along photos that share a view, and reading one off a link plus the
 * plan. The refusals matter more than the finds — a wrong bearing here turns
 * every arrow on the plate and the compass in the finished tour. */

/* sceneOf() above builds a scene whose stored profile is `bumpy` shifted by N
 * columns, which is exactly what the matcher measures. 37 columns of 256 is
 * 52.03 degrees, and a photo turned that way has its own frame starting that
 * much earlier. */
const wrap360 = deg => ((deg % 360) + 360) % 360;
const COL = 360 / W;
const shifted = (id, cols, extra = {}) => ({ ...sceneOf(cols, cols), id, ...extra });

const chain = deriveHeadings([
  shifted('a', 0, { geo: { heading: 100 } }),
  shifted('b', 37),
]);
check(chain.length === 1, `the photo that does not know gets a bearing (got ${chain.length})`);
check(chain[0] && near(chain[0].heading, wrap360(100 - wrap180(37 * COL)), 0.05),
  `a photo turned 37 columns from a known one starts that much earlier (got ${chain[0]?.heading})`);
check(chain[0]?.from === 'match', 'and it says it came from a shared view');

/* the one that matters most: the answer must not depend on which photo happens
   to be the one that knows. Aim the far end instead and the near end must come
   out where the far end's own bearing puts it. */
const reversed = deriveHeadings([
  shifted('a', 0),
  shifted('c', 74, { geo: { heading: 200 } }),
]);
check(reversed.length === 1 && near(reversed[0].heading, wrap360(200 + wrap180(74 * COL)), 0.05),
  `carrying a bearing backwards reverses the turn (got ${reversed[0]?.heading})`);

/* ---- and it carries further than one hop, which is the whole claim ----
   Three photos along a walk, each turned 37 columns from the last. The floor
   band swings 43 columns per step against the skyline's 37 — parallax, which
   is exactly why a nearby floor slides further than a distant horizon as you
   walk, and exactly why photos stop matching once they are far enough apart.
   Six columns of disagreement is what yawBetween tolerates, so neighbours
   match and the two ends, twelve apart, do not. That gap is what makes this a
   test of the search rather than of one direct correlation. */
const [w0, w1, w2] = [
  { ...sceneOf(0, 0), id: 'w0' },
  { ...sceneOf(37, 43), id: 'w1' },
  { ...sceneOf(74, 86), id: 'w2' },
];
const hop1 = yawBetween(w0, w1), hop2 = yawBetween(w1, w2);
check(hop1 && hop2, 'neighbours along the walk match, one step at a time');
check(yawBetween(w0, w2) === null,
  'and the two ends do NOT match directly, so reaching the far one means going through the middle');
const walk = deriveHeadings([{ ...w0, geo: { heading: 100 } }, w1, w2]);
check(walk.length === 2, `a bearing on one end reaches both other photos (got ${walk.length})`);
const far = walk.find(x => x.id === 'w2');
check(far && near(far.heading, wrap360(100 - hop1.degrees - hop2.degrees), 0.05),
  `the far end is both turns away, composed in order (got ${far?.heading})`);
check(walk.find(x => x.id === 'w1')?.hops === 1 && far?.hops === 2,
  'and each says how many turns from a known bearing it is, since that is what its error is made of');

check(deriveHeadings([shifted('a', 0), shifted('b', 37)]).length === 0,
  'with nothing known anywhere, nothing is invented');

/* ---- two photos that disagree about a third one settle nothing ----
   The search takes the best route and stops, which is right with one route and
   wrong with several. Here 'a' and 'c' both match 'b' and both know their own
   bearing, but they are 90 degrees apart about what 'b' should be. Picking the
   more confident of the two would look like an answer and be a coin toss. */
const contested = deriveHeadings([
  shifted('a', 0, { geo: { heading: 100 } }),
  shifted('b', 37),
  shifted('c', 74, { geo: { heading: 190 } }),
]);
check(!contested.some(x => x.id === 'b'),
  'a photo its neighbours cannot agree about is left with no bearing rather than the winner of a coin toss');
/* and the same three, with c's bearing where the turns actually put it, agree */
const consistent = deriveHeadings([
  shifted('a', 0, { geo: { heading: 100 } }),
  shifted('b', 37),
  shifted('c', 74, { geo: { heading: wrap360(100 - wrap180(74 * COL)) } }),
]);
check(consistent.some(x => x.id === 'b'),
  'while neighbours that agree still settle it');
check(deriveHeadings([]).length === 0 && deriveHeadings(null).length === 0,
  'no scenes derives nothing rather than throwing');
check(deriveHeadings([shifted('a', 0, { geo: { heading: 10 } })]).length === 0,
  'one photo has nobody to carry a bearing to');
check(deriveHeadings([
  shifted('a', 0, { geo: { heading: 100 } }),
  { id: 'b' },
]).length === 0, 'a photo with no stored profile cannot be matched, and is left alone');
check(deriveHeadings([
  shifted('a', 0, { geo: { heading: 100 } }),
  shifted('b', 37, { geo: { heading: 250 } }),
]).length === 0, 'a photo that already has a bearing is never overwritten');

/* ---- the pair cache, which is what lets this run on every change ----
   Correlating every pair is the expensive half, and it depends only on the
   photos' stored profiles, which are written once at upload. So the editor
   keeps the answers. A cache that changed an answer would be the worst kind of
   bug: right the first time and quietly wrong afterwards. */
const shared = new Map();
const cachedFirst = deriveHeadings([shifted('a', 0, { geo: { heading: 100 } }), shifted('b', 37)], null, shared);
check(shared.size > 0, 'a cache handed in gets filled');
const cachedAgain = deriveHeadings([shifted('a', 0, { geo: { heading: 100 } }), shifted('b', 37)], null, shared);
check(JSON.stringify(cachedFirst) === JSON.stringify(cachedAgain),
  'and the second run through a warm cache gives the same answer as the first');
check(JSON.stringify(cachedFirst) === JSON.stringify(chain),
  'which is also the answer with no cache at all');
/* the trap: the cache is keyed on the sorted id pair, so a run that hands the
   photos over in the other order has to recover which way it was measured */
const flipped = deriveHeadings([shifted('b', 37), shifted('a', 0, { geo: { heading: 100 } })], null, shared);
check(flipped.length === 1 && near(flipped[0].heading, cachedFirst[0].heading, 0.01),
  `reading a cached pair backwards flips the turn back (got ${flipped[0]?.heading}, wanted ${cachedFirst[0]?.heading})`);

/* ---- derived bearings follow their source; told ones do not move ---- */
const told = { ...sceneOf(0, 0), id: 'a', geo: { heading: 100, headingFrom: 'recorded' } };
const inherited = { ...sceneOf(37, 37), id: 'b', geo: { heading: 47.97, headingFrom: 'match' } };
check(deriveHeadings([told, inherited]).length === 0,
  'a derived bearing that is already right is not re-proposed, so nothing is saved for nothing');
const moved = deriveHeadings([{ ...told, geo: { heading: 160, headingFrom: 'hand' } }, inherited]);
check(moved.length === 1 && near(moved[0].heading, wrap360(160 - wrap180(37 * COL)), 0.05),
  `turning the photo a bearing came from re-aims the one that inherited it (got ${moved[0]?.heading})`);
check(deriveHeadings([
  { ...told, geo: { heading: 160, headingFrom: 'hand' } },
  { ...sceneOf(37, 37), id: 'b', geo: { heading: 47.97, headingFrom: 'magnetic' } },
]).length === 0, 'but a bearing the camera measured is left exactly where it is');

/* ---- a bearing that can no longer be justified is WITHDRAWN ----
   Not merely left un-refreshed. A tour carrying answers derived under looser
   rules — off arrows the linker had guessed, before those stopped counting —
   would otherwise keep them for ever, because nothing ever proposes over the
   top of an answer that is no longer produced. Silence has to be able to take a
   number away, or the first version of these rules is the one that sticks. */
const orphaned = deriveHeadings([
  { ...sceneOf(0, 0), id: 'a', geo: { heading: 12, headingFrom: 'plan' } },
  { id: 'b' },  /* nothing to match against, no plan, no links: no evidence at all */
]);
check(orphaned.length === 1 && orphaned[0].id === 'a' && orphaned[0].heading === null,
  'a derived bearing with nothing left to support it is proposed for removal');
check(deriveHeadings([
  { ...sceneOf(0, 0), id: 'a', geo: { heading: 12, headingFrom: 'recorded' } },
  { id: 'b' },
]).length === 0, 'while a told one with no support is simply left alone — it was never derived');

/* ---- the plan pass: a link plus two real positions is a bearing ---- */

/* b sits due east of a, and a's link to b points 30 degrees right of centre,
   so a's centre faces 60. Both dots placed by hand, which is a claim about
   where they stood; a dot laid out by capture order is not. */
const placed = (id, x, y, hotspots) => ({ id, plan: { x, y }, hotspots });
const planned = deriveHeadings(
  [
    placed('a', 0, 0, [{ type: 'link', target: 'b', yaw: 30, aim: 'set' }]),
    placed('b', 50, 0, []),
    { id: 'seed', geo: { heading: 0 } },
  ],
  planPositions([placed('a', 0, 0, []), placed('b', 50, 0, []), { id: 'seed' }]).pts,
);
const fromPlan = planned.find(p => p.id === 'a');
check(fromPlan && fromPlan.from === 'plan', 'a link between two placed photos yields a bearing');
check(fromPlan && near(fromPlan.heading, 60, 0.05),
  `east is 90, the arrow sits 30 right of centre, so the centre faces 60 (got ${fromPlan?.heading})`);

/* THE LOOP THIS MUST NOT CLOSE. The auto-linker aims arrows by guessing when
   the photo has no heading to aim them from. Reading one of those back as a
   bearing would guess an arrow off nothing, derive a bearing off the arrow, and
   then present it as worked out. Only an angle somebody aimed gets a vote. */
const guessedLink = deriveHeadings(
  [
    placed('a', 0, 0, [{ type: 'link', target: 'b', yaw: 30 }]),
    placed('b', 50, 0, []),
  ],
  planPositions([placed('a', 0, 0, []), placed('b', 50, 0, [])]).pts,
);
check(guessedLink.length === 0,
  'an unmarked arrow — every one in every tour built before this — is not read back as evidence');

/* a bearing between two photos standing almost on top of each other is mostly
   the error in where they stand: 4 m apart, GPS good to a few metres */
const shortBaseline = deriveHeadings(
  [
    placed('a', 0, 0, [{ type: 'link', target: 'b', yaw: 30, aim: 'set' }]),
    placed('b', 4, 0, []),
  ],
  planPositions([placed('a', 0, 0, []), placed('b', 4, 0, [])]).pts,
);
check(shortBaseline.length === 0,
  'and neither is one measured across a baseline too short to carry an angle');

/* the refusal that keeps this honest: a dot laid out by capture order is a
   placeholder, and a bearing measured off it would be an invention */
const guessedEnds = deriveHeadings(
  [{ id: 'a', hotspots: [{ type: 'link', target: 'b', yaw: 30, aim: 'set' }] }, { id: 'b' }],
  planPositions([{ id: 'a' }, { id: 'b' }]).pts,
);
check(guessedEnds.length === 0,
  'a link between two dots that were only guessed into place says nothing about bearing');

/* two links that cannot agree are not evidence, and their average is a number
   with no source behind it */
const disagreeing = deriveHeadings(
  [
    placed('a', 0, 0, [{ type: 'link', target: 'b', yaw: 30, aim: 'set' }, { type: 'link', target: 'c', yaw: 30, aim: 'set' }]),
    placed('b', 50, 0, []),
    placed('c', 0, 50, []),
  ],
  planPositions([placed('a', 0, 0, []), placed('b', 50, 0, []), placed('c', 0, 50, [])]).pts,
);
check(!disagreeing.some(p => p.id === 'a'),
  'two links putting one photo 90 degrees apart produce no bearing at all');

/* ---------- the photos the finished tour cannot reach ---------- */

check(strandedScenes(null).length === 0 && strandedScenes({ scenes: [] }).length === 0,
  'an empty tour strands nobody');
const reach = { settings: { startScene: 'a' }, scenes: [
  { id: 'a', hotspots: [link('b')] },
  { id: 'b', hotspots: [link('a')] },
  { id: 'c' },
] };
check(strandedScenes(reach).join() === 'c', 'a photo nothing links to is stranded');
check(!strandedScenes(reach).includes('a'), 'the start scene is never stranded — it is the front door');
/* the disagreement this helper exists to end: with no startScene chosen, the
   scene list used to treat NOTHING as the front door and put a red orphan dot
   on the very first photo, while the pre-share check said the tour was fine */
check(!strandedScenes({ scenes: [{ id: 'a' }, { id: 'b', hotspots: [link('a')] }] }).includes('a'),
  'with no startScene set the first photo is the front door, not an orphan');
check(strandedScenes({ scenes: [{ id: 'a' }, { id: 'b', hotspots: [link('a')] }] }).join() === 'b',
  'and the photo nothing links to is still stranded');
check(strandedScenes({ settings: { startScene: 'gone' }, scenes: [{ id: 'a' }, { id: 'b' }] }).join() === 'a,b',
  'a startScene pointing at a deleted photo strands everything rather than silently excusing one');

/* ---------- the tour document, as a contract ----------

   tests/fixtures/tour-v1.json is one tour carrying every field the code reads.
   It exists because the document's shape was, until now, defined only by the
   `?.` chains that happened to read it: ~15 tour-level fields, ~16 per scene
   and ~19 per hotspot, none of them written down anywhere, and a server that
   validates exactly one thing about a save — that `scenes` is a list.

   A schema document nobody updates is worse than none, so this is not one. It
   is a real document run through the real readers, which means a renamed or
   dropped field fails a check here instead of quietly becoming undefined in
   the editor six months from now. */
const fixture = JSON.parse(readFileSync(join(root, 'tests', 'fixtures', 'tour-v1.json'), 'utf8'));

check(fixture.v === 1, 'the fixture declares the schema version the server stamps');
check(fixture.scenes.length === 3, 'the fixture is three scenes: a full equirect, a partial sweep and a snapshot');

/* every shape of panorama the app accepts, told apart by the same predicate
   the viewer uses to decide whether to crop the sphere */
check(isPartial(fixture.scenes[0]) === false, 'a scene with no pano block reads as a full sphere');
check(isPartial(fixture.scenes[1]) === true && isPartial(fixture.scenes[2]) === true,
  'a phone sweep and an ordinary snapshot both read as partial');
check(Number.isFinite(panoDataFor(fixture.scenes[1])({ width: 4096, height: 1536 }).fullWidth),
  'the fixture partial scene produces a usable crop rather than NaN');

/* the metadata fields, read the way the app reads them */
check(facingBearing(fixture.scenes[1]) === 92.7, 'a scene with a recorded heading reports a facing');
check(facingBearing(fixture.scenes[2]) === null, 'a scene with no geo block reports none');
check(unpackProfile(fixture.scenes[0].prof)?.W === 64,
  'the stored column profile is real packed data and unpacks to its two bands');

/* the plan view, over a document that mixes GPS fixes with a hand placement */
const fixturePlan = planPositions(fixture.scenes);
check(fixturePlan.scaled, 'two GPS fixes give the fixture plan a scale');
check(fixturePlan.pts.find(p => p.id === 's-abutment').kind === 'manual',
  'the scene carrying a plan block is placed by hand, not guessed');
check(fixturePlan.vehicle === null,
  'one vehicle sighting is not a crossing, so the fixture draws no truck');
const fixtureEdges = planEdges(fixture.scenes, fixturePlan.pts);
check(fixtureEdges.filter(e => e.both).length === 1 && fixtureEdges.filter(e => !e.both).length === 1,
  'the fixture walks one pair both ways and reaches the abutment one way only');
check(strandedScenes(fixture).length === 0, 'every scene in the fixture is reachable');

/* the defect register, end to end over a real document */
check(tourDefects(fixture).length === 3, 'the fixture carries three defects across two scenes');
check(tourDefects(fixture).every(d => d.h && d.s), 'each one comes back paired with the photo it was marked on');
check(defectCounts(fixture).get('s-deck') === 2, 'and they count per photo for the plan');
check(nextDefectCode(fixture.scenes) === 'D4', 'the next code follows the highest already used');
const fixtureRows = registerCsv(fixture).split('\r\n');
check(fixtureRows.length === 4, 'the register is a header and one row per defect');
check(fixtureRows[1].startsWith('D1,Spall,"1/2 in deep, reinforcement exposed"'),
  'and the measurement column reads the way the field-sketch tool words it');
/* Every measurement in the fixture stays on the quick-step lists — the common
   path an inspector actually taps. The Exact field can record between-step
   values too, and fmtIn words those as mixed numbers ("1 1/2 in"), but the
   fixture documents the ordinary document, not the edge of the input. */
const onList = (v, steps) => steps.some(([n]) => n === v);
check(tourDefects(fixture).every(({ h }) =>
  (h.depthIn === undefined || onList(h.depthIn, DEPTH_STEPS))
  && (h.widthIn === undefined || onList(h.widthIn, WIDTH_STEPS))),
  'every fixture measurement is one the editor can actually record');

/* ---------- every helper actually gets exercised ----------
   Deriving the export list mechanically fixes the two ways the old
   hand-written lists drifted (a const helper the old existence check could
   not see, and an export nobody destructured). It does not fix a helper
   being added to the fence and then never checked by anything at all — that
   gap produces no import-time error, so it gets its own check: every
   FUNCTION the derivation found must appear, as a whole word, somewhere in
   the checks above.

   Functions only, deliberately. The first version of this demanded a mention
   of every top-level name, which swept in three dozen private tuning
   constants — SUN_MIN_ALT, VEHICLE_MIN_LUM, DECLUTTER_GAP and the like. The
   only way to satisfy that is to write `check(SUN_MIN_ALT === 7)`, a check
   that asserts a constant equals itself, passes forever, and fails the moment
   somebody tunes the one number it exists to let them tune. A gate that can
   only be satisfied by writing worthless checks trains people to write
   worthless checks, so it covers behaviour — functions — and the constants
   are covered where they actually bite, inside the functions that read them.

   INDIRECT is the deliberate escape hatch, and it is deliberately noisy to
   use. These are internal steps of a parser whose behaviour is asserted
   through its public entry point: the EXIF chunk walkers are exercised by
   every readGps check against a real JPEG, PNG and WebP buffer. A new helper
   is not allowed to join this list by accident — the check fails until
   somebody either writes it a check or writes its name here on purpose, and
   the second one is a decision with a reviewer's name on it. */
const INDIRECT = new Set([
  /* EXIF/XMP container walking, all exercised through readGps and its
     malformed-buffer refusals against real JPEG, PNG and WebP bytes */
  'jpegTiff', 'pngTiff', 'webpTiff', 'findExifTiff', 'tiffCursor',
  /* the DateTimeOriginal reader, exercised through readGps's utc assertions */
  'readShotTime',
]);
const selfText = readFileSync(fileURLToPath(import.meta.url), 'utf8');
const CHECKS_FROM = '/* --- checks begin here';
const checksAt = selfText.indexOf(CHECKS_FROM);
if (checksAt < 0) {
  throw new Error('the "checks begin here" marker used by the coverage check is missing from this file');
}
/* Searching only from the marker onward, rather than the whole file, is what
   stops this from self-certifying. Above the marker, the destructuring
   assignment necessarily names every helper this file uses — that is what
   destructuring IS — so searching the whole file would make "pulled into
   scope" indistinguishable from "checked". Cutting the scaffolding out is
   what lets a helper that is destructured but never actually asserted
   against anywhere show up as unexercised, instead of quietly certifying
   itself via its own name in the destructuring line above. (Naming specific
   examples in this comment would be the same mistake in miniature — this
   comment sits after the marker too, so any helper name written here would
   count as a mention of itself.) */
const checksText = selfText.slice(checksAt);
const unexercised = fnNames.filter(name =>
  !INDIRECT.has(name) && !new RegExp(`\\b${name}\\b`).test(checksText));
check(unexercised.length === 0, unexercised.length
  ? `every pure helper in the fence is exercised by at least one check (never mentioned: ${unexercised.join(', ')})`
  : 'every pure helper in the fence is exercised by at least one check');
/* The escape hatch must not outlive what it excuses: a name left in INDIRECT
   after its helper is gone is a lie about coverage that reads as coverage. */
const staleIndirect = [...INDIRECT].filter(name => !fnNames.includes(name));
check(staleIndirect.length === 0, staleIndirect.length
  ? `INDIRECT names a helper the fence no longer has: ${staleIndirect.join(', ')}`
  : 'nothing is excused from the coverage check that has since been deleted');

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
