// vehicles.js — VICE BAY 3D, Stage 2 (rebuild-final).
// Drivable cars + traffic. Written fresh in the rebuild recording; no code
// copied from any earlier branch. Procedural three.js meshes, arcade
// physics, headlights, visible damage. Fully deterministic (fixed spawn
// points and waypoint loops, no randomness, no network).

import * as THREE from 'three';
import { clamp, damp, dampAngle, resolveCollisions } from './util.js';

const WORLD = 240; // must match city.js WORLD
const MAX_SPEED = 30; // ~108 km/h
const MAX_REVERSE = 9;
const ACCEL = 14;
const BRAKE = 26;
const TURN_RATE = 1.9;
const ENTER_DIST = 3.5;
const WHEEL_R = 0.36;

// ---- car definitions -------------------------------------------------------
// Five distinct cars. The red Sunset GT is the player's own car (owned);
// the other four are parked cars — entering one is theft (wanted 1).
const CAR_DEFS = [
  { id: 'sunset', name: 'Sunset GT', color: 0xe23b3b, len: 4.6, wid: 1.9, maxSpeed: 32, owned: true, style: 'sport', x: 0, z: 40, heading: Math.PI },
  { id: 'ocean', name: 'Ocean Hatch', color: 0x2b6fe3, len: 4.0, wid: 1.8, maxSpeed: 27, owned: false, style: 'hatch', x: 0, z: -20, heading: 0 },
  { id: 'taxi', name: 'Vice Taxi', color: 0xf2c200, len: 4.4, wid: 1.9, maxSpeed: 28, owned: false, style: 'taxi', x: 64, z: 24, heading: -Math.PI / 2 },
  { id: 'palm', name: 'Palm Pickup', color: 0x2fae5f, len: 4.8, wid: 2.0, maxSpeed: 26, owned: false, style: 'pickup', x: -64, z: 24, heading: Math.PI / 2 },
  { id: 'violet', name: 'Violet Cruiser', color: 0x8a4fd0, len: 4.5, wid: 1.9, maxSpeed: 29, owned: false, style: 'sedan', x: 0, z: 90, heading: Math.PI },
];

// Four traffic loops. Every edge runs along a road centreline (ROADS), so
// traffic never crosses a building block.
const TRAFFIC_LOOPS = [
  { id: 't1', color: 0xd8d8d8, pts: [[-64, -64], [64, -64], [64, 64], [-64, 64]] },
  { id: 't2', color: 0x3d4450, pts: [[-128, 0], [-128, 128], [0, 128], [0, 0]] },
  { id: 't3', color: 0xc96a2b, pts: [[64, -128], [192, -128], [192, 0], [64, 0]] },
  { id: 't4', color: 0x7fb3d5, pts: [[-192, 64], [-64, 64], [-64, 192], [-192, 192]] },
];
const TRAFFIC_SPEED = 8;

// ---- mesh builder ----------------------------------------------------------
function buildCarMesh(def) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, metalness: 0.35, roughness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.6, roughness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });

  // Main body.
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.len, 0.7, def.wid), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  // Cabin (pickup gets a low cab + open bed instead).
  if (def.style === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.32, 0.55, def.wid * 0.85), glassMat);
    cab.position.set(-def.len * 0.22, 1.1, 0);
    g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.4, 0.18, def.wid * 0.9), darkMat);
    bed.position.set(def.len * 0.22, 0.95, 0);
    g.add(bed);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(def.len * 0.5, 0.55, def.wid * 0.82), glassMat);
    cab.position.set(-def.len * 0.05, 1.12, 0);
    g.add(cab);
  }
  // Sport spoiler.
  if (def.style === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, def.wid * 0.9), darkMat);
    wing.position.set(-def.len / 2 + 0.1, 1.05, 0);
    g.add(wing);
  }
  // Taxi roof sign.
  if (def.style === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xaa8800, emissiveIntensity: 0.6 }));
    sign.position.set(0, 1.5, 0);
    g.add(sign);
  }

  // Wheels: steer pivot (front) > spin pivot > cylinder.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.25, 14);
  const wheelPos = [
    [def.len * 0.32, def.wid / 2, true], [def.len * 0.32, -def.wid / 2, true],
    [-def.len * 0.32, def.wid / 2, false], [-def.len * 0.32, -def.wid / 2, false],
  ];
  for (const [wx, wz, front] of wheelPos) {
    const steer = new THREE.Group();
    steer.position.set(wx, WHEEL_R, wz);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, darkMat);
    tyre.rotation.z = Math.PI / 2; // axle along X
    spin.add(tyre);
    steer.add(spin);
    g.add(steer);
    wheels.push({ steer, spin, front });
  }

  // Headlight lenses (emissive) at the front (+Z).
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xffedb0, emissiveIntensity: 1.6 });
  const lensGeo = new THREE.BoxGeometry(0.42, 0.16, 0.08);
  const lensL = new THREE.Mesh(lensGeo, lensMat);
  lensL.position.set(def.len / 2 + 0.01, 0.62, def.wid * 0.28);
  const lensR = new THREE.Mesh(lensGeo, lensMat);
  lensR.position.set(def.len / 2 + 0.01, 0.62, -def.wid * 0.28);
  g.add(lensL, lensR);
  // Taillights (red emissive) at the rear (-Z).
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xcc0000, emissiveIntensity: 1.2 });
  const tailGeo = new THREE.BoxGeometry(0.42, 0.14, 0.08);
  const tailL = new THREE.Mesh(tailGeo, tailMat);
  tailL.position.set(-def.len / 2 - 0.01, 0.62, def.wid * 0.28);
  const tailR = new THREE.Mesh(tailGeo, tailMat);
  tailR.position.set(-def.len / 2 - 0.01, 0.62, -def.wid * 0.28);
  g.add(tailL, tailR);

  // Headlight spotlight + visible beam cone (apex at the car, base forward).
  const spot = new THREE.SpotLight(0xffeebb, 55, 45, 0.45, 0.6, 1.2);
  spot.position.set(0, 0.65, def.len / 2);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, 14);
  g.add(spotTarget);
  spot.target = spotTarget;
  g.add(spot);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 16, 1, true), beamMat);
  beam.rotation.x = -Math.PI / 2; // apex toward the car, base forward (+Z)
  beam.position.set(0, 0.55, def.len / 2 + 5);
  g.add(beam);

  // Damage: smoke puffs from the hood + a dent plate.
  const smoke = [];
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0 });
  const smokeGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(smokeGeo, smokeMat.clone());
    puff.visible = false;
    g.add(puff);
    smoke.push({ mesh: puff, life: 0, phase: i / 6 });
  }
  const dent = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 })
  );
  dent.position.set(def.len * 0.28, 0.92, 0);
  dent.visible = false;
  g.add(dent);

  return { group: g, spot, beam, lensMat, smoke, dent, wheels };
}

// ---- vehicles factory ------------------------------------------------------
export function createVehicles(scene, opts) {
  const colliders = opts.colliders || [];

  const cars = CAR_DEFS.map((def) => {
    const parts = buildCarMesh(def);
    parts.group.position.set(def.x, 0, def.z);
    parts.group.rotation.y = def.heading;
    scene.add(parts.group);
    return {
      id: def.id, name: def.name, color: def.color, owned: def.owned,
      x: def.x, z: def.z, heading: def.heading, speed: 0,
      damage: 0, damageCooldown: 0, maxSpeed: def.maxSpeed,
      len: def.len, wid: def.wid, traffic: false,
      ...parts,
    };
  });

  const traffic = TRAFFIC_LOOPS.map((loop) => {
    const def = { len: 4.2, wid: 1.85, style: 'sedan', color: loop.color };
    const parts = buildCarMesh(def);
    const [sx, sz] = loop.pts[0];
    const [nx, nz] = loop.pts[1];
    const heading = Math.atan2(nx - sx, nz - sz);
    parts.group.position.set(sx, 0, sz);
    parts.group.rotation.y = heading;
    scene.add(parts.group);
    return {
      id: loop.id, name: 'Traffic', color: loop.color, owned: false,
      x: sx, z: sz, heading, speed: TRAFFIC_SPEED,
      damage: 0, damageCooldown: 0, maxSpeed: TRAFFIC_SPEED,
      len: def.len, wid: def.wid, traffic: true,
      loop: loop.pts, wp: 1,
      ...parts,
    };
  });

  const api = {
    cars,
    traffic,
    driving: null,

    nearest(x, z, maxDist = ENTER_DIST) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { best = car; bestD = d; }
      }
      return best;
    },

    enter(car) {
      api.driving = car;
      return car;
    },

    exit() {
      const car = api.driving;
      if (!car) return null;
      api.driving = null;
      // Step out on the car's left side.
      const sideX = Math.cos(car.heading);
      const sideZ = -Math.sin(car.heading);
      return { x: car.x + sideX * 2.2, z: car.z + sideZ * 2.2, heading: car.heading };
    },

    update(dt, keys) {
      // --- driven car ---
      const car = api.driving;
      if (car) {
        const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
        const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        car._steer = steer;
        if (throttle > 0) {
          car.speed += ACCEL * dt;
        } else if (throttle < 0) {
          if (car.speed > 0.5) car.speed -= BRAKE * dt;
          else car.speed -= ACCEL * 0.6 * dt;
        } else {
          car.speed = damp(car.speed, 0, 1.2, dt);
        }
        car.speed = clamp(car.speed, -MAX_REVERSE, car.maxSpeed);
        const speedFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
        const dir = car.speed >= 0 ? 1 : -1;
        car.heading += steer * TURN_RATE * speedFactor * dt * dir;
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        // Buildings stop the car and add damage on a hard hit.
        const [rx, rz] = resolveCollisions(car.x, car.z, 1.2, colliders);
        const pushed = Math.hypot(rx - car.x, rz - car.z);
        car.x = clamp(rx, -WORLD + 4, WORLD - 4);
        car.z = clamp(rz, -WORLD + 4, WORLD - 4);
        car.damageCooldown = Math.max(0, car.damageCooldown - dt);
        if (pushed > 0.08 && Math.abs(car.speed) > 3 && car.damageCooldown <= 0) {
          car.damage = clamp(car.damage + Math.abs(car.speed) * 0.015, 0, 1);
          car.damageCooldown = 0.5;
          car.speed *= 0.35;
        }
        syncCarMesh(car, dt);
      }
      // --- traffic (always moving) ---
      for (const t of traffic) {
        const [wx, wz] = t.loop[t.wp];
        const dx = wx - t.x;
        const dz = wz - t.z;
        if (Math.hypot(dx, dz) < 4) {
          t.wp = (t.wp + 1) % t.loop.length;
        } else {
          const targetHeading = Math.atan2(dx, dz);
          t.heading = dampAngle(t.heading, targetHeading, 2.5, dt);
        }
        // Slow down if the player's car is right ahead.
        let targetSpeed = TRAFFIC_SPEED;
        if (car && Math.hypot(t.x - car.x, t.z - car.z) < 7) targetSpeed = 0;
        t.speed = damp(t.speed, targetSpeed, 2, dt);
        t.x += Math.sin(t.heading) * t.speed * dt;
        t.z += Math.cos(t.heading) * t.speed * dt;
        syncCarMesh(t, dt);
      }
    },

    // Headlights on at dusk/night (17:00–06:00). The game starts at 18:42.
    updateLighting(clockMin) {
      const dusk = clockMin >= 17 * 60 || clockMin < 6 * 60;
      for (const c of [...cars, ...traffic]) {
        c.spot.visible = dusk;
        c.beam.visible = dusk;
        c.lensMat.emissiveIntensity = dusk ? 1.6 : 0.25;
      }
      return dusk;
    },

    serialize() {
      return {
        driving: api.driving ? api.driving.id : null,
        cars: cars.map((c) => ({ id: c.id, x: c.x, z: c.z, heading: c.heading, speed: c.speed, damage: c.damage })),
      };
    },

    restore(data) {
      if (!data || !Array.isArray(data.cars)) return false;
      for (const saved of data.cars) {
        const car = cars.find((c) => c.id === saved.id);
        if (!car) continue;
        car.x = saved.x;
        car.z = saved.z;
        car.heading = saved.heading;
        car.speed = saved.speed || 0;
        car.damage = clamp(saved.damage || 0, 0, 1);
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
        car.dent.visible = car.damage > 0.5;
      }
      api.driving = data.driving ? cars.find((c) => c.id === data.driving) || null : null;
      return true;
    },

    reset() {
      api.driving = null;
      for (const car of cars) {
        const def = CAR_DEFS.find((d) => d.id === car.id);
        car.x = def.x;
        car.z = def.z;
        car.heading = def.heading;
        car.speed = 0;
        car.damage = 0;
        car.damageCooldown = 0;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.heading;
        car.dent.visible = false;
      }
      for (const t of traffic) {
        const [sx, sz] = t.loop[0];
        const [nx, nz] = t.loop[1];
        t.x = sx;
        t.z = sz;
        t.heading = Math.atan2(nx - sx, nz - sz);
        t.speed = TRAFFIC_SPEED;
        t.wp = 1;
        t.group.position.set(t.x, 0, t.z);
        t.group.rotation.y = t.heading;
      }
    },
  };

  // Keep every mesh in sync with its state (position, heading, wheels,
  // damage smoke). Called from update() and restore().
  function syncCarMesh(car, dt) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    // Wheel spin + front steer.
    const steerAngle = car._steer || 0;
    for (const w of car.wheels) {
      w.spin.rotation.x += (car.speed * dt) / WHEEL_R;
      if (w.front) w.steer.rotation.y = steerAngle * 0.4;
    }
    // Damage smoke: puffs rise and fade while damage is high.
    const smoking = car.damage > 0.3;
    car.dent.visible = car.damage > 0.5;
    for (const puff of car.smoke) {
      if (!smoking) {
        puff.mesh.visible = false;
        continue;
      }
      puff.life += dt * 0.7;
      if (puff.life >= 1) puff.life = 0;
      const p = puff.life;
      puff.mesh.visible = true;
      puff.mesh.position.set(0.3 + Math.sin(puff.phase * 6.28) * 0.2, 1.0 + p * 1.6, car.len * 0.28);
      puff.mesh.material.opacity = 0.45 * (1 - p);
      const s = 0.6 + p * 1.4;
      puff.mesh.scale.set(s, s, s);
    }
    // Headlight flicker when heavily damaged.
    if (car.damage > 0.6) {
      car.spot.intensity = 55 * (0.7 + 0.3 * Math.sin(performance.now() * 0.03));
    } else {
      car.spot.intensity = 55;
    }
  }

  return api;
}
