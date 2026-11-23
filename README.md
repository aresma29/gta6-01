[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aresma29/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aresma29/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# VICE BAY — a GTA 6 fan game (Stages 1–4)

Third-person 3D open-world game: a procedural coastal city at dusk,
a walk/run/jump character, drivable cars, a police pursuit system with a
helicopter, NPCs, combat, 4 story missions, and synthesized audio.
Desktop Chrome/Chromium, keyboard + mouse, fully offline.

## How to play

Open `game/index.html` in a desktop browser (or serve the repo root and
visit `game/index.html`). Click START. No install, no network.

- **WASD / arrows** — move (camera-relative)
- **Shift** — run
- **Space** — jump
- **E** — enter / exit the nearest car
- **F** — punch / fire (on foot) · **Q** — cycle weapon (FISTS → BAT → PISTOL)
- **Drag mouse** — orbit the camera
- **P / Esc** — pause · **M** — mute · **Enter** — start

## What is in the game

### Stage 1 — world + character
- Procedural character (red jacket, cap) with walk/run/jump animation.
- Procedural city: 7×7 road grid, ~70 buildings in 5 districts, 6 named
  landmarks, a neon tower, billboards, a plaza fountain, palms,
  streetlights, a beach and an animated sea. Dusk / golden-hour lighting.
- HUD: money, wanted stars, health, mission panel, VBPD dispatch,
  dialogue, circular minimap, district + clock + radio, speed, FPS meter.
- Save/load via LocalStorage. Deterministic (seed 1).

### Stage 2 — cars
- 5 drivable cars (Sunset GT, Taxi, Cruiser, Pickup, Van) + 4 traffic cars
  on fixed loops. Chase camera, headlights, visible damage (dent + smoke),
  car condition in the HUD. Enter with E; stealing a non-owned car raises
  your wanted level.

### Stage 3 — police, NPCs, combat
- VBPD pursuit: named dispatch units (UNIT 12 / 07 / 23), a helicopter
  (AIR 1) with a spotlight at wanted 3+, police rams that damage your car,
  heat that decays when you break line of sight, and a WASTED respawn at
  the Hospital. Wanted level 0–5, shown as stars + the dispatch board.
- 10 NPC pedestrians (walk, flee when the heat is on). Punching an NPC
  downs them and raises wanted; the Fixer Rico warns you at wanted 3+.
- Combat: FISTS → BAT → PISTOL (Q cycles), pistol shots raise wanted.

### Stage 4 — missions + audio
- 4 story missions with markers, timers, and cash rewards:
  - **M1 BEACH RUN — $100**: reach the ferris wheel on Sunset Strand.
  - **M2 PACKAGE RUN — $150**: two-leg courier run across the city.
  - **M3 LOSE THE HEAT — $200**: hit 3 stars, then drop back to 0.
  - **M4 CHECKPOINT DASH — $250**: three checkpoints against the clock.
  Completing all four takes your money from $250 to $950. The mission
  panel shows the live objective, timer, and reward; a beacon + ground
  ring mark the target. Missions start automatically, one after another.
- Synthesized audio (Web Audio, no files): engine hum whose pitch
  follows your speed, a siren wail when wanted ≥ 1, punch thud, pistol
  crack, pickup / checkpoint chimes, a mission-complete jingle, and a
  mission-fail tone. M mutes. Headless-safe: silent no-op when no audio
  device is present, so offline play and automated tests never break.

## Staged screenshots

Deterministic via `?shot=` + `window.__shotReady`:
`onfoot` (character on the street), `chase` (Sunset GT at speed, wanted 4,
police + helicopter + ferris wheel), `city` (aerial), `beach` (ferris wheel).

## Tech

Three.js r187 (vendored in `game/vendor/three/`, MIT). All art is
procedural (boxes + canvas textures). No external requests. `main.ts`
(Node 22) builds the submission dossier (`makefun/dossier/v1`).
