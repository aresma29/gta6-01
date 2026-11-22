// VICE BAY 3D — vehicles: drivable cars, enter/exit, driving physics,
// a cinematic chase-cam, traffic AI and parked cars. All geometry is
// procedural (boxes/cylinders); no external assets. Written fresh for
// Stage 2. Forward is local +Z; heading h means forward = (sin h, cos h).
import * as THREE from '../vendor/three/three.module.min.js';
import { makeCar } from './actors.js';
import { clamp, lerpAngle, dist2D, makeRng } from './util.js';
import { ROADS, resolveCollision, collides } from './city.js';

const ACT_ENTER = 4; // KeyE (matches util.js)

// --- Car detail kit: grille, bumpers, windshield, side windows, mirrors,
// spoiler. Applied on top of a makeCar() result so the car reads as a car,
// not a box. All positions are relative to the car's spec (L, W, bodyH, cabH).
function addCarDetails(car, type) {
  const g = car.group;
  const { L, W, spec } = car;
  const bodyH = spec.bodyH;
  const cabH = spec.cabH;
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.25, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.5, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.12, metalness: 0.55 });
  function bx(w, h, d, mat, x, y, z, rx = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    m.castShadow = true;
    g.add(m);
    return m;
  }
  // Grille + front bumper + rear bumper.
  bx(W * 0.52, 0.2, 0.07, dark, 0, 0.58, L / 2 + 0.02);
  bx(W * 0.96, 0.16, 0.12, chrome, 0, 0.36, L / 2 + 0.05);
  bx(W * 0.96, 0.16, 0.12, chrome, 0, 0.36, -L / 2 - 0.05);
  // Windshield + side windows (only when the car has a cabin).
  if (cabH > 0) {
    const cabY = 0.35 + bodyH + cabH / 2 - 0.05;
    const cabZ = -L * 0.04;
    bx(W * 0.72, cabH * 0.82, 0.04, glass, 0, cabY, cabZ + L * 0.24 - 0.02, -0.28);
    for (const sx of [-1, 1]) {
      bx(0.04, cabH * 0.62, L * 0.36, glass, sx * W * 0.42, cabY, cabZ);
      // Side mirror.
      bx(0.1, 0.08, 0.14, dark, sx * (W / 2 + 0.07), 0.35 + bodyH + 0.12, L * 0.16);
    }
  } else if (type === 'truck') {
    for (const sx of [-1, 1]) {
      bx(0.1, 0.08, 0.14, dark, sx * (W / 2 + 0.07), 0.35 + 1.0, L * 0.36);
    }
  }
  // Spoiler on the sports car.
  if (type === 'sports') {
    bx(W * 0.8, 0.05, 0.34, dark, 0, 0.35 + bodyH + 0.34, -L / 2 + 0.3);
    for (const sx of [-1, 1]) bx(0.06, 0.26, 0.06, dark, sx * W * 0.32, 0.35 + bodyH + 0.2, -L / 2 + 0.3);
  }
  // Roof: a slightly darker panel so the car reads as two-tone from above.
  if (cabH > 0) bx(W * 0.7, 0.04, L * 0.4, dark, 0, 0.35 + bodyH + cabH - 0.02, -L * 0.04);
}

// Waypoint loops (rectangles on the road grid) for traffic circulation.
const LOOPS = [
  [[-56, -56], [56, -56], [56, 56], [-56, 56]],
  [[-168, -168], [0, -168], [0, -112], [-168, -112]],
  [[0, 112], [168, 112], [168, 168], [0, 168]],
  [[-168, 56], [-56, 56], [-56, 112], [-168, 112]],
  [[-112, -168], [-112, 0], [-56, 0], [-56, -168]],
];

const PARKED_DEFS = [
  { type: 'sports', colour: 0xd43a2f, name: 'SUNSET GT', x: 40, z: -53, heading: Math.PI / 2 },
  { type: 'sedan', colour: 0x2a9a9a, name: 'CORAL SEDAN', x: -3, z: 40, heading: 0 },
  { type: 'truck', colour: 0x5a6a7a, name: 'HARBOUR TRUCK', x: -120, z: 53, heading: -Math.PI / 2 },
  { type: 'taxi', colour: 0xf0c020, name: 'PALM TAXI', x: 115, z: -20, heading: Math.PI },
  { type: 'van', colour: 0x8d929c, name: 'BEACH VAN', x: 60, z: 171, heading: Math.PI / 2 },
];

const TRAFFIC_DEFS = [
  { type: 'sedan', colour: 0x8d929c, loop: 0, speed: 10 },
  { type: 'taxi', colour: 0xf0c020, loop: 1, speed: 11 },
  { type: 'van', colour: 0x4a6a8a, loop: 2, speed: 9 },
  { type: 'sedan', colour: 0x7a4a8a, loop: 3, speed: 10 },
  { type: 'truck', colour: 0x8a2a2a, loop: 4, speed: 9 },
];

const TYPE_LABEL = { sedan: 'SEDAN', sports: 'SPORTS', taxi: 'TAXI', truck: 'TRUCK', van: 'VAN', police: 'VBPD INTERCEPTOR', armoured: 'ARMOURED VAN' };

export function createVehicles(scene, city) {
  const rng = makeRng(2026);
  const list = [];
  let playerCar = null;
  let driveCamYaw = 0;
  let driveCamPitch = 0.22;
  let fov = 60;

  // Headlight spotlight for the player's car (one light, dusk driving).
  const headlight = new THREE.SpotLight(0xffe9a0, 0, 55, 0.55, 0.55, 1.1);
  headlight.castShadow = false;
  scene.add(headlight);
  scene.add(headlight.target);

  // Parked cars are solid for the player on foot (an AABB in the city
  // colliders). The collider is removed while the car is driven and put back
  // when it is parked again, so the driven car never collides with itself.
  function carCollider(v) {
    const r = Math.max(v.L, v.W) / 2;
    const axisAligned = Math.abs(Math.sin(v.heading)) < 0.01 || Math.abs(Math.cos(v.heading)) < 0.01;
    if (axisAligned && Math.abs(Math.sin(v.heading)) > 0.5) {
      // Facing +/-x: length along x.
      return { minX: v.x - v.L / 2, maxX: v.x + v.L / 2, minZ: v.z - v.W / 2, maxZ: v.z + v.W / 2 };
    }
    if (axisAligned) {
      // Facing +/-z: length along z.
      return { minX: v.x - v.W / 2, maxX: v.x + v.W / 2, minZ: v.z - v.L / 2, maxZ: v.z + v.L / 2 };
    }
    return { minX: v.x - r, maxX: v.x + r, minZ: v.z - r, maxZ: v.z + r };
  }
  function addParkedCollider(v) {
    if (v._collider) return;
    v._collider = carCollider(v);
    city.colliders.push(v._collider);
  }
  function removeParkedCollider(v) {
    if (!v._collider) return;
    const i = city.colliders.indexOf(v._collider);
    if (i >= 0) city.colliders.splice(i, 1);
    v._collider = null;
  }

  function spawnVehicle(def, isTraffic, loopIdx) {
    const built = makeCar(def.type, def.colour);
    addCarDetails(built, def.type);
    built.group.position.set(def.x, 0, def.z);
    built.group.rotation.y = def.heading;
    scene.add(built.group);
    const v = {
      ...built,
      type: def.type,
      name: def.name || TYPE_LABEL[def.type],
      displayName: def.name || TYPE_LABEL[def.type],
      typeLabel: TYPE_LABEL[def.type],
      x: def.x, z: def.z, heading: def.heading ?? 0,
      speed: 0, targetSpeed: def.speed || 0,
      steer: 0, condition: 92 + Math.floor(rng.next() * 8),
      isTraffic: !!isTraffic, isParked: !isTraffic,
      isPlayer: false,
      loop: isTraffic ? LOOPS[loopIdx % LOOPS.length] : null,
      wp: 0,
    };
    if (isTraffic) {
      // Start at the first waypoint of the loop, facing the next one.
      const w0 = v.loop[0], w1 = v.loop[1];
      v.x = w0[0]; v.z = w0[1]; v.wp = 1;
      v.heading = Math.atan2(w1[0] - w0[0], w1[1] - w0[1]);
      v.speed = v.targetSpeed;
    } else {
      addParkedCollider(v);
    }
    list.push(v);
    return v;
  }

  for (const d of PARKED_DEFS) spawnVehicle(d, false);
  for (const d of TRAFFIC_DEFS) spawnVehicle(d, true, d.loop);
  const hero = list[0]; // SUNSET GT — the hero car, next to the player start.

  // --- Enter / exit prompt (a small panel, created once) ---
  const promptEl = document.createElement('div');
  promptEl.id = 'carprompt';
  promptEl.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:6;pointer-events:none;background:rgba(8,12,18,0.72);border:1px solid rgba(255,214,10,0.5);border-radius:8px;padding:8px 16px;font:700 14px system-ui,sans-serif;color:#ffd60a;letter-spacing:1px;display:none;text-shadow:0 1px 4px #000';
  document.body.appendChild(promptEl);
  function showPrompt(text) {
    if (text) { promptEl.textContent = text; promptEl.style.display = 'block'; }
    else promptEl.style.display = 'none';
  }

  function nearestDrivable(player, maxDist = 4.5) {
    let best = null, bd = maxDist;
    for (const v of list) {
      if (v.isTraffic || v.isPlayer) continue;
      const d = dist2D(player.x, player.z, v.x, v.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  function enterCar(car, player, playerMesh) {
    if (playerCar) return false;
    playerCar = car;
    car.isPlayer = true;
    car.isParked = false;
    removeParkedCollider(car);
    car.speed = 0;
    player.x = car.x; player.z = car.z; player.heading = car.heading;
    player.speed = 0;
    driveCamYaw = car.heading;
    driveCamPitch = 0.22;
    playerMesh.group.visible = false;
    showPrompt('E — EXIT CAR');
    return true;
  }

  function exitCar(player, playerMesh) {
    if (!playerCar) return false;
    const car = playerCar;
    // Step out on the car's right side.
    const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
    let px = car.x + rx * 2.4, pz = car.z + rz * 2.4;
    const res = resolveCollision(city.colliders, px, pz, 0.55);
    px = res.x; pz = res.z;
    px = clamp(px, -235, 235); pz = clamp(pz, -235, 206);
    player.x = px; player.z = pz; player.y = 0; player.vy = 0; player.onGround = true;
    player.heading = car.heading; player.camYaw = car.heading; player.speed = 0;
    playerMesh.group.position.set(px, 0, pz);
    playerMesh.group.rotation.y = player.heading;
    playerMesh.group.visible = true;
    car.isPlayer = false;
    car.isParked = true;
    car.speed = 0;
    addParkedCollider(car);
    playerCar = null;
    headlight.intensity = 0;
    showPrompt(null);
    return true;
  }

  function reset(player, playerMesh) {
    if (playerCar) exitCar(player, playerMesh);
    // Parked cars back to their spawn spots; traffic keeps circulating.
    for (let i = 0; i < PARKED_DEFS.length; i++) {
      const d = PARKED_DEFS[i], v = list[i];
      removeParkedCollider(v);
      v.x = d.x; v.z = d.z; v.heading = d.heading; v.speed = 0;
      v.group.position.set(d.x, 0, d.z);
      v.group.rotation.y = d.heading;
      addParkedCollider(v);
    }
  }

  // --- Driving physics (player car) ---
  function updateDriving(dt, input, player) {
    const car = playerCar;
    const axes = input.moveAxes();
    const spec = car.spec;
    const handbrake = input.isDown('Space');
    // Throttle / brake / reverse.
    if (axes.f > 0) {
      car.speed += spec.accel * dt;
    } else if (axes.f < 0) {
      if (car.speed > 0.5) car.speed -= 30 * dt; // brake
      else car.speed -= spec.accel * 0.55 * dt; // reverse
    } else {
      // Rolling drag toward 0.
      const drag = 6 * dt;
      car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
    }
    if (handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
    // Damage is real: a battered car loses top speed (55% at condition 5).
    const effMax = car.spec.maxSpeed * (0.55 + 0.45 * car.condition / 100);
    car.speed = clamp(car.speed, -9, effMax);
    if (Math.abs(car.speed) < 0.05 && axes.f === 0) car.speed = 0;
    // Steering: speed-sensitive, sharper with the handbrake.
    const spd = Math.abs(car.speed);
    const turnFactor = clamp(spd / 12, 0, 1) * (1 - clamp(spd / effMax, 0, 1) * 0.45) * (handbrake ? 1.6 : 1);
    const steerTarget = axes.s * 0.55;
    car.steer += (steerTarget - car.steer) * (1 - Math.exp(-10 * dt));
    car.heading -= car.steer * turnFactor * 2.2 * dt * Math.sign(car.speed || 1);
    // Move + collide (centre + front/rear points, so the long body can't clip).
    const prevX = car.x, prevZ = car.z;
    let nx = car.x + Math.sin(car.heading) * car.speed * dt;
    let nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const res = resolveCollision(city.colliders, nx, nz, 1.9);
    nx = res.x; nz = res.z;
    const fx = nx + Math.sin(car.heading) * 1.9, fz = nz + Math.cos(car.heading) * 1.9;
    const bx = nx - Math.sin(car.heading) * 1.9, bz = nz - Math.cos(car.heading) * 1.9;
    const hitFront = collides(city.colliders, fx, fz, 0.9);
    const hitRear = collides(city.colliders, bx, bz, 0.9);
    if (hitFront || hitRear || (res.x !== car.x + Math.sin(car.heading) * car.speed * dt) || (res.z !== car.z + Math.cos(car.heading) * car.speed * dt)) {
      // Crash: stop at the previous position, bleed speed, damage the car.
      car.x = prevX; car.z = prevZ;
      car.speed *= 0.3;
      car.condition = Math.max(5, car.condition - 2);
    } else {
      car.x = clamp(nx, -235, 235);
      car.z = clamp(nz, -235, 206);
    }
    // Car-car collision (player car vs every other vehicle).
    for (const o of list) {
      if (o === car) continue;
      const d = dist2D(car.x, car.z, o.x, o.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d);
        const ux = (car.x - o.x) / d, uz = (car.z - o.z) / d;
        car.x += ux * push; car.z += uz * push;
        car.speed *= 0.55;
        car.condition = Math.max(5, car.condition - 1.5);
        if (o.isTraffic) o.speed *= 0.5;
      }
    }
    // Wheels: spin + front steer.
    const spin = (car.speed * dt) / 0.36;
    for (const p of car.pivots) {
      p.pivot.rotation.y = p.front ? -car.steer * 0.85 : 0;
    }
    for (const w of car.wheels) w.rotation.x += spin;
    // Sync the player to the car (HUD, minimap, sun, district all follow).
    player.x = car.x; player.z = car.z; player.heading = car.heading;
    player.speed = Math.abs(car.speed);
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    // Headlight: on while driving, aimed ahead.
    headlight.intensity = 55;
    const hx = car.x + Math.sin(car.heading) * 2.2, hz = car.z + Math.cos(car.heading) * 2.2;
    headlight.position.set(hx, 1.0, hz);
    headlight.target.position.set(car.x + Math.sin(car.heading) * 18, 0.4, car.z + Math.cos(car.heading) * 18);
    headlight.target.updateMatrixWorld();
  }

  // --- Traffic AI: waypoint loops + follow/avoid ---
  function updateTraffic(dt, player) {
    for (const v of list) {
      if (!v.isTraffic) continue;
      // Follow: slow if something is ahead (another car, the player car, or the player on foot).
      let want = v.targetSpeed;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const ahead = [];
      for (const o of list) {
        if (o === v) continue;
        ahead.push({ x: o.x, z: o.z, speed: Math.abs(o.speed) });
      }
      if (!playerCar) ahead.push({ x: player.x, z: player.z, speed: 0 });
      else ahead.push({ x: playerCar.x, z: playerCar.z, speed: Math.abs(playerCar.speed) });
      for (const a of ahead) {
        const dx = a.x - v.x, dz = a.z - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 11 && dist > 0.01) {
          const dot = (dx * fx + dz * fz) / dist; // 1 = dead ahead
          if (dot > 0.86) {
            if (dist < 5) want = 0;
            else want = Math.min(want, a.speed * 0.9 + 1.5);
          }
        }
      }
      v.speed += clamp(want - v.speed, -14 * dt, 9 * dt);
      if (v.speed < 0.05 && want === 0) v.speed = 0;
      // Waypoint steering.
      const wp = v.loop[v.wp];
      const dx = wp[0] - v.x, dz = wp[1] - v.z;
      const distWp = Math.hypot(dx, dz);
      if (distWp < 6) v.wp = (v.wp + 1) % v.loop.length;
      const desired = Math.atan2(dx, dz);
      v.heading = lerpAngle(v.heading, desired, 1 - Math.exp(-2.6 * dt));
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      // Stay on the road: resolve against buildings as a safety net.
      const res = resolveCollision(city.colliders, v.x, v.z, 1.9);
      v.x = res.x; v.z = res.z;
      v.x = clamp(v.x, -235, 235); v.z = clamp(v.z, -235, 206);
      // Mesh: lateral lane offset (right side of the road) + wheels.
      const rx = -Math.cos(v.heading), rz = Math.sin(v.heading);
      v.group.position.set(v.x + rx * 2.5, 0, v.z + rz * 2.5);
      v.group.rotation.y = v.heading;
      const spin = (v.speed * dt) / 0.36;
      for (const p of v.pivots) p.pivot.rotation.y = 0;
      for (const w of v.wheels) w.rotation.x += spin;
    }
  }

  // --- Chase-cam: smooth, low, close behind the car, with a sense of speed.
  // look = {dx, dy} mouse-drag deltas (consumed here). lift = 1 when the
  // police helicopter is active: the camera pulls back a little and tilts up
  // so the helicopter stays in frame. Returns nothing; moves `camera`.
  function driveCamera(camera, dt, look, lift) {
    const car = playerCar;
    if (!car) return;
    driveCamYaw -= look.dx * 0.004;
    driveCamPitch = clamp(driveCamPitch + look.dy * 0.002, 0.08, 0.5);
    // Ease the camera back behind the car.
    driveCamYaw = lerpAngle(driveCamYaw, car.heading, 1 - Math.exp(-1.6 * dt));
    const dist = 9.5 + (lift ? 1 : 0);
    const speedF = clamp(Math.abs(car.speed) / car.spec.maxSpeed, 0, 1);
    const height = 2.7 - speedF * 0.55; // lower + more aggressive at speed
    const cp = Math.cos(driveCamPitch), sp = Math.sin(driveCamPitch);
    const fx = Math.sin(driveCamYaw), fz = Math.cos(driveCamYaw);
    camera.position.set(
      car.x - fx * cp * dist,
      height + sp * dist * 0.45,
      car.z - fz * cp * dist
    );
    camera.position.y = Math.max(camera.position.y, 1.4);
    camera.lookAt(
      car.x + Math.sin(car.heading) * 6,
      1.6 + (lift ? 2.5 : 0),
      car.z + Math.cos(car.heading) * 6
    );
    // FOV kick with speed (a sense of speed).
    const targetFov = 60 + speedF * 9;
    if (Math.abs(targetFov - fov) > 0.05) {
      fov += (targetFov - fov) * (1 - Math.exp(-4 * dt));
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // Damage the player's car from outside (police ram). Condition floors at 5.
  function damagePlayerCar(amount) {
    if (!playerCar) return;
    playerCar.condition = Math.max(5, playerCar.condition - amount);
  }

  function update(dt, actions, input, player, playerMesh) {
    if (actions & ACT_ENTER) {
      if (playerCar) exitCar(player, playerMesh);
      else {
        const near = nearestDrivable(player);
        if (near) enterCar(near, player, playerMesh);
      }
    }
    if (playerCar) {
      updateDriving(dt, input, player);
      showPrompt('E — EXIT CAR');
    } else {
      const near = nearestDrivable(player);
      showPrompt(near ? `E — ENTER CAR · ${near.displayName}` : null);
    }
    updateTraffic(dt, player);
    return !!playerCar;
  }

  return {
    list,
    hero,
    get playerCar() { return playerCar; },
    update,
    driveCamera,
    nearestDrivable,
    enterCar,
    exitCar,
    reset,
    damagePlayerCar,
  };
}
