// VICE BAY — Stage 1 core: third-person 3D, player, camera, HUD, menus.
// Written fresh for the rebuild. No vehicles, no police, no missions yet —
// those arrive in Stages 2–4. Desktop Chrome, keyboard + mouse, offline.
import * as THREE from 'three';
import { buildCity, districtName, HALF } from './city.js';
import { buildCharacter, animateCharacter } from './character.js';
import { createVehicles } from './vehicles.js';
import { clamp, lerp, damp, angleDelta, resolveCollisions } from './util.js';

const WALK_SPEED = 5;
const RUN_SPEED = 9;
const JUMP_VELOCITY = 8.5;
const GRAVITY = 24;
const PLAYER_RADIUS = 0.55;
const SAVE_KEY = 'vicebay-save-v3';

// ------------------------------------------------------------------ setup
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x8a4a6e, 180, 620);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

// --- dusk lighting: low warm sun over the sea (east), purple sky fill ---
const sun = new THREE.DirectionalLight(0xffb070, 2.0);
sun.position.set(180, 90, 260);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 800;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8a5cc8, 0x2a1a2e, 1.15));
scene.add(new THREE.AmbientLight(0x604a6a, 0.8));
// Camera-side fill light: follows the camera so the character never reads
// as a dark silhouette from behind.
const fill = new THREE.DirectionalLight(0xffe0b8, 0.55);
scene.add(fill);
scene.add(fill.target);

// --- the city ---
const city = buildCity(scene);

// --- the vehicles (Stage 2) ---
const vehicles = createVehicles(scene, city);

// --- the player ---
const char = buildCharacter();
scene.add(char.group);
const player = {
  x: 0,
  z: 26,
  y: 0,
  vy: 0,
  yaw: Math.PI, // facing north, toward the plaza fountain
  onGround: true,
  speed: 0,
  walkPhase: 0,
  health: 100,
  money: 250,
  wanted: 0,
};

// --- camera rig ---
const cam = {
  yaw: Math.PI,
  pitch: 0.32,
  dist: 7.5,
  height: 2.6,
  lookX: 0,
  lookY: 1.6,
  lookZ: 0,
};
// Chase-cam orbit yaw while driving: mouse drags it, and it eases back
// behind the car (heading + PI) when left alone.
let driveYaw = Math.PI;

// ------------------------------------------------------------------ input
const keys = {};
let jumpQueued = false;
let dragging = false;
let lastPX = 0;
let lastPY = 0;
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') jumpQueued = true;
  if (e.code === 'KeyE') toggleCar();
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'KeyM') toggleMute();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastPX = e.clientX;
  lastPY = e.clientY;
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  if (vehicles.driving) {
    // Orbit the chase-cam; it eases back behind the car on its own.
    driveYaw -= (e.clientX - lastPX) * 0.0042;
  } else {
    cam.yaw -= (e.clientX - lastPX) * 0.0042;
    cam.pitch = clamp(cam.pitch + (e.clientY - lastPY) * 0.0032, -0.15, 0.85);
  }
  lastPX = e.clientX;
  lastPY = e.clientY;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------------ HUD
const el = (id) => document.getElementById(id);
const hud = {
  money: el('hud-money'),
  stars: el('hud-stars'),
  healthFill: el('hud-health-fill'),
  healthNum: el('hud-health-num'),
  mission: el('hud-mission-text'),
  dispatch: el('hud-dispatch'),
  dialogue: el('hud-dialogue'),
  minimap: el('hud-minimap'),
  district: el('hud-district'),
  clock: el('hud-clock'),
  radio: el('hud-radio'),
  speedNum: el('hud-speed-num'),
  speedMode: el('hud-speed-mode'),
  carName: el('hud-car-name'),
  carCond: el('hud-car-cond'),
  carPrompt: el('hud-car-prompt'),
  bannerTitle: el('hud-banner-title'),
  bannerSub: el('hud-banner-sub'),
  title: el('title-screen'),
  pause: el('pause-menu'),
  muteState: el('hud-mute-state'),
};
const mmCtx = hud.minimap.getContext('2d');
let muted = false;
let clockMin = 18 * 60 + 42; // 18:42, advances 1 min per 10 s of play

function fmtClock() {
  const h = Math.floor(clockMin / 60) % 24;
  const m = Math.floor(clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawMinimap() {
  const S = 220;
  const ctx = mmCtx;
  ctx.clearRect(0, 0, S, S);
  const toMap = (x, z) => [((x + HALF) / (HALF * 2)) * S, ((z + HALF) / (HALF * 2)) * S];
  // Sea + beach (south).
  ctx.fillStyle = '#0e6f80';
  ctx.fillRect(0, toMap(0, 200)[1], S, S - toMap(0, 200)[1]);
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(0, toMap(0, 185)[1], S, toMap(0, 200)[1] - toMap(0, 185)[1]);
  // Blocks.
  ctx.fillStyle = '#3a3a44';
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const [bx, bz] = toMap(-186 + i * 64, -186 + j * 64);
      ctx.fillRect(bx, bz, (52 / 480) * S, (52 / 480) * S);
    }
  }
  // Roads.
  ctx.strokeStyle = '#565660';
  ctx.lineWidth = 3;
  for (const r of city.roads) {
    const [rx] = toMap(r, 0);
    const [, rz] = toMap(0, r);
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, S);
    ctx.moveTo(0, rz);
    ctx.lineTo(S, rz);
    ctx.stroke();
  }
  // Plaza.
  ctx.fillStyle = '#8a6f52';
  ctx.beginPath();
  const [px, pz] = toMap(0, 0);
  ctx.arc(px, pz, 8, 0, Math.PI * 2);
  ctx.fill();
  // Player arrow (gold), rotated by facing.
  ctx.save();
  ctx.translate(...toMap(player.x, player.z));
  ctx.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Vehicle dots: parked grey, traffic blue, driven car gold.
  for (const car of vehicles.parked) {
    const [vx, vz] = toMap(car.x, car.z);
    ctx.fillStyle = '#999999';
    ctx.beginPath();
    ctx.arc(vx, vz, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of vehicles.traffic) {
    const [vx, vz] = toMap(car.x, car.z);
    ctx.fillStyle = '#4aa8ff';
    ctx.beginPath();
    ctx.arc(vx, vz, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (vehicles.driving) {
    const [vx, vz] = toMap(vehicles.car.x, vehicles.car.z);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(vx, vz, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateHUD() {
  hud.money.textContent = '$' + player.money;
  hud.stars.textContent = '★'.repeat(player.wanted) + '☆'.repeat(5 - player.wanted);
  hud.healthFill.style.width = player.health + '%';
  hud.healthNum.textContent = Math.round(player.health);
  hud.district.textContent = districtName(player.x, player.z);
  hud.clock.textContent = fmtClock();
  hud.radio.textContent = 'VICE FM 98.5';
  const kmh = Math.round(Math.abs(player.speed) * 3.6);
  hud.speedNum.textContent = kmh;
  if (vehicles.driving) {
    const car = vehicles.car;
    hud.speedMode.textContent = `${car.name} · ${car.type}`;
    hud.carName.textContent = car.name;
    const cond = Math.round(car.condition);
    hud.carCond.textContent = cond + '%';
    hud.carCond.style.color = cond < 45 ? '#ff5a5a' : '#ddd';
    hud.carPrompt.textContent = 'E — EXIT CAR';
    hud.carPrompt.classList.remove('hidden');
  } else {
    hud.speedMode.textContent = 'ON FOOT';
    hud.carName.textContent = '—';
    hud.carCond.textContent = '—';
    hud.carCond.style.color = '#ddd';
    if (vehicles.prompt) {
      hud.carPrompt.textContent = vehicles.prompt;
      hud.carPrompt.classList.remove('hidden');
    } else {
      hud.carPrompt.classList.add('hidden');
    }
  }
  hud.muteState.textContent = muted ? 'MUTED' : 'SOUND ON';
  drawMinimap();
}

// ------------------------------------------------------------------ menus
let mode = 'title'; // title | playing | paused
function showTitle() {
  mode = 'title';
  hud.title.classList.remove('hidden');
  hud.pause.classList.add('hidden');
}
function startGame() {
  mode = 'playing';
  hud.title.classList.add('hidden');
  hud.pause.classList.add('hidden');
}
function togglePause() {
  if (mode === 'playing') {
    mode = 'paused';
    hud.pause.classList.remove('hidden');
  } else if (mode === 'paused') {
    mode = 'playing';
    hud.pause.classList.add('hidden');
  }
}
function toggleMute() {
  muted = !muted;
}

// E: enter the nearest parked car, or step out of the driven car.
function toggleCar() {
  if (mode !== 'playing') return;
  if (vehicles.driving) {
    const spot = vehicles.exit();
    if (spot) {
      player.x = spot.x;
      player.z = spot.z;
      player.yaw = spot.heading;
      cam.yaw = spot.heading + Math.PI;
      snapCamera();
    }
    char.group.visible = true;
  } else {
    let best = null;
    let bestD = 3.5;
    for (const car of vehicles.parked) {
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best && vehicles.enter(best)) {
      char.group.visible = false;
      driveYaw = best.heading + Math.PI;
      player.yaw = best.heading;
    }
  }
}
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      x: player.x, z: player.z, yaw: player.yaw,
      money: player.money, health: player.health, clockMin,
    }));
  } catch (e) { /* storage unavailable: ignore */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    player.x = s.x;
    player.z = s.z;
    player.yaw = s.yaw;
    player.money = s.money;
    player.health = s.health;
    clockMin = s.clockMin;
    return true;
  } catch (e) {
    return false;
  }
}
function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}
el('btn-start').addEventListener('click', startGame);
el('btn-continue').addEventListener('click', () => {
  if (loadGame()) startGame();
});
el('btn-resume').addEventListener('click', togglePause);
el('btn-save').addEventListener('click', saveGame);
el('btn-load').addEventListener('click', () => {
  loadGame();
});
el('btn-restart').addEventListener('click', () => {
  vehicles.reset();
  char.group.visible = true;
  player.x = 0;
  player.z = 26;
  player.y = 0;
  player.vy = 0;
  player.yaw = Math.PI;
  player.health = 100;
  player.money = 250;
  player.wanted = 0;
  clockMin = 18 * 60 + 42;
  mode = 'playing';
  hud.pause.classList.add('hidden');
});
el('btn-mute').addEventListener('click', toggleMute);
el('btn-quit').addEventListener('click', showTitle);
if (hasSave()) el('btn-continue').classList.remove('hidden');

// ------------------------------------------------------------------ player
function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const running = keys.ShiftLeft || keys.ShiftRight;
  const target = running ? RUN_SPEED : WALK_SPEED;
  // Camera-relative movement.
  const sin = Math.sin(cam.yaw);
  const cos = Math.cos(cam.yaw);
  let mx = 0;
  let mz = 0;
  if (fwd !== 0 || strafe !== 0) {
    mx = -sin * fwd + cos * strafe;
    mz = -cos * fwd - sin * strafe;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    player.yaw = Math.atan2(mx, mz);
  }
  const speedTarget = (fwd !== 0 || strafe !== 0) ? target : 0;
  player.speed = lerp(player.speed, speedTarget, damp(10, dt));
  const nx = player.x + mx * player.speed * dt;
  const nz = player.z + mz * player.speed * dt;
  const resolved = resolveCollisions(nx, nz, PLAYER_RADIUS, city.colliders);
  player.x = clamp(resolved.x, -HALF + 4, HALF - 4);
  player.z = clamp(resolved.z, -HALF + 4, HALF - 4);
  // Parked/traffic cars are solid to the player on foot.
  const carPush = vehicles.collidePlayer(player.x, player.z, PLAYER_RADIUS);
  if (carPush) {
    player.x = carPush.x;
    player.z = carPush.z;
  }
  // Jump + gravity. A tap queues the jump so it fires even when a frame
  // lands between the keydown and the keyup (SwiftShader runs ~1 FPS).
  if (jumpQueued && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
  jumpQueued = false;
  if (!player.onGround) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
  }
  // Walk cycle advances with distance.
  player.walkPhase += player.speed * dt * 1.6;
  char.group.position.set(player.x, player.y, player.z);
  char.group.rotation.y = player.yaw;
  animateCharacter(char, player.walkPhase, player.speed, !player.onGround, dt);
}

// ------------------------------------------------------------------ camera
function updateCamera(dt) {
  if (vehicles.driving) {
    // Cinematic chase-cam: low + close behind the car, lookahead in the
    // driving direction, FOV kick with speed. The mouse orbit offset
    // (driveYaw) eases back behind the car when left alone.
    const car = vehicles.car;
    driveYaw += angleDelta(driveYaw, car.heading + Math.PI) * damp(1.2, dt);
    const speedRatio = clamp(Math.abs(car.speed) / car.top, 0, 1);
    const dist = 9.5 - speedRatio * 1.0;
    const height = 2.7 - speedRatio * 0.4;
    cam.lookX = lerp(cam.lookX, car.x + Math.sin(car.heading) * 4, damp(6, dt));
    cam.lookZ = lerp(cam.lookZ, car.z + Math.cos(car.heading) * 4, damp(6, dt));
    cam.lookY = lerp(cam.lookY, 1.4, damp(6, dt));
    const cx = cam.lookX + Math.sin(driveYaw) * dist;
    const cz = cam.lookZ + Math.cos(driveYaw) * dist;
    camera.position.set(
      lerp(camera.position.x, cx, damp(8, dt)),
      lerp(camera.position.y, height, damp(8, dt)),
      lerp(camera.position.z, cz, damp(8, dt))
    );
    camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
    const targetFov = 60 + speedRatio * 9;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = lerp(camera.fov, targetFov, damp(4, dt));
      camera.updateProjectionMatrix();
    }
    fill.position.set(camera.position.x, camera.position.y + 4, camera.position.z);
    fill.target.position.set(car.x, 1.2, car.z);
    return;
  }
  const lookX = player.x + Math.sin(player.yaw) * 3;
  const lookZ = player.z + Math.cos(player.yaw) * 3;
  cam.lookX = lerp(cam.lookX, lookX, damp(6, dt));
  cam.lookZ = lerp(cam.lookZ, lookZ, damp(6, dt));
  cam.lookY = lerp(cam.lookY, 1.6 + player.y, damp(6, dt));
  const cx = cam.lookX + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cz = cam.lookZ + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cy = cam.lookY + Math.sin(cam.pitch) * cam.dist + 1.2;
  camera.position.set(
    lerp(camera.position.x, cx, damp(8, dt)),
    lerp(camera.position.y, cy, damp(8, dt)),
    lerp(camera.position.z, cz, damp(8, dt))
  );
  camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
  // Fill light follows the camera so the player is lit from the front.
  fill.position.set(camera.position.x, camera.position.y + 4, camera.position.z);
  fill.target.position.set(player.x, 1.2, player.z);
}

// ------------------------------------------------------------------ shots
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = params.get('seed') || '1';
window.__shotReady = false;

// Snap the camera + look point to their staged targets immediately.
// Without this the camera lerps from the origin (0,0,0) and after only
// 6 frames it is still ~100 m short of a far staged position (the beach
// shot showed the city, the plaza shot showed the fountain from above).
function snapCamera() {
  cam.lookX = player.x + Math.sin(player.yaw) * 3;
  cam.lookZ = player.z + Math.cos(player.yaw) * 3;
  cam.lookY = 1.6 + player.y;
  camera.position.set(
    cam.lookX + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    cam.lookY + Math.sin(cam.pitch) * cam.dist + 1.2,
    cam.lookZ + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist
  );
  camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
}

function snapChaseCamera() {
  const car = vehicles.car;
  if (!car) return;
  cam.lookX = car.x + Math.sin(car.heading) * 4;
  cam.lookZ = car.z + Math.cos(car.heading) * 4;
  cam.lookY = 1.4;
  camera.position.set(
    cam.lookX + Math.sin(driveYaw) * 9.5,
    2.7,
    cam.lookZ + Math.cos(driveYaw) * 9.5
  );
  camera.lookAt(cam.lookX, cam.lookY, cam.lookZ);
  camera.fov = 60 + clamp(Math.abs(car.speed) / car.top, 0, 1) * 9;
  camera.updateProjectionMatrix();
}

function stageShot(name) {
  if (name === 'onfoot') {
    player.x = 0;
    player.z = 26;
    player.yaw = Math.PI;
    cam.yaw = Math.PI;
    cam.pitch = 0.3;
    cam.dist = 7.5;
  } else if (name === 'city') {
    player.x = 0;
    player.z = 26;
    player.yaw = Math.PI;
    camera.position.set(90, 150, 150);
    camera.lookAt(0, 0, 0);
  } else if (name === 'beach') {
    // Player faces the sea (south, yaw 0); the camera must be NORTH of
    // the player (cam.yaw PI) looking south. Player x=16 sits in the gap
    // between the beach buildings at x=0 and x=32 so the camera is not
    // inside one. Player z=200 puts the sea just beyond the look point,
    // and the low pitch (0.15) keeps the sea + sky in the upper frame
    // instead of a wide empty sand foreground.
    player.x = 16;
    player.z = 200;
    player.yaw = 0;
    cam.yaw = Math.PI;
    cam.pitch = 0.15;
    cam.dist = 10;
  } else if (name === 'plaza') {
    // Player on the plaza's south edge facing north (yaw PI); camera
    // behind (south, cam.yaw 0) looking north at the player, the fountain
    // and the HOSPITAL landmark beyond.
    player.x = 0;
    player.z = 18;
    player.yaw = Math.PI;
    cam.yaw = 0;
    cam.pitch = 0.3;
    cam.dist = 9;
  } else if (name === 'drive') {
    // Hero GT on the central road heading south at 20 m/s (72 KM/H),
    // chase-cam snapped behind it. Staged at z=130 (market district,
    // shorter buildings) so the car is sunlit, not in a downtown shadow.
    const hero = vehicles.hero;
    hero.x = 6;
    hero.z = 130;
    hero.heading = 0;
    hero.speed = 20;
    hero.condition = 93;
    vehicles.enter(hero);
    char.group.visible = false;
    player.x = hero.x;
    player.z = hero.z;
    player.yaw = 0;
    player.speed = 20;
    driveYaw = Math.PI;
    cam.pitch = 0.3;
  }
  if (name === 'drive') snapChaseCamera();
  else if (name !== 'city') snapCamera();
  mode = 'playing';
  hud.title.classList.add('hidden');
}

// ------------------------------------------------------------------ loop
let lastNow = performance.now();
let frames = 0;
let shotFrames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  // Clamp dt to [0, 0.05]: a negative first-frame dt once spun the camera.
  const dt = clamp((now - lastNow) / 1000, 0, 0.05);
  lastNow = now;
  frames++;
  if (mode === 'title') {
    // Slow orbit over the city behind the title screen.
    const t = now * 0.00004;
    camera.position.set(Math.sin(t) * 150, 90, Math.cos(t) * 150);
    camera.lookAt(0, 10, 0);
    fill.position.set(camera.position.x, 100, camera.position.z);
    fill.target.position.set(0, 0, 0);
  } else if (mode === 'playing') {
    if (vehicles.driving) {
      // Driving: the car moves, the player rides along with it.
      vehicles.update(dt, keys, null);
      const car = vehicles.car;
      player.x = car.x;
      player.z = car.z;
      player.yaw = car.heading;
      player.speed = car.speed;
      char.group.visible = false;
    } else {
      updatePlayer(dt);
      vehicles.update(dt, keys, player);
      char.group.visible = true;
    }
    if (shotName !== 'city') updateCamera(dt);
    // Clock advances 1 minute per 10 s of play.
    clockMin += dt / 10;
    // Animate the sea.
    city.seaTex.offset.x += dt * 0.01;
    city.seaTex.offset.y += dt * 0.004;
  }
  updateHUD();
  renderer.render(scene, camera);
  if (frames === 3 && !window.__gameReady) window.__gameReady = true;
  if (shotName) {
    shotFrames++;
    if (shotFrames >= 6 && !window.__shotReady) window.__shotReady = true;
  }
}
if (shotName) stageShot(shotName);
window.__gameReady = false;
requestAnimationFrame(loop);

// ------------------------------------------------------------------ test hooks
window.__vb = {
  get mode() {
    return mode;
  },
  get player() {
    return {
      x: player.x,
      z: player.z,
      y: player.y,
      yaw: player.yaw,
      speed: player.speed,
      onGround: player.onGround,
    };
  },
  get money() {
    return player.money;
  },
  get health() {
    return player.health;
  },
  get wanted() {
    return player.wanted;
  },
  get clock() {
    return fmtClock();
  },
  get district() {
    return districtName(player.x, player.z);
  },
  get driving() {
    return vehicles.driving;
  },
  get car() {
    const c = vehicles.car;
    return c
      ? { name: c.name, type: c.type, speed: c.speed, condition: Math.round(c.condition), x: c.x, z: c.z, heading: c.heading }
      : null;
  },
  get traffic() {
    return vehicles.traffic.map((c) => ({ x: c.x, z: c.z, speed: c.speed, heading: c.heading }));
  },
  get parkedCount() {
    return vehicles.parkedCount;
  },
  get camera() {
    return { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov };
  },
  buildingCount: city.buildingCount,
  colliderCount: city.colliders.length,
  start() {
    startGame();
  },
  teleport(x, z) {
    player.x = x;
    player.z = z;
    player.y = 0;
    player.vy = 0;
  },
  setWanted(n) {
    player.wanted = clamp(n, 0, 5);
  },
};
