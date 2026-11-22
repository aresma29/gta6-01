# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aresma29/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aresma29/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE BAY** — an original top-down open-world crime action game. Explore a fictional coastal metropolis on foot and by car: steal vehicles, outrun the police, fight rival crews, and finish all five story jobs for Rico — from your first stolen car to the big armoured-van score at the Harbour. Everything (city, characters, story, art, sound) is original and made for this bounty.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. The game runs fully offline from static files — no server, no network, no downloads at runtime.

## How to play

- **WASD / arrow keys** — move on foot, drive when in a car (W accelerate, S brake/reverse, A/D steer)
- **Shift** — run on foot
- **E** — enter / exit a car (stealing a traffic car raises your wanted level; parked cars are free)
- **Space** — punch (fight rivals, or shove a civilian — at a cost)
- **P / Esc** — pause (resume, restart, save, load, mute, quit to title)
- **M** — mute sound

## The city

Vice Bay is a 3200×2400 coastal city with five districts: the Harbour docks in the west, Downtown towers in the centre, the Market in the east, the Beach and the sea in the south, and the Hills in the north. Roads, traffic, pedestrians, parks and landmarks fill every block. The minimap (top right) shows the city, your position, the mission target and every police car.

## Jobs (missions)

1. **First Wheels** — steal any car and drive it to the Garage.
2. **Package Run** — pick up a package at the Market and deliver it to the Beach before the timer runs out.
3. **Getaway Driver** — lose a 2-star wanted level and reach the Safehouse.
4. **Rival Turf** — clear the rival crew out of Downtown Plaza.
5. **The Big Score** — steal the armoured van from the Bank and bring it to the Harbour.

## Wanted system

Stealing a traffic car, hitting a pedestrian or fighting the police raises your wanted level (1–5 stars). Police cars pursue, ram your car and grab you on foot — get busted or wasted and you wake up at the Hospital, lighter by 20% of your money. Break line of sight and stay clean to let the heat decay.

## Features

- Freely explorable open city with roads, buildings, parks, beach and harbour
- Drivable cars with enter/exit and theft, live traffic and pedestrians
- Police pursuit with vision cones, wanted stars and decay
- Five story missions with objectives, progression and cash rewards
- Combat with rival gang members, health pickups and money drops
- Health, money, wanted stars, minimap, mission markers and a polished HUD
- Title screen, pause menu, restart, save/load (localStorage)
- Synthesised Web Audio sound effects (engine, siren, punches, jingles) — no audio files
- All art drawn in code; no external assets, no copyrighted material

---

<sub>Entered on [make.fun](https://make.fun/?ref=janaka29&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
