// VICE BAY — Stage 2: drivable cars, traffic, chase-cam support.
// Written fresh for the rebuild-v3. No line is copied from any earlier
// build. Desktop Chrome, keyboard + mouse, offline. Three.js r187.
//
// A car faces +z when its heading is 0 (forward = (sin h, cos h)).
// The module owns the parked cars, the traffic cars and the one
// headlight spotlight; main3d.js owns the player, the camera and the HUD.
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, resolveCollisions } from './util.js';
import { ROADS } from './city.js';

const CAR_RADIUS = 1.1; // collision radius for the centre/front/rear points
const CAR_CLEAR = 2.4; // minimum centre distance between two cars
const WHEEL_BASE = 2.7;

// ------------------------------------------------------------------ defs
// Parked cars: fixed spots on real road lanes (roads at -192..192, lanes
// offset 6 m from the road centre line). The hero GT sits south of the
// player start on the central road so the on-foot shot sees it.
const PARKED_DEFS = [
  { name: 'SUNSET GT', type: 'SPORTS', body: 'gt', color: 0xd41e2a, top: 34, accel: 15, x: 6, z: 44, heading: 0, hero: true },
  { name: 'CORAL SEDAN', type: 'SEDAN', body: 'sedan', color: 0x2aa8a0, top: 27, accel: 11, x: -6, z: 62, heading: Math.PI },
  { name: 'PALM TAXI', type: 'TAXI', body: 'taxi', color: 0xe8b62a, top: 28, accel: 12, x: 70, z: -6, heading: Math.PI / 2 },
  { name: 'HARBOUR TRUCK', type: 'TRUCK', body: 'truck', color: 0x8a6a2a, top: 23, accel: 8, x: -70, z: 6, heading: -Math.PI / 2 },
  { name: 'BEACH VAN', type: 'VAN', body: 'van', color: 0x4a90e8, top: 25, accel: 10, x: 134, z: 70, heading: Math.PI },
];

// Traffic loops: rectangles on real roads (right-lane offset applied at
// runtime). Each car starts at a different corner so they spread out.
const TRAFFIC_DEFS = [
  { name: 'SEDAN', type: 'SEDAN', body: 'sedan', color: 0x3a7ac2, top: 12, accel: 6, loop: [[-64, -64], [64, -64], [64, 64], [-64, 64]], start: 0 },
  { name: 'TAXI', type: 'TAXI', body: 'taxi', color: 0xe8c62a, top: 12, accel: 6, loop: [[-128, -128], [128, -128], [128, 128], [-128, 128]], start: 2 },
  { name: 'VAN', type: 'VAN', body: 'van', color: 0x5a8ac2, top: 11, accel: 5, loop: [[-192, -192], [192, -192], [192, 192], [-192, 192]], start: 1 },
  { name: 'TRUCK', type: 'TRUCK', body: 'truck', color: 0xb3541e, top: 10, accel: 5, loop: [[-64, -128], [64, -128], [64, 128], [-64, 128]], start: 3 },
];

// ------------------------------------------------------------------ mesh
function stdMat(color, roughness = 0.35, metalness = 0.55) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * One wheel: a steer pivot group (rotation.y = steer for front wheels)
 * holding a cylinder whose spin is rotation.y with Euler order ZYX, so
 * the spin axis stays on the car's X axis after the z = PI/2 turn.
 */
function buildWheel() {
  const pivot = new THREE.Group();
  const tyre = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: '#111111', roughness: 1 })
  );
  tyre.rotation.order = 'ZYX';
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  pivot.add(tyre);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8),
    new THREE.MeshStandardMaterial({ color: '#8a8a92', roughness: 0.4, metalness: 0.7 })
  );
  hub.rotation.order = 'ZYX';
  hub.rotation.z = Math.PI / 2;
  pivot.add(hub);
  return { pivot, tyre, hub };
}

/**
 * Extruded side-profile body: a real car silhouette (sloped hood,
 * windshield, roof, trunk) instead of a rectangular box. The profile is
 * in (x = length, front = +x; y = height); it is extruded across the
 * width and rotated so the length lies along the car's +z.
 * (Stage 2: replaces the boxy body/cabin. Fully local, no external asset.)
 */
function extrude(points, width, mat) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  g.translate(0, 0, -width / 2);
  g.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Build a detailed procedural car facing +z (front at +z).
 * Returns the group, the four wheels and the dent patch (hidden until
 * the condition drops below 60).
 */
function buildCarMesh(def) {
  const g = new THREE.Group();
  const paint = stdMat(def.color, 0.32, 0.6);
  const glass = stdMat(0x16202e, 0.15, 0.7);
  const dark = stdMat(0x1a1a20, 0.6, 0.3);
  const isTruck = def.body === 'truck';
  const isVan = def.body === 'van';
  const len = isTruck ? 5.0 : 4.4;

  // Body + cabin. Cars: extruded silhouette (low body + glasshouse with
  // sloped windshield/roof/rear window). Van: tall extruded body. Truck:
  // short cab + open bed (kept boxy — a utility vehicle).
  if (isTruck) {
    g.add(box(1.9, 0.72, 5.0, paint, 0, 0.62, 0));
    g.add(box(1.8, 0.7, 1.5, glass, 0, 1.3, 1.4));
    g.add(box(1.86, 0.5, 2.2, dark, 0, 1.05, -1.1)); // bed walls
    const crateMat = stdMat(0x9a7a3a, 0.9, 0.05);
    g.add(box(0.9, 0.7, 0.9, crateMat, -0.4, 1.45, -1.3));
    g.add(box(0.8, 0.6, 0.8, stdMat(0x3a6a9a, 0.9, 0.05), 0.45, 1.4, -0.8));
  } else if (isVan) {
    g.add(extrude([[-2.2, 0.28], [-2.2, 1.9], [1.7, 1.9], [2.2, 1.5], [2.2, 0.28]], 1.9, paint));
    g.add(extrude([[-1.9, 0.9], [-1.7, 1.85], [1.5, 1.85], [2.05, 1.45]], 1.7, glass));
  } else {
    g.add(extrude([[-2.2, 0.28], [-2.2, 0.88], [1.6, 0.88], [2.2, 0.78], [2.2, 0.28]], 1.9, paint));
    g.add(extrude([[-1.05, 0.86], [-0.85, 1.3], [0.65, 1.3], [1.35, 0.88]], 1.7, glass));
  }
  // Grille, bumpers, lights, mirrors.
  g.add(box(1.2, 0.22, 0.08, dark, 0, 0.62, len / 2 + 0.01));
  g.add(box(1.94, 0.22, 0.18, dark, 0, 0.42, len / 2 + 0.02));
  g.add(box(1.94, 0.22, 0.18, dark, 0, 0.42, -len / 2 - 0.02));
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xd41e1e, emissiveIntensity: 1.2 });
  for (const sx of [-0.6, 0.6]) {
    g.add(box(0.34, 0.16, 0.06, headMat, sx, 0.72, len / 2 + 0.03));
    g.add(box(0.34, 0.16, 0.06, tailMat, sx, 0.72, -len / 2 - 0.03));
    g.add(box(0.16, 0.12, 0.3, paint, sx * 1.66, 1.15, 0.7));
  }
  // Body-specific extras.
  if (def.body === 'gt') {
    g.add(box(1.7, 0.08, 0.5, dark, 0, 1.28, -2.05)); // spoiler
    g.add(box(0.1, 0.28, 0.1, dark, -0.7, 1.12, -2.05));
    g.add(box(0.1, 0.28, 0.1, dark, 0.7, 1.12, -2.05));
    g.add(box(1.94, 0.1, 0.3, dark, 0, 0.3, 0)); // side skirts
  }
  if (def.body === 'taxi') {
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffc23a, emissiveIntensity: 1.4 });
    g.add(box(0.7, 0.22, 0.4, signMat, 0, 1.72, -0.25));
  }
  // Dent patch: a dark crumpled hood panel, shown when condition < 60.
  // (Stage 2: y 1.02 -> 0.9 — the extruded hood top is ~0.88, not 1.0.)
  const dent = box(1.2, 0.06, 0.9, stdMat(0x222222, 1, 0), 0, 0.9, 1.5);
  dent.visible = false;
  g.add(dent);

  // Wheels: front axle steers, all four spin.
  const wheels = [];
  for (const [wx, wz, front] of [[-0.85, 1.35, true], [0.85, 1.35, true], [-0.85, -1.35, false], [0.85, -1.35, false]]) {
    const w = buildWheel();
    w.pivot.position.set(wx, 0.36, wz);
    g.add(w.pivot);
    wheels.push({ ...w, front });
  }
  return { group: g, wheels, dent, length: len };
}

// ------------------------------------------------------------------ state
function spawnCar(def, isTraffic) {
  const mesh = buildCarMesh(def);
  const car = {
    name: def.name,
    type: def.type,
    hero: !!def.hero,
    traffic: isTraffic,
    top: def.top,
    accel: def.accel,
    x: def.x ?? def.loop[def.start][0],
    z: def.z ?? def.loop[def.start][1],
    heading: def.heading ?? 0,
    speed: 0,
    steer: 0,
    wheelSpin: 0,
    condition: 100,
    spawn: { x: def.x ?? def.loop[def.start][0], z: def.z ?? def.loop[def.start][1], heading: def.heading ?? 0 },
    loop: def.loop || null,
    wpIndex: isTraffic ? (def.start + 1) % def.loop.length : 0,
    cruise: isTraffic ? def.top : 0,
    // Parked cars are immovable in collisions; traffic cars give way.
    // The driven car has fixed cleared on enter, restored on exit/reset.
    fixed: !isTraffic,
    ...mesh,
  };
  if (isTraffic) {
    // Face the next waypoint at spawn.
    const t = car.loop[car.wpIndex];
    car.heading = Math.atan2(t[0] - car.x, t[1] - car.z);
    car.speed = car.cruise * 0.6;
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  return car;
}

function syncMesh(car) {
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.wheelSpin += (car.speed / 0.36) * 0.016;
  for (const w of car.wheels) {
    w.pivot.rotation.y = w.front ? car.steer : 0;
    w.tyre.rotation.y = car.wheelSpin;
    w.hub.rotation.y = car.wheelSpin;
  }
  car.dent.visible = car.condition < 60;
}

function conditionFactor(car) {
  return 0.55 + 0.45 * (car.condition / 100);
}

function damage(car, amount) {
  car.condition = clamp(car.condition - amount, 0, 100);
}

/** Resolve a car against building colliders at centre/front/rear points. */
function collideBuildings(car, colliders) {
  let hit = 0;
  const fx = Math.sin(car.heading) * 1.9;
  const fz = Math.cos(car.heading) * 1.9;
  for (const [px, pz] of [[car.x, car.z], [car.x + fx, car.z + fz], [car.x - fx, car.z - fz]]) {
    const out = resolveCollisions(px, pz, CAR_RADIUS, colliders);
    const dx = out.x - px;
    const dz = out.z - pz;
    if (dx !== 0 || dz !== 0) {
      car.x += dx;
      car.z += dz;
      hit = Math.max(hit, Math.hypot(dx, dz));
    }
  }
  return hit;
}

/** Push two cars apart (circles); returns true when they touched.
 *  A fixed (parked) car never moves: the other car takes the full push. */
function pushCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d >= CAR_CLEAR || d < 1e-6) return false;
  const push = CAR_CLEAR - d;
  const nx = dx / d;
  const nz = dz / d;
  const aShare = a.fixed ? 0 : b.fixed ? 1 : 0.5;
  const bShare = b.fixed ? 0 : a.fixed ? 1 : 0.5;
  a.x -= nx * push * aShare;
  a.z -= nz * push * aShare;
  b.x += nx * push * bShare;
  b.z += nz * push * bShare;
  return true;
}

// ------------------------------------------------------------------ driving
function driveStep(car, input, dt, colliders, others) {
  const maxSpeed = car.top * conditionFactor(car);
  const fwd = (input.throttle || 0);
  const handbrake = !!input.handbrake;
  if (fwd > 0) {
    car.speed += car.accel * fwd * dt;
  } else if (fwd < 0) {
    if (car.speed > 0.5) car.speed -= 18 * dt; // brake
    else car.speed -= 8 * dt; // reverse
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 12 * dt);
  }
  // Rolling + aero drag.
  car.speed *= Math.exp(-0.35 * dt);
  car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 0.15 * dt);
  car.speed = clamp(car.speed, -8, maxSpeed);
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;

  // Speed-sensitive steering (less lock at speed, sharper on handbrake).
  const speedRatio = clamp(Math.abs(car.speed) / car.top, 0, 1);
  const maxSteer = 0.55 * (1 - 0.55 * speedRatio) * (handbrake ? 1.6 : 1);
  const steerTarget = clamp(input.steer || 0, -1, 1) * maxSteer;
  car.steer = lerp(car.steer, steerTarget, damp(8, dt));
  car.heading += (car.speed / WHEEL_BASE) * Math.tan(car.steer) * dt;

  const before = Math.abs(car.speed);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  const hit = collideBuildings(car, colliders);
  if (hit > 0.05) {
    if (before > 8) damage(car, 2); // hard crash dents the car
    car.speed *= 0.5;
  }
  for (const other of others) {
    if (other === car) continue;
    if (pushCars(car, other)) {
      if (before > 3) damage(car, 1.5);
      car.speed *= 0.85;
    }
  }
  syncMesh(car);
}

// ------------------------------------------------------------------ traffic
function trafficStep(car, dt, colliders, others, playerPos) {
  const target = car.loop[car.wpIndex];
  // Right-lane offset: shift the waypoint 3 m to the right of travel.
  const dx = target[0] - car.x;
  const dz = target[1] - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 4) {
    car.wpIndex = (car.wpIndex + 1) % car.loop.length;
    return;
  }
  const nx = dx / dist;
  const nz = dz / dist;
  const tx = target[0] + -nz * 3;
  const tz = target[1] + nx * 3;
  const desired = Math.atan2(tx - car.x, tz - car.z);
  const turn = angleDelta(car.heading, desired);
  const speedRatio = clamp(Math.abs(car.speed) / car.top, 0, 1);
  car.steer = lerp(car.steer, clamp(turn * 1.5, -1, 1) * 0.5 * (1 - 0.5 * speedRatio), damp(6, dt));
  car.heading += (car.speed / WHEEL_BASE) * Math.tan(car.steer) * dt;

  // Slow/stop for a car or the player directly ahead.
  let blocked = false;
  const ahead = [...others];
  if (playerPos) ahead.push({ x: playerPos.x, z: playerPos.z, speed: 0 });
  for (const o of ahead) {
    if (o === car) continue;
    const rx = o.x - car.x;
    const rz = o.z - car.z;
    const fwdDist = rx * Math.sin(car.heading) + rz * Math.cos(car.heading);
    const latDist = Math.abs(rx * Math.cos(car.heading) - rz * Math.sin(car.heading));
    if (fwdDist > 0 && fwdDist < 10 && latDist < 2.5) {
      blocked = true;
      break;
    }
  }
  const targetSpeed = blocked ? 0 : car.cruise;
  car.speed = lerp(car.speed, targetSpeed, damp(2, dt));
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  const hit = collideBuildings(car, colliders);
  if (hit > 0.05) car.speed *= 0.5;
  for (const other of others) {
    if (other === car) continue;
    pushCars(car, other);
  }
  syncMesh(car);
}

// ------------------------------------------------------------------ factory
export function createVehicles(scene, city) {
  const colliders = city.colliders;
  const parked = PARKED_DEFS.map((d) => spawnCar(d, false));
  const traffic = TRAFFIC_DEFS.map((d) => spawnCar(d, true));
  const list = [...parked, ...traffic];
  for (const car of list) scene.add(car.group);

  // One headlight spotlight on the driven car.
  const headlight = new THREE.SpotLight(0xfff2c0, 0, 60, 0.5, 0.4, 1.2);
  headlight.castShadow = false;
  scene.add(headlight);
  scene.add(headlight.target);

  let driven = null;
  let prompt = null;

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  const api = {
    list,
    parked,
    traffic,
    hero: parked[0],
    get driving() {
      return driven !== null;
    },
    get car() {
      return driven;
    },
    get parkedCount() {
      return parked.length;
    },
    get prompt() {
      return prompt;
    },

    /** Enter a parked car (called by main3d on E). */
    enter(car) {
      if (!car || driven) return false;
      driven = car;
      car.fixed = false; // the driven car must be pushable in collisions
      return true;
    },

    /** Step out beside the car (right side, collider-aware). Returns the exit spot. */
    exit() {
      if (!driven) return null;
      const car = driven;
      driven = null;
      car.fixed = true;
      headlight.intensity = 0;
      const rx = -Math.cos(car.heading) * 2.2;
      const rz = Math.sin(car.heading) * 2.2;
      const out = resolveCollisions(car.x + rx, car.z + rz, 0.55, colliders);
      return { x: out.x, z: out.z, heading: car.heading };
    },

    /** Push the on-foot player out of every parked/traffic car circle. */
    collidePlayer(px, pz, radius) {
      for (const car of list) {
        if (car === driven) continue;
        const dx = px - car.x;
        const dz = pz - car.z;
        const d = Math.hypot(dx, dz);
        const min = 2.3 + radius;
        if (d < min && d > 1e-6) {
          const push = min - d;
          return { x: px + (dx / d) * push, z: pz + (dz / d) * push };
        }
        if (d <= 1e-6) return { x: px + min, z: pz };
      }
      return null;
    },

    /** Put every car back at its spawn (used by RESTART). */
    reset() {
      driven = null;
      headlight.intensity = 0;
      for (const car of list) {
        car.x = car.spawn.x;
        car.z = car.spawn.z;
        car.heading = car.spawn.heading;
        car.speed = 0;
        car.steer = 0;
        car.condition = 100;
        car.fixed = !car.traffic;
        if (car.traffic) {
          const t = car.loop[car.wpIndex];
          car.heading = Math.atan2(t[0] - car.x, t[1] - car.z);
          car.speed = car.cruise * 0.6;
        }
        syncMesh(car);
      }
    },

    /**
     * Advance the world one frame. dt is clamped to [0, 0.05] here as
     * well as in the main loop: a negative first-frame dt once spun the
     * car and flung the camera.
     * keys: the main key map (KeyW/KeyS/KeyA/KeyD/Space).
     * playerPos: {x, z} of the on-foot player (traffic avoids them).
     */
    update(dt, keys, playerPos) {
      dt = clamp(dt, 0, 0.05);
      // The driven car.
      if (driven) {
        const input = {
          throttle: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
          steer: (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0),
          handbrake: !!(keys.Space),
        };
        driveStep(driven, input, dt, colliders, list);
        // Headlight: front of the car, aimed 15 m ahead.
        const fx = Math.sin(driven.heading);
        const fz = Math.cos(driven.heading);
        headlight.position.set(driven.x + fx * 2, 1.0, driven.z + fz * 2);
        headlight.target.position.set(driven.x + fx * 15, 0.4, driven.z + fz * 15);
        headlight.intensity = 80;
        prompt = 'E — EXIT CAR';
      } else {
        headlight.intensity = 0;
        const near = playerPos ? nearestParked(playerPos.x, playerPos.z, 3.5) : null;
        prompt = near ? `E — ENTER CAR · ${near.name}` : null;
      }
      // Traffic always moves.
      for (const car of traffic) {
        trafficStep(car, dt, colliders, list, driven ? null : playerPos);
      }
    },
  };
  return api;
}
