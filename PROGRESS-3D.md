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

---

## REBUILD — Stage 1 (core) — DONE 22 Nov ~17:05 WIB (new recording)

**Why a rebuild:** the old recording 01a20223 died when the VM was replaced (~15:30 WIB), so the old Stage 3 was unwitnessed and cannot be submitted. The old Stage 2 tip (ee2c8ab) was sealed + submitted as a backup (accepted, stage scored). This rebuild re-authors the whole game under a NEW recording so every file is witnessed and submittable.
**Branch:** `full-3d-v2` (from the old Stage 3 tip dcdafce; main + `backup/vice-bay-2d` untouched at 3cd30a68).
**Recording:** 01a202aa-b90a-7499-a6cc-0358480ff238 (PID 13812, started 16:51:12 WIB, running — NOT stopped or sealed).
**Authorship rule followed:** every game file was written FRESH via muse.write in this session, without reading the old files first (the old game source was deleted before the rewrite, so no line could be copied). Verified: none of the 8 rewritten files is byte-identical to its old version.

### What was deleted (and why)
The old Stage 2–4 modules were removed from the repo in this commit (they live in git history on `full-3d` at dcdafce, nothing is lost): `actors.js`, `audio.js`, `citydetails.js`, `combat.js`, `damage.js`, `neon.js`, `npcs.js`, `police.js`, `vehicles.js`. They are Stage 2–4 features, not Stage 1, and leaving them in place would have put unwritten (pre-recording) lines into the dossier. **Each later stage MUST write its modules fresh via muse.write — never restore them from git history.**

### Features completed (all fresh)
- **3D character:** shaped humanoid (red jacket, shirt V, collar, gold chain, head with face/eyes/hair/cap, arms ending in hands, legs ending in feet), walk/run animation (limb swing, knee bend, body bob, forward lean at a run, jump tuck, idle breathing).
- **Third-person camera:** smooth follow, mouse drag to orbit (yaw + pitch), lookahead, camera smoothing.
- **3D city:** seeded (seed 1) 480×480 m dusk coastal city — 7×7 road grid, ~70 buildings in five districts (Downtown towers 26–58 m, Harbour warehouses, Market, Beach, Hills houses), 6 named landmarks with illuminated signs (HOSPITAL + red cross, BANK, GARAGE, SAFEHOUSE, MARKET, HARBOUR) + a tall tower with a vertical pink "VICEBAY" neon sign, 4 billboards (VICE BAY, SUNSET GT, VICE FM 98.5, CORAL COLA), beach + teal sea (animated texture), ~40 palms, streetlights on every road, plaza fountain, park trees, harbour containers, benches/hydrants/bins, 10 parked prop cars, beach umbrellas + lifeguard stand.
- **Dusk / golden-hour lighting:** low warm sun over the sea (east), purple hemisphere + ambient fill (hemi 1.15, ambient 0.8, exposure 1.18), gradient sky dome (purple → magenta → orange), distance fog.
- **Controls:** WASD/arrows move (camera-relative), Shift run, Space jump, mouse drag look, P/Esc pause, Enter start, M mute (placeholder — audio arrives in Stage 4), save/load (localStorage).
- **HUD (all live state):** money ($250), wanted stars (0 — ☆☆☆☆☆), health bar (100), mission panel (FREE ROAM — "Explore the city. Missions arrive in Stage 2."), VBPD dispatch board (STANDBY — no active units, live from the wanted level), dialogue box (Rico — Fixer), circular minimap (roads, buildings, beach, sea, plaza, player arrow, N tick), location name (district, live) + clock (18:42, advancing 1 min / 10 s) + radio (VICE FM 98.5), live speed KM/H, controls footer.
- **Menus:** title screen (orbiting camera over the city, START / CONTINUE when a save exists), pause menu (resume / save / load / restart / mute / quit to title).
- **Shot staging:** `?shot=onfoot|city|beach|plaza` + `window.__shotReady` (deterministic, seed 1). Test hooks: `window.__gameReady`, `window.__vb` (mode, player, money, health, wanted, clock, district, building/collider counts, start, teleport, setWanted).

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720; test script `~/workspace/makefun/gta6-01/test-rebuild-stage1.py`)
- **24/24 checks PASS, 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified).**
- Title loads (`__gameReady`), START → playing. Walk 5.00 m/s, run 8.11 m/s, jump apex 1.26 m (target ~1.5 m; the sampled apex is a lower bound — SwiftShader samples sparsely), lands. Save/load round-trips (teleport → save → teleport away → load → position restored).
- All 4 staged shots reach `__shotReady` (onfoot, city, beach, plaza).
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (86,534 B) — third-person behind the character (red jacket, cap) on a street by the plaza fountain, HOSPITAL sign + red cross, lit-window buildings, palms, streetlights, dusk sky, dense HUD.
  - `screenshots/2-city.jpg` (123,800 B) — aerial dusk city: ~70 buildings with lit windows, roads + crosswalks, plaza fountain, the VICE BAY vertical neon sign, HOSPITAL + SAFEHOUSE + BANK signs.
  - `screenshots/3-beach.jpg` (65,995 B) — dusk beach: character on the sand, an umbrella, teal sea with a golden sun glow, "SUNSET STRAND".
  - `screenshots/4-plaza.jpg` (88,703 B) — the plaza fountain + HOSPITAL sign + lit-window towers + palms, character centre frame.
  - The superseded old `2-chase.jpg`, `3-city.jpg`, `4-beach.jpg` were removed (they live in git history at dcdafce) — the dossier caps at 4 screenshots.
- `shots.json` rewritten for the 4 rebuild shots (onfoot, city, beach, plaza).
- `main.ts` rewritten fresh (Node 22, stdlib only): copies game/ + screenshots/ to the output dir and writes dossier.json with buildDossier. **Dossier valid:** schema makefun/dossier/v1, 4 images, text 67,689 bytes of the 163,840 cap, 6 source files (67,038 bytes), 3 vendored (three.js).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### Errors / obstacles found (all fixed)
1. **Favicon 404 (1 console error):** the browser requested /favicon.ico and got a 404. Fixed by adding `<link rel="icon" href="data:,">` to index.html. Re-test: 0 console errors.
2. **Walk-movement check failed (moved 1.2 m):** a fixed 2 s wait after reaching speed is only ~2–6 frames under SwiftShader (dt clamped to 0.05 s), so the player covers ~0.25 m/frame. The game was correct (speed 4.75 m/s). Fixed the test to poll for ≥3 m of displacement instead of a fixed sleep. Re-test: moved 3.1 m.
3. **Jump-apex check read 0.62 m:** the test read y once right after the poll fired (mid-rise). Fixed the test to sample y over time and take the max. Re-test: apex 1.26 m.
4. **Dossier failed on `screenshots.max` (6 files):** the repo held the old `3-city.jpg` + `4-beach.jpg` alongside the 4 new shots. Fixed by removing the two superseded old shots; the dossier then built cleanly.

### Honest notes
- **Beach shot is the weakest of the four:** the sand foreground is a wide empty expanse and the lifeguard stand sits at the frame's right edge. It is a genuine beach scene (character + umbrella + teal sea + sun glow + dense HUD), but the framing could be denser. Re-stage candidate for Stage 4's final shots.
- **The character reads dark from behind** (backlit by the low eastern sun). The red jacket + cap are visible, but the figure is mostly silhouette in the on-foot/beach shots. A camera-side fill light would help; noted for Stage 4 polish.
- **SwiftShader is ~1–3 FPS** in the VM (software rendering). Speeds are correct in game time; wall-time distances look small. This is a test-environment artifact, not a game bug. Draw calls are light (~70 buildings + props, one mesh each) — a real GPU will run it at 60 FPS.

### Features NOT yet done (next stages)
- **Stage 2 — Vehicles + chase-cam:** 5 drivable cars (SUNSET GT hero, CORAL SEDAN, HARBOUR TRUCK, PALM TAXI, BEACH VAN), enter/exit (E), driving physics, cinematic chase-cam, traffic cars, `?shot=drive`. **Must write `game/src/vehicles.js` fresh** (do not restore the deleted one).
- **Stage 3 — Police + NPCs + combat:** wanted 0–5 stars, police cars (pursuit + ram), police HELICOPTER (spotlight cone), pedestrians, punch/weapon combat, vehicle damage, neon landmarks (ferris wheel), `?shot=chase`. **Must write `game/src/police.js`, `npcs.js`, `combat.js`, `damage.js`, `neon.js`, `actors.js` fresh.**
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, money changing on rewards, dense HUD fed by live data, audio (Web Audio synth), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero), README update, kit check, commit + push. **Must write `game/src/audio.js` (+ `citydetails.js` if split out) fresh.**
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

### Estimated completion time (rebuild)
- Stage 1 DONE (~1 h of build/test, 22 Nov ~16:55–17:05 WIB).
- Stage 2 (vehicles + chase-cam): ~1–1.5 h. Stage 3 (police + helicopter + NPCs + combat): ~2–3 h. Stage 4 (missions + audio + polish + final shots): ~2–3 h.
- **Total remaining: ~5–7 h of build/test time.** Deadline 24 Nov 22:00 WIB — comfortable if Stages 2–4 run back-to-back under the same recording. **Do NOT stop or seal the recording until the owner approves the final result.**

---

## REBUILD — Stage 2 (vehicles + chase-cam) — DONE 22 Nov ~17:55 WIB (new recording)

**Branch:** `full-3d-v2`. **Recording:** 01a202aa-b90a-7499-a6cc-0358480ff238 (PID 13812, running — NOT stopped or sealed).
**Authorship rule followed:** `game/src/vehicles.js` written FRESH via muse.write in this session (no read of the old Stage 2 code — the old module lives only in git history on `full-3d` at dcdafce, never restored). `main3d.js` / `index.html` wired with targeted edits (the fresh vehicles.js carries the authorship; the edits add the chase-cam, HUD, prompt, drive shot and fill light).

### Features completed
- **Drivable cars (5 parked):** SUNSET GT sports (red hero, east side of the central road next to the player start), CORAL SEDAN (teal), HARBOUR TRUCK, PALM TAXI, BEACH VAN — each a detailed procedural model (body, cabin, glass, grille, bumpers, head/taillights, mirrors, GT spoiler + side skirts, truck bed + crates, taxi roof sign, van window band) on top of `buildCarMesh`.
- **Enter/exit with E:** walk to a car → "E — ENTER CAR · <NAME>" prompt → E enters (chase-cam, character hidden); E exits (steps out on the car's right side, collider-aware, camera swings behind the player). Parked/traffic cars are solid AABBs to the player on foot (driven car excluded).
- **Driving physics:** W accelerate, S brake/reverse, A/D speed-sensitive steering (less lock at speed), Space handbrake (sharper turn, speed bleed), rolling drag, building collision (centre + front/rear points, push-out + speed cut + condition damage on hard hits), car-car collision (push apart + speed loss), wheel spin + front-wheel steer. Top speeds 23–34 m/s by type; condition scales top speed.
- **Cinematic chase-cam:** low + close behind the car (9.5 m, lower + closer with speed), lookahead, FOV kick with speed (60→69), mouse-drag orbit offset that eases back to centre, one headlight spotlight on the driven car.
- **Traffic (4 cars):** sedan/taxi/van/sedan on 4 rectangular waypoint loops on the REAL road grid (roads at -192, -128, -64, 0, 64, 128, 192), right-lane offset, follow/avoid logic (slow/stop for a car or the player ahead), wheel spin.
- **HUD (live data):** vehicle name + type + condition + live KM/H while driving, CAR condition row (top-left, red below 45%), "E — ENTER CAR / E — EXIT CAR" prompt, minimap vehicle dots (parked grey, traffic blue, driven car gold), speed mode line (vehicle name · type / ON FOOT).
- **Banner fixed:** "Cars are here. The police arrive in Stage 3. Missions arrive in Stage 4." (was the stale "Missions arrive in Stage 2").
- **Camera-side fill light:** a warm directional light repositioned every frame from the camera onto the player / driven car — the character no longer reads as a dark silhouette from behind (verified in the on-foot shot: red jacket + cap readable).
- **Restart:** exits the car + resets every car to its spawn spot (new `vehicles.reset()`).
- **HUD bug fixed (Stage 1):** the speed span and its outer div shared the id `hud-speed`, so updating the speed wiped the KM/H + ON FOOT labels. Renamed to `hud-speed-num` / `hud-speed-mode`.
- **`?shot=drive` staging:** auto-enters the hero GT at 20 m/s (72 KM/H) heading south on the central road, chase-cam behind — for the drive shot. `window.__vb` now exposes `driving`, `car`, `traffic`, `parkedCount`, `camera`.

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720; test script `~/workspace/makefun/gta6-01/test-rebuild-stage2.py`)
- **31/31 checks PASS, 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified).**
- Title loads, START → playing. Walk 5.00 m/s (regression). 5 parked + 4 traffic cars spawn.
- Enter prompt appears near the car ("E — ENTER CAR · SUNSET GT"); E enters (driving=true, HUD "SUNSET GT"); car accelerates from input to 51 KM/H (HUD 51) and moves 7.5 m; E exits (driving=false, player steps out 1.8 m beside the car).
- Traffic: 4/4 cars move along their loops.
- All 4 staged shots reach `__shotReady` (onfoot, drive, city, beach).
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (101,481 B) — third-person behind the character (red jacket, cap, readable), plaza fountain, HOSPITAL sign, lit-window buildings, a yellow taxi + red GT + green van, minimap vehicle dots.
  - `screenshots/2-drive.jpg` (99,737 B) — **chase-cam while actually driving (67 KM/H, SUNSET GT, CONDITION 93% · SPORTS, E — EXIT CAR, CAR 93%)**, a traffic van ahead-right, minimap dots.
  - `screenshots/3-city.jpg` (138,177 B) — aerial dusk city: VICE BAY vertical neon sign, HOSPITAL + BANK + SAFEHOUSE signs, plaza fountain, traffic cars.
  - `screenshots/4-beach.jpg` (71,118 B) — beach: umbrella + teal sea + sun glow, character on the sand, lifeguard stand at the edge.
- `shots.json` updated to the 4 shots (onfoot, drive, city, beach). The superseded `2-city.jpg`, `3-beach.jpg`, `4-plaza.jpg` were removed (they live in git history at 983174f) — the dossier caps at 4 screenshots.
- `main.ts` writes a valid dossier.json (schema makefun/dossier/v1, cover 0, 4 images, text 95,732 bytes of the 163,840 cap).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### Errors / obstacles found (all fixed)
1. **Negative first-frame dt spun the car and flung the camera (the big one):** the loop computed `dt = min((now - lastNow)/1000, 0.05)` with no lower bound; the first rAF timestamp came in ~0.35 s BEFORE `performance.now()` captured at module load, so dt ≈ -0.35. That inverted the steering clamp (steer jumped to exactly 2.1 = 6×0.35), drove traffic speed to exactly -2.1, and gave the camera lerp a factor of -7.17, flinging it ~200 m away. The car spun ~1.6 turns and the camera took ~10 s to lerp back. Fixed by clamping dt to [0, 0.05] in the main loop AND in `vehicles.update()` (defense in depth). Verified with a probe: the hero now drives straight south (heading 0, x locked at 6.0), the camera sits low + close behind it (y ~2.5, ~10 m back), FOV 61→64. The same unclamped-dt bug existed in Stage 1 (harmless there — a small position glitch); the clamp fixes it for the whole game.
2. **Traffic loops used the wrong roads:** first draft put loops on roads at ±60/±120/±180, but the real grid is -192, -128, -64, 0, 64, 128, 192 — cars would have driven through buildings. Fixed before testing by redefining all 4 loops on real roads.
3. **Drive-shot camera was an aerial view (before the dt fix):** same root cause as (1) — the negative-dt camera fling. Resolved by the dt clamp; the re-shot 2-drive.jpg is a proper low chase-cam.
4. **Dossier failed on `screenshots.max` (7 files):** the repo held the old `2-city.jpg`, `3-beach.jpg`, `4-plaza.jpg` alongside the 4 new shots. Fixed by removing the three superseded files; the dossier then built cleanly.
5. **Test-threshold misread:** "car moves" failed at 7.5 m against a 10 m threshold — the car had reached 51 KM/H and was still accelerating, so 7.5 m was exactly the physics (15 m/s² over ~1 s). The game was correct; the threshold was lowered to 5 m. Re-test: 31/31.
6. **Test script syntax error:** a backslash inside an f-string expression (`\"`) — fixed by hoisting the value to a variable first.

### Features NOT yet done (next stages)
- **Stage 3 — Police + NPCs + combat: DONE (salvaged, see the Rebuild-v3 Stage 3 record below).** Commit e1bdc5d (code) + second commit (screenshots, shots.json, this record).
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, money changing on rewards, dense HUD fed by live data, audio (Web Audio synth), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero), README update, kit check, commit + push. **Must write `game/src/audio.js` (+ `citydetails.js` if split out) fresh.**
- **Still a weakness vs Top 10:** no helicopter/police chase yet (Stage 3 — the #1 gap), HUD dispatch/mission still placeholder (Stage 4), the drive shot has a streetlight pole dead-centre ahead of the car and no traffic car directly in the chase lane (Stage 3 chase staging will put police + traffic + helicopter in one frame), the beach shot's sand foreground is still a wide empty expanse (re-stage candidate for Stage 4).
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

### Estimated completion time (rebuild, revised)
- Stage 2 DONE (~1 h of build/test, 22 Nov ~17:10–17:55 WIB).
- Stage 3 (police + helicopter + NPCs + combat): ~2–3 h. Stage 4 (missions + audio + polish + final shots): ~2–3 h.
- **Total remaining: ~4–6 h of build/test time.** Deadline 24 Nov 22:00 WIB. **Do NOT stop or seal the recording until the owner approves the final result.**

## Rebuild-v3 Stage 1 — 3D core (fresh, under recording 01a202e0) — 22 Nov ~18:10 WIB

**Context:** Recording 2 (01a202aa) died when the VM was replaced ~17:10 WIB, so rebuild Stage 2 (a6312e2) was unwitnessed. Mot chose OPTION B: one more fast full rebuild (Stages 1–4) under a NEW recorder. Recording 3 (01a202e0-7049-74a8-ac8a-da7b2099c25e, PID 8575) started 17:49:52 WIB. This is Stage 1 of that rebuild — the core only, written entirely fresh in this session (no old game file read before writing; the old Stage 1 files were deleted first so `muse.write` could create them fresh). The backup entry (old Stage 2 tip ee2c8ab, submission 01a202a7) was NOT touched.

### Features built (all fresh, this session)
- **`game/src/util.js`** (2,757 B): mulberry32 seeded RNG, clamp/lerp/damp/angleDelta, pick/rand/randInt, pushOutOfBox + resolveCollisions (AABB push-out for building collision).
- **`game/src/textures.js`** (6,842 B): procedural canvas textures — facades (varied heights, lit windows, rooftop edge), signs (HOSPITAL/BANK/GARAGE/SAFEHOUSE/MARKET/HARBOUR), neon VICEBAY tower, billboards, ground (roads/sidewalks/blocks/beach), sea, dusk sky dome.
- **`game/src/city.js`** (17,187 B): seeded 480×480 m dusk coastal city — 7×7 road grid (-192…192), ~70 buildings in 5 districts (downtown/harbour/market/beach/hills) with varied height/facades/lit windows, 6 named landmarks with illuminated signs, vertical pink VICEBAY neon tower, 4 billboards, plaza fountain, ~40 palms, streetlights, harbour containers, 5 beach umbrellas + lifeguard stand, benches/hydrants/bins, 10 parked prop cars, park trees, animated teal sea + sky dome. Returns colliders, buildingCount, palmCount, sea, seaTex, roads.
- **`game/src/character.js`** (5,914 B): shaped humanoid — red jacket + shirt V + collar + gold chain, face/eyes/hair/cap, arms with elbows + hands, legs with knees + feet. Walk/run animation: limb swing, knee bend, body bob, run lean, jump tuck, breathing idle.
- **`game/src/main3d.js`** (14,636 B + fixes): renderer (ACESFilmic, exposure 1.18, PCF shadows), dusk lighting (warm sun hemi 1.15 / ambient 0.8 + camera-side fill light so the character is not dark from behind), player controller (walk 5 m/s, run 9 m/s, jump ~1.5 m, camera-relative movement, building collision, world bounds), mouse-orbit third-person camera with lookahead, HUD (money $250, wanted stars 0, health 100, weapon slots FISTS/BAT/PISTOL/SMG, mission panel, VBPD dispatch STANDBY, Rico dialogue, circular minimap with player arrow, district + clock 18:42 + radio VICE FM 98.5, live KM/H + ON FOOT), title/pause/save/load (localStorage `vicebay-save-v3`), staged shots (`?shot=onfoot|city|beach|plaza` + `__shotReady`/`__gameReady`/`__vb` hooks), dt clamped to [0, 0.05].
- **`game/index.html`** (6,963 B): import map for three, full HUD DOM, title + pause overlays, favicon data URI. Banner text is accurate: "Explore the city. Cars arrive in Stage 2. The police arrive in Stage 3. Missions arrive in Stage 4."
- **`main.ts`** (1,677 B): fresh Node 22 entrypoint — copies game/ + screenshots/ to the output dir, writes dossier.json via buildDossier (caps: text 163,840 / screenshots max 4 × 256 KiB).
- **`shots.json`**: exactly 4 shots (1-onfoot, 2-city, 3-beach, 4-plaza). The superseded Stage 2 shots (2-drive, 3-city, 4-beach) were removed (they live in git history at a6312e2) — the dossier caps at 4.
- `game/src/vehicles.js` was NOT touched (Stage 2 rewrites it fresh in its own session).

### Tests (headless desktop Chromium, Python Playwright, SwiftShader)
- **20/20 checks pass** (19/20 on the first full run + the 1 failure re-verified with a longer poll): 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified). Title loads (`__gameReady`); START → playing; walk moves ≥3 m at 5.00 m/s; run 8.11 m/s; jump apex 1.29 m and lands (confirmed in a focused re-test — see error 2); save/load round-trips (teleport → save → teleport away → load restores (40, -80)); HUD live (money/stars/district/clock). All 4 staged shots reach `__shotReady`.
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (78,172 B) — character (red jacket, cap, front view) on the road at the plaza's south edge, dusk city + pink sky behind, full HUD.
  - `screenshots/2-city.jpg` (177,718 B) — aerial dusk city: dense lit-window towers, roads, plaza fountain.
  - `screenshots/3-beach.jpg` (74,955 B) — character from behind on the sand facing the teal sea, palm tree, pink dusk sky, "SUNSET STRAND · 18:42 · VICE FM 98.5".
  - `screenshots/4-plaza.jpg` (88,131 B) — character from behind on the plaza, blue fountain in the mid-ground, lit-window buildings + pink VICEBAY neon tower, "DOWNTOWN · 18:42".
- `main.ts` writes a valid dossier.json (schema makefun/dossier/v1, cover 0, 4 images, text 77,188 bytes of the 163,840 cap).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### Errors / obstacles found (all fixed)
1. **Jump did not fire on a quick Space tap:** the game read `keys.Space` in the frame loop, but at ~1 FPS a `press` (down+up) finished between frames, so the flag was already false. Fixed with a jump queue: keydown sets `jumpQueued = true`, the next `updatePlayer` consumes it. Verified: apex 1.29 m.
2. **"Jump lands" failed on the first full run:** the test only polled 10 s, but at ~1 FPS (dt clamped to 0.05) a 0.71 s game-time jump takes ~14 s of real time. Not a game bug — confirmed with a focused re-test (apex 1.29 m, landed after ~18 s). Test artifact only.
3. **Shot pages timed out on load:** the interactive page kept running its game loop at ~1 FPS and starved the CPU, so the second page's `goto` hit the 30 s timeout. Fixed by closing the interactive page before opening the shot pages and raising the goto timeout to 90 s.
4. **Beach + plaza shots framed the wrong thing:** two causes. (a) The beach shot had cam.yaw = 0 (camera south of the player, looking north at the city) — fixed to cam.yaw = π (camera north, looking south at the sea). (b) The plaza shot's camera sat inside a building block (player (10,30) put the camera at (15.3,19.6), inside a block) — re-staged to player (0,18) facing north with the camera south. (c) Deeper cause found after the first re-stage: the camera lerps from the origin (0,0,0), and after only 6 frames it was still ~100 m short of a far staged position (the beach shot showed the city, the plaza shot showed the fountain from above). Fixed with a `snapCamera()` that sets the look point + camera position to their staged targets immediately in `stageShot`. All 4 shots re-taken and viewed after the fix.
5. **Dossier failed on `screenshots.max` (7 files):** the repo held the old Stage 2 shots (2-drive, 3-city, 4-beach) alongside the 4 new ones. Fixed by removing the three superseded files; the dossier then built cleanly.

### Features NOT yet done (next stages)
- **Stage 2 — Vehicles + traffic (next session):** rewrite `game/src/vehicles.js` FRESH (5 drivable cars, enter/exit on E, arcade physics, chase-cam with FOV kick, 4 traffic cars on real road loops, live vehicle HUD). Do NOT restore the deleted Stage 2 file.
- **Stage 3 — Police + NPCs + combat:** wanted 0–5 stars, police cars (pursuit + ram), police HELICOPTER (spotlight cone), pedestrians, punch/weapon combat, vehicle damage, neon landmarks (ferris wheel), `?shot=chase`. Must write `game/src/police.js`, `npcs.js`, `combat.js`, `damage.js`, `neon.js`, `actors.js` fresh.
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, money changing on rewards, dense HUD fed by live data, audio (Web Audio synth), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero), README update, kit check, commit + push. Must write `game/src/audio.js` (+ `citydetails.js` if split out) fresh.
- **Still a weakness vs Top 10:** no cars/police/helicopter yet (Stages 2–3 — the #1 gap), HUD dispatch/mission still placeholder (Stage 4), the beach shot's sand foreground is still a wide empty expanse (re-stage candidate for Stage 4).
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

### Estimated completion time (rebuild-v3, revised)
- Stage 1 DONE (~1 h of build/test, 22 Nov ~17:50–18:10 WIB).
- Stage 2 DONE (~50 min of build/test, 22 Nov ~18:10–19:00 WIB — see Stage 2 record below).
- Stage 3 (police + helicopter + NPCs + combat): ~2–3 h. Stage 4 (missions + audio + polish + final shots): ~2–3 h.
- **Total remaining: ~4–6 h of build/test time.** Deadline 24 Nov 22:00 WIB. **Do NOT stop or seal the recording until the owner approves the final result.**

---

## Rebuild-v3 Stage 2 — Vehicles + traffic + chase-cam — DONE 22 Nov ~18:25 WIB

**Branch:** `full-3d-v2`. **Recording:** 01a202e0-7049-74a8-ac8a-da7b2099c25e (PID 8575, running — NOT stopped or sealed).
**Authorship rule followed:** `game/src/vehicles.js` written FRESH via muse.write in this session — the old Stage 2 file was deleted unread first, so no line could be copied. `main3d.js` / `index.html` wired with targeted edits (the fresh vehicles.js carries the authorship; the edits add the enter/exit, chase-cam, HUD, prompt and drive shot).

### Features completed
- **Drivable cars (5 parked):** SUNSET GT sports (red hero, central road south of the player start), CORAL SEDAN (teal), PALM TAXI (yellow, roof sign), HARBOUR TRUCK (bed + crates), BEACH VAN — each a detailed procedural model (body, glass cabin, grille, bumpers, head/taillights, mirrors, GT spoiler + side skirts, van roof) on top of `buildCarMesh`, facing +z.
- **Enter/exit with E:** walk to a car → "E — ENTER CAR · <NAME>" prompt → E enters (chase-cam, character hidden); E exits (steps out on the car's right side, collider-aware, camera snaps behind the player). Parked cars are solid to the player on foot (circle push-out); the driven car is excluded.
- **Driving physics:** W accelerate, S brake/reverse, A/D speed-sensitive steering (bicycle model, less lock at speed), Space handbrake (sharper turn, speed bleed), rolling + aero drag, building collision (centre + front/rear points via resolveCollisions, hard hits −2 condition + speed cut), car-car collision (circle push-apart; a fixed parked car never moves, the other car takes the full push), wheel spin (Euler order ZYX so the spin axis stays on the car's X axle) + front-wheel steer. Top speeds 23–34 m/s by type; condition scales top speed (55% at condition 0).
- **Vehicle damage (visible):** hard crashes −2 condition, car-car hits −1.5; below 60 a dark dent patch appears on the hood; the HUD CAR row turns red below 45%.
- **Cinematic chase-cam:** low + close behind the car (9.5 m, lower + closer with speed), lookahead in the driving direction, FOV kick with speed (60→69, verified 62.3 while driving), mouse-drag orbit offset that eases back behind the car (angular lerp via angleDelta), one headlight spotlight on the driven car (intensity 80, aimed 15 m ahead).
- **Traffic (4 cars):** sedan/taxi/van/truck on 4 rectangular waypoint loops on the REAL road grid (-192, -128, -64, 0, 64, 128, 192), right-lane offset (3 m), follow/avoid logic (slow/stop for a car or the player ahead), wheel spin.
- **HUD (live data):** vehicle name + type + condition + live KM/H while driving, CAR condition row (top-left), "E — ENTER CAR / E — EXIT CAR" prompt (bottom-centre), minimap vehicle dots (parked grey, traffic blue, driven car gold), speed mode line (vehicle name · type / ON FOOT).
- **Banner fixed:** "Cars are here. The police arrive in Stage 3. Missions arrive in Stage 4." (was the stale "Cars arrive in Stage 2" line).
- **Restart:** exits the car + resets every car to its spawn spot (new `vehicles.reset()`), character visible again.
- **`?shot=drive` staging:** auto-enters the hero GT at 20 m/s (72 KM/H) heading south on the central road, chase-cam snapped behind — for the drive shot. `window.__vb` now exposes `driving`, `car`, `traffic`, `parkedCount`, `camera`.

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720; test script `~/workspace/makefun/gta6-01/test-rebuild-stage2-v3.py`)
- **25/25 checks PASS, 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified).**
- Title loads, START → playing. Walk 5.00 m/s (regression). 5 parked + 4 traffic cars spawn.
- Enter prompt appears near the car ("E — ENTER CAR · SUNSET GT"); E enters (driving=true, HUD "SUNSET GT"); car accelerates from input to 41 KM/H (HUD 41) and moves 5.7 m; chase-cam FOV 62.3 while driving; E exits (driving=false, player steps out 2.2 m beside the car at (3.8, 49.7)).
- Traffic: 4/4 cars move along their loops.
- All 4 staged shots reach `__shotReady` (onfoot, drive, city, beach).
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (79,642 B) — character (red jacket, front view) on the central road, the red GT + teal sedan ahead, lit-window buildings, minimap vehicle dots.
  - `screenshots/2-drive.jpg` (113,237 B) — **chase-cam while actually driving (65 KM/H, SUNSET GT, CONDITION 93% · SPORTS, E — EXIT CAR, CAR 93%)**, the road ahead ending at the beach + sea + palms + umbrella, "OCEAN DRIVE · 18:42".
  - `screenshots/3-city.jpg` (177,739 B) — aerial dusk city: dense lit-window towers, roads, plaza fountain, minimap dots.
  - `screenshots/4-beach.jpg` (79,059 B) — character from behind on the sand, teal sea with a golden sun glow, a palm with a long shadow, pink dusk sky.
- `shots.json` updated to the 4 shots (onfoot, drive, city, beach). The superseded `2-city.jpg`, `3-beach.jpg`, `4-plaza.jpg` were removed (they live in git history at f870d4a) — the dossier caps at 4 screenshots.
- `main.ts` writes a valid dossier.json (schema makefun/dossier/v1, cover 0, 4 images, text 80,954 bytes of the 163,840 cap).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### Errors / obstacles found (all fixed)
1. **HUD-name test flake (1 check):** the test read `hud-car-name` in the same poll that first saw `driving=true`, but the HUD only updates on the next rendered frame (~1 s later at SwiftShader's ~1 FPS), so it still read "—". The game was correct. Fixed the test to poll the HUD name (up to 10 s) instead of reading it once. Re-test: 25/25.
2. **Beach shot v1: mostly empty sand, sea a thin band:** the camera pitch (0.3) looked down at the player and the sea sat far above the look point. Fixed by re-staging (player z 196→200, pitch 0.3→0.15, dist 7.5→10) — the sea + sun glow now fill the upper frame. Re-shot and viewed.
3. **Drive shot v1: the car's rear read black between tall downtown towers:** re-staged from z=60 to z=130 (market district, shorter buildings) — the road ahead now ends at the beach + sea + palms and the buildings are sunlit. The car's rear is still dark (it faces away from the low eastern sun) but the red body + glowing taillights read clearly. Re-shot and viewed.
4. **Dossier failed on `screenshots.max` (6 files):** the repo held the old `2-city.jpg` + `3-beach.jpg` alongside the 4 new shots. Fixed by removing the two superseded files; the dossier then built cleanly.
5. **Collision design fix (before testing):** the first draft of `pushCars` moved both cars equally, so a driven car would shove a parked car. Rewrote it with a `fixed` flag (parked cars immovable, the driven car has `fixed` cleared on enter and restored on exit/reset).

### Features NOT yet done (next stages)
- **Stage 3 — Police + NPCs + combat: DONE (salvaged, see the Rebuild-v3 Stage 3 record below).** Commit e1bdc5d (code) + second commit (screenshots, shots.json, this record).
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, money changing on rewards, dense HUD fed by live data, audio (Web Audio synth), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero), README update, kit check, commit + push. **Must write `game/src/audio.js` (+ `citydetails.js` if split out) fresh.**
- **Still a weakness vs Top 10:** no helicopter/police chase yet (Stage 3 — the #1 gap), HUD dispatch/mission still placeholder (Stage 4), the drive shot has no traffic car or police in frame (Stage 3 chase staging will put police + traffic + helicopter in one frame), the beach shot's sand foreground is still a wide empty expanse (re-stage candidate for Stage 4).
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

---

## Rebuild-v3 Stage 3 — Police + helicopter + NPCs + combat (SALVAGED)

**Context:** Stage 3 code was written fresh under recording 01a202e0 (18:45–18:48 WIB, 22 Nov 2026) by builder session 058f7457, but the recorder died when the VM was replaced ~18:50 WIB, before testing or committing. Mot chose **Option A — SALVAGE**: recover + secure the already-written code, commit it, test it, screenshot it. Do NOT rewrite Stage 3 if the existing code can be saved; do NOT start Stage 4; do NOT seal; do NOT submit; do NOT delete/replace the backup submission. The salvage was done by a separate (unrecorded) verification session — its job was verification + testing + committing, not new authorship.

**Commit:** `e1bdc5d` "Rebuild-v3 Stage 3: police + helicopter + NPCs + combat (salvaged, written under recording 01a202e0)" — 8 files changed, 1,574 insertions, 8 deletions; pushed to origin, branch `full-3d-v2`. Second commit (screenshots + shots.json + this record) follows below.

### Features BUILT (all written fresh under recording 01a202e0; verified present + `node --check` passes on all 10 JS files in `game/src/`)
- **`game/src/police.js` (18,925 B):** wanted 0–5 stars (heat 0–100, +20 per crime: theft/assault), police cars spawn 60–90 m out (1 per star, max 5), pursuit steering with road following + collision resolution, on-foot ram (dist < 2.3 m → health −12, push 3 m), helicopter at 3+ stars (follows player, spotlight cone tracking the player), wanted decay (1.5 heat/s after 8 s with no police within 45 m), stand-down when wanted hits 0. Live dispatch board (unit callsigns VBPD-07/12/23/31 + AIR 1, roles PURSUIT/HELICOPTER, live distances).
- **`game/src/npcs.js` (8,718 B):** 10 pedestrians (seeded `mulberry32(7)`), walk on sidewalks, flee when the player attacks within 3.5 m or a police chase passes within 6 m, knocked down by combat (down 8 s, then rise + flee). `getState()` returns counts (count/walking/fleeing/down).
- **`game/src/combat.js` (8,628 B):** weapons FISTS / BAT / PISTOL (Q cycles, F attacks), melee range FISTS 2.3 m / BAT 2.7 m with a 0.9 rad front cone, pistol hitscan range 45 m with a 0.35 rad front cone + tracer + muzzle flash, 0.6 s game-time attack cooldown, weapon switching live in the HUD. Player health regenerates when not wanted.
- **`game/src/damage.js` (3,780 B):** vehicle condition (0–100%), damage from police rams + pistol hits, smoke at low condition, repair on restart.
- **`game/src/neon.js` (6,076 B):** neon landmarks — ferris wheel (rotating, lit), VICE BAY sign, Ocean Drive billboard, lit windows.
- **Wiring (`game/src/main3d.js` + `game/index.html`):** imports + creation of all five modules (damage 80, neon 81, police 82, npcs 83, combat 84); KeyQ → `combat.switchWeapon()`, KeyF → `combat.attack()`; `?shot=chase` staging via `police.stageChase()` (line 702); car-theft crime `police.addHeat(20, 'theft')` (line 401). `window.__vb` exposes `wanted`, `police`, `npcs`, `combat`, `health`.

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720; test script `~/workspace/makefun/gta6-01/test-rebuild-stage3-v3.py`; focused probes `probe-stage3-failures.py`, `probe-ram.py`)
- **Main test: 35/40 checks PASS, 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified).**
- **Verified (measured):** title loads; START → playing; run 8.26 m/s; jump apex 1.10 m + lands; save/load round-trips (restores (40, −80)); NPCs 10 (≥8); E enters car; police spawns after theft at 70 m; **police closes 70 → 67 m in 12 s**; car accelerates 23 KM/H; E exits car; helicopter appears at 3 stars; HUD stars = 3; 3 police cars at 3 stars; helicopter follows player 23.6 m, heli y=32; dispatch shows AIR 1 (VBPD-07 PURSUIT 67 m, VBPD-12 PURSUIT 89 m, VBPD-23 PURSUIT 70 m, AIR 1 HELICOPTER); Q cycles FISTS→BAT→PISTOL→FISTS; pistol equipped; **pistol hits a target**; wanted rises from combat to 3; FPS meter reports 1 (SwiftShader ~1 FPS); all 4 staged shots reach `__shotReady`; all 4 screenshots ≤256 KiB.
- **Focused probe (cooldown-aware + long-wait):** walk speed ≥4.0 **True (4.32 m/s)**; E enters car True; **car theft → wanted ≥1 True (wanted=1)**. These three were test-script bugs in the main test (see "Errors fixed" below), not game bugs.
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (69,143 B) — character front-on on a dark road, 0 KM/H.
  - `screenshots/2-chase.jpg` (118,016 B) — **HERO: red SUNSET GT chase-cam at 71 KM/H, 4 stars, dispatch VBPD-07/12/23/31 + AIR 1, helicopter spotlight cone, ferris wheel, "WANTED — Lose the VBPD", Rico warning, FPS 1.** No police car in frame (units at 28–60 m, behind/around the corner) — the chase is evidenced by 4 stars + dispatch + spotlight.
  - `screenshots/3-city.jpg` (144,428 B) — aerial dusk city, lit windows, VICE BAY neon sign, plaza fountain.
  - `screenshots/4-beach.jpg` (68,130 B) — character on sand, teal sea + sun glow, palm.
- `shots.json` fixed to the 4 shots (onfoot, chase, city, beach). The dossier caps at 4.
- `main.ts` writes a valid dossier.json (schema makefun/dossier/v1, 4 images, text **134,426 bytes** of the 163,840 cap).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### Errors / obstacles found (all fixed, or honestly reported as NOT fixed)
1. **`shots.json` was stale** (listed `2-drive.jpg` / `?shot=drive`) — **FIXED** to `2-chase.jpg` / `?shot=chase&seed=1`. The dossier is built from the `screenshots/` directory, so the dossier was already correct.
2. **Main test walk check was a test bug** (poll_value returned the initial 0 immediately; run 8.26 m/s proves movement works). **FIXED** the test to poll for `speed >= 4.0` with a condition. Probe confirms walk 4.32 m/s.
3. **Main test car-theft wanted check was a test bug** (read wanted before the heat propagated; police spawned at 70 m, so the wanted system fired). **FIXED** the test to poll for `wanted >= 1`. Probe confirms wanted=1 after theft.
4. **Punch did NOT hit an NPC in 20 cooldown-aware attempts** (0 down, across 20 sidewalk spots). **NOT a game bug by code inspection:** the punch shares the exact `nearestNPC` targeting path as the verified pistol hit (range 2.3 m + 0.9 rad front cone vs pistol 45 m + 0.35 rad). The code is correct; the NPCs are sparse (10 in a 480×480 m city) and wander, so no NPC was within 2.3 m + front cone at the test spots. **Status: punch mechanic sound by inspection + same code path as the verified pistol; NOT directly hit-tested.** NPC spawn positions are deterministic (`mulberry32(7)`); a targeted test at a spawn point is possible but was not run (see `~/workspace/makefun/gta6-01/npc-spawns.mjs` for the 10 computed spawn positions).
5. **Police ram (player health drop) NOT verified.** **Root cause found:** the police pursuit has no pathfinding/obstacle avoidance — it steers directly at the player. When the player is on foot and a building blocks the direct path, the police car drives into the building and gets stuck (measured: closed 70 → 35 m, then stalled at 34 m for 60+ s, health stayed 100). Additionally, under SwiftShader the wanted decays (1.5 heat/s after 8 s with no police within 45 m) faster than the police can close 60–90 m at ~0.25–0.47 m/s real-time, so they stand down before reaching the player unless wanted is re-asserted. On real hardware (60 FPS) the police close 70 m in seconds, well within the 8 s grace, so the ram should trigger — **but the building-stuck limitation is real on any hardware when a building blocks the direct path.** A pathfinding fix is NOT minimal (it would rewrite the pursuit steering), so it was NOT attempted per the salvage rules. **Status: police chase verified (they pursue and close distance on roads); on-foot ram not verified; police can get stuck on buildings when the player is on foot.** The chase screenshot + dispatch prove the pursuit works on roads (the main chase scenario).
6. **1-onfoot shot is darker than the Stage 2 shot** (noted, not a defect — dusk lighting).

### Features NOT yet done (next stage)
- **Stage 4 — Missions + polish:** 4 story missions with markers + timers + rewards, money changing on rewards, dense HUD fed by live data, audio (Web Audio synth), final 4 screenshots (chase-cam + helicopter + dense HUD as the hero), README update, kit check, commit + push. **Must write `game/src/audio.js` (+ `citydetails.js` if split out) fresh.** Do NOT start Stage 4 without Mot's approval.
- **Known limitations to weigh for the Stage 4 decision:** police pursuit has no pathfinding (gets stuck on buildings on foot); punch not directly hit-tested; 1-onfoot shot darker than Stage 2; the 2-chase hero shows no police car in frame (chase evidenced by stars + dispatch + spotlight, not a visible police car).
- **Still a weakness vs Top 10:** HUD dispatch/mission still placeholder (Stage 4), the chase hero has no police car in frame (re-stage candidate for Stage 4 — get a police car + helicopter + traffic in one frame), the beach shot's sand foreground is still a wide empty expanse (re-stage candidate for Stage 4).
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

### Estimated completion time (salvage, actual)
- Salvage done 22 Nov ~19:45 WIB (verify + commit e1bdc5d + main test 35/40 + focused probes + screenshots + dossier + kit check + this record + second commit). Stage 4 estimate: ~45–60 min (missions + audio + polish + re-test + re-shoot) once Mot approves. **Deadline for the final submission: 24 Nov 22:00 WIB** (gta6-01 closes). Do NOT seal or submit without Mot's approval.

---

## Rebuild-v3 Stage 4 — Missions + audio + polish + hero fix (DONE)

**Context:** Mot approved Stage 4 (22 Nov ~19:31 WIB) and ordered: missions, audio, polish, hero-shot refinement (a police car actually visible), punch re-test, police-stuck evaluation, full Stage 1–3 re-test + the 5 checks that did not pass in the Stage 3 salvage, save/load + offline. The visual upgrade (GTA V-like character/cars/city) is a SEPARATE estimate, NOT part of this stage. Do NOT seal; do NOT submit; do NOT delete/replace the backup submission. This stage was built by a separate (unrecorded) session — no live recorder existed (recording 01a202e0 died with the VM ~18:50 WIB).

**Commit:** Stage 4 code + screenshots + this record (pushed to origin, branch `full-3d-v2`).

### Features BUILT (all fresh for Stage 4)
- **`game/src/missions.js` (7,438 B, fresh):** 4 story jobs from Rico, run in sequence (auto-start M1 on START; N skips to the next). Each has a gold beacon (in-world + minimap diamond), a live objective in the HUD, and a money reward actually added to the player's money on completion. M1 BEACH RUN — drive to the beach marker, $100. M2 PACKAGE RUN — deliver to the market marker within 90 s, $150. M3 LOSE THE HEAT — get 3 stars, then lose them, $200. M4 CHECKPOINT DASH — 3 checkpoints in order, $250. Failed timed missions can be retried with N. `getState()` / `getMarker()` feed the HUD + minimap.
- **`game/src/audio.js` (5,850 B, fresh):** synthesized Web Audio, no external files — engine hum (pitch follows speed), police siren while wanted, gunshot, punch thud, reward chime, fail tone, quiet ambient city pad. Mute (M) silences the master gain. Never throws if AudioContext is unavailable. Wired in main3d.js (resume on START, engine + siren in the loop, gunshot/punch on F, chime on mission complete, fail tone on mission fail).
- **Polish (main3d.js + index.html):** mission panel shows the active job + brief + live progress (distance / checkpoint / timer / phase) + reward; banner "Jobs are live — press N for the next job"; title screen "Four jobs from the fixer Rico, live now"; controls line adds "N next job"; minimap shows the mission marker (gold diamond); README rewritten for the complete game (jobs, wanted, audio, features, controls).
- **Chase staging fix (`police.js` stageChase + main3d.js `stageShot('chase')`):** a police car now sits ALONGSIDE the player (left lane, 10 m ahead, same road) — inside the chase-cam frame, not 34–52 m ahead where Stage 3 read as specks. Two more cruisers ahead on the same road, helicopter above-ahead, two traffic cars ahead. The hero now shows a police car chasing.
- **Police-stuck backout (`police.js`, minimal):** a cruiser that is barely moving (speed < 2.5 m/s) AND not closing on the player for 3 s of game time backs out (reverse ~6 m/s + turn ~129°) and tries a different angle. This is NOT pathfinding — it only unsticks. The speed gate keeps it from firing when the player simply outruns a cruiser.
- **Test hooks (`__vb`):** `npcPositions` (NPC x/z/state), `policeCars` (x/z/speed/heading/stuckTimer/backoutTimer/condition), `missions` / `startMission(i)` / `startNextMission()`, `audio` (ctx state, muted, engine/siren), `toggleMute()`, `setYaw(yaw)`.

### Features TESTED (headless Chromium 1255, SwiftShader, 1280×720; test script `~/workspace/makefun/gta6-01/test-rebuild-stage4-v3.py`; stuck probe `~/workspace/makefun/gta6-01/probe-stuck.py`)
- **Main test: 55/55 checks PASS, 0 console errors, 0 page errors, 0 failed requests, 0 external requests (offline verified).**
- **Verified (measured):** title loads; START → playing; mission 1 auto-starts (BEACH RUN, active); audio context exists, state `running`, mute toggles False → True → False; walk 4.32 m/s; run 8.37 m/s; jump apex 1.26 m + lands; save/load round-trips (restores (40, −80)); **M1 completes +$100 ($250 → $350)**; **M2 completes +$150 ($350 → $500)**; **M3 phase 2 (3 stars registered), completes +$200 ($500 → $700)**; **M4 checkpoints 1/3, 2/3, completes +$250 ($700 → $950)**; all 4 missions done; HUD mission line shows "MISSION COMPLETE — CHECKPOINT DASH +$250"; NPCs 10; E enters car; car theft → wanted 1; police spawns at 90 m, closes 90 → 88 m in 12 s; car accelerates to 21 KM/H; E exits car; helicopter at 3 stars, follows 27.0 m, heli y=32; 3 police cars at 3 stars; dispatch shows AIR 1; Q cycles FISTS → BAT → PISTOL → FISTS; **punch hits an NPC (NPC at (−15.2, −69.4), attempt 1), NPC knocked down (down 0 → 1)**; pistol equipped; pistol hits a target; wanted rises from combat to 3; FPS meter reports 1 (SwiftShader ~1 FPS); all 4 staged shots reach `__shotReady`; all 4 screenshots ≤256 KiB.
- **Screenshots (all viewed, all ≤256 KiB):**
  - `screenshots/1-onfoot.jpg` (69,145 B) — character front-on on a dark road, 0 KM/H, "FREE ROAM — Press N to start the next job."
  - `screenshots/2-chase.jpg` (119,653 B) — **HERO (FIXED): red SUNSET GT chase-cam at 72 KM/H, 4 stars, a WHITE POLICE CAR alongside (VBPD-07 PURSUIT 11 m) + dispatch VBPD-07/12/23/31 + AIR 1, helicopter spotlight cone, ferris wheel, "WANTED — Lose the VBPD", Rico warning.**
  - `screenshots/3-city.jpg` (144,351 B) — aerial dusk city, lit windows, VICE BAY neon sign, plaza fountain.
  - `screenshots/4-beach.jpg` (67,920 B) — character on sand, teal sea + sun glow, palm.
- `shots.json` lists exactly the 4 shots (unchanged — same names/queries).
- `main.ts` writes a valid dossier.json (schema makefun/dossier/v1, 4 images, text **152,477 bytes** of the 163,840 cap).
- **Kit check: 4 passed, 0 failed, 17 skipped, 5 checked at submission** (the 5 are repo/submission items the site checks at submit time).

### The 5 checks that did not pass in the Stage 3 salvage main test (35/40) — status now
1. **(a) Walk check — PASS.** Was a test bug (poll_value returned the initial 0). Fixed in the Stage 3 salvage probe (4.32 m/s); re-verified in Stage 4: walk 4.32 m/s.
2. **(b) E enters car — PASS.** Was a test-timing issue. Re-verified in Stage 4: E enters the car.
3. **(c) Car-theft wanted check — PASS.** Was a test bug (read wanted before heat propagated). Fixed in the Stage 3 salvage probe (wanted=1); re-verified in Stage 4: car theft → wanted 1.
4. **(d) Punch hit — PASS (fixed by a targeted re-test, not a game change).** The Stage 3 salvage could not hit an NPC in 20 attempts (NPCs sparse). Stage 4 re-tested by placing the player 1.5 m from a real walking NPC, facing it (same synchronous evaluate, so the NPC cannot move between the read and the punch): **punch hit on attempt 1, NPC knocked down (down 0 → 1).** The punch mechanic was sound; the Stage 3 failure was the test's blind sidewalk spots.
5. **(e) Police ram / health drop — NOT VERIFIED (limitation, see the stuck evaluation below).** No ram was observed in the 240 s stuck probe (health stayed 100).

### Police-stuck evaluation (probe-stuck.py, 240 s, player on foot at (0, 100), wanted=1 re-asserted every 8 s)
- **The backout fix WORKS as designed (observed):** the cruiser closed 65.3 → 59.3 m, then stalled at ~59 m with speed ~1.99 m/s (pinned against a building). At t≈114 s the stuck detector fired (backoutTimer 1.4 → 0): the car reversed at −6 m/s, backed out to ~61 m, turned, and re-approached.
- **But the fix does NOT solve the stuck problem:** after the backout the cruiser re-approached and got pinned AGAIN at ~58 m (speed ~1.7–2.4 m/s), and stayed there to the end of the probe. Min distance over 240 s: **58.1 m**. No ram, health stayed 100.
- **Honest conclusion: the backout prevents permanent pinning (the car does move and retry), but it does NOT get the cruiser around a building — there is still NO pathfinding.** On real hardware (60 FPS) the 3 s game-time stuck trigger fires every 3 s real time (vs 60 s under SwiftShader), so the car retries far more often and may eventually find a corner — but that is UNVERIFIED, and I do NOT claim it. **On-foot rams remain unverified when a building blocks the direct path. The chase on roads is verified (police close 90 → 88 m while the player drives; the hero shows a cruiser alongside).**

### Errors / obstacles found (all fixed, or honestly reported as NOT fixed)
1. **Pistol test read a stale wanted value** (poll_value returned the first read before the next frame's police.update() synced player.wanted from heat). **FIXED** the test to poll for `wanted >= 3`. Re-test: wanted=3.
2. **Car-acceleration test read the speed while still accelerating** (poll_value returned 16 KM/H on the first read). **FIXED** the test to poll for `KM/H > 20`. Re-test: 21 KM/H.
3. **Pistol never fired on the first run** (the punch's 0.6 s game-time attack cooldown had not expired — SwiftShader ~1 FPS means 0.6 s game time is ~12 s real time). **FIXED** the test to wait 14 s before the pistol loop. Re-test: pistol fires, wanted rises to 3.
4. **Police-stuck backout does not get the cruiser around a building** (see the evaluation above). **NOT fixed — reported honestly.** A detour phase (drive along the building face after backing out) or a re-spawn on a nearby road would be a bigger change, not minimal; NOT attempted in this stage.

### Features NOT yet done (next steps, Mot's decision)
- **Visual upgrade (SEPARATE estimate, NOT implemented):** GTA V-like character/cars/city per the 4 reference-gtav-*.jpg images. See the Stage 4 report for the estimate (approach, time, risks). Do NOT start it before the Stage 4 checkpoint is safe + Mot approves.
- **Seal / submit:** NOT done. Do NOT seal or submit without Mot's approval. Recording 01a202e0 is still unsealed; no new recorder was started.
- **Known limitations to weigh for the final submission:** police pursuit has no pathfinding (cruiser can be re-pinned on buildings on foot; on-foot ram unverified); the beach shot's sand foreground is still a wide empty expanse; 1-onfoot shot is darker than Stage 2 (dusk lighting, noted, not a defect); the staged onfoot/beach shots show "FREE ROAM — Press N to start the next job" (missions auto-start on START, not on staged shots).
- **Not in scope (simplified, honest):** procedural low-poly models only, no detailed rigs, no helicopter roadblocks, no weapon wheel beyond the shown slots, 4 missions (not 8–10), no garage upgrades, no respect ranks beyond the HUD label.

### Estimated completion time (Stage 4, actual)
- Stage 4 done 22 Nov ~20:00 WIB (missions.js + audio.js fresh, wiring, chase fix, backout fix, main test 55/55 + stuck probe 240 s, screenshots, dossier + kit check, this record, commit + push). **Deadline for the final submission: 24 Nov 22:00 WIB** (gta6-01 closes). Do NOT seal or submit without Mot's approval.
