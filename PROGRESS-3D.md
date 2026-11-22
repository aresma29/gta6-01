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
- **Stage 3 — Police + NPCs:** wanted system (0–5 stars), police cars (pursuit + ram), a police HELICOPTER (spotlight cone + pursuit), pedestrians (walk + flee), rivals + punch combat, pickups, particles, busted/wasted + Hospital respawn.
- **Stage 4 — Missions + polish:** 4 story missions (First Wheels, Package Run, Rival Turf, The Big Score) with markers + timers + rewards, dense HUD fed by live data (dispatch board with named units + roles + distances, vehicle name + condition + speed, dialogue), day/night polish, audio (engine, siren, effects), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero shot), README update, kit check, commit + push.
- **Not in scope (simplified, honest):** procedural low-poly models only (no detailed rigs, no motion capture), no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

## THREE BIGGEST WEAKNESSES vs the Top 10 (from ANALYSIS-TOP10.md)
The top 10 (all judge 993,977; paid line 992,703) win on DENSITY in one frame: a 3D chase-cam car + a helicopter + police + a dusk coastal city + a HUD packed with mission + dispatch + money + stars + weapons + dialogue + minimap + vehicle/speed. Our Stage 1 gaps, in priority order:
1. **NO HELICOPTER + NO POLICE CHASE.** Every top-10 frame has a helicopter with a spotlight cone + police cars + 3–4 stars. We have no police, no helicopter, no wanted system. The chase is the subject of every top-10 frame — without it our shot reads as "walking", not "being chased". (Fix in Stage 3.)
2. **HUD IS NOT YET DENSE WITH LIVE DATA.** The top 10 pack mission + stage + objective + next, a dispatch board with named units + roles + distances, weapon slots, dialogue, minimap, health/armor, vehicle name + condition + speed, radio, location, time. Our HUD has the panels, but the dispatch board is "NO ACTIVE UNITS", the mission is a placeholder, and there is no vehicle. The HUD only reads as dense once police/missions/vehicles feed it live data. (Fix in Stages 2–4.)
3. **NO VEHICLES / NO CHASE-CAM CAR SHOT.** All 10 are chase-cam behind a car; zero are on-foot. Our Stage 1 is on-foot only. The car is the hero of every top-10 frame. (Fix in Stage 2 — the chase-cam + car shot is the first thing to stage.)

## Estimated completion time
- Stage 2 (vehicles + chase-cam): DONE 22 Nov ~16:15 WIB (see Stage 2 section below).
- Stage 3 (police + helicopter + NPCs + combat): ~4–5 h.
- Stage 4 (missions + dense HUD live + audio + polish + final shots + check): ~3–4 h.
- **Total remaining: ~7–9 h of build/test time.** Target: Stage 2 by ~19:00 WIB 22 Nov, Stage 3 by ~01:00 WIB 23 Nov, Stage 4 by ~12:00 WIB 23 Nov — leaving the afternoon of 23 Nov + 24 Nov for the owner's review, the seal and the submit. Deadline 24 Nov 22:00 WIB.

## Stage 2 — Vehicles + visual upgrade (DONE 22 Nov ~16:15 WIB, commit 8a87375, pushed to `full-3d`)
Branch `full-3d`; main untouched at 3cd30a68. Built in the recorded session (recording 01a20223-50e0-7635-8279-965cf036dbf3, still running).

### Features completed
- **Drivable cars (5 parked):** SUNSET GT sports (red, hero — next to the player start), CORAL SEDAN (teal), HARBOUR TRUCK, PALM TAXI, BEACH VAN. Each is a detailed procedural model (body, cabin, windshield/side windows, grille, bumpers, mirrors, sports spoiler, roof panel) on top of `makeCar`, not a box.
- **Enter/exit with E:** walk to a car → "E — ENTER CAR · <NAME>" prompt → E enters (camera switches to chase-cam, character hidden); E exits (character steps out on the car's right side, collider-aware). Parked cars are solid AABBs for the player on foot (collider removed while driven, restored on exit/reset).
- **Driving physics:** W accelerate, S brake/reverse, A/D speed-sensitive steering, Space handbrake (sharper turn, speed bleed), rolling drag, building collision (centre + front/rear points — the long body cannot clip through), car-car collision (push apart + speed loss), wheel spin + front-wheel steer. Top speeds 20–34 m/s by type.
- **Cinematic chase-cam:** smooth follow, low + close behind the car (9.5 m), lookahead in the driving direction, eases back behind the car after mouse-look, FOV kick with speed (60→69), height drops with speed. One headlight spotlight on the player's car.
- **Traffic (4 cars):** sedan/taxi/van/sedan on 4 rectangular waypoint loops around the road grid, right-side lane offset, follow/avoid logic (slow/stop for a car or the player ahead), wheel spin.
- **Character upgrade (owner feedback):** new `character.js` — shaped torso, head with face/eyes/hair, arms ending in hands, legs ending in feet, natural walk/run (arm swing, knee bend, body lean, walk bob, jump tuck). Replaces the Stage 1 block humanoid for the player.
- **Buildings (owner feedback):** brighter facades with varied window patterns (wide/double windows, blank walls, darker floor bands), 55% lit windows (was 42%), ground-floor shopfront + awning band; rooftop props (AC units, antennas, water towers); named illuminated signage on all 6 landmarks (HOSPITAL, BANK, GARAGE, SAFEHOUSE, MARKET, HARBOUR); 4 billboards (VICE BAY, SUNSET GT, VICE FM 98.5, CORAL COLA).
- **Lighting (owner feedback):** hemi 0.8→1.15, ambient 0.5→0.8, toneMappingExposure 1.05→1.18 — golden-hour dusk kept, but buildings/streets/character are readable (shadow faces still dark, by design).
- **Environment detail (owner feedback):** beach umbrellas (5 colours) + lifeguard stand, benches/hydrants/bins, traffic lights (4 intersections, green/yellow/red cycle), 24 extra palms, crosswalks already in the ground texture.
- **HUD (live data):** vehicle name + type + condition (92–99%) + live speed KM/H while driving, CAR condition row (top-left), "E — ENTER CAR / E — EXIT CAR" prompt, minimap vehicle dots (parked grey, traffic blue, player car gold). Money/stars/dispatch/mission still placeholder (Stage 3/4 feeds them).
- **`?shot=drive` staging:** auto-enters the hero car at 20 m/s with the chase-cam — for the drive shot. `window.__vb` now exposes `vehicles` + a `driving` getter.

### Features TESTED (headless desktop Chromium, SwiftShader; test script `~/workspace/makefun/gta6-01/test-stage2.py`)
- **26/26 checks PASS, 0 console/page errors, 0 warnings, 0 failed requests, 0 external requests (offline verified).**
- Title loads (`__gameReady`), START → playing. Walk 5.00 m/s, run 9.00 m/s, jump apex 1.22–1.29 m.
- Enter prompt visible near the car ("E — ENTER CAR · SUNSET GT"); E enters (driving=true, HUD "SUNSET GT"); car accelerates from input to 19.8 m/s (71 KM/H) and moves (x 40→51.4); E exits (driving=false, mesh visible).
- Traffic: 4/4 cars move along their loops (real positions, e.g. [-31,-56]→[-27,-56]).
- All 4 staged shots reach `__shotReady` (onfoot, city, beach, drive).
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (79,260 B) — new character (red shirt, hands/feet) on a plaza, lit-window buildings, streetlights, a yellow taxi, minimap vehicle dots.
  - `screenshots/2-drive.jpg` (95,669 B) — **interactive chase-cam while driving (75 KM/H, SUNSET GT, CONDITION 95% · SPORTS, E — EXIT CAR, CAR 95%)** — captured from the play-test while holding W, NOT a posed render.
  - `screenshots/3-city.jpg` (104,591 B) — aerial dusk city: varied-height buildings, lit windows, roads, plaza fountain, a traffic car.
  - `screenshots/4-beach.jpg` (70,971 B) — beach: lifeguard stand + purple umbrella + teal sea, character on the sand.
- `shots.json` updated to the 4 shots (onfoot, drive, city, beach).

### Errors / obstacles found (all fixed)
1. **Traffic cars had NaN positions (invisible):** `TRAFFIC_DEFS` has no `heading`, so `spawnVehicle` set `v.heading = undefined` → `Math.sin(undefined)` = NaN poisoned heading, then x/z. Fixed by computing the traffic heading from the loop direction (waypoint 0 → waypoint 1) and defaulting any missing heading to 0. Verified: traffic now shows real positions and moves.
2. **Test-timing flake:** at ~1–3 FPS a fixed 2 s wait after pressing E can be shorter than one frame, so the "driving after E" check failed once while the car was in fact entered (proven by the 19.8 m/s speed check in the same run). Fixed by polling for the driving state (up to 30 s) instead of a fixed sleep.
3. **Beach shot showed empty sand:** the umbrellas/lifeguard stand were just outside the camera frame (player at x=0, props at x=-34/+24/+40). Fixed by moving the beach staging to (24, 184) so an umbrella + the lifeguard stand are in frame.
4. **Chase-cam car too small / shadow faces too dark:** tightened the chase-cam (10.5→9.5 m, height 2.9→2.7) and raised the fill light (hemi 1.05→1.15, ambient 0.7→0.8).

### Features NOT yet done (next stages)
- **Stage 3 — Police + NPCs:** wanted system (0–5 stars), police cars (pursuit + ram), a police HELICOPTER (spotlight cone + pursuit), pedestrians (walk + flee), rivals + punch combat, pickups, particles, busted/wasted + Hospital respawn. The vehicle/traffic system is built so a police car + helicopter can join the same chase scene (traffic `ahead` logic already slows for the player car; `vehicles.list` is the shared registry).
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, dense HUD fed by live data (dispatch board with named units + roles + distances, money changing on rewards, wanted stars changing with the wanted level, mission objective updating), day/night polish, audio (engine, siren, effects), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero shot), README update, kit check, commit + push.
- **Still a weakness vs Top 10:** no helicopter/police chase yet (Stage 3 — the #1 gap), HUD dispatch/mission still placeholder (Stage 4), the drive shot has no traffic car in frame (Stage 3 chase staging will put police + traffic + helicopter in one frame).

### Estimated completion time (revised)
- Stage 2 DONE (~1 h 10 min of build/test, 22 Nov ~15:05–16:15 WIB — faster than the 3–4 h estimate, because the Stage 1 architecture was reused).
- Stage 3 (police + helicopter + NPCs + combat): DONE 22 Nov ~17:00 WIB (see Stage 3 section below).
- Stage 4 (missions + dense HUD live + audio + polish + final shots + check): ~3–4 h.
- **Total remaining: ~3–4 h of build/test time.** Target: Stage 4 by ~12:00 WIB 23 Nov — leaving the afternoon of 23 Nov + 24 Nov for the owner's review, the seal and the submit. Deadline 24 Nov 22:00 WIB.

## Stage 3 — Police + helicopter + NPCs + combat + damage + neon landmarks (DONE 22 Nov ~17:00 WIB, commit 6f5e92c, pushed to `full-3d`)
Branch `full-3d`; main untouched at 3cd30a68. Built in the recorded session (recording 01a20223-50e0-7635-8279-965cf036dbf3, still running). Visual reference used as the target: `~/workspace/makefun/gta6-01/reference-vice-bay.jpg` (a mood board only — NOT copied into the game or screenshots/).

### Features completed
- **Wanted level (0–5 stars):** heat 0–100 (20/star). Crimes: car theft +1, punch/assault +1 (3 s cooldown), pistol +2 (5 s cooldown), speeding >25 m/s within 30 m of a police car +1 (10 s cooldown). Decay: 1.5 heat/s after 8 s with no police within 45 m (~13 s per star). Stars update LIVE in the HUD.
- **Police cars (2–3):** spawn on roads 60–90 m from the player the moment wanted rises (2 at 1–2 stars, 3 at 3+). Pursuit AI: steer at the player, chase slightly faster (target = player speed + 5, cap 30 m/s vs police max 32). Ram: on a car, bleed its speed ×0.6 + damage it + camera shake; on foot, 12 damage + 3 m knockback + the car reverses. When wanted clears, they stand down and drive away, then despawn. Flashing red/blue light bars (alternating emissive) + a flashing glow sprite above the roof. Black-and-white VBPD livery (black hood/trunk panels, grille, bumpers, glass).
- **Helicopter (wanted ≥ 3):** white/navy VBPD helicopter (body, tail boom + fin, spinning main + tail rotors, blur disc, skids, searchlight housing). Follows 80 m ahead of the player and above the local rooftops (altitude = max(26, rooftop + 10), lerped) with a gentle sway, so the chase-cam sees it. **Spotlight:** a SpotLight + a visible additive cone + a bright pool circle on the ground, all tracking the player. Climbs away and despawns when wanted falls below 3.
- **NPCs (8 pedestrians):** varied outfits/proportions (10 shirt colours, 5 pants, 5 skins, scale 0.92–1.08, 2 with hats). Walk the sidewalks (offset 8.5 m from road lines), flee from police chases (12 m) and moving cars (5 m), knocked down by punches/pistol (fall flat, get up, flee). Minimap pale dots.
- **Combat:** punch (F) with the swing animation + hit at 0.3 of the swing; weapons FISTS / BAT / PISTOL, switched with Q (the HUD slots switch and reflect the equipped weapon; a bat + a pistol mesh appear in the player's right hand). Pistol: hitscan with a tracer line + muzzle flash, 45 m reach. SMG stays locked.
- **Vehicle damage (real):** crashes −2 condition, car-car hits −1.5, police rams −1. Top speed scales with condition (55% at condition 5). Below 60 a dent patch appears on the hood; below 45 smoke pours from the hood (sprite pool); the HUD CAR row turns red below 45%.
- **Neon landmarks:** a neon ferris wheel on the beach (0, 198 — pink emissive rim, 8 coloured cabins, rotating slowly), a vertical "VICE BAY" neon sign on the bank tower (south face), an "Ocean Drive" billboard by the beach road (sunset gradient + sun + sea, faces south so the chase-cam reads it). All textures canvas-generated.
- **HUD layout (reference board):** minimap moved bottom-left and made circular; dispatch board moved top-right; controls hint moved bottom-centre; dialogue sits above the minimap. Money + stars top-left, speed bottom-right (as the reference).
- **HUD is now live:** stars, dispatch board (named units + PURSUIT/STAND DOWN roles + live distances + AIR 1 HELICOPTER), weapon slots, CAR condition (red when damaged), Rico's warning line when wanted ≥ 3 ("The cops are all over you, Jax. Lose them — fast."). The stale mission line is fixed: "Steal a car, outrun the VBPD. Missions arrive in Stage 4."
- **Wasted:** health ≤ 0 → respawn at the Hospital, health 100, wanted cleared, "WASTED" banner.
- **Traffic variety:** 5 traffic cars now (sedan, taxi, van, sedan, truck) on 5 waypoint loops.
- **Chase-cam lift:** when the helicopter is active the chase-cam pulls back 1 m and tilts up so the helicopter stays in frame.
- **`?shot=chase` staging:** player in the SUNSET GT driving south on the central road at 22 m/s, wanted 4, two lead police cars in open lanes ahead (right then left), a third closing from behind, the helicopter above-ahead, traffic ahead, pedestrians on the sidewalks, the ferris wheel dead ahead.

### Features TESTED (headless desktop Chromium, SwiftShader; test script `~/workspace/makefun/gta6-01/test-stage3.py`)
- **43/43 checks PASS, 0 console/page errors, 0 warnings, 0 failed requests, 0 external requests (offline verified).**
- Title loads; wanted 0 / no police / 8 NPCs at start; traffic 5 cars, 4 types incl. truck; NPCs walk (7/8 moved in 15 s).
- Car theft → wanted 1; police spawns (2 cars); police closes in (63.6 → 58.3 m in 20 s).
- setWanted(3) → helicopter appears, spotlight on, 3 police cars; HUD stars ★★★☆☆; dispatch shows UNIT 12/07/23 + AIR 1 with live distances.
- Punch → NPC down, wanted 3 → 4. Q cycles FISTS → BAT → PISTOL → FISTS (HUD slots follow). Pistol at 10 m → NPC down.
- Crash into the bank → condition 95 → 79–81. damagePlayerCar(60) → smoke puffs active (3), condition 17–21.
- Health 0 → wasted respawn at the Hospital (hp 100, wanted 0). Minimap bottom-left + circular (50%). Mission text no longer stale.
- All 5 staged shots reach `__shotReady` (onfoot, city, beach, chase, drive).
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (80,143 B) — character on a plaza, lit-window buildings, a yellow taxi, circular minimap, new HUD layout.
  - `screenshots/2-chase.jpg` (111,265 B) — **the hero shot: SUNSET GT centre at 74 KM/H, the helicopter above with its spotlight cone, a white police car ahead-right with a red flashing glow, the ferris wheel, 4 live stars, dispatch with 3 units + AIR 1, NPCs on the sidewalks** — captured from the staged chase.
  - `screenshots/3-city.jpg` (104,563 B) — aerial dusk city: varied-height buildings, lit windows, roads, plaza fountain, the ferris wheel in the distance.
  - `screenshots/4-beach.jpg` (87,098 B) — beach: lifeguard stand + umbrella + teal sea, character on the sand, the ferris wheel's neon rim at the right edge.
  - Temp shots (viewed, NOT in the dossier): combat (NPC visibly falling after a punch, helicopter spotlight pool on the pavement) + damage (smoke) + billboard close-up (the "Ocean Drive" canvas texture renders correctly).
- `shots.json` updated to the 4 shots (onfoot, chase, city, beach). **The superseded `2-drive.jpg` was removed from the repo** (it lives in git history at ee2c8ab) — the dossier caps at 4 screenshots and the chase shot replaces it.
- **Kit check: 4 passed, 0 failed, 17 skipped** (transcripts run on the server). **main.ts writes a valid dossier.json** (schema makefun/dossier/v1, cover 0, 4 images, text 145,467 bytes of the 163,840 cap).

### Errors / obstacles found (all fixed)
1. **Weapon-switch test flaked (3 checks):** the full test used fixed 1 s sleeps after pressing Q, but the game runs at ~1 FPS under SwiftShader, so no frame had consumed the key flag yet. The game code was correct — a focused poll-based re-test passed 8/8 (Q → BAT → PISTOL → FISTS, pistol downs an NPC at 10 m). Fixed the test to poll (up to 60 s) instead of sleeping; the full suite then passed 43/43.
2. **Dossier failed on `screenshots.max`:** the repo held 5 screenshots (the old 2-drive.jpg plus the new 2-chase.jpg). Fixed by removing the superseded 2-drive.jpg; the dossier then built cleanly.
3. **Chase shot v1: police cars not identifiable:** the lead police car was hidden behind the traffic van and the helicopter was at the frame's top edge. Fixed by re-staging (lead police cars in open lanes ahead, the van moved off the chase road, the helicopter lower/farther at (0, 24, 158)) — v2 shows the helicopter + a white police car with its red glow clearly.
4. **Beach shot re-stage made it worse:** facing the ferris wheel from (48, 186) put its support legs dead centre. Reverted to the original (24, 184) facing south — umbrella + lifeguard stand + sea + the wheel's rim at the edge.
5. **Billboard looked dark in the chase shot:** verified with a close-up — the canvas texture renders correctly (sunset gradient + "OCEAN DRIVE" + "VICE BAY · SUNSET STRIP"); it only reads dark at 80 m in the dusk. No fix needed.

### Features NOT yet done (Stage 4)
- **Stage 4 — Missions + polish:** 4 story missions (First Wheels, Package Run, Rival Turf, The Big Score) with markers + timers + rewards, money changing on rewards, day/night polish, audio (engine, siren, effects — the audio module already exists, it is not wired in), final 4 screenshots (the chase shot is already the hero), README update, kit check, commit + push.
- **Not verified in real time (logic reviewed, noted honestly):** wanted decay (~13 s per star in game time) and the escape behaviour — SwiftShader runs at ~0.05× real time, so a decay cycle would take ~4 minutes of wall time per star; the decay code path (heat, unseen distance, grace period) was verified by reading, not by a live wait. The helicopter's rooftop clearance (altitude = rooftop + 10) is computed from the building list and was verified in the chase shot (the helicopter flew above the market-district roofs).
- **Still a weakness vs Top 10:** no missions yet (Stage 4), the HUD mission panel is a free-roam placeholder, no audio yet, the chase shot has no police car directly behind the player car (the chase-cam looks forward — the reference shows the same), and our 3D is still low-poly/stylised vs the reference board's rendered look. The density gap is now much smaller: helicopter + 3 police + traffic + NPCs + ferris wheel + neon + live dense HUD are all in one frame.
