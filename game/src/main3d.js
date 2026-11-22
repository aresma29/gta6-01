// VICE BAY 3D — entry point, game loop, third-person camera, player movement.
// STAGE 1: playable core — a procedural humanoid walking in a 3D dusk coastal
// city with a smooth third-person camera, collision, jump/run, title + pause,
// a minimal HUD and a minimap. Written fresh for the 3D build.
import * as THREE from '../vendor/three/three.module.min.js';
import { buildCity, resolveCollision, ROADS } from './city.js';
import { buildCityDetails } from './citydetails.js';
import { makeHumanoid, poseHumanoid } from './actors.js';
import { makeCharacter, poseCharacter } from './character.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createNPCs } from './npcs.js';
import { createCombat } from './combat.js';
import { createDamageFX } from './damage.js';
import { createLandmarks } from './neon.js';
import { createInput, ACT_JUMP, ACT_PUNCH, ACT_WEAPON, ACT_PAUSE, ACT_CONFIRM, clamp, lerp, lerpAngle, angleDiff } from './util.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || null;
const SEED = parseInt(params.get('seed') || '1', 10);

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x3a2438, 130, 620);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

// --- Dusk / golden-hour sky (a big gradient dome) ---
{
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#1c1030');   // zenith: deep purple
  grad.addColorStop(0.45, '#5a2a4a');  // mid: dusky magenta
  grad.addColorStop(0.72, '#c65a2e');  // low: burnt orange
  grad.addColorStop(0.85, '#ffb060');  // horizon: golden
  grad.addColorStop(1.0, '#3a2438');   // below horizon
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
}

// --- Dusk lighting: low warm sun + purple hemisphere + faint ambient ---
const sun = new THREE.DirectionalLight(0xffb060, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0x8a5a8a, 0x2a2018, 1.15);
scene.add(hemi);
scene.add(new THREE.AmbientLight(0x403050, 0.8));
const SUN_DIR = new THREE.Vector3(-0.82, 0.42, 0.38).normalize();

// --- City ---
const city = buildCity(scene, 1337 + SEED * 0); // seed is fixed: the city is the same every run
const cityDetails = buildCityDetails(scene, city);

// --- Vehicles (drivable cars, traffic, chase-cam) ---
const vehicles = createVehicles(scene, city);

// --- Police (wanted level, pursuit cars, helicopter) + NPCs ---
const police = createPolice(scene, city, vehicles);
const npcs = createNPCs(scene, city);

// --- Player ---
const playerMesh = makeCharacter({ shirt: 0xc0392b, pants: 0x2c3e50, skin: 0xc9976b, scale: 1 });
scene.add(playerMesh.group);
const player = {
  x: city.playerStart.x, z: city.playerStart.z, y: 0, vy: 0,
  heading: city.playerStart.heading, onGround: true,
  health: 100, money: 250, speed: 0, walkPhase: 0,
  camYaw: city.playerStart.heading, camPitch: 0.3,
};
playerMesh.group.position.set(player.x, 0, player.z);
playerMesh.group.rotation.y = player.heading;

// --- Combat (punch + weapons) + damage FX + landmarks (neon, ferris wheel) ---
const combat = createCombat(scene, player, playerMesh, npcs, police);
const damageFX = createDamageFX(scene);
const landmarks = createLandmarks(scene, city);

// --- Input ---
const input = createInput(canvas);

// --- Game state ---
let mode = 'title'; // 'title' | 'playing' | 'paused'
let shake = 0;
let frames = 0;
let shotReadyAt = 0;

// --- HUD elements ---
const $ = (id) => document.getElementById(id);
const hud = $('hud'), titleEl = $('title'), pauseEl = $('pause');
const healthfill = $('healthfill'), moneyEl = $('money'), starsEl = $('stars');
const mnameEl = $('mname'), mobjEl = $('mobj'), mtimerEl = $('mtimer');
const speedvalEl = $('speedval'), vehiclenameEl = $('vehiclename'), carcondEl = $('carcond');
const carrowEl = $('carrow'), carhpEl = $('carhp');
const locnameEl = $('locname'), clockEl = $('clock'), radioEl = $('radio');
const bannerEl = $('banner'), arrowEl = $('arrow');
const minimap = $('minimap'), mctx = minimap.getContext('2d');
const dispatchUnitsEl = $('dispatchunits'), dialogueLineEl = $('dialogueline');
const statusEl = $('status');

function setBanner(text, sub) {
  bannerEl.innerHTML = text + (sub ? `<span class="sub">${sub}</span>` : '');
  bannerEl.style.opacity = '1';
  clearTimeout(setBanner._t);
  setBanner._t = setTimeout(() => { bannerEl.style.opacity = '0'; }, 2600);
}

function districtName(x, z) {
  if (z > 175) return 'SUNSET STRAND';
  if (x < -112) return 'HARBOUR DOCKS';
  if (Math.abs(x) < 56 && Math.abs(z) < 56) return 'DOWNTOWN';
  if (x > 112) return 'CORAL ROW';
  if (z > 112) return 'PALM BEACH';
  if (z < -112) return 'HILLS';
  return 'VICE BAY';
}

function drawMinimap() {
  const S = 180, W = 480;
  const px = (v) => ((v + W / 2) / W) * S;
  mctx.fillStyle = '#10141a'; mctx.fillRect(0, 0, S, S);
  // Sea + beach.
  mctx.fillStyle = '#1b5f7a'; mctx.fillRect(0, px(210), S, S - px(210));
  mctx.fillStyle = '#d9c48f'; mctx.fillRect(0, px(180), S, px(210) - px(180));
  // Roads.
  mctx.fillStyle = '#3a3d44';
  for (const r of ROADS) {
    mctx.fillRect(px(r - 6), 0, px(12) - px(0), S);
    mctx.fillRect(0, px(r - 6), S, px(12) - px(0));
  }
  // Buildings.
  mctx.fillStyle = '#8d929c';
  for (const b of city.buildings) {
    mctx.fillRect(px(b.x - b.w / 2), px(b.z - b.d / 2), px(b.w) - px(0), px(b.d) - px(0));
  }
  // Vehicle blips: parked cars (grey), traffic (blue), the player's car (gold).
  for (const v of vehicles.list) {
    const vx = px(v.x), vz = px(v.z);
    mctx.fillStyle = v === vehicles.playerCar ? '#ffd60a' : (v.isPolice ? '#ff4040' : (v.isTraffic ? '#7ec8ff' : '#e8e8e8'));
    mctx.fillRect(vx - 2, vz - 2, 4, 4);
  }
  // Helicopter blip (white) + pedestrian blips (pale dots).
  if (police.heli) {
    mctx.fillStyle = '#ffffff';
    mctx.fillRect(px(police.heli.x) - 2, px(police.heli.z) - 2, 4, 4);
  }
  mctx.fillStyle = '#d8d8d8';
  for (const n of npcs.list) {
    mctx.fillRect(px(n.x) - 1, px(n.z) - 1, 2, 2);
  }
  // Player arrow. On the canvas +x is right and +z is down; the player faces
  // (sin h, cos h) in (x,z), so rotate the up-pointing triangle by PI - h.
  const cx = px(player.x), cz = px(player.z);
  mctx.save();
  mctx.translate(cx, cz);
  mctx.rotate(Math.PI - player.heading);
  mctx.fillStyle = '#ffd60a';
  mctx.beginPath();
  mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6); mctx.closePath();
  mctx.fill();
  mctx.restore();
}

function updateHUD() {
  healthfill.style.width = `${clamp(player.health, 0, 100)}%`;
  moneyEl.textContent = `$${player.money.toLocaleString('en-US')}`;
  const w = police.wanted;
  starsEl.textContent = '★'.repeat(w) + '☆'.repeat(5 - w);
  mnameEl.textContent = 'VICE BAY — FREE ROAM';
  mobjEl.textContent = 'Steal a car, outrun the VBPD. Missions arrive in Stage 4.';
  mtimerEl.textContent = '';
  locnameEl.textContent = districtName(player.x, player.z);
  clockEl.textContent = '18:42';
  radioEl.textContent = 'VICE FM 98.5 — Sunset Drive';
  vehiclenameEl.textContent = vehicles.playerCar ? vehicles.playerCar.displayName : 'ON FOOT';
  carcondEl.textContent = vehicles.playerCar ? `CONDITION ${vehicles.playerCar.condition}% · ${vehicles.playerCar.typeLabel}` : '';
  if (vehicles.playerCar) {
    carrowEl.style.display = 'flex';
    carhpEl.textContent = `CAR ${vehicles.playerCar.condition}%`;
    carhpEl.style.color = vehicles.playerCar.condition < 45 ? '#ff6b6b' : '';
  } else {
    carrowEl.style.display = 'none';
  }
  speedvalEl.textContent = String(Math.round(player.speed * 3.6));
  // Weapon slots: the equipped weapon is active; FISTS/BAT/PISTOL are owned,
  // SMG stays locked.
  const slots = [$('wslot0'), $('wslot1'), $('wslot2'), $('wslot3')];
  slots.forEach((s, i) => {
    if (!s) return;
    s.classList.toggle('active', i === combat.weaponIndex);
    s.classList.toggle('locked', i === 3);
  });
  // Dispatch board: named units + roles + live distances, or standby.
  const units = police.units(player);
  if (units.length === 0) {
    dispatchUnitsEl.innerHTML = '<div class="unit"><span>VBPD — STANDBY</span><span class="dist">NO ACTIVE UNITS</span></div>';
  } else {
    dispatchUnitsEl.innerHTML = units.map((u) =>
      `<div class="unit"><span>${u.name} — <span class="role">${u.role}</span></span><span class="dist">${u.dist} m</span></div>`
    ).join('');
  }
  // Rico warns the player the first time the heat is on.
  if (w >= 3 && !updateHUD._warned) {
    updateHUD._warned = true;
    dialogueLineEl.textContent = 'The cops are all over you, Jax. Lose them — fast.';
  } else if (w === 0 && updateHUD._warned) {
    updateHUD._warned = false;
    dialogueLineEl.textContent = 'Welcome to Vice Bay, Jax. Keep your head down and your wheels turning.';
  }
  drawMinimap();
}

// --- Camera rig (third-person, smooth follow) ---
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
let camInit = false;
function updateCamera(dt, orbitMode) {
  const look = input.takeLook();
  player.camYaw -= look.dx * 0.005;
  player.camPitch = clamp(player.camPitch + look.dy * 0.003, 0.06, 0.75);
  if (vehicles.playerCar) {
    // Driving: cinematic chase-cam behind the car (handled by the vehicle system).
    // Lift the camera when the helicopter is up so it stays in frame.
    vehicles.driveCamera(camera, dt, look, police.heliActive() ? 1 : 0);
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake *= Math.exp(-6 * dt);
    }
    return;
  }
  if (SHOT === 'city') {
    // Wide establishing shot: high above the north edge, looking south across
    // downtown toward the beach and the sea.
    camera.position.set(0, 95, -185);
    camera.lookAt(0, 8, 60);
    return;
  }
  if (orbitMode) {
    // Title: slow orbit around the player at a low height.
    const t = performance.now() * 0.00008;
    const r = 26, h = 11;
    camPos.set(
      player.x + Math.sin(t) * r,
      h,
      player.z + Math.cos(t) * r
    );
    camTarget.set(player.x, 2.2, player.z);
    camera.position.lerp(camPos, 1 - Math.exp(-2 * dt));
    camera.lookAt(camTarget);
    return;
  }
  const dist = 7.2;
  const cp = Math.cos(player.camPitch), sp = Math.sin(player.camPitch);
  const fx = Math.sin(player.camYaw), fz = Math.cos(player.camYaw);
  const desired = new THREE.Vector3(
    player.x - fx * cp * dist,
    1.7 + sp * dist + 0.6,
    player.z - fz * cp * dist
  );
  // Keep the camera above the ground.
  desired.y = Math.max(desired.y, 1.2);
  if (!camInit) { camera.position.copy(desired); camInit = true; }
  camera.position.lerp(desired, 1 - Math.exp(-11 * dt));
  const lookAhead = 2.2;
  camTarget.set(
    player.x + fx * lookAhead,
    1.7 + player.y * 0.5,
    player.z + fz * lookAhead
  );
  if (shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= Math.exp(-6 * dt);
  }
  camera.lookAt(camTarget);
}

// --- Player movement (on foot). `actions` is passed in by the loop (the loop
// is the only place that consumes the one-shot action flags).
function updatePlayer(dt, actions) {
  const axes = input.moveAxes();
  const fx = Math.sin(player.camYaw), fz = Math.cos(player.camYaw);
  const rx = -fz, rz = fx; // right = (-fz, fx)
  let mx = fx * axes.f + rx * axes.s;
  let mz = fz * axes.f + rz * axes.s;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) { mx /= ml; mz /= ml; }
  const targetSpeed = ml > 0.01 ? (input.run ? 9 : 5) : 0;
  player.speed += clamp(targetSpeed - player.speed, -34 * dt, 26 * dt);
  if (ml > 0.01) {
    const targetHeading = Math.atan2(mx, mz);
    player.heading = lerpAngle(player.heading, targetHeading, 1 - Math.exp(-12 * dt));
    player.x += mx * player.speed * dt;
    player.z += mz * player.speed * dt;
  }
  // Jump / gravity.
  if ((actions & ACT_JUMP) && player.onGround) { player.vy = 8.5; player.onGround = false; }
  if (!player.onGround || player.y > 0) {
    player.vy -= 24 * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; }
  }
  // Collision + bounds.
  const res = resolveCollision(city.colliders, player.x, player.z, 0.55);
  player.x = res.x; player.z = res.z;
  player.x = clamp(player.x, -235, 235);
  player.z = clamp(player.z, -235, 206);
  // Pose + mesh (walk/run animation, jump tuck, walk bob, punch swing).
  player.walkPhase += player.speed * dt * 1.7;
  const amp = clamp(player.speed / 9, 0, 1) * (input.run ? 0.95 : 0.6);
  poseCharacter(playerMesh, player.walkPhase, amp, combat.punchT, clamp(player.speed / 9, 0, 1) * 0.14, player.onGround ? 0 : 1);
  playerMesh.group.position.set(player.x, player.y + playerMesh.bob, player.z);
  playerMesh.group.rotation.y = player.heading;
}

// --- Shot staging (deterministic, for screenshots) ---
function stageShot(name) {
  if (name === 'onfoot') {
    // Third-person view on a street: player on Coral Row facing downtown.
    player.x = 84; player.z = 28; player.heading = Math.PI * 0.5; player.camYaw = Math.PI * 0.5; player.camPitch = 0.3;
  } else if (name === 'city') {
    // Wide city view: player on a rooftop-height overlook is not possible on foot,
    // so place the camera high via a wide orbit — handled in the render by a flag.
    player.x = 0; player.z = -140; player.heading = Math.PI; player.camYaw = Math.PI; player.camPitch = 0.55;
  } else if (name === 'beach') {
    // Dusk beach: player on the sand facing the sea (south), with an
    // umbrella and the lifeguard stand in frame and the ferris wheel's neon
    // rim at the right edge.
    player.x = 24; player.z = 184; player.heading = 0; player.camYaw = 0; player.camPitch = 0.28;
  } else if (name === 'drive') {
    // Chase-cam: the player is IN the hero car, driving east on Coral Row,
    // with traffic ahead. The car is moving (live speed) when the shot lands.
    const car = vehicles.hero;
    player.x = car.x - 3; player.z = car.z;
    vehicles.enterCar(car, player, playerMesh);
    car.speed = 20;
    player.camYaw = car.heading; player.camPitch = 0.22;
  } else if (name === 'chase') {
    // Cinematic police chase: the player is IN the hero car, driving south
    // on the central road toward the beach, with the VBPD in pursuit — two
    // police cars ahead/behind, the helicopter overhead with its spotlight,
    // traffic ahead, pedestrians on the sidewalks, and the ferris wheel dead
    // ahead in the distance.
    const car = vehicles.hero;
    vehicles.enterCar(car, player, playerMesh);
    car.x = 0; car.z = 100; car.heading = 0; car.speed = 22;
    car.group.position.set(0, 0, 100);
    car.group.rotation.y = 0;
    player.camYaw = car.heading; player.camPitch = 0.22;
    police.stageChase();
    // Traffic ahead on the road (the traffic update re-places the meshes
    // from v.x/v.z each frame, so only the state needs staging). The van is
    // moved off the chase road so it cannot block the police cars.
    const traffic = vehicles.list.filter((v) => v.isTraffic);
    const taxi = traffic.find((v) => v.type === 'taxi');
    if (taxi) { taxi.x = -3; taxi.z = 168; taxi.heading = 0; taxi.speed = 11; }
    const sedan = traffic.find((v) => v.type === 'sedan');
    if (sedan) { sedan.x = 4; sedan.z = 182; sedan.heading = 0; sedan.speed = 10; }
    const van = traffic.find((v) => v.type === 'van');
    if (van) { van.x = -56; van.z = 120; van.heading = 0; van.speed = 9; }
    // Pedestrians on the sidewalks.
    npcs.place(0, 8, 112, Math.PI);
    npcs.place(1, -8, 130, 0);
  }
  playerMesh.group.position.set(player.x, player.y, player.z);
  playerMesh.group.rotation.y = player.heading;
  mode = 'playing';
  hud.classList.remove('hidden');
  titleEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  camInit = false;
  updateHUD();
  shotReadyAt = performance.now() + 1800;
}

// --- Menus ---
function startGame() {
  mode = 'playing';
  titleEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hud.classList.remove('hidden');
  camInit = false;
  setBanner('VICE BAY', 'Welcome to the city, Jax.');
  statusEl.textContent = 'VICE BAY 3D — playing';
}
function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  pauseEl.classList.remove('hidden');
}
function resumeGame() {
  if (mode !== 'paused') return;
  mode = 'playing';
  pauseEl.classList.add('hidden');
}
function restartGame() {
  vehicles.reset(player, playerMesh);
  police.reset();
  npcs.reset();
  combat.reset();
  player.x = city.playerStart.x; player.z = city.playerStart.z; player.y = 0; player.vy = 0;
  player.heading = city.playerStart.heading; player.camYaw = player.heading;
  player.health = 100; player.money = 250; player.speed = 0;
  playerMesh.group.position.set(player.x, 0, player.z);
  playerMesh.group.rotation.y = player.heading;
  playerMesh.group.visible = true;
  camInit = false;
  resumeGame();
  setBanner('VICE BAY', 'Back on the streets.');
}
function saveGame() {
  try {
    localStorage.setItem('vicebay3d-save-v1', JSON.stringify({
      x: player.x, z: player.z, heading: player.heading, health: player.health, money: player.money,
    }));
    setBanner('SAVED', 'Progress saved.');
  } catch (e) { setBanner('SAVE FAILED', 'Storage unavailable.'); }
}
function loadGame() {
  try {
    const raw = localStorage.getItem('vicebay3d-save-v1');
    if (!raw) { setBanner('NO SAVE', 'No saved game found.'); return false; }
    const d = JSON.parse(raw);
    if (vehicles.playerCar) vehicles.exitCar(player, playerMesh);
    player.x = d.x; player.z = d.z; player.heading = d.heading || 0; player.camYaw = player.heading;
    player.health = d.health ?? 100; player.money = d.money ?? 0;
    playerMesh.group.position.set(player.x, 0, player.z);
    playerMesh.group.rotation.y = player.heading;
    camInit = false;
    return true;
  } catch (e) { return false; }
}

$('startbtn').addEventListener('click', startGame);
$('loadbtn').addEventListener('click', () => { if (loadGame()) startGame(); else setBanner('NO SAVE', 'No saved game found.'); });
$('resumebtn').addEventListener('click', resumeGame);
$('restartbtn').addEventListener('click', restartGame);
$('savebtn').addEventListener('click', saveGame);
$('loadbtn2').addEventListener('click', () => { if (loadGame()) { resumeGame(); setBanner('LOADED', 'Save loaded.'); } });
$('mutebtn').addEventListener('click', () => { setBanner('MUTE', 'Sound arrives in a later stage.'); });
$('quitbtn').addEventListener('click', () => { mode = 'title'; pauseEl.classList.add('hidden'); titleEl.classList.remove('hidden'); hud.classList.add('hidden'); });
$('besthaul').textContent = 'Best haul: $0 — finish a job to set a record.';

// --- Main loop ---
let lastNow = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;
  frames++;
  const actions = input.takeActions();
  if (actions & ACT_PAUSE) {
    if (mode === 'playing') pauseGame();
    else if (mode === 'paused') resumeGame();
  }
  if ((actions & ACT_CONFIRM) && mode === 'title') startGame();
  if (mode === 'playing') {
    // Vehicles own the E key and the driving state; on foot the player walks.
    const wasDriving = !!vehicles.playerCar;
    const driving = vehicles.update(dt, actions, input, player, playerMesh);
    if (!driving) updatePlayer(dt, actions);
    // Stealing a parked car is a crime (not when a shot is staged).
    if (driving && !wasDriving && !SHOT) police.addWanted(1);
    const ev = police.update(dt, player, vehicles);
    if (ev.rammed) shake = 0.6;
    npcs.update(dt, player, vehicles, police);
    combat.update(dt, actions, player, playerMesh, vehicles);
    damageFX.update(dt, vehicles);
    landmarks.update(dt);
    // Wasted: the player wakes up at the Hospital, heat cleared.
    if (player.health <= 0) {
      if (vehicles.playerCar) vehicles.exitCar(player, playerMesh);
      police.reset();
      player.x = city.landmarks.hospital.x; player.z = city.landmarks.hospital.z;
      player.y = 0; player.vy = 0; player.health = 100; player.speed = 0;
      player.heading = 0; player.camYaw = 0;
      playerMesh.group.position.set(player.x, 0, player.z);
      playerMesh.group.rotation.y = 0;
      playerMesh.group.visible = true;
      camInit = false;
      setBanner('WASTED', 'You woke up at the Hospital.');
    }
    updateHUD();
  }
  // Sun follows the player so shadows stay crisp nearby.
  sun.position.set(player.x + SUN_DIR.x * 190, SUN_DIR.y * 190, player.z + SUN_DIR.z * 190);
  sun.target.position.set(player.x, 0, player.z);
  sun.target.updateMatrixWorld();
  city.update(dt);
  cityDetails.update(dt);
  updateCamera(dt, mode === 'title');
  renderer.render(scene, camera);
  if (frames === 3) window.__gameReady = true;
  if (SHOT && shotReadyAt && performance.now() >= shotReadyAt) {
    window.__shotReady = true;
    shotReadyAt = 0;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('error', (e) => { window.__lastError = String(e.message || e.error); });

// Debug handle for automated tests (read-only state).
window.__vb = { player, city, vehicles, police, npcs, combat, damageFX, get mode() { return mode; }, get frames() { return frames; }, get driving() { return !!vehicles.playerCar; } };

// --- Boot ---
if (SHOT) {
  stageShot(SHOT);
} else {
  updateHUD();
  dialogueLineEl.textContent = 'Welcome to Vice Bay, Jax. Keep your head down and your wheels turning.';
}
animate();
