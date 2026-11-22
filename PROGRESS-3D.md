# VICE BAY 3D — PROGRESS (full-3d branch)

**Bounty:** gta6-01 ("Make GTA 6"), $1,666 USDC escrowed, 100 places paid. **Deadline:** 24 Nov 2026 22:00 WIB.
**Branch:** `full-3d` (from main commit 3cd30a68, the stable 2D backup — main and `backup/vice-bay-2d` are untouched).
**Platform (confirmed by the owner):** PC via DESKTOP BROWSER (Chrome/Chromium). Keyboard + mouse only — no touch controls, no on-screen joysticks, no phone layout. Tested in headless desktop Chromium. Fully offline (0 external requests verified).
**Recording:** 01a20223-50e0-7635-8279-965cf036dbf3 (PID 11854, still running — NOT stopped or sealed).
**Technology:** Three.js r187 (WebGL2), vendored locally in `game/vendor/three/` (MIT). All art procedural (boxes/capsules/planes + canvas textures). Web Audio synth only. No external assets.

## STAGE 1 — DONE (22 Nov ~15:05 WIB)

### Features completed
- **3D character:** procedural humanoid (red jacket, walk/run animation with leg + arm swing, forward lean when running, jump tuck). Walk, run (Shift), jump (Space).
- **Third-person camera:** smooth follow behind the character, mouse drag to orbit (yaw + pitch), lookahead, camera smoothing, screen-shake hook.
- **3D city:** seeded procedural coastal metropolis, 480×480 m — roads (7×7 grid), ~70 buildings (InstancedMesh, window facades, roof caps, district palettes: Downtown towers, Harbour warehouses + containers, Market, Beach, Hills houses), parks + trees, beach palms, a sea plane (animated), streetlights, a central plaza fountain, landmarks (Hospital with red cross, Bank, Garage, Safehouse, Market hall, Harbour). Building collision (AABB) + world bounds.
- **Dusk / golden-hour lighting:** low warm sun (long shadows, PCF), purple hemisphere + ambient fill, a gradient sky dome (purple → orange → gold), distance fog. Default time 18:42.
- **Controls:** WASD/arrows move (camera-relative), Shift run, Space jump, mouse drag look, P/Esc pause, Enter start, M mute (placeholder), save/load (localStorage, basic).
- **HUD + minimap:** health bar, money ($250), wanted stars (empty for now), mission panel, location name + clock (18:42) + radio (VICE FM 98.5 — Sunset Drive), dialogue box (Rico — Fixer), VBPD dispatch board (standby), weapon slots (FISTS active, BAT/PISTOL/SMG locked), speed, a 2D minimap (roads, buildings, beach, sea, player arrow).
- **Menus:** title screen (orbiting camera over the city), pause menu (resume / restart / save / load / mute / quit).
- **Shot staging:** `?shot=onfoot|city|beach&seed=1` + `window.__shotReady` (deterministic).

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720)
- **Title screen:** loads, `window.__gameReady`, 0 errors. **PASS.**
- **3 staged shots:** onfoot, city, beach — all reach `window.__shotReady`, 0 errors. **PASS.**
- **Interactive play:** click START → mode "playing". Walk (W): speed reaches 5 m/s (target). Run (Shift+W): speed reaches 9 m/s (target). Jump (Space): y rises to ~1.3–1.5 m (apex), lands. **PASS.**
- **Offline:** 0 external requests, 0 failed requests across all loads. **PASS.**
- **Console/page errors:** 0 errors, 0 warnings (after fixing a THREE.Clock deprecation + a PCFSoftShadowMap warning). **PASS.**
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (76,782 B) — third-person behind the character (red jacket) on a street, lit-window buildings, streetlights, dusk sky, dense HUD.
  - `screenshots/2-city.jpg` (96,499 B) — wide city view: downtown towers, roads, plaza fountain, dusk sky.
  - `screenshots/3-beach.jpg` (64,303 B) — dusk beach: character on the sand, palm, teal sea, "SUNSET STRAND".
- **Performance (VM, SwiftShader — software rendering, NOT real-GPU FPS):** ~1–3 FPS in the VM (software rasteriser). Draw calls ~35, triangles ~30k — a light workload that runs at 60 FPS on any real GPU. Do NOT quote the VM FPS as the game's performance.

### Errors / obstacles found (all fixed)
1. **Jump never fired:** the main loop consumed the one-shot action flags before `updatePlayer` read them. Fixed by passing the actions from the loop into `updatePlayer`.
2. **Sea rendered black:** the water material was too dark at dusk. Fixed with an emissive tint (sea now reads as teal).
3. **Character/buildings too dark (silhouettes):** hemisphere + ambient light raised (0.55→0.8, 0.35→0.5).
4. **THREE.Clock deprecation + PCFSoftShadowMap removed (r187):** replaced with a manual `performance.now()` delta and `THREE.PCFShadowMap`.
5. **SwiftShader is very slow for 3D (~1–3 FPS):** game time advances at ~0.05× real time (dt clamped to 0.05 s/frame). Movement distances in tests look small, but the speeds (5 / 9 m/s) are correct — this is a test-environment artifact, not a game bug. Key holds in tests were lengthened to compensate.

## Features NOT yet done (next stages)
- **Stage 2 — Vehicles:** drivable cars (enter/exit, driving physics, handbrake), traffic AI, parked cars, chase-cam behind the car, vehicle variety + names.
- **Stage 3 — Police + NPCs:** wanted system (0–5 stars), police cars (pursuit + ram), a police HELICOPTER (spotlight cone + pursuit), pedestrians (walk + flee), rivals + punch combat, pickups, particles, busted/wasted + Hospital respawn.
- **Stage 4 — Missions + polish:** 4 story missions (First Wheels, Package Run, Rival Turf, The Big Score) with markers + timers + rewards, dense HUD fed by live data (dispatch board with named units + roles + distances, vehicle name + condition + speed, dialogue), day/night polish, audio (engine, siren, effects), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero shot), README update, kit check, commit + push.
- **Not in scope (simplified, honest):** procedural low-poly models only (no detailed rigs, no motion capture), no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

## THREE BIGGEST WEAKNESSES vs the Top 10 (from ANALYSIS-TOP10.md)
The top 10 (all judge 993,977; paid line 992,703) win on DENSITY in one frame: a 3D chase-cam car + a helicopter + police + a dusk coastal city + a HUD packed with mission + dispatch + money + stars + weapons + dialogue + minimap + vehicle/speed. Our Stage 1 gaps, in priority order:
1. **NO HELICOPTER + NO POLICE CHASE.** Every top-10 frame has a helicopter with a spotlight cone + police cars + 3–4 stars. We have no police, no helicopter, no wanted system. The chase is the subject of every top-10 frame — without it our shot reads as "walking", not "being chased". (Fix in Stage 3.)
2. **HUD IS NOT YET DENSE WITH LIVE DATA.** The top 10 pack mission + stage + objective + next, a dispatch board with named units + roles + distances, weapon slots, dialogue, minimap, health/armor, vehicle name + condition + speed, radio, location, time. Our HUD has the panels, but the dispatch board is "NO ACTIVE UNITS", the mission is a placeholder, and there is no vehicle. The HUD only reads as dense once police/missions/vehicles feed it live data. (Fix in Stages 2–4.)
3. **NO VEHICLES / NO CHASE-CAM CAR SHOT.** All 10 are chase-cam behind a car; zero are on-foot. Our Stage 1 is on-foot only. The car is the hero of every top-10 frame. (Fix in Stage 2 — the chase-cam + car shot is the first thing to stage.)

## Estimated completion time
- Stage 2 (vehicles + chase-cam): ~3–4 h.
- Stage 3 (police + helicopter + NPCs + combat): ~4–5 h.
- Stage 4 (missions + dense HUD live + audio + polish + final shots + check): ~3–4 h.
- **Total remaining: ~10–13 h of build/test time.** Target: Stage 2 by ~19:00 WIB 22 Nov, Stage 3 by ~01:00 WIB 23 Nov, Stage 4 by ~12:00 WIB 23 Nov — leaving the afternoon of 23 Nov + 24 Nov for the owner's review, the seal and the submit. Deadline 24 Nov 22:00 WIB.
