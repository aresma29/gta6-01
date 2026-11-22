# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aresma29/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aresma29/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE BAY 3D** — an original full-3D third-person open-world crime game. Explore a fictional coastal metropolis on foot (and, in the full game, by car): a dusk-lit city of docks, towers, markets, beaches and hills, with a police wanted system, story jobs for the fixer Rico, and a living streetscape. Everything (city, characters, story, art, sound) is original and made for this bounty. Built with Three.js (r187, vendored locally) — no downloads at runtime.

> **Stage 1 (this branch, `full-3d`):** the playable core — a 3D character walking/running/jumping in the 3D city with a smooth third-person camera, collision, dusk lighting, HUD and minimap. Vehicles, police + helicopter, pedestrians, missions and full audio arrive in the next stages. The stable 2D version is preserved on `main` and `backup/vice-bay-2d`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser (Chrome/Chromium). The game runs fully offline from static files — no server, no network, no downloads at runtime.

## How to play

- **WASD / arrow keys** — walk (camera-relative)
- **Shift** — run
- **Space** — jump
- **Mouse drag** — look around (third-person camera)
- **F** — punch (combat arrives with the rivals in a later stage)
- **E** — enter / exit a car (vehicles arrive in a later stage)
- **P / Esc** — pause (resume, restart, save, load, mute, quit to title)
- **M** — mute sound

## The city

Vice Bay is a 480×480 m coastal metropolis at dusk (18:42, golden hour): the Harbour docks in the west, Downtown towers in the centre, Coral Row in the east, Sunset Strand and the sea in the south, and the Hills in the north. Roads, buildings with lit windows, parks, palms, streetlights and landmarks (Hospital, Bank, Garage, Safehouse, Market hall, Harbour, central Plaza) fill every block. The minimap (top right) shows the city, your position and the districts.

## Jobs (missions — arriving in the next stages)

1. **First Wheels** — steal any car and drive it to the Garage.
2. **Package Run** — pick up a package at the Market and deliver it to the Beach before the timer runs out.
3. **Rival Turf** — clear the rival crew out of Downtown Plaza.
4. **The Big Score** — steal the armoured van from the Bank and bring it to the Harbour.

## Wanted system (arriving in the next stages)

Stealing a traffic car, hitting a pedestrian or fighting the police raises your wanted level (1–5 stars). Police cars pursue and ram, a police helicopter tracks you with a spotlight, and officers can grab you on foot — get busted or wasted and you wake up at the Hospital, lighter by 20% of your money. Break line of sight and stay clean to let the heat decay.

## Features

- Full 3D third-person open world: a coastal city at dusk, explorable on foot
- Procedural 3D character with walk/run/jump animation and a smooth follow camera
- Seeded procedural city: roads, buildings, parks, beach, sea, palms, landmarks
- Dusk / golden-hour lighting: low warm sun, long shadows, gradient sky, fog
- Health, money, wanted stars, minimap, location + time + radio, dialogue, dispatch board
- Title screen, pause menu, restart, save/load (localStorage)
- Synthesised Web Audio sound effects (engine, siren, punches, jingles) — no audio files (wired in the next stages)
- All art generated in code; no external assets, no copyrighted material

---

<sub>Entered on [make.fun](https://make.fun/?ref=janaka29&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
