# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aresma29/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aresma29/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE BAY 3D** — an original full-3D third-person open-world crime game. Explore a fictional coastal metropolis on foot (and, in the full game, by car): a dusk-lit city of docks, towers, markets, beaches and hills, with a police wanted system, story jobs for the fixer Rico, and a living streetscape. Everything (city, characters, story, art, sound) is original and made for this bounty. Built with Three.js (r187, vendored locally) — no downloads at runtime.

> **Stage 4 (this branch, `full-3d-v2`):** the complete game — missions, audio, police + helicopter, pedestrians, combat, vehicles, and the full HUD, all live and tested in desktop Chromium. The stable 2D version is preserved on `main` and `backup/vice-bay-2d`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser (Chrome/Chromium). The game runs fully offline from static files — no server, no network, no downloads at runtime.

## How to play

- **WASD / arrow keys** — walk (camera-relative)
- **Shift** — run
- **Space** — jump
- **Mouse drag** — look around (third-person camera); while driving, orbit the chase-cam
- **E** — enter / exit a car (stealing a car is a crime: +1 star)
- **Q** — cycle weapon (FISTS → BAT → PISTOL)
- **F** — attack with the current weapon
- **N** — next job (start / skip to the next mission)
- **P / Esc** — pause (resume, restart, save, load, mute, quit to title)
- **M** — mute / unmute sound

## The city

Vice Bay is a 480×480 m coastal metropolis at dusk (18:42, golden hour): the Harbour docks in the west, Downtown towers in the centre, Coral Row in the east, Sunset Strand and the sea in the south, and the Hills in the north. Roads, buildings with lit windows, parks, palms, streetlights and landmarks (Hospital, Bank, Garage, Safehouse, Market hall, Harbour, central Plaza) fill every block. The minimap (top right) shows the city, your position and the districts.

## Jobs (missions — live)

Four story jobs from the fixer Rico, run in sequence (press **N** to start / skip). Each has a gold beacon in the world and on the minimap, a live objective in the HUD, and a money reward that is added to your cash on completion:

1. **Beach Run** — drive to the beach marker. Reward $100.
2. **Package Run** — deliver to the market marker within 90 seconds. Reward $150.
3. **Lose the Heat** — get the VBPD to 3 stars, then lose them completely. Reward $200.
4. **Checkpoint Dash** — hit three checkpoints in order. Reward $250.

## Wanted system (live)

Stealing a car, hitting a pedestrian or fighting the police raises your wanted level (1–5 stars). Police cars pursue and ram (on foot they can knock you down; in a car they dent it), a police helicopter tracks you with a spotlight at 3+ stars, and the dispatch board names every unit with its live distance. Get wasted and you wake up at the Hospital. Break line of sight and stay clean to let the heat decay. A cruiser pinned against a building backs out and tries a different angle — there is no full pathfinding, so a cruiser can still be delayed by a block.

## Audio (live, synthesized)

All sound is generated with Web Audio — no audio files, no downloads: engine hum (pitch follows speed), police siren while wanted, gunshot, punch thud, reward chime, and a quiet ambient city pad. **M** mutes everything.

## Features

- Full 3D third-person open world: a coastal city at dusk, explorable on foot and by car
- Procedural 3D character with walk/run/jump animation and a smooth follow camera
- 5 drivable cars (arcade physics, damage, traffic, chase-cam with FOV kick) + 4 traffic cars
- Seeded procedural city: roads, buildings, parks, beach, sea, palms, landmarks, neon (ferris wheel, VICE BAY sign, billboards)
- Wanted system: police pursuit + rams, helicopter with spotlight, live dispatch board
- 10 pedestrians who walk the sidewalks and flee from chases and attacks
- Combat: fists / bat / pistol (hitscan, tracer, muzzle flash), weapon slots in the HUD
- 4 story missions with beacons, timers, checkpoints and money rewards
- Synthesised Web Audio sound (engine, siren, gunshot, punch, chime, ambient) — no audio files
- Dense live HUD: money, stars, health, weapon slots, vehicle name/condition/speed, mission panel, dispatch, dialogue, minimap (player, cars, police, helicopter, NPCs, mission marker), district, clock, radio, FPS meter
- Title screen, pause menu, restart, save/load (localStorage)
- All art generated in code; no external assets, no copyrighted material

---

<sub>Entered on [make.fun](https://make.fun/?ref=janaka29&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
