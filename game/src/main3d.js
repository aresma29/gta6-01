// VICE BAY — the game. A 3D third-person open-world core: a shaped
// character walking a seeded dusk coastal city, a smooth chase camera,
// building collision, a live HUD (minimap, money, stars, dispatch, mission,
// location, clock, radio), title / pause / save / load, and staged
// screenshots for the dossier. Desktop Chrome, keyboard + mouse, offline.

import * as THREE from 'three';
import { buildCity, districtAt, LAYOUT } from './city.js';
import { makeCharacter } from './character.js';
import { createVehicleSystem } from './vehicles.js';
import { clamp, lerp, lerpAngle, pushOutOfBox } from './util.js';

// ---------------------------------------------------------------- constants

const WALK_SPEED = 5; // m/s
const RUN_SPEED = 9; // m/s
const GRAVITY = 20; // m/s^2
const JUMP_VELOCITY = 7.7; // m/s — about a 1.5 m apex
const PLAYER_RADIUS = 0.45;
const WORLD_BOUND = 238;
const SAVE_KEY = 'vicebay-save-v1';
const START_MONEY = 250;
const START_TIME_MINUTES = 18 * 60 + 42; // 18:42, golden hour

// ---------------------------------------------------------------- state

let mode = 'title'; // 'title' | 'playing' | 'paused'
let money = START_MONEY;
let health = 100;
let wanted = 0;
let muted = false;
let gameMinutes = START_TIME_MINUTES;
let frameCount = 0;
let walkPhase = 0;
let shotName = null;
let shotReady = false;

const player = {
  x: 0,
  z: 24,
  y: 0,
  vy: 0,
  vx: 0,
  vz: 0,
  yaw: Math.PI,
  onGround: true,
  speed: 0,
};

const cam = {
  yaw: 0,
  pitch: 0.35, // 0 = level, 1 = high
  dist: 6.5,
  height: 2.6,
};

const keys = Object.create(null);
const oneShot = { jump: false, enter: false };
let chaseOrbit = 0; // mouse-look offset for the chase-cam; eases back to 0

// ---------------------------------------------------------------- renderer / scene

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6a4a7a, 120, 750);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

// Dusk sky: a gradient dome (purple overhead, magenta, orange at the horizon).
{
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a1038');
  grad.addColorStop(0.35, '#4a2560');
  grad.addColorStop(0.62, '#8a3a6a');
  grad.addColorStop(0.8, '#e86a3c');
  grad.addColorStop(0.92, '#ffb060');
  grad.addColorStop(1, '#3a2a4a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);
}

// Golden-hour sun, low over the sea (east), so the beach glows.
const sun = new THREE.DirectionalLight(0xffb060, 2.2);
sun.position.set(300, 70, -60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a5a9a, 0x5a4a3a, 1.15));
scene.add(new THREE.AmbientLight(0x604a6a, 0.8));

// Camera-side fill so the character does not read as a dark silhouette
// when backlit by the low eastern sun; repositioned every frame in loop().
const fill = new THREE.DirectionalLight(0xffd9b0, 0.55);
scene.add(fill);
scene.add(fill.target);

// ---------------------------------------------------------------- world

const city = buildCity(1);
scene.add(city.group);
const colliders = city.colliders;

const character = makeCharacter();
scene.add(character.group);

// Vehicles (Stage 2): five drivable cars + four traffic cars on road loops.
const vehicles = createVehicleSystem(THREE, scene, { colliders, bounds: WORLD_BOUND });
vehicles.spawnParked({ x: player.x, z: player.z });
vehicles.spawnTraffic();

// ---------------------------------------------------------------- HUD elements

const $ = (id) => document.getElementById(id);
const hud = {
  money: $('hud-money'),
  stars: $('hud-stars'),
  healthFill: $('hud-health-fill'),
  healthNum: $('hud-health-num'),
  dispatch: $('hud-dispatch-body'),
  missionTitle: $('hud-mission-title'),
  missionText: $('hud-mission-text'),
  dialogueName: $('hud-dialogue-name'),
  dialogueText: $('hud-dialogue-text'),
  location: $('hud-location'),
  clock: $('hud-clock'),
  radio: $('hud-radio'),
  speed: $('hud-speed-num'),
  speedMode: $('hud-speed-mode'),
  car: $('hud-car'),
  carName: $('hud-car-name'),
  carCond: $('hud-car-cond'),
  prompt: $('hud-prompt'),
  minimap: $('hud-minimap'),
  title: $('title-screen'),
  pause: $('pause-menu'),
  toast: $('hud-toast'),
  muted: $('hud-muted'),
};
const minimapCtx = hud.minimap.getContext('2d');

// ---------------------------------------------------------------- input

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') {
    oneShot.jump = true;
    e.preventDefault();
  }
  if (e.code === 'KeyE') {
    oneShot.enter = true;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (mode === 'playing') pauseGame();
    else if (mode === 'paused') resumeGame();
  }
  if (e.code === 'Enter' && mode === 'title') startGame();
  if (e.code === 'KeyM') {
    muted = !muted;
    showToast(muted ? 'Sound muted' : 'Sound on');
    updateMuted();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// Mouse drag orbits the camera (no pointer lock: it must work headless too).
let dragging = false;
let lastMouse = { x: 0, y: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastMouse.x;
  const dy = e.clientY - lastMouse.y;
  lastMouse = { x: e.clientX, y: e.clientY };
  if (vehicles.driving) {
    chaseOrbit = clamp(chaseOrbit - dx * 0.005, -1.2, 1.2);
  } else {
    cam.yaw -= dx * 0.005;
  }
  cam.pitch = clamp(cam.pitch + dy * 0.003, 0, 1);
  cam.height = 2.2 + cam.pitch * 3.2;
});
window.addEventListener('pointerup', () => {
  dragging = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- game flow

function startGame() {
  mode = 'playing';
  hud.title.classList.add('hidden');
  hud.pause.classList.add('hidden');
  showToast('Welcome to Vice Bay');
}

function pauseGame() {
  mode = 'paused';
  hud.pause.classList.remove('hidden');
}

function resumeGame() {
  mode = 'playing';
  hud.pause.classList.add('hidden');
}

function restartGame() {
  if (vehicles.driving) {
    vehicles.exit();
    character.group.visible = true;
  }
  vehicles.reset();
  chaseOrbit = 0;
  player.x = 0;
  player.z = 24;
  player.y = 0;
  player.vy = 0;
  player.vx = 0;
  player.vz = 0;
  player.yaw = Math.PI;
  money = START_MONEY;
  health = 100;
  wanted = 0;
  gameMinutes = START_TIME_MINUTES;
  cam.yaw = 0;
  cam.pitch = 0.35;
  resumeGame();
  showToast('Back at the start');
}

let toastTimer = 0;
function showToast(text) {
  hud.toast.textContent = text;
  hud.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hud.toast.classList.add('hidden'), 2600);
}

function updateMuted() {
  hud.muted.classList.toggle('hidden', !muted);
}

// ---------------------------------------------------------------- save / load

function saveGame() {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ x: player.x, z: player.z, yaw: player.yaw, money, minutes: gameMinutes })
    );
    showToast('Game saved');
  } catch {
    showToast('Save failed (storage unavailable)');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      showToast('No save found');
      return false;
    }
    const s = JSON.parse(raw);
    player.x = s.x;
    player.z = s.z;
    player.yaw = s.yaw;
    money = s.money;
    gameMinutes = s.minutes;
    player.vx = 0;
    player.vz = 0;
    showToast('Save loaded');
    return true;
  } catch {
    showToast('Load failed');
    return false;
  }
}

function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// Buttons (title + pause menus).
$('btn-start').addEventListener('click', startGame);
$('btn-continue').addEventListener('click', () => {
  if (loadGame()) startGame();
});
$('btn-resume').addEventListener('click', resumeGame);
$('btn-save').addEventListener('click', saveGame);
$('btn-load').addEventListener('click', loadGame);
$('btn-restart').addEventListener('click', restartGame);
$('btn-mute').addEventListener('click', () => {
  muted = !muted;
  updateMuted();
  showToast(muted ? 'Sound muted' : 'Sound on');
});
$('btn-quit').addEventListener('click', () => {
  mode = 'title';
  hud.pause.classList.add('hidden');
  hud.title.classList.remove('hidden');
  updateContinueButton();
});
updateContinueButton();
updateMuted();

function updateContinueButton() {
  $('btn-continue').classList.toggle('hidden', !hasSave());
}

// ---------------------------------------------------------------- player update

function updatePlayer(dt) {
  // Camera-relative movement.
  const fwdX = -Math.sin(cam.yaw);
  const fwdZ = -Math.cos(cam.yaw);
  const rightX = Math.cos(cam.yaw);
  const rightZ = -Math.sin(cam.yaw);
  let mx = 0;
  let mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) {
    mx += fwdX;
    mz += fwdZ;
  }
  if (keys['KeyS'] || keys['ArrowDown']) {
    mx -= fwdX;
    mz -= fwdZ;
  }
  if (keys['KeyD'] || keys['ArrowRight']) {
    mx += rightX;
    mz += rightZ;
  }
  if (keys['KeyA'] || keys['ArrowLeft']) {
    mx -= rightX;
    mz -= rightZ;
  }
  const len = Math.hypot(mx, mz);
  const running = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  const targetSpeed = len > 0 ? (running ? RUN_SPEED : WALK_SPEED) : 0;
  if (len > 0) {
    mx /= len;
    mz /= len;
    const wantYaw = Math.atan2(mx, mz);
    player.yaw = lerpAngle(player.yaw, wantYaw, 1 - Math.exp(-12 * dt));
  }
  const tx = mx * targetSpeed;
  const tz = mz * targetSpeed;
  const k = 1 - Math.exp(-10 * dt);
  player.vx = lerp(player.vx, tx, k);
  player.vz = lerp(player.vz, tz, k);
  player.x += player.vx * dt;
  player.z += player.vz * dt;

  // Jump + gravity.
  if (oneShot.jump && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
  oneShot.jump = false;
  player.vy -= GRAVITY * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    player.onGround = true;
  }

  // Building collision (only while below the roof).
  for (const b of colliders) {
    if (player.y < b.height) {
      const r = pushOutOfBox(player.x, player.z, PLAYER_RADIUS, b);
      player.x = r.x;
      player.z = r.z;
    }
  }
  // World bounds (the sea edge is the east bound).
  player.x = clamp(player.x, -WORLD_BOUND, WORLD_BOUND);
  player.z = clamp(player.z, -WORLD_BOUND, WORLD_BOUND);

  player.speed = Math.hypot(player.vx, player.vz);
}

// ---------------------------------------------------------------- camera

function updateCamera(dt) {
  if (vehicles.driving && vehicles.current) {
    // Cinematic chase-cam: low + close behind the car, FOV kick with speed.
    const car = vehicles.current;
    const speedRatio = Math.min(1, Math.abs(car.speed) / car.def.topSpeed);
    const camDist = 9.5 - speedRatio * 1.5;
    const camH = 2.7 - speedRatio * 0.4;
    if (!dragging) chaseOrbit = lerp(chaseOrbit, 0, 1 - Math.exp(-2 * dt));
    const behind = car.heading + Math.PI + chaseOrbit;
    const desired = new THREE.Vector3(
      car.x + Math.sin(behind) * camDist,
      camH,
      car.z + Math.cos(behind) * camDist
    );
    const s = 1 - Math.exp(-6 * dt);
    camera.position.lerp(desired, s);
    camera.lookAt(car.x + Math.sin(car.heading) * 6, 1.4, car.z + Math.cos(car.heading) * 6);
    const targetFov = 60 + speedRatio * 9;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-4 * dt));
      camera.updateProjectionMatrix();
    }
    return;
  }
  // Back on foot: restore the default field of view.
  if (Math.abs(camera.fov - 60) > 0.05) {
    camera.fov = 60;
    camera.updateProjectionMatrix();
  }
  const lookX = player.x - Math.sin(cam.yaw) * 1.2;
  const lookZ = player.z - Math.cos(cam.yaw) * 1.2;
  const lookY = 1.6;
  const desired = new THREE.Vector3(
    player.x + Math.sin(cam.yaw) * cam.dist,
    lookY + cam.height,
    player.z + Math.cos(cam.yaw) * cam.dist
  );
  if (shotName === 'city') {
    // Aerial overview: fixed high camera over downtown, player in the plaza.
    desired.set(95, 78, 95);
    camera.position.copy(desired);
    camera.lookAt(0, 10, 0);
    return;
  }
  const s = 1 - Math.exp(-8 * dt);
  camera.position.lerp(desired, s);
  camera.lookAt(lookX, lookY, lookZ);
}

// ---------------------------------------------------------------- HUD (all live state)

function starText() {
  let s = '';
  for (let i = 0; i < 5; i++) s += i < wanted ? '★' : '☆';
  return s;
}

function clockText() {
  const h = Math.floor(gameMinutes / 60) % 24;
  const m = Math.floor(gameMinutes) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function updateHud() {
  hud.money.textContent = `$${money.toLocaleString('en-US')}`;
  hud.stars.textContent = starText();
  hud.healthFill.style.width = `${clamp(health, 0, 100)}%`;
  hud.healthNum.textContent = `${Math.round(health)}`;
  if (vehicles.driving && vehicles.current) {
    const car = vehicles.current;
    hud.speed.textContent = `${Math.round(vehicles.speedKmh)}`;
    hud.speedMode.textContent = `${car.def.name} · ${car.def.type}`;
    hud.car.classList.remove('hidden');
    hud.carName.textContent = car.def.name;
    hud.carCond.textContent = `${Math.round(car.condition)}`;
    hud.carCond.style.color = car.condition < 45 ? '#ff5a5a' : '';
    hud.prompt.classList.remove('hidden');
    hud.prompt.innerHTML = '<b>E</b> — EXIT CAR';
  } else {
    hud.speed.textContent = `${Math.round(player.speed * 3.6)}`;
    hud.speedMode.textContent = 'ON FOOT';
    hud.car.classList.add('hidden');
    const near = vehicles.nearestCar(player.x, player.z, 4);
    if (near) {
      hud.prompt.classList.remove('hidden');
      hud.prompt.innerHTML = `<b>E</b> — ENTER CAR · ${near.def.name}`;
    } else {
      hud.prompt.classList.add('hidden');
    }
  }
  hud.location.textContent = districtAt(player.x, player.z);
  hud.clock.textContent = clockText();
  if (wanted === 0) {
    hud.dispatch.innerHTML = '<div class="dispatch-row"><span class="dispatch-standby">STANDBY</span><span>No active units</span><span>—</span></div><div class="dispatch-note">Patrols on routine rounds.</div>';
  } else {
    hud.dispatch.innerHTML = `<div class="dispatch-row"><span class="dispatch-alert">${wanted} STAR${wanted > 1 ? 'S' : ''}</span><span>Units responding</span><span>${wanted}★</span></div>`;
  }
  drawMinimap();
}

/** Top-down minimap: roads, buildings, beach, sea and the player arrow. */
function drawMinimap() {
  const S = 180;
  const half = LAYOUT.half;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  const ctx = minimapCtx;
  ctx.clearRect(0, 0, S, S);
  // Sea + sand (east strip).
  ctx.fillStyle = '#1a6a7a';
  ctx.fillRect(toPx(200), 0, S - toPx(200), S);
  ctx.fillStyle = '#d8b878';
  ctx.fillRect(toPx(192), 0, toPx(200) - toPx(192), S);
  // Ground.
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(0, 0, toPx(192), S);
  // Roads.
  ctx.fillStyle = '#232328';
  for (const r of LAYOUT.roads) {
    ctx.fillRect(toPx(r - LAYOUT.roadW / 2), 0, LAYOUT.roadW * (S / (half * 2)), S);
    ctx.fillRect(0, toPx(r - LAYOUT.roadW / 2), S, LAYOUT.roadW * (S / (half * 2)));
  }
  // Buildings.
  ctx.fillStyle = '#8a8a96';
  for (const b of colliders) {
    if (b.height < 2) continue;
    ctx.fillRect(toPx(b.minX), toPx(b.minZ), toPx(b.maxX) - toPx(b.minX), toPx(b.maxZ) - toPx(b.minZ));
  }
  // Plaza.
  ctx.fillStyle = '#b8a888';
  ctx.beginPath();
  ctx.arc(toPx(0), toPx(0), 12, 0, Math.PI * 2);
  ctx.fill();
  // Vehicles: parked grey, traffic blue, the driven car gold.
  for (const car of vehicles.allCars()) {
    ctx.fillStyle = car === vehicles.current ? '#ffd24a' : (car.isTraffic ? '#5aa8ff' : '#9a9aa8');
    ctx.beginPath();
    ctx.arc(toPx(car.x), toPx(car.z), car === vehicles.current ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow (gold, rotated to the facing).
  const px = toPx(player.x);
  const py = toPx(player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('N', S / 2 - 4, 12);
}

// ---------------------------------------------------------------- staged shots

/** Position the player + camera for a named shot (?shot=onfoot|city|beach|plaza). */
function setupShot(name) {
  shotName = name;
  mode = 'playing';
  hud.title.classList.add('hidden');
  if (name === 'onfoot') {
    player.x = 0;
    player.z = 40;
    player.yaw = Math.PI;
    cam.yaw = 0;
    cam.dist = 6.5;
    cam.height = 2.6;
  } else if (name === 'city') {
    player.x = 14;
    player.z = 14;
    player.yaw = -2.4;
    cam.dist = 120;
  } else if (name === 'beach') {
    player.x = 218;
    player.z = 10;
    player.yaw = Math.PI / 2;
    cam.yaw = -Math.PI / 2;
    cam.dist = 6.5;
    cam.height = 2.8;
  } else if (name === 'plaza') {
    player.x = 16;
    player.z = 16;
    player.yaw = -2.4;
    cam.yaw = 0.74;
    cam.dist = 7;
    cam.height = 3;
  } else if (name === 'drive') {
    // Chase-cam while actually driving: the hero GT heads south on the
    // central road at 20 m/s (72 KM/H), camera behind it.
    const hero = vehicles.heroCar();
    if (hero) {
      player.x = hero.x;
      player.z = hero.z;
      player.yaw = hero.heading;
      vehicles.enter(hero);
      vehicles.setSpeed(hero, 20);
      character.group.visible = false;
    }
    cam.yaw = Math.PI;
    cam.dist = 9.5;
    cam.height = 2.7;
  } else {
    shotName = null;
    return;
  }
  // Snap the camera to the shot's framing before the first frame renders.
  const lookX = player.x - Math.sin(cam.yaw) * 1.2;
  const lookZ = player.z - Math.cos(cam.yaw) * 1.2;
  if (name === 'city') {
    camera.position.set(95, 78, 95);
    camera.lookAt(0, 10, 0);
  } else {
    camera.position.set(
      player.x + Math.sin(cam.yaw) * cam.dist,
      1.6 + cam.height,
      player.z + Math.cos(cam.yaw) * cam.dist
    );
    camera.lookAt(lookX, 1.6, lookZ);
  }
  character.group.position.set(player.x, player.y, player.z);
  character.group.rotation.y = player.yaw;
}

/** Place the character mesh at the player's state and run one animation step. */
function placeCharacter(dt) {
  character.group.position.set(player.x, player.y, player.z);
  character.group.rotation.y = player.yaw;
  const speed = mode === 'playing' ? player.speed : 0;
  walkPhase = character.animate(walkPhase, speed, dt, !player.onGround);
  // animate() writes the walk bob into position.y; add the jump height back.
  character.group.position.y += player.y;
}

// ---------------------------------------------------------------- main loop

let lastNow = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(Math.max((now - lastNow) / 1000, 0), 0.05);
  lastNow = now;
  frameCount++;

  if (mode === 'playing') {
    // Enter / exit a car (one-shot E).
    if (oneShot.enter) {
      oneShot.enter = false;
      if (vehicles.driving) {
        const car = vehicles.current;
        const out = vehicles.exit();
        if (out) {
          player.x = out.x;
          player.z = out.z;
          player.vx = 0;
          player.vz = 0;
          player.yaw = car.heading;
        }
        cam.yaw = car.heading + Math.PI;
        chaseOrbit = 0;
        character.group.visible = true;
      } else {
        const car = vehicles.nearestCar(player.x, player.z, 4);
        if (car) {
          oneShot.jump = false; // Space is the handbrake while driving
          vehicles.enter(car);
          character.group.visible = false;
          showToast(`${car.def.name} — drive!`);
        }
      }
    }
    if (vehicles.driving) {
      vehicles.update(dt, {
        forward: !!(keys['KeyW'] || keys['ArrowUp']),
        back: !!(keys['KeyS'] || keys['ArrowDown']),
        left: !!(keys['KeyA'] || keys['ArrowLeft']),
        right: !!(keys['KeyD'] || keys['ArrowRight']),
        handbrake: !!keys['Space'],
      }, { x: player.x, z: player.z });
      // The player rides in the car.
      const car = vehicles.current;
      player.x = car.x;
      player.z = car.z;
      player.yaw = car.heading;
      player.speed = Math.abs(car.speed);
      player.vx = 0;
      player.vz = 0;
    } else {
      updatePlayer(dt);
      // Parked / traffic cars are solid to the player on foot.
      for (const b of vehicles.solidAABBs()) {
        const r = pushOutOfBox(player.x, player.z, PLAYER_RADIUS, b);
        player.x = r.x;
        player.z = r.z;
      }
      placeCharacter(dt);
      // Traffic keeps moving while the player is on foot.
      vehicles.update(dt, {}, { x: player.x, z: player.z });
    }
    gameMinutes += dt / 10; // one game-minute per ten real seconds
    updateCamera(dt);
    updateHud();
  } else if (mode === 'title') {
    cam.yaw += dt * 0.05;
    camera.position.set(Math.sin(cam.yaw) * 150, 70, Math.cos(cam.yaw) * 150);
    camera.lookAt(0, 15, 0);
    placeCharacter(dt);
  }
  // The sea shimmers: scroll its texture slowly.
  city.sea.offset.x += dt * 0.008;
  city.sea.offset.y += dt * 0.004;

  // Camera-side fill: shine from the camera onto the player / driven car.
  fill.position.copy(camera.position);
  const fillTarget = vehicles.driving && vehicles.current ? vehicles.current : player;
  fill.target.position.set(fillTarget.x, 1.5, fillTarget.z);
  fill.target.updateMatrixWorld();

  renderer.render(scene, camera);

  if (frameCount === 1) window.__gameReady = true;
  if (shotName && !shotReady && frameCount >= 4) {
    shotReady = true;
    window.__shotReady = true;
  }
}

// ---------------------------------------------------------------- test hooks + init

window.__gameReady = false;
window.__shotReady = false;
window.__vb = {
  get mode() {
    return mode;
  },
  get player() {
    return { x: player.x, y: player.y, z: player.z, speed: player.speed, yaw: player.yaw, onGround: player.onGround };
  },
  get money() {
    return money;
  },
  get health() {
    return health;
  },
  get wanted() {
    return wanted;
  },
  get clock() {
    return clockText();
  },
  get district() {
    return districtAt(player.x, player.z);
  },
  get driving() {
    return vehicles.driving;
  },
  get car() {
    const c = vehicles.current;
    return c ? { name: c.def.name, type: c.def.type, speed: c.speed, condition: c.condition, x: c.x, z: c.z, heading: c.heading } : null;
  },
  get traffic() {
    return vehicles.traffic.map((c) => ({ x: c.x, z: c.z, speed: c.speed, name: c.def.name }));
  },
  get parkedCount() {
    return vehicles.parked.length;
  },
  get camera() {
    return { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov };
  },
  get buildingCount() {
    return city.buildingCount;
  },
  get colliderCount() {
    return colliders.length;
  },
  start: () => startGame(),
  teleport: (x, z) => {
    player.x = x;
    player.z = z;
    player.vx = 0;
    player.vz = 0;
  },
  setWanted: (n) => {
    wanted = n;
  },
};

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
if (shotParam) setupShot(shotParam);
updateHud();
requestAnimationFrame(loop);
