# VICE BAY — a GTA 6 fan game (Stage 1)

Third-person 3D open-world prototype: a procedural coastal city at dusk,
a walk/run/jump character, a chase camera, a live HUD with minimap, and
save/load. Desktop Chrome/Chromium, keyboard + mouse, fully offline.

## How to play

Open `game/index.html` in a desktop browser (or serve the repo root and
visit `game/index.html`). Click START. No install, no network.

- **WASD / arrows** — move (camera-relative)
- **Shift** — run
- **Space** — jump
- **Drag mouse** — orbit the camera
- **P / Esc** — pause · **M** — mute · **Enter** — start

## Stage 1 scope

- Procedural character (red jacket, cap) with walk/run/jump animation.
- Procedural city: 7×7 road grid, ~70 buildings in 5 districts, 6 named
  landmarks, a neon tower, billboards, a plaza fountain, palms,
  streetlights, a beach and an animated sea. Dusk / golden-hour lighting.
- HUD: money ($250), wanted stars, health, mission panel, VBPD dispatch,
  dialogue, circular minimap, district + clock + radio, speed, FPS meter.
- Save/load via LocalStorage. Deterministic (seed 1).
- Staged screenshots: `?shot=onfoot|city|beach|plaza&seed=1`.

## What is NOT here yet

Cars (Stage 2), police / helicopter / NPCs / combat (Stage 3), missions
and audio (Stage 4). The mission panel and dispatch board are placeholders
until those stages feed them live data.

## Tech

Three.js r187 (vendored in `game/vendor/three/`, MIT). All art is
procedural (boxes + canvas textures). No external requests. `main.ts`
(Node 22) builds the submission dossier (`makefun/dossier/v1`).
