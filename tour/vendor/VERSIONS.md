# Vendored viewer libraries

Downloaded from jsDelivr, 2026-07-23. All MIT licensed.

| File | Package | Version |
|---|---|---|
| three.module.js | three | 0.184.0 |
| three.core.js | three (split-bundle half, imported by three.module.js as ./three.core.js) | 0.184.0 |
| psv-core.module.js / .css | @photo-sphere-viewer/core | 5.14.3 |
| psv-markers.module.js / .css | @photo-sphere-viewer/markers-plugin | 5.14.3 |
| psv-virtual-tour.module.js / .css | @photo-sphere-viewer/virtual-tour-plugin | 5.14.3 |
| psv-gallery.module.js / .css | @photo-sphere-viewer/gallery-plugin | 5.14.3 |
| psv-autorotate.module.js | @photo-sphere-viewer/autorotate-plugin | 5.14.3 |
| psv-gyroscope.module.js | @photo-sphere-viewer/gyroscope-plugin | 5.14.3 |
| psv-stereo.module.js | @photo-sphere-viewer/stereo-plugin | 5.14.3 |

Upgrade rules (verified 2026-07-23):

- All `@photo-sphere-viewer/*` packages are version-lockstepped — always pin
  every plugin to the exact same version as core (peer deps are exact-pinned).
- Core 5.14.3 requires three `^0.184.0`, which for a 0.x version means
  0.184.x ONLY. Do not bump three.js independently of PSV core.
- Little planet: use core's built-in `fisheye` option; the separate
  `little-planet-adapter` package is stale (5.7.4, 2024) — never add it.
- PSV v5 ships ESM only (no UMD). The app loads these via an import map;
  mapped specifiers: `three`, `@photo-sphere-viewer/core`, and each plugin.
