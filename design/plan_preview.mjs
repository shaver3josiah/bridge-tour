/* Builds design/plan-view-20.html: the editor's plan plate, carrying a whole
 * twenty-photo bridge inspection, as one self-contained page you can open
 * without starting the server or uploading anything.
 *
 *   node design/plan_preview.mjs
 *
 * Lives in design/ rather than tools/ for one dull reason: tools/ is
 * gitignored, because it holds a vendored ffmpeg and a vendored splat trainer.
 * A generator nobody can check out is a generator that stops matching its
 * output the first time somebody else edits the plate.
 *
 * The point is to see the plate at the size a real job makes it — twenty dots,
 * twenty arrows, the links between them, the defect badges — because every
 * screenshot of it so far has had three photos on it, and three photos do not
 * tell you whether twenty will read as a map or as a dartboard.
 *
 * Nothing here re-implements the app. The stylesheet and the fenced pure
 * helpers are lifted out of tour/index.html verbatim, exactly as the test
 * harness lifts them, so the geometry, the colours and the arrow shape in this
 * page ARE the ones that ship. What the page does restate is the markup
 * renderPlan builds — that is the thing being previewed, so it has to be
 * written down somewhere, and this file is the copy. Re-run after changing the
 * plate and the two stay together.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'tour', 'index.html'), 'utf8');

const between = (open, close, what) => {
  const from = html.indexOf(open);
  const to = html.indexOf(close, from + open.length);
  if (from < 0 || to < 0) throw new Error(`tour/index.html no longer contains ${what}`);
  return html.slice(from + open.length, to);
};

const css = between('<style>', '</style>', 'its stylesheet');
const helpers = between('/* --- pure helpers begin', '/* --- pure helpers end', 'its fenced helper block');
/* the fence opens with the rest of that comment line; drop it and keep the code */
const helperSource = helpers.slice(helpers.indexOf('*/') + 2);

const DECL = /^(?:function (\w+)\(|const (\w+) =|let (\w+) =)/gm;
const names = [];
for (let m; (m = DECL.exec(helperSource)); ) names.push(m[1] || m[2] || m[3]);
if (names.length < 30) throw new Error('the helper fence yielded too few names to be real');

/* ---------- a bridge, and a walk round it ----------
   Two spans on a skew, the way a real one sits: the plate has to find the
   structure's own axis rather than being told it. Metres, x east, y north. */

const SKEW = 20 * Math.PI / 180;
const AX = Math.cos(SKEW), AY = Math.sin(SKEW);
/* t runs along the deck from the west abutment, off runs across it, left positive */
const at = (t, off) => ({ x: t * AX - off * AY, y: t * AY + off * AX });

const LAT0 = 40.4416, LON0 = -79.9833;
const M_PER_DEG = 111320;
const geoAt = p => ({
  lat: +(LAT0 + p.y / M_PER_DEG).toFixed(7),
  lon: +(LON0 + p.x / (M_PER_DEG * Math.cos(LAT0 * Math.PI / 180))).toFixed(7),
});

/* Where the truck is parked, so the sightings below can be aimed at something
   real rather than at numbers that happen to cross. */
const TRUCK = at(35, 2);
const bearingTo = (from, to) => ((Math.atan2(to.x - from.x, to.y - from.y) * 180 / Math.PI) + 360) % 360;

/* name, t, off, heading (null = the camera recorded nothing), where the
   heading came from, defects, and whether the photo is placed or is left for
   the plate to guess at */
const WALK = [
  ['W approach', -8, 0, 62, 'recorded', 0, 'gps', 'Approach roadway'],
  ['W abutment, N kerb', 2, 5, 62, 'recorded', 0, 'gps', 'Abutments'],
  ['W abutment, S kerb', 2, -5, null, null, 0, 'gps', 'Abutments'],
  ['Span 1, N kerb', 12, 5, 66, 'magnetic', 0, 'gps', 'Deck'],
  ['Span 1, S kerb', 12, -5, null, null, 1, 'gps', 'Deck'],
  ['Span 1 mid, N kerb', 22, 5, 61, 'sun', 0, 'gps', 'Deck'],
  ['Span 1 mid, S kerb', 22, -5, null, null, 0, 'gps', 'Deck'],
  ['Pier 1, N kerb', 30, 5, 154, 'hand', 3, 'gps', 'Pier, column'],
  ['Pier 1, S kerb', 30, -5, 334, 'hand', 0, 'gps', 'Pier, column'],
  ['Span 2, N kerb', 40, 5, 63, 'recorded', 0, 'gps', 'Deck'],
  ['Span 2, S kerb', 40, -5, null, null, 0, 'gps', 'Deck'],
  ['Span 2 mid, N kerb', 50, 5, 64, 'recorded', 0, 'gps', 'Deck'],
  ['Span 2 mid, S kerb', 50, -5, null, null, 0, 'gps', 'Deck'],
  ['E abutment', 58, 0, 243, 'recorded', 0, 'gps', 'Abutments'],
  ['E approach', 68, 0, 243, 'recorded', 0, 'gps', 'Approach roadway'],
  /* under the deck a phone sees four satellites on a good day, so these two
     are dragged into place by hand — which is what k-manual is for */
  ['Bearings, W abutment', 3, -9, 152, 'hand', 2, 'manual', 'Bearings'],
  ['Pier cap, underside', 30, -10, 341, 'hand', 12, 'manual', 'Pier, column'],
  ['Bearings, E abutment', 57, -9, null, null, 0, 'gps', 'Bearings'],
  /* no fix at all: the plate lays these on its own axis and says so */
  ['Channel, upstream', 30, -18, null, null, 0, 'guess', 'Channel'],
  ['Channel, downstream', 30, 16, null, null, 0, 'guess', 'Channel'],
];

const id = i => `s${String(i + 1).padStart(2, '0')}`;
const scenes = WALK.map(([name, t, off, heading, from, defects, kind, stop], i) => {
  const here = at(t, off);
  const s = { id: id(i), name, stop, view: { yaw: 0, pitch: 0 }, hotspots: [] };
  /* Chainage, on the photos taken from the deck. The ones underneath and down
     in the channel have none, which is the real mixture: an option that is
     blank on half the plate is worth seeing before it ships. */
  if (Math.abs(off) <= 5) s.station = `1+${String(Math.round(t + 8)).padStart(2, '0')}`;
  if (kind === 'gps') s.geo = geoAt(here);
  if (kind === 'manual') { s.geo = geoAt(here); s.plan = { x: here.x, y: here.y }; }
  if (heading !== null) {
    s.geo = s.geo || {};
    s.geo.heading = heading;
    s.geo.headingFrom = from;
  }
  for (let d = 0; d < defects; d++) {
    s.hotspots.push({ id: `${s.id}d${d}`, type: 'defect', yaw: d * 20, pitch: -10, code: `D${d + 1}`, defect: 'Spall' });
  }
  /* Three photos both saw the truck and know which way they were facing, which
     is what lets the plate cross their bearings and draw it. Deliberately from
     three sides: sightings taken from along one kerb are near enough parallel
     that triangulate() refuses them, and quite right too — the crossing point
     of two nearly parallel lines moves a hundred metres for a degree of error. */
  if ([0, 8, 13].includes(i) && heading !== null) {
    s.vehicle = { yaw: +(((bearingTo(here, TRUCK) - heading + 540) % 360 - 180).toFixed(2)), width: 34 };
  }
  return s;
});

/* The walk, linked as it was walked: out along the north kerb, back along the
   south, with the under-deck photos hung off the abutments and the pier. One
   link is left one-way on purpose, and one photo is left unlinked, because
   both are things the plate is supposed to make visible. */
const link = (a, b, yaw, both = true) => {
  scenes[a].hotspots.push({ id: `l${a}-${b}`, type: 'link', target: id(b), yaw, pitch: -20 });
  if (both) scenes[b].hotspots.push({ id: `l${b}-${a}`, type: 'link', target: id(a), yaw: yaw + 180, pitch: -20 });
};
const NORTH_RUN = [0, 1, 3, 5, 7, 9, 11, 13, 14];
const SOUTH_RUN = [2, 4, 6, 8, 10, 12, 17];
NORTH_RUN.forEach((n, k) => k && link(NORTH_RUN[k - 1], n, 0));
SOUTH_RUN.forEach((n, k) => k && link(SOUTH_RUN[k - 1], n, 0));
link(1, 2, 90);      /* across the west abutment */
link(7, 8, 90);      /* across the pier */
link(13, 12, 90);    /* across the east abutment */
link(1, 15, -30);    /* down to the bearings */
link(7, 16, -30);    /* down to the pier cap */
link(17, 18, -60, false); /* one way only: you can get down the bank, not back up */

/* ---------- the page ---------- */

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan view, twenty photos — Bridge Tour</title>
<style>
${css}
  /* the preview's own chrome, and nothing else: everything above this comment
     is tour/index.html's stylesheet, lifted whole */
  body { margin: 0; background: var(--bg); color: var(--ink); }
  .pv-stage { position: relative; height: 100vh; }
  .pv-lede { margin: 0; font-size: var(--t-sm); color: var(--ink-2); max-width: 46ch; }
  .map-head { flex-wrap: wrap; }
</style>
</head>
<body>
<div class="pv-stage" id="stage">
  <div class="map-view" role="region" aria-label="Plan view preview">
    <header class="map-head">
      <h2>Plan view &mdash; 20 photos</h2>
      <p class="pv-lede">A two-span skew bridge, walked out along one kerb and
        back along the other. Drag any arrow to turn it.</p>
      <ul class="map-legend">
        <li><span class="lg" aria-hidden="true"></span>GPS fix</li>
        <li><span class="lg lg-guess" aria-hidden="true"></span>guessed &mdash; drag it home</li>
        <li><span class="lg lg-manual" aria-hidden="true"></span>placed by hand</li>
        <li><span class="lg lg-on" aria-hidden="true"></span>the photo you are editing</li>
        <li><span class="lg lg-stray" aria-hidden="true"></span>not in the walk yet</li>
        <li><span class="lg lg-aim" aria-hidden="true"></span>which way it looks &mdash; drag to turn</li>
      </ul>
      <label class="map-opt">Labels
        <select id="labels" aria-label="What each photo is labelled with">
          <option value="name">Name</option>
          <option value="stop">Photo stop</option>
          <option value="station">Station</option>
          <option value="none">None</option>
        </select>
      </label>
      <label class="map-opt" title="Dragging a photo onto another will not link them">
        <input type="checkbox" id="moveonly"> Move only
      </label>
      <label class="map-zoom" title="Pinch on a trackpad, or Ctrl+scroll, to zoom about the pointer">Zoom
        <input type="range" min="1" max="4" step="0.25" value="1" id="zoom" aria-label="Zoom the map">
      </label>
    </header>
    <div class="map-scroll"><div class="map-sheet">
      <p class="scene-note plan-how" id="plan-how"></p>
      <div class="plan-box" id="plan-box"></div>
      <p class="scene-note" id="plan-note"></p>
    </div></div>
  </div>
</div>
<script type="module">
${helperSource}

const SCENES = ${JSON.stringify(scenes, null, 2)};
let curSceneId = ${JSON.stringify(id(7))};
const PLAN_LABEL_MAX = 12;
let planLabels = null;
let planMoveOnly = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = h => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };

/* ---- the copy of renderPlan's markup this preview exists to show ---- */
function draw() {
  const box = document.getElementById('plan-box');
  box.innerHTML = '';
  const plan = planPositions(SCENES);
  const step = plan.scaled ? niceMetres(plan.span) : 0;
  if (step) box.style.setProperty('--plan-grid', (step / plan.span * 100).toFixed(4) + '%');

  const d = plan.deck;
  const x1 = d.from.u * 100, y1 = d.from.v * 100, x2 = d.to.u * 100, y2 = d.to.v * 100;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len * 3, ny = (x2 - x1) / len * 3;
  const seg = (ax, ay, bx, by, cls) => \`<line class="\${cls}" x1="\${ax.toFixed(2)}" y1="\${ay.toFixed(2)}"
    x2="\${bx.toFixed(2)}" y2="\${by.toFixed(2)}"\${cls === 'band' ? '' : ' vector-effect="non-scaling-stroke"'}/>\`;
  const edges = planEdges(SCENES, plan.pts);

  box.append(el(\`<svg class="plan-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
    <defs aria-hidden="true"><marker id="plan-arrow" class="plan-arrow" viewBox="0 0 8 8" refX="7" refY="4"
      markerUnits="userSpaceOnUse" markerWidth="4" markerHeight="4" orient="auto">
      <path d="M0 0 L8 4 L0 8 Z"/></marker></defs>
    <g class="plan-deck" aria-hidden="true">
      \${seg(x1, y1, x2, y2, 'band')}
      \${seg(x1 + nx, y1 + ny, x2 + nx, y2 + ny, 'edge')}
      \${seg(x1 - nx, y1 - ny, x2 - nx, y2 - ny, 'edge')}
      \${seg(x1 + nx, y1 + ny, x1 - nx, y1 - ny, 'abut')}
      \${seg(x2 + nx, y2 + ny, x2 - nx, y2 - ny, 'abut')}
      \${seg(x1, y1, x2, y2, 'mid')}
    </g>
    <g class="plan-edges" aria-hidden="true">\${edges.map(e => {
      const ex = (e.to.u - e.from.u) * 100, ey = (e.to.v - e.from.v) * 100;
      const l = Math.hypot(ex, ey);
      const ux = l ? ex / l * 2.6 : 0, uy = l ? ey / l * 2.6 : 0;
      const lit = e.a.id === curSceneId || e.b.id === curSceneId;
      const cls = [e.both ? '' : 'one', lit ? 'on' : ''].filter(Boolean).join(' ');
      return \`<line class="\${cls}"
        x1="\${((e.from.u * 100) + ux).toFixed(2)}" y1="\${((e.from.v * 100) + uy).toFixed(2)}"
        x2="\${((e.to.u * 100) - ux).toFixed(2)}" y2="\${((e.to.v * 100) - uy).toFixed(2)}"
        \${e.both || !l ? '' : 'marker-end="url(#plan-arrow)"'} vector-effect="non-scaling-stroke"/>\`;
    }).join('')}</g>
  </svg>\`));

  /* arrows before dots, so a defect badge is never buried under one */
  for (const p of plan.pts) {
    const s = SCENES.find(x => x.id === p.id);
    const bear = facingBearing(s);
    const said = bear === null
      ? \`\${s.name} has no bearing yet. Drag this arrow, or press the arrow keys, to say which way it looks.\`
      : \`\${s.name} looks \${Math.round(bear)} degrees. Drag this arrow, or press the arrow keys, to change it.\`;
    const mark = el(\`<button class="plan-aim\${p.id === curSceneId ? ' on' : ''}\${bear === null ? ' unset' : ''}"
      data-aim-id="\${esc(p.id)}" role="slider" aria-valuemin="0" aria-valuemax="359"
      aria-valuenow="\${Math.round(bear ?? 0)}" aria-label="\${esc(said)}"
      title="\${esc(bear === null ? 'Not aimed yet — drag to turn' : Math.round(bear) + '° — drag to turn')}"
      style="left:\${(p.u * 100).toFixed(2)}%;top:\${(p.v * 100).toFixed(2)}%"
      ><svg viewBox="0 0 100 100" aria-hidden="true"><path d="\${AIM_DART}"/></svg></button>\`);
    mark.style.transform = \`translate(-50%, -50%) rotate(\${bear ?? 0}deg)\`;
    box.append(mark);
    wireAim(mark, box, plan);
  }

  const defects = defectCounts({ scenes: SCENES });
  const stray = new Set(strandedScenes({ scenes: SCENES, settings: { startScene: SCENES[0].id } }));
  const labelMode = planLabels ?? (plan.pts.length > PLAN_LABEL_MAX ? 'none' : 'name');
  for (const p of plan.pts) {
    const s = SCENES.find(x => x.id === p.id);
    const on = p.id === curSceneId;
    const label = [s.name, s.station && ('Sta ' + s.station)].filter(Boolean).join(' — ');
    const caption = { name: s.name, stop: s.stop, station: s.station && ('Sta ' + s.station) }[labelMode] || '';
    const where = { gps: 'from GPS', manual: 'placed by hand', guess: 'guessed' }[p.kind];
    const nd = defects.get(p.id) || 0;
    const lost = stray.has(p.id);
    const said = [\`\${label}, \${where}\`, nd ? \`\${nd} defect\${nd === 1 ? '' : 's'}\` : '',
      lost ? 'nothing links to it' : ''].filter(Boolean).join('. ');
    const dot = el(\`<button class="plan-dot k-\${p.kind}\${on ? ' on' : ''}\${lost ? ' stray' : ''}"
      data-plan-id="\${esc(p.id)}"\${caption ? ' data-name="' + esc(caption) + '"' : ''}
      title="\${esc(said)}" aria-label="\${esc(said)}"
      aria-current="\${on}" style="left:\${(p.u * 100).toFixed(2)}%;top:\${(p.v * 100).toFixed(2)}%"
      >\${nd ? \`<span class="plan-def num">\${nd > 9 ? '9+' : nd}</span>\` : ''}</button>\`);
    dot.addEventListener('click', () => { if (!dot.dataset.dragged) { curSceneId = p.id; draw(); } });
    wireMove(dot, box, plan, p.id);
    box.append(dot);
  }

  if (plan.vehicle) {
    const v = plan.vehicle;
    box.append(el(\`<svg class="plan-truck" viewBox="0 0 26 14" role="img"
      aria-label="Plant on the deck, crossed from \${v.from} photos"
      style="left:\${(v.u * 100).toFixed(2)}%;top:\${(v.v * 100).toFixed(2)}%">
      <path d="M1 2h13v8H1z"/><path d="M14 5h4l4 3v2h-8z"/>
      <circle cx="5" cy="11" r="1.6"/><circle cx="11" cy="11" r="1.6"/><circle cx="19" cy="11" r="1.6"/>
    </svg>\`));
  }
  if (plan.oriented) box.append(el('<span class="plan-north" aria-hidden="true">N</span>'));
  if (step) {
    box.append(el(\`<span class="plan-scale" aria-hidden="true"
      style="width:\${(step / plan.span * 100).toFixed(4)}%">\${+step.toFixed(2)} m</span>\`));
  }


  const counts = plan.pts.reduce((a, p) => (a[p.kind]++, a), { gps: 0, manual: 0, guess: 0 });
  const aimed = plan.pts.filter(p => facingBearing(SCENES.find(s => s.id === p.id)) !== null).length;
  const marked = [...defects.values()].reduce((a, n) => a + n, 0);
  const oneWay = edges.filter(e => !e.both).length;
  document.getElementById('plan-how').textContent =
    'Drag a photo to where it stood. Each photo carries an arrow for the way it looks — drag the arrow '
    + 'to turn it, or focus it and use the arrow keys. Click a photo to select it.';
  document.getElementById('plan-note').textContent = [
    \`Sized by GPS: about \${Math.round(plan.span)} m across — each grid square is \${+step.toFixed(2)} m.\`,
    counts.guess ? \`\${counts.guess} placed by capture order — drag them onto the right spot.\` : '',
    counts.manual ? \`\${counts.manual} moved by hand.\` : '',
    \`\${edges.length} links drawn between them, \${oneWay} of which walks one way only — dashed, with the arrow on the end that works.\`,
    stray.size ? \`\${stray.size} in red — nothing links to it, so it is in the record but not in the walk.\` : '',
    \`\${marked} defects counted on the photos that carry them.\`,
    \`Bearing known on \${aimed} of \${plan.pts.length} photos — turn a dashed arrow to aim another.\`,
    planLabels === null && labelMode === 'none'
      ? \`Names are off above \${PLAN_LABEL_MAX} photos because they overlap into a smear — the Labels control puts them back, or swaps them for the station or the photo stop.\`
      : '',
    plan.vehicle ? \`The truck is plant on the deck, crossed from \${plan.vehicle.from} photos that saw it.\` : '',
    'Phone GPS is good to a few metres, so treat this as a sketch.',
  ].filter(Boolean).join(' ');
}

/* Drag a photo to where it stood. The editor's version can also drop one dot
   on another to link them; this preview keeps only the move half, since there
   is nothing here to save a link into — which is exactly what the editor's
   Move only tick does, and the tick above turns the snap-to-neighbour off in
   the editor for the same reason it is absent here. */
function wireMove(dot, box, plan, id) {
  dot.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const rect = box.getBoundingClientRect();
    try { dot.setPointerCapture(ev.pointerId); } catch { /* the drag still works */ }
    let at = null;
    const move = e => {
      at = { u: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
             v: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)) };
      dot.classList.add('dragging');
      dot.style.left = (at.u * 100).toFixed(2) + '%';
      dot.style.top = (at.v * 100).toFixed(2) + '%';
    };
    const up = () => {
      dot.removeEventListener('pointermove', move);
      dot.removeEventListener('pointerup', up);
      dot.classList.remove('dragging');
      if (!at) return;
      dot.dataset.dragged = '1';
      SCENES.find(s => s.id === id).plan = plan.toMetres(at.u, at.v);
      draw();
    };
    dot.addEventListener('pointermove', move);
    dot.addEventListener('pointerup', up);
  });
}

/* drag to turn, the same three helpers the editor uses */
function wireAim(g, box, plan) {
  const p = plan.pts.find(x => x.id === g.dataset.aimId);
  const scene = SCENES.find(x => x.id === g.dataset.aimId);
  const drawAt = deg => {
    g.style.transform = \`translate(-50%, -50%) rotate(\${deg.toFixed(1)}deg)\`;
    g.classList.remove('unset');
    g.setAttribute('aria-valuenow', String(Math.round(deg)));
  };
  const commit = aim => {
    scene.geo = scene.geo || {};
    scene.geo.heading = headingForAim(scene, aim);
    scene.geo.headingFrom = 'hand';
    draw();
    box.querySelector('.plan-aim[data-aim-id="' + CSS.escape(p.id) + '"]')?.focus();
  };
  g.addEventListener('pointerdown', ev => {
    ev.preventDefault(); ev.stopPropagation();
    const rect = box.getBoundingClientRect();
    try { g.setPointerCapture(ev.pointerId); } catch { /* the turn still works */ }
    let aim = null;
    const move = e => {
      aim = aimFromPoint(p, { u: (e.clientX - rect.left) / rect.width, v: (e.clientY - rect.top) / rect.height });
      drawAt(aim);
    };
    const up = () => {
      g.removeEventListener('pointermove', move);
      g.removeEventListener('pointerup', up);
      if (aim !== null) commit(aim);
    };
    g.addEventListener('pointermove', move);
    g.addEventListener('pointerup', up);
  });
  g.addEventListener('keydown', e => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    commit(((facingBearing(scene) ?? 0) + dir * (e.shiftKey ? 15 : 5) + 360) % 360);
  });
}

/* zoom about the pointer — the same handler the editor runs, and the reason it
   measures twice rather than doing arithmetic on scroll offsets is written up
   at toggleMap() in tour/index.html */
const ov = document.querySelector('.map-view');
const scroll = ov.querySelector('.map-scroll');
const zoomInput = document.getElementById('zoom');
let mapZoom = 1;
const setZoom = (want, ax, ay) => {
  const z = Math.min(+zoomInput.max, Math.max(+zoomInput.min, want));
  if (z === mapZoom) return;
  const plate = document.getElementById('plan-box');
  const was = plate.getBoundingClientRect();
  const fx = was.width ? (ax - was.left) / was.width : 0.5;
  const fy = was.height ? (ay - was.top) / was.height : 0.5;
  mapZoom = z;
  ov.style.setProperty('--map-zoom', String(z));
  zoomInput.value = String(z);
  const now = plate.getBoundingClientRect();
  scroll.scrollLeft += now.left - (ax - fx * now.width);
  scroll.scrollTop += now.top - (ay - fy * now.height);
};
zoomInput.addEventListener('input', e => {
  const r = scroll.getBoundingClientRect();
  setZoom(+e.target.value, r.left + r.width / 2, r.top + r.height / 2);
});
scroll.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  setZoom(mapZoom * Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY);
}, { passive: false });
const labelSel = document.getElementById('labels');
labelSel.value = SCENES.length > PLAN_LABEL_MAX ? 'none' : 'name';
labelSel.addEventListener('change', e => { planLabels = e.target.value; draw(); });
document.getElementById('moveonly').addEventListener('change', e => { planMoveOnly = e.target.checked; draw(); });
draw();
</script>
</body>
</html>
`;

mkdirSync(join(root, 'design'), { recursive: true });
const out = join(root, 'design', 'plan-view-20.html');
writeFileSync(out, page);
console.log(`wrote ${out}`);
console.log(`  ${scenes.length} photos, ${scenes.reduce((n, s) => n + s.hotspots.filter(h => h.type === 'link').length, 0)} links, `
  + `${scenes.reduce((n, s) => n + s.hotspots.filter(h => h.type === 'defect').length, 0)} defects`);
console.log(`  ${(page.length / 1024).toFixed(0)}KB, self-contained`);
