// main3d.js — VICE BAY 3D, Stage 1 (final rebuild).
// Third-person 3D: procedural character, coastal city, chase camera, HUD,
// minimap, save/load, staged screenshots. Desktop Chrome/Chromium, offline.
// dt is clamped to [0, 0.05] (a negative first-frame dt once spun the camera).

import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, resolveCollisions } from './util.js';
import { buildCity, districtAt, WORLD } from './city.js';
import { buildCharacter } from './character.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createNPCs } from './npcs.js';
import { createCombat } from './combat.js';
import { buildLandmarks } from './landmarks.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';

const SAVE_KEY = 'vicebay-save-final';
const WALK_SPEED = 5;
const RUN_SPEED = 8;
const JUMP_VEL = 7.5;
const GRAVITY = 22;
const PLAYER_RADIUS = 0.5;

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const STAGED = !!SHOT;

// ---- renderer / scene ----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7a4a58, 120, 620);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);

// ---- dusk lighting --------------------------------------------------------
const sun = new THREE.DirectionalLight(0xff9e3d, 2.6);
sun.position.set(180, 55, 320); // low over the sea (south-east), long shadows
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x9a6ab8, 0x3a2a30, 1.25));
scene.add(new THREE.AmbientLight(0x6a4a58, 0.85));
// Camera-side fill so the character is not a dark silhouette from behind.
const fill = new THREE.DirectionalLight(0xffe0b0, 0.85);
scene.add(fill);
scene.add(fill.target);

// ---- city + character -----------------------------------------------------
const city = buildCity(scene);
const vehicles = createVehicles(scene, { colliders: city.colliders });
const { group: charGroup, parts: charParts, pose } = buildCharacter();
scene.add(charGroup);

// ---- Stage 3: police, NPCs, landmarks (combat is bound after `player`) --
const police = createPolice(scene, { colliders: city.colliders, buildings: city.buildings, vehicles });
const npcs = createNPCs(scene, { colliders: city.colliders });
const landmarks = buildLandmarks(scene, city.landmarks);

// ---- player state ---------------------------------------------------------
const player = {
  x: 0, z: 24, y: 0, vy: 0, heading: Math.PI, speed: 0,
  grounded: true, phase: 0, idleTime: 0, money: 250, health: 100, wanted: 0,
};
let clockMin = 18 * 60 + 42; // 18:42
let mode = 'title'; // 'title' | 'playing' | 'paused'
let muted = false;
let jumpQueued = false;
let titleYaw = 0;
let wastedT = 0; // WASTED banner countdown (game seconds)

// ---- Stage 3: combat (needs the `player` object + character parts) --------
const combat = createCombat(scene, { parts: charParts, npcs, police, player });

// ---- Stage 4: missions + audio -------------------------------------------
const missions = createMissions(scene, {
  player, police,
  // Mission rewards land in the player's pocket live ($250 -> $3,550).
  onReward: (amount) => { player.money += amount; },
});
const audio = createAudio();
audio.setMuted(muted);

// ---- camera ---------------------------------------------------------------
let camYaw = 0;
let camPitch = 0.32;
let camDist = 7;
let camPos = new THREE.Vector3(0, 4, 31);
let camLook = new THREE.Vector3(0, 1.6, 24);

function snapCamera() {
  const dh = Math.cos(camPitch) * camDist;
  const h = Math.sin(camPitch) * camDist + 1.6;
  camPos.set(
    player.x + Math.sin(camYaw) * dh,
    h,
    player.z + Math.cos(camYaw) * dh
  );
  camLook.set(player.x, 1.6, player.z);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---- vehicles (Stage 2) ----------------------------------------------------
function tryEnterExitCar() {
  if (vehicles.driving) {
    const spot = vehicles.exit();
    if (spot) {
      player.x = spot.x;
      player.z = spot.z;
      player.heading = spot.heading;
      player.speed = 0;
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      charGroup.visible = true;
      camDist = 7;
      camPitch = 0.32;
      snapCamera();
    }
    return;
  }
  const car = vehicles.nearest(player.x, player.z);
  if (!car) return;
  vehicles.enter(car);
  if (!car.owned) police.addHeat(20, 'theft', 0); // car theft: +1 star
  player.x = car.x;
  player.z = car.z;
  player.heading = car.heading;
  player.speed = car.speed;
  charGroup.visible = false;
}

// ---- input ----------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') {
    jumpQueued = true;
    e.preventDefault();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') { muted = !muted; audio.setMuted(muted); }
  if (e.code === 'KeyE' && mode === 'playing') tryEnterExitCar();
  if (e.code === 'KeyF' && mode === 'playing' && !vehicles.driving) {
    combat.useWeapon();
    if (combat.weapon === 'PISTOL') audio.pistol(); else audio.punch();
  }
  if (e.code === 'KeyQ' && mode === 'playing' && !vehicles.driving) combat.cycleWeapon();
  if (e.code === 'Enter' && mode === 'title') startGame();
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

let dragging = false;
let lastMX = 0;
let lastMY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMX = e.clientX;
  lastMY = e.clientY;
});
addEventListener('mouseup', () => {
  dragging = false;
});
addEventListener('mousemove', (e) => {
  if (!dragging || mode !== 'playing') return;
  camYaw -= (e.clientX - lastMX) * 0.005;
  camPitch = clamp(camPitch + (e.clientY - lastMY) * 0.004, -0.05, 1.15);
  lastMX = e.clientX;
  lastMY = e.clientY;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- HUD ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const minimap = $('minimap');
const mm = minimap.getContext('2d');

function fmtClock() {
  const h = Math.floor(clockMin / 60) % 24;
  const m = Math.floor(clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap() {
  const S = minimap.width;
  const scale = S / 480;
  const px = (v) => (v + 240) * scale;
  mm.clearRect(0, 0, S, S);
  // Circular mask.
  mm.save();
  mm.beginPath();
  mm.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  mm.clip();
  mm.fillStyle = '#1a1a24';
  mm.fillRect(0, 0, S, S);
  // Sea (south) + beach.
  mm.fillStyle = '#1f7a8a';
  mm.fillRect(0, px(240), S, S - px(240));
  mm.fillStyle = '#d9c08a';
  mm.fillRect(0, px(160), S, px(240) - px(160));
  // Roads.
  mm.strokeStyle = '#3a3a44';
  mm.lineWidth = 3;
  for (const r of city.roads) {
    mm.beginPath();
    mm.moveTo(px(r), 0);
    mm.lineTo(px(r), S);
    mm.stroke();
    mm.beginPath();
    mm.moveTo(0, px(r));
    mm.lineTo(S, px(r));
    mm.stroke();
  }
  // Buildings.
  mm.fillStyle = '#8a8694';
  for (const b of city.buildings) {
    mm.fillRect(px(b.x - b.w / 2), px(b.z - b.d / 2), Math.max(1.5, b.w * scale), Math.max(1.5, b.d * scale));
  }
  // Plaza.
  mm.fillStyle = '#4a8a9a';
  mm.beginPath();
  mm.arc(px(0), px(0), 6, 0, Math.PI * 2);
  mm.fill();
  // NPCs (pale dots), police cars (blue), helicopter (white).
  mm.fillStyle = '#c9c9d8';
  for (const n of npcs.list) {
    mm.beginPath();
    mm.arc(px(n.x), px(n.z), 1.6, 0, Math.PI * 2);
    mm.fill();
  }
  mm.fillStyle = '#4a8aff';
  for (const c of police.list) {
    mm.beginPath();
    mm.arc(px(c.x), px(c.z), 2.4, 0, Math.PI * 2);
    mm.fill();
  }
  const hp = police.heliPos;
  if (hp) {
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.arc(px(hp.x), px(hp.z), 3, 0, Math.PI * 2);
    mm.fill();
  }
  // Player arrow (gold, rotated to heading).
  mm.save();
  mm.translate(px(player.x), px(player.z));
  mm.rotate(-player.heading + Math.PI);
  mm.fillStyle = '#ffd24a';
  mm.beginPath();
  mm.moveTo(0, -7);
  mm.lineTo(5, 5);
  mm.lineTo(-5, 5);
  mm.closePath();
  mm.fill();
  mm.restore();
  mm.restore();
  // N tick.
  mm.fillStyle = '#ffffff';
  mm.font = 'bold 11px Arial';
  mm.textAlign = 'center';
  mm.fillText('N', S / 2, 12);
}

let hudTick = 0;
function updateHUD(dt) {
  hudTick += dt;
  if (hudTick < 0.12) return;
  hudTick = 0;
  $('hud-money').textContent = `$${player.money}`;
  $('hud-stars').textContent = '★'.repeat(player.wanted) + '☆'.repeat(5 - player.wanted);
  $('hud-health-fill').style.width = `${player.health}%`;
  $('hud-health-num').textContent = `${Math.round(player.health)}`;
  $('hud-speed-num').textContent = `${Math.round(player.speed * 3.6)}`;
  $('hud-speed-mode').textContent = vehicles.driving ? 'IN CAR' : 'ON FOOT';
  $('hud-district').textContent = districtAt(player.x, player.z);
  $('hud-clock').textContent = fmtClock();
  $('hud-radio').textContent = muted ? 'MUTED' : 'VICE FM 98.5';
  // Live dispatch board (named units + roles + distances + AIR 1).
  $('hud-dispatch').innerHTML = `<b>VBPD DISPATCH</b><br>${police.getDispatch(player)}`;
  // Mission panel (live objective + timer + reward; all-done banner).
  // missions.status is a getter returning a one-line status string
  // (e.g. "M1 BEACH RUN · Ferris wheel 25m · 90s · $100"), NOT a function.
  const mEl = $('hud-mission');
  if (mEl) {
    // NEXT line: the next action inside the CURRENT mission (only when one
    // is running — otherwise the panel just names the next mission).
    const ns = missions.nextStep;
    mEl.innerHTML = `<b>MISSION ${missions.progress}</b><br>${missions.status}` + (ns ? `<br><span style="color:#9ad1ff">NEXT: ${ns}</span>` : '');
  }
  // Weapon slots (active one gold + bold; SMG stays locked).
  const w = combat.weapon;
  for (const [id, name] of [['hud-w-fists', 'FISTS'], ['hud-w-bat', 'BAT'], ['hud-w-pistol', 'PISTOL']]) {
    const el = $(id);
    if (el) {
      el.style.color = name === w ? '#ffd24a' : '#9a9ab0';
      el.style.fontWeight = name === w ? 'bold' : 'normal';
    }
  }
  // Car condition row (red when damaged), shown only while driving.
  const carRow = $('hud-car');
  if (carRow) {
    const car = vehicles.driving;
    if (car) {
      const cond = Math.round((1 - car.damage) * 100);
      carRow.style.display = 'block';
      carRow.textContent = `${car.name} · ${cond}%`;
      carRow.style.color = cond < 45 ? '#ff5a5a' : '#f2ead8';
    } else {
      carRow.style.display = 'none';
    }
  }
  // Rico's warning when the heat is on (text span only — the portrait stays).
  const dlg = $('hud-dialogue');
  if (dlg) {
    const s = player.wanted >= 3
      ? '<b>Rico — Fixer:</b> The cops are all over you, Jax. Lose them — fast.'
      : '<b>Rico — Fixer:</b> Vice Bay is yours, Jax. Walk it, learn it. The work comes later.';
    const txt = dlg.querySelector('.dlg-text');
    if (txt) txt.innerHTML = s; else dlg.innerHTML = s;
  }
  drawMinimap();
}

// ---- menus / save / load --------------------------------------------------
function showTitle() {
  mode = 'title';
  $('title-screen').style.display = 'flex';
  $('pause-menu').style.display = 'none';
  $('hud').style.display = 'none';
  $('btn-continue').style.display = localStorage.getItem(SAVE_KEY) ? 'block' : 'none';
}

function startGame() {
  mode = 'playing';
  $('title-screen').style.display = 'none';
  $('pause-menu').style.display = 'none';
  $('hud').style.display = 'block';
  snapCamera();
}

function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    $('pause-menu').style.display = 'flex';
  } else if (mode === 'paused') {
    mode = 'playing';
    $('pause-menu').style.display = 'none';
  }
}

function saveGame() {
  const data = { x: player.x, z: player.z, money: player.money, health: player.health, clockMin, car: vehicles.serialize() };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  return true;
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    player.x = d.x;
    player.z = d.z;
    player.money = d.money;
    player.health = d.health;
    clockMin = d.clockMin;
    player.y = 0;
    player.vy = 0;
    player.grounded = true;
    if (d.car) {
      vehicles.restore(d.car);
      if (vehicles.driving) {
        const car = vehicles.driving;
        player.x = car.x;
        player.z = car.z;
        player.heading = car.heading;
        player.speed = car.speed;
        charGroup.visible = false;
        camDist = 9.5;
        camPitch = 0.35;
      } else {
        charGroup.visible = true;
      }
    }
    police.reset(); // a loaded save starts clean (no stale pursuit)
    snapCamera();
    return true;
  } catch {
    return false;
  }
}

$('btn-start').addEventListener('click', startGame);
$('btn-continue').addEventListener('click', () => {
  loadGame();
  startGame();
});
$('btn-resume').addEventListener('click', togglePause);
$('btn-save').addEventListener('click', saveGame);
$('btn-load').addEventListener('click', loadGame);
$('btn-restart').addEventListener('click', () => {
  vehicles.reset();
  police.reset();
  npcs.reset();
  combat.reset();
  missions.reset();
  charGroup.visible = true;
  player.x = 0;
  player.z = 24;
  player.y = 0;
  player.vy = 0;
  player.heading = Math.PI;
  player.money = 250;
  player.health = 100;
  player.wanted = 0;
  clockMin = 18 * 60 + 42;
  camYaw = 0;
  camPitch = 0.32;
  camDist = 7;
  snapCamera();
  togglePause();
});
$('btn-mute').addEventListener('click', () => {
  muted = !muted;
  audio.setMuted(muted);
});
$('btn-quit').addEventListener('click', showTitle);

// ---- shot staging ---------------------------------------------------------
const SHOTS = {
  onfoot: { x: 0, z: -40, heading: Math.PI, yaw: 0, pitch: 0.28, dist: 7 },
  drive: { x: 0, z: 40, heading: Math.PI, yaw: 0, pitch: 0.3, dist: 9, inCar: true },
  chase: { x: 0, z: 100, heading: 0, yaw: Math.PI, pitch: 0.3, dist: 9, chase: true },
  city: { x: 0, z: 0, heading: Math.PI, yaw: 0, pitch: 1.05, dist: 150 },
  beach: { x: 0, z: 172, heading: 0, yaw: Math.PI, pitch: 0.3, dist: 7 },
};
let shotFrames = 0;
if (STAGED) {
  const s = SHOTS[SHOT] || SHOTS.onfoot;
  player.x = s.x;
  player.z = s.z;
  player.heading = s.heading;
  camYaw = s.yaw;
  camPitch = s.pitch;
  camDist = s.dist;
  mode = 'playing';
  $('title-screen').style.display = 'none';
  $('hud').style.display = 'block';
  snapCamera();
  if (s.inCar) {
    const car = vehicles.nearest(player.x, player.z, 6);
    if (car) {
      vehicles.enter(car);
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      charGroup.visible = false;
    }
  }
  if (s.chase) {
    // Hero chase: Sunset GT on the central road facing south at speed,
    // wanted 5, two lead police cars + one behind, helicopter above-ahead.
    // Staged on the road at z=100 (not the empty plaza) so buildings line
    // both sides and the ferris wheel at (0,198) reads dead ahead.
    const gt = vehicles.cars.find((c) => c.id === 'sunset');
    gt.x = 0; gt.z = 100; gt.heading = 0; gt.speed = 22;
    gt.group.position.set(0, 0, 100);
    gt.group.rotation.y = 0;
    vehicles.enter(gt);
    player.x = 0; player.z = 100; player.heading = 0; player.speed = 22;
    charGroup.visible = false;
    camDist = 9.5;
    camPitch = 0.35;
    police.stageChase(player);
    // Live mission in the hero frame so the mission panel shows the
    // objective + NEXT step (staging only — the target beacon sits at the
    // ferris wheel dead ahead).
    missions.start('m1');
    snapCamera();
  }
} else {
  showTitle();
}

// ---- test hooks -----------------------------------------------------------
window.__vb = {
  get mode() { return mode; },
  player,
  get money() { return player.money; },
  get health() { return player.health; },
  get wanted() { return player.wanted; },
  get clockMin() { return clockMin; },
  get district() { return districtAt(player.x, player.z); },
  buildingCount: city.buildingCount,
  colliderCount: city.colliders.length,
  start: startGame,
  teleport(x, z) {
    if (vehicles.driving) tryEnterExitCar();
    player.x = x;
    player.z = z;
    snapCamera();
  },
  setWanted(n) {
    police.setWanted(n);
    player.wanted = police.wanted;
  },
  setCarDamage(v) {
    const c = vehicles.driving;
    if (c) c.damage = clamp(v, 0, 1);
  },
  get inCar() { return !!vehicles.driving; },
  get car() {
    const c = vehicles.driving;
    return c ? { id: c.id, x: c.x, z: c.z, heading: c.heading, speed: c.speed, damage: c.damage, owned: c.owned } : null;
  },
  vehicles,
  police,
  npcs,
  combat,
  missions,
  audio,
  get traffic() { return vehicles.traffic.map((t) => ({ id: t.id, x: t.x, z: t.z, heading: t.heading, speed: t.speed })); },
  get policeCars() { return police.list; },
  get heli() { return police.heliPos; },
  get heliActive() { return police.heliActive; },
  get weapon() { return combat.weapon; },
  save: saveGame,
  load: loadGame,
  camera,
  version: 'stage4-final',
};

// ---- main loop ------------------------------------------------------------
let lastNow = performance.now();
let fpsEMA = 0;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastNow) / 1000;
  lastNow = now;
  dt = clamp(dt, 0, 0.05); // never negative, never a huge step
  frames++;

  if (mode === 'title') {
    // Slow orbit over the city.
    titleYaw += dt * 0.05;
    camera.position.set(Math.sin(titleYaw) * 130, 65, Math.cos(titleYaw) * 130);
    camera.lookAt(0, 10, 0);
  } else if (mode === 'playing') {
    if (vehicles.driving) {
      // --- driving (Stage 2) ---
      if (STAGED && SHOT === 'drive') keys.KeyW = true; // auto-drive for the shot
      if (STAGED && SHOT === 'chase') keys.KeyW = true; // auto-drive for the chase shot
      vehicles.update(dt, keys);
      const car = vehicles.driving;
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      player.speed = car.speed;
      charGroup.visible = false;
      // Chase camera: swing behind the car. Lift it when the helicopter is
      // active so the helicopter stays in frame.
      const liftDist = police.heliActive ? 10.5 : 9.5;
      const liftPitch = police.heliActive ? 0.45 : 0.35;
      camYaw = dampAngle(camYaw, car.heading + Math.PI, 3, dt);
      camDist = damp(camDist, liftDist, 3, dt);
      camPitch = damp(camPitch, liftPitch, 3, dt);
      vehicles.updateLighting(clockMin);
    } else {
    // --- movement (camera-relative) ---
    const fwdX = -Math.sin(camYaw);
    const fwdZ = -Math.cos(camYaw);
    const rightX = -fwdZ;
    const rightZ = fwdX;
    let mx = 0;
    let mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += fwdX; mz += fwdZ; }
    if (keys.KeyS || keys.ArrowDown) { mx -= fwdX; mz -= fwdZ; }
    if (keys.KeyD || keys.ArrowRight) { mx += rightX; mz += rightZ; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= rightX; mz -= rightZ; }
    const mLen = Math.hypot(mx, mz);
    const moving = mLen > 0.01;
    const running = !!(keys.ShiftLeft || keys.ShiftRight);
    const targetSpeed = moving ? (running ? RUN_SPEED : WALK_SPEED) : 0;
    player.speed = damp(player.speed, targetSpeed, 10, dt);
    if (moving) {
      const nx = mx / mLen;
      const nz = mz / mLen;
      const targetHeading = Math.atan2(nx, nz);
      player.heading = dampAngle(player.heading, targetHeading, 12, dt);
      player.x += nx * player.speed * dt;
      player.z += nz * player.speed * dt;
      player.phase += player.speed * dt * 1.7;
      player.idleTime = 0;
    } else {
      player.idleTime += dt;
    }
    // --- jump / gravity ---
    if (jumpQueued) {
      jumpQueued = false;
      if (player.grounded) {
        player.vy = JUMP_VEL;
        player.grounded = false;
      }
    }
    if (!player.grounded) {
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.grounded = true;
      }
    }
    // --- collision + bounds ---
    const [rx, rz] = resolveCollisions(player.x, player.z, PLAYER_RADIUS, city.colliders);
    player.x = clamp(rx, -WORLD + 4, WORLD - 4);
    player.z = clamp(rz, -WORLD + 4, WORLD - 4);
    // --- character ---
    charGroup.position.set(player.x, player.y, player.z);
    charGroup.rotation.y = player.heading;
    const speedNorm = clamp(player.speed / RUN_SPEED, 0, 1);
    pose(player.phase, speedNorm, !player.grounded, player.idleTime);
    combat.update(dt); // punch swing overrides the arm pose while active
      charGroup.visible = true;
      vehicles.update(dt, keys); // traffic keeps moving while on foot
      vehicles.updateLighting(clockMin);
    }
    // --- Stage 3: police pursuit, NPCs, landmarks ---
    police.update(dt, player);
    player.wanted = police.wanted; // sync HUD/test-facing wanted from the police heat
    npcs.update(dt, player, police, vehicles);
    landmarks.update(dt);
    // --- Stage 4: missions + audio (jingle/chime on mission events) ---
    const mres = missions.update(dt, player, police);
    if (mres) {
      if (mres.type === 'complete') audio.missionComplete();
      else if (mres.type === 'fail') audio.missionFail();
      else if (mres.type === 'checkpoint') audio.checkpoint();
      else if (mres.type === 'start') audio.pickup();
    }
    audio.update(dt, player, vehicles, police);
    // --- wasted: respawn at the Hospital ---
    if (player.health <= 0) {
      if (vehicles.driving) tryEnterExitCar();
      police.setWanted(0);
      player.wanted = 0;
      player.health = 100;
      player.x = -64;
      player.z = -32;
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      charGroup.visible = true;
      wastedT = 2;
      const wb = $('hud-wasted');
      if (wb) wb.style.display = 'flex';
      snapCamera();
    }
    if (wastedT > 0) {
      wastedT -= dt;
      if (wastedT <= 0) {
        const wb = $('hud-wasted');
        if (wb) wb.style.display = 'none';
      }
    }
    // --- camera (smooth follow) ---
    const dh = Math.cos(camPitch) * camDist;
    const h = Math.sin(camPitch) * camDist + 1.6;
    const tx = player.x + Math.sin(camYaw) * dh;
    const tz = player.z + Math.cos(camYaw) * dh;
    camPos.x = damp(camPos.x, tx, 8, dt);
    camPos.y = damp(camPos.y, h, 8, dt);
    camPos.z = damp(camPos.z, tz, 8, dt);
    camLook.x = damp(camLook.x, player.x + -Math.sin(camYaw) * 2, 10, dt);
    // When the helicopter is active, raise the look target so the camera
    // tilts up: the helicopter + ferris wheel stay in frame while the car
    // and the lead police cars stay in the lower half. (Previously the
    // look target stayed at y=1.6 while the camera lifted, so the camera
    // looked down MORE steeply and pushed the helicopter out of frame.)
    // y=5 (not higher): the car sits ~22 deg below the look direction,
    // the helicopter ~18 deg above — both inside a 60 deg FOV.
    camLook.y = damp(camLook.y, police.heliActive ? 5 : 1.6, 10, dt);
    camLook.z = damp(camLook.z, player.z + -Math.cos(camYaw) * 2, 10, dt);
    // Camera shake on police rams.
    if (police.shake > 0) {
      camPos.x += (Math.random() - 0.5) * police.shake * 0.6;
      camPos.y += (Math.random() - 0.5) * police.shake * 0.4;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // --- fill light follows the camera (lights the character's back) ---
    fill.position.set(camera.position.x, camera.position.y + 2, camera.position.z);
    fill.target.position.set(player.x, 1.2, player.z);
    // --- clock (1 min per 10 s) + sea ---
    clockMin += dt / 10;
    city.seaTex.offset.y += dt * 0.02;
    updateHUD(dt);
    // --- staged shot ready ---
    if (STAGED) {
      shotFrames++;
      if (shotFrames >= 6) window.__shotReady = true;
    }
  }

  // FPS meter (EMA over the last frames).
  if (dt > 0) fpsEMA = fpsEMA === 0 ? 1 / dt : lerp(fpsEMA, 1 / dt, 0.05);
  if (frames % 30 === 0) {
    const el = $('hud-fps');
    if (el) el.textContent = `${fpsEMA.toFixed(1)} FPS`;
  }

  renderer.render(scene, camera);
  if (frames === 3) window.__gameReady = true;
}

requestAnimationFrame(frame);
