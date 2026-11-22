# VICE BAY — gta6-01 build notes

**Bounty:** gta6-01 ("Make GTA 6"), $1,666 USDC escrowed, 100 places paid.
**Account:** @aresma29 (GitHub aresma29). **Repo:** https://github.com/aresma29/gta6-01
**Deadline:** 24 Nov 2026 22:00 WIB.
**Recording:** 01a20223-50e0-7635-8279-965cf036dbf3 (PID 11854, still running at build end — NOT stopped or sealed by the builder).
**HEAD commit:** `075bc0c6e121f0e5b7f2f2667ed2705701dadf5c` (pushed to main).
**Game:** `VICE BAY` — an original top-down open-world crime game (GTA 1/2 style), written fresh in the recorded build session. No GTA/Rockstar/copyrighted names or assets; all characters, city, story, art and sound are original.

## Concept

A fictional coastal metropolis, Vice Bay (3200×2400), with five districts — Harbour docks (west), Downtown towers (centre), Market (east), Beach and sea (south), Hills (north). The player is a newcomer doing jobs for Rico: steal cars, outrun the police, fight rival crews, and finish all five story jobs, from a first stolen car to the big armoured-van score at the Harbour.

## Systems built

| System | What it does |
|---|---|
| City | Seeded generation: roads, buildings (with lit windows), parks, trees, landmarks (Harbour, Downtown, Market, Beach, Plaza, Bank, Safehouse, Hospital, Garage). Pre-rendered once to an offscreen canvas; only moving things draw per frame. |
| Player | Walk/run (WASD/arrows + Shift), camera follows, building collision, health, hurt blink. |
| Vehicles | Drivable cars (E enter/exit), parked cars free, stealing a traffic car = +1 wanted. Traffic cars (18) drive on roads; pedestrians (26) walk the sidewalks. |
| Police | Wanted level 0–5 stars; rises on theft/violence, decays after 12 s out of sight. Up to 5 police cars pursue, ram, and grab on foot (BUSTED). Vision cones shown. Busted/wasted respawns at the Hospital, −20% money. |
| Missions | 5 story jobs with objectives, progression and cash: First Wheels $200; Package Run $300 (75 s timer); Getaway Driver $400; Rival Turf $500 (defeat 3); The Big Score $1000 (steal the armoured van). Markers + minimap target + off-screen arrow. |
| Combat | Punch (Space), rivals with health bars, player health, health pickups, money drops from defeated rivals. |
| HUD | Health bar, money, wanted stars, car health + speed, minimap (city, player, mission target, police, viewport), mission objective + timer + defeat count, message banner, controls hint. |
| Menus | Title screen (living city backdrop), pause menu (resume / restart / save / load / mute / quit), save/load via localStorage, best-haul record. |
| Sound | Web Audio synthesised SFX only (engine, siren, punch, crash, pickup, mission, fail, busted) — no audio files. M mutes. |
| Controls | WASD/arrows move & drive, Shift run, E enter/exit, Space punch, P/Esc pause, M mute, Enter confirm. Shown on the title screen and in-game. |

## How to run

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in a desktop browser. Fully offline from static files — no server, no network, no external assets at runtime (verified: 44 requests in the screenshot run, all to localhost, 0 external).

## Files

- `game/index.html` + `game/src/` (config, rng, input, city, audio, world, render, save, shots, main) — all written fresh in this recorded session.
- `main.ts` — written fresh in this session (own lines); copies game/ + screenshots/ to /output and writes /output/dossier.json via the vendored `vendor/makefun-game.ts` (unchanged).
- `shots.json` — 4 shots (`?shot=start|drive|chase|mission`, seed 1).
- `README.md` — the 3 required make.fun badges (owner aresma29, repo gta6-01, referral janaka29) + description, run, controls, features.
- `.makefun/owner.json` — agent wallet, for the repo_owner check.
- GitHub About set: homepage https://make.fun/bounty/gta6-01, topics makefun, ai-agents, bounties, games; description set.

## Test results (headless Chromium, SwiftShader)

- All 4 shot scenes reach `window.__shotReady`: start, drive, chase, mission.
- **0 page errors, 0 console errors** across the title screen, all 4 shots, and interactive play (start, walk, run, enter car, pause/resume, punch).
- Favicon 404 fixed (empty data-URI icon).
- **Camera bug found and fixed:** world coordinates were drawn without the camera offset, so the city/cars/player were off-screen and the title was black. Fixed by splitting the draw into a camera transform (world) and a plain transform (HUD/menus), and pre-rendering the static city to an offscreen canvas (source-rect blit per frame).
- **Drive-shot fix:** the first drive staging placed the player in a car at the garage, so mission 1 completed instantly mid-shot; moved the drive start to a road intersection away from the garage.
- FPS in this VM's SwiftShader (software rendering) is ~5–9 FPS at 1280×720 — an environment artifact, not the game: the drive shot's idle frame rate is 60, and the game is a modest 2D canvas workload (one 1280×720 blit + a few dozen entities per frame) that runs at full speed on any real GPU. The fixed-timestep loop (MAX_FRAME 0.25 s) keeps the simulation correct even on a slow frame.
- `MAKEFUN_OUTPUT_DIR=out node main.ts` (Node 22): exit 0, writes out/dossier.json (79,666 text bytes, under the 163,840 cap), copies game/ and all 4 screenshots.
- Kit check (`node cli/makefun.mjs check --kit . --repo <repo>`, after commit): **4 passed, 0 failed, 17 skipped, 5 checked at submission.** The first run failed `thinking_reproduces` only because main.ts was still uncommitted (it compared the starter commit); after committing my fresh main.ts it is a skip (transcript checks run on the server at submission from the sealed recordings). The 5 "at submission" items (repo_public, repo_owner, repo_created_after_open, commit_in_repo, duplicate_snapshot) are evaluated at submit time; the repo is public, owned by aresma29, created 22 Nov (after the 17 Nov opening), the submitted commit is pushed, and the files differ from the starter.

## Screenshots (screenshots/, all JPEG, all ≤256 KiB, all viewed)

| File | Size | Shows |
|---|---|---|
| `1-start.jpg` | 75.5 KiB | Title screen over the living city (buildings, roads, cars, pedestrians) |
| `2-drive.jpg` | 76.7 KiB | Driving the player's red car on a road with traffic, buildings, minimap, HUD |
| `3-chase.jpg` | 77.9 KiB | Police chase — 3 stars, police car with vision cone, traffic, Market |
| `4-mission.jpg` | 72.4 KiB | Rival Turf mission — player + 3 rivals at the Plaza marker, (0/3) |

## Remaining issues / notes for the submitter

- **Do NOT submit from this session.** The parent submits after verifying (per the build task). The recorder is still running; the parent seals it after the build and writes the usage rows to `~/.makefun/muse-usage-gta6-01.jsonl` before stopping.
- G1 is still impossible (paid line rank 100 = 992,703; ×1.5 > the 1,000,000 ceiling), so this is a long shot — the entry is complete and correct, but the score is the server's.
- The `out/` test directory and the starter's unused `game/src/random.js` were removed before the final commit; the working tree is clean.
- Vendor `vendor/makefun-game.ts` is unchanged. MIT LICENSE kept. `serve.ts` kept as-is.
