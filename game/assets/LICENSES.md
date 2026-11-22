# VICE BAY — asset licenses (visual prototype)

All assets in this folder are stored locally in the repo and loaded offline.
No external requests are made for them. No GTA V asset is used or copied.

## Rigged human characters — CC0 1.0 (public domain)

- `Casual_Male.glb` (1,752,060 B) — "Casual Male", rigged human with 17
  animations (Idle, Walk, Run, Jump, Punch, ...).
- `Casual_Female.glb` (1,759,956 B) — "Casual Female", same rig + clips.

Source: Quaternius, "Ultimate Animated Characters" pack.
Pack pages: https://quaternius.com/packs/animatedman.html
(and https://quaternius.com/packs/animatedwoman.html).
License: CC0 1.0 Universal (public domain) — the pack pages link to
https://creativecommons.org/publicdomain/zero/1.0/ and Quaternius
publishes all of its packs under CC0. No attribution required, no
restrictions on commercial use or modification.
Downloaded (22 Nov 2026) from the pack's CDN mirror:
https://cdn.cinevva.com/assets/packs/quaternius/ultimate-animated-characters/Casual_Male.glb
https://cdn.cinevva.com/assets/packs/quaternius/ultimate-animated-characters/Casual_Female.glb
(the Cinevva animation guide confirms these Quaternius files are CC0).

## GLTFLoader + utils — MIT License (three.js r187)

- `../vendor/three/jsm/loaders/GLTFLoader.js`
- `../vendor/three/jsm/utils/BufferGeometryUtils.js`
- `../vendor/three/jsm/utils/SkeletonUtils.js`

Source: three.js r187, https://github.com/mrdoob/three.js
(examples/jsm/loaders/GLTFLoader.js and examples/jsm/utils/*).
License: MIT (same as the vendored three.js core — see
`../vendor/three/LICENSE`). Files are used unmodified; the directory
layout mirrors three.js `examples/jsm/` so GLTFLoader's relative
imports (`../utils/BufferGeometryUtils.js`, `../utils/SkeletonUtils.js`)
resolve unchanged.
