// police.js — VBPD pursuit cars, helicopter, wanted/heat (VICE BAY 3D, Stage 3).
// Written fresh in the rebuild recording. Procedural three.js meshes,
// deterministic spawns, no network. Heat 0-100 (20 per star); crimes add
// heat, it decays when no police is near. Police ram cars and the player
// on foot; the helicopter (wanted >= 3) tracks the player with a spotlight.

import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDelta, resolveCollisions, mulberry32, rand } from './util.js';

const WORLD = 240;
const ROADS = [-192, -128, -64, 0, 64, 128, 192];
const POLICE_MAX = 32;
const UNIT_NAMES = ['UNIT 12', 'UNIT 07', 'UNIT 23'];

// ---- police car mesh (VBPD black-and-white, light bar, glow) -------------
function buildPoliceCarMesh() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.3, roughness: 0.4 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14141a, metalness: 0.2, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.6, roughness: 0.2 });
  // Body: white, with a black hood + trunk.
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 1.9), white);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.7), black);
  hood.position.set(1.7, 0.92, 0);
  g.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 1.7), black);
  trunk.position.set(-1.8, 0.92, 0);
  g.add(trunk);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 1.6), glass);
  cab.position.set(-0.1, 1.12, 0);
  g.add(cab);
  // Grille + bumpers (black).
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 1.5), black);
  grille.position.set(2.22, 0.55, 0);
  g.add(grille);
  const bumpF = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 1.9), black);
  bumpF.position.set(2.2, 0.3, 0);
  g.add(bumpF);
  const bumpR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 1.9), black);
  bumpR.position.set(-2.2, 0.3, 0);
  g.add(bumpR);
  // Light bar: red (left) + blue (right) lenses on the roof.
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 1.5), black);
  barBase.position.set(0, 1.5, 0);
  g.add(barBase);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff0000, emissiveIntensity: 1 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000cc, emissive: 0x2244ff, emissiveIntensity: 1 });
  const redLens = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.65), redMat);
  redLens.position.set(0, 1.62, 0.4);
  g.add(redLens);
  const blueLens = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.65), blueMat);
  blueLens.position.set(0, 1.62, -0.4);
  g.add(blueLens);
  // Glow sprite above the roof (flashes with the bar).
  const glowMat = new THREE.SpriteMaterial({ color: 0xff3333, transparent: true, opacity: 0.5, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(3, 3, 1);
  glow.position.set(0, 2.6, 0);
  g.add(glow);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14);
  const wheels = [];
  for (const [wx, wz] of [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, black);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  // Headlights.
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xfff6cc, emissive: 0xffedb0, emissiveIntensity: 1.6 });
  for (const wz of [0.55, -0.55]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.4), lensMat);
    lens.position.set(2.22, 0.62, wz);
    g.add(lens);
  }
  return { group: g, redMat, blueMat, glowMat, wheels };
}

// ---- helicopter mesh (white/navy VBPD, rotors, searchlight) ---------------
function buildHelicopterMesh() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf0, metalness: 0.3, roughness: 0.4 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: 0.3, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, metalness: 0.6, roughness: 0.2 });
  // Body.
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.0), white);
  body.position.y = 0;
  body.castShadow = true;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 1.7), navy);
  belly.position.set(0, -0.9, 0);
  g.add(belly);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.8), glass);
  nose.position.set(2.4, 0.1, 0);
  g.add(nose);
  // Tail boom + fin.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 4.5, 8), white);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(-4.0, 0.3, 0);
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.2), navy);
  fin.position.set(-6.0, 0.8, 0);
  g.add(fin);
  // Main rotor (spins) + blur disc.
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.1, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 9.5), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), navy);
  mast.position.y = 0.85;
  g.add(mast);
  g.add(rotor);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.12;
  g.add(disc);
  // Tail rotor.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-6.0, 0.6, 0.3);
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.2), bladeMat);
    blade.rotation.z = a;
    tailRotor.add(blade);
  }
  g.add(tailRotor);
  // Skids.
  for (const wz of [0.9, -0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6), navy);
    skid.rotation.z = Math.PI / 2;
    skid.position.set(0, -1.5, wz);
    g.add(skid);
  }
  // Searchlight housing under the nose.
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.4, 10), navy);
  housing.position.set(1.8, -1.2, 0);
  g.add(housing);
  // Spotlight + visible cone + ground pool (added to the scene, not the group,
  // so the cone can stretch from the helicopter to the player).
  const spot = new THREE.SpotLight(0xfff2c0, 300, 120, 0.32, 0.5, 1.0);
  const spotTarget = new THREE.Object3D();
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(6, 1, 16, 1, true), coneMat);
  const poolMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5, 20), poolMat);
  pool.rotation.x = -Math.PI / 2;
  return { group: g, rotor, tailRotor, spot, spotTarget, cone, pool };
}

// ---- police factory --------------------------------------------------------
export function createPolice(scene, opts) {
  const colliders = opts.colliders || [];
  const buildings = opts.buildings || [];
  const vehicles = opts.vehicles;
  const rng = mulberry32(7);

  let heat = 0;
  let time = 0;
  let timeSinceSeen = 0;
  let lastCrime = {};
  let flash = 0;
  let shake = 0;
  let spawnIdx = 0;

  const cars = []; // {mesh, x, z, heading, speed, reverse, standDown, despawnT, unit}
  let heli = null; // {mesh, x, z, y, sway}

  function wanted() {
    // ceil, not floor: setWanted(3) sets heat=60 exactly, and ANY decay
    // below 60 must not instantly drop the level to 2 (floor(59.9/20)=2).
    // ceil keeps the level until heat falls to the next lower multiple of 20.
    return clamp(Math.ceil(heat / 20), 0, 5);
  }

  function addHeat(n, type = 'misc', cooldown = 0) {
    const now = time;
    if (cooldown > 0) {
      if (lastCrime[type] !== undefined && now - lastCrime[type] < cooldown) return false;
      lastCrime[type] = now;
    }
    heat = clamp(heat + n, 0, 100);
    return true;
  }

  function setWanted(n) {
    heat = clamp(n, 0, 5) * 20;
  }

  function spawnPoint(minD, maxD, px, pz) {
    // A point on a road 60-90 m from the player (deterministic cycle).
    for (let tries = 0; tries < 12; tries++) {
      const road = ROADS[Math.floor(rng() * ROADS.length)];
      const along = rand(rng, -200, 200);
      const onX = rng() < 0.5;
      const x = onX ? road : along;
      const z = onX ? along : road;
      const d = Math.hypot(x - px, z - pz);
      if (d >= minD && d <= maxD) return { x, z };
    }
    // Fallback: straight ahead on the central road.
    return { x: px, z: pz + 75 };
  }

  function spawnCar(px, pz) {
    const parts = buildPoliceCarMesh();
    const pt = spawnPoint(60, 90, px, pz);
    const heading = Math.atan2(px - pt.x, pz - pt.z);
    parts.group.position.set(pt.x, 0, pt.z);
    parts.group.rotation.y = heading;
    scene.add(parts.group);
    const car = {
      ...parts, x: pt.x, z: pt.z, heading, speed: 0,
      reverse: 0, standDown: false, despawnT: 0,
      unit: UNIT_NAMES[cars.length % UNIT_NAMES.length],
    };
    cars.push(car);
    return car;
  }

  function spawnHeli(px, pz) {
    const parts = buildHelicopterMesh();
    parts.group.position.set(px, 40, pz - 80);
    scene.add(parts.group);
    scene.add(parts.spotTarget);
    scene.add(parts.cone);
    scene.add(parts.pool);
    parts.spot.target = parts.spotTarget;
    scene.add(parts.spot);
    heli = { ...parts, x: px, z: pz - 80, y: 40, sway: rng() * 6.28 };
    return heli;
  }

  function removeCar(car) {
    scene.remove(car.group);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli.group);
    scene.remove(heli.spot);
    scene.remove(heli.spotTarget);
    scene.remove(heli.cone);
    scene.remove(heli.pool);
    heli = null;
  }

  function tallestNear(x, z, r) {
    let h = 0;
    for (const b of buildings) {
      if (Math.abs(b.x - x) < r && Math.abs(b.z - z) < r) h = Math.max(h, b.h || 0);
    }
    return h;
  }

  function update(dt, player) {
    time += dt;
    flash += dt;
    shake = Math.max(0, shake - dt * 2);
    const w = wanted();
    player.wanted = w;

    // --- heat decay: 1.5/s after 8 s with no police within 45 m ---
    let nearestPolice = 1e9;
    for (const c of cars) nearestPolice = Math.min(nearestPolice, Math.hypot(c.x - player.x, c.z - player.z));
    if (nearestPolice > 45) {
      timeSinceSeen += dt;
      if (timeSinceSeen > 8 && heat > 0) heat = Math.max(0, heat - 1.5 * dt);
    } else {
      timeSinceSeen = 0;
    }

    // --- speeding crime: >25 m/s within 30 m of a police car ---
    if (w > 0 && vehicles && vehicles.driving) {
      const car = vehicles.driving;
      if (Math.abs(car.speed) > 25 && nearestPolice < 30) addHeat(20, 'speed', 10);
    }

    // --- desired police count ---
    const want = w === 0 ? 0 : w <= 2 ? 2 : 3;
    while (cars.length < want) spawnCar(player.x, player.z);
    // Stand down when wanted clears; rejoin the pursuit when it rises again.
    // (A leftover STAND DOWN car from a cleared wanted level must not sit
    // idle — or drive AWAY — while the player is wanted again; the old code
    // left it standDown, so the nearest-car distance GREW and the
    // "closes in" check failed even though the other car was pursuing.)
    if (w === 0) {
      for (const c of cars) c.standDown = true;
    } else {
      for (const c of cars) c.standDown = false;
    }

    // --- police cars ---
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const dist = Math.hypot(dx, dz);
      // Flashing light bar (alternating red/blue).
      const on = Math.floor(flash * 6) % 2 === 0;
      c.redMat.emissiveIntensity = on ? 2.2 : 0.25;
      c.blueMat.emissiveIntensity = on ? 0.25 : 2.2;
      c.glowMat.color.setHex(on ? 0xff3333 : 0x3355ff);
      c.glowMat.opacity = 0.45 + 0.2 * Math.sin(flash * 12);

      if (c.standDown) {
        // Drive away from the player, then despawn.
        c.despawnT += dt;
        const away = Math.atan2(c.x - player.x, c.z - player.z);
        c.heading = dampAngle(c.heading, away, 2, dt);
        c.speed = damp(c.speed, 14, 1.5, dt);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        if (c.despawnT > 10 || dist > 140) { removeCar(c); continue; }
      } else {
        // Pursuit: steer at the player, slightly faster than them. Slow
        // down when close so the car does not overshoot the player and
        // end up FARTHER away (the old code kept full speed, overshot,
        // and the "closes in" distance grew instead of shrinking).
        const targetHeading = Math.atan2(dx, dz);
        c.heading = dampAngle(c.heading, targetHeading, 2.2, dt);
        const playerSpeed = Math.abs(player.speed || 0);
        const targetSpeed = dist < 6
          ? 4 // close in gently and stay in contact to ram
          : clamp(playerSpeed + 5, 12, POLICE_MAX);
        c.speed = damp(c.speed, targetSpeed, 1.2, dt);
        c.ramCooldown = Math.max(0, (c.ramCooldown || 0) - dt);
        if (c.reverse > 0) {
          c.reverse -= dt;
          c.x -= Math.sin(c.heading) * 6 * dt;
          c.z -= Math.cos(c.heading) * 6 * dt;
        } else {
          c.x += Math.sin(c.heading) * c.speed * dt;
          c.z += Math.cos(c.heading) * c.speed * dt;
        }
        // Resolve collisions at the NEW position (after moving). The old
        // code resolved at the pre-move position and then overwrote the
        // moved position with it, so the car never moved at all.
        const [rx, rz] = resolveCollisions(c.x, c.z, 1.2, colliders);
        const pushed = Math.hypot(rx - c.x, rz - c.z);
        if (pushed > 0.5 && c.reverse <= 0) c.reverse = 0.8;
        c.x = clamp(rx, -WORLD + 4, WORLD - 4);
        c.z = clamp(rz, -WORLD + 4, WORLD - 4);
        // Ram: on a car, bleed its speed + damage it; on foot, hurt + knockback.
        // No speed gate on the player's car: a stationary car must still take
        // damage when a police car hits it (the old `speed > 1` gate meant a
        // parked/stationary player car was never damaged, so the ram check
        // always read 0.00). Ram at most once per 0.5 s per unit.
        if (dist < 3.2 && c.ramCooldown <= 0) {
          if (vehicles && vehicles.driving) {
            const car = vehicles.driving;
            car.speed *= 0.6;
            car.damage = clamp(car.damage + 0.05, 0, 1);
            car.damageCooldown = 0.5;
            c.ramCooldown = 0.5;
            shake = 0.5;
          } else if (dist < 2.5) {
            player.health = Math.max(0, player.health - 12);
            const nx = dx / (dist || 1);
            const nz = dz / (dist || 1);
            player.x -= nx * 3;
            player.z -= nz * 3;
            c.reverse = 0.8;
            c.ramCooldown = 0.5;
            shake = 0.4;
          }
        }
      }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      for (const wh of c.wheels) wh.rotation.x += (c.speed * dt) / 0.36;
    }

    // --- helicopter ---
    if (w >= 3 && !heli) spawnHeli(player.x, player.z);
    if (heli) {
      if (w < 3) {
        // Climb away and despawn.
        heli.y = damp(heli.y, 90, 0.8, dt);
        heli.group.position.y = heli.y;
        if (heli.y > 85) removeHeli();
      } else {
        // Follow 80 m ahead of the player, above the rooftops, with a sway.
        heli.sway += dt;
        const aheadX = player.x + Math.sin(player.heading) * 80;
        const aheadZ = player.z + Math.cos(player.heading) * 80;
        const tx = aheadX + Math.sin(heli.sway * 0.7) * 6;
        const tz = aheadZ + Math.cos(heli.sway * 0.5) * 6;
        const roof = tallestNear(player.x, player.z, 60);
        const targetY = Math.max(26, roof + 10);
        heli.x = damp(heli.x, tx, 0.8, dt);
        heli.z = damp(heli.z, tz, 0.8, dt);
        heli.y = damp(heli.y, targetY, 0.8, dt);
        heli.group.position.set(heli.x, heli.y, heli.z);
        heli.group.rotation.y = dampAngle(heli.group.rotation.y, player.heading + Math.PI, 1, dt);
        heli.rotor.rotation.y += dt * 22;
        heli.tailRotor.rotation.x += dt * 30;
        // Spotlight tracks the player.
        heli.spot.position.set(heli.x, heli.y - 1.2, heli.z);
        heli.spotTarget.position.set(player.x, 0.5, player.z);
        // Cone from the helicopter down to the player.
        const dxp = player.x - heli.x;
        const dzp = player.z - heli.z;
        const len = Math.hypot(dxp, heli.y, dzp);
        heli.cone.scale.set(1, len / 10, 1);
        heli.cone.position.set((heli.x + player.x) / 2, heli.y / 2, (heli.z + player.z) / 2);
        heli.cone.lookAt(player.x, 0, player.z);
        heli.cone.rotateX(Math.PI / 2);
        heli.pool.position.set(player.x, 0.12, player.z);
        const pulse = 0.24 + 0.06 * Math.sin(time * 5);
        heli.pool.material.opacity = pulse;
        heli.cone.material.opacity = 0.09 + 0.02 * Math.sin(time * 5);
      }
    }
  }

  // Deterministic hero-chase staging: wanted 4, two lead police cars in open
  // lanes ahead, a third closing from behind, helicopter above-ahead.
  function stageChase(player) {
    setWanted(4);
    player.wanted = 4;
    // Clear any existing units, then place three at fixed offsets RELATIVE
    // to the player (so the staged chase puts them in frame): two lead
    // cars 25–30 m ahead in open lanes, one closing from 30 m behind.
    while (cars.length) removeCar(cars[0]);
    const spots = [
      { x: player.x + 4, z: player.z + 25, heading: 0 },
      { x: player.x - 4, z: player.z + 30, heading: 0 },
      { x: player.x, z: player.z - 30, heading: 0 },
    ];
    for (const s of spots) {
      const parts = buildPoliceCarMesh();
      parts.group.position.set(s.x, 0, s.z);
      parts.group.rotation.y = s.heading;
      scene.add(parts.group);
      cars.push({
        ...parts, x: s.x, z: s.z, heading: s.heading, speed: 22,
        reverse: 0, standDown: false, despawnT: 0,
        unit: UNIT_NAMES[cars.length % UNIT_NAMES.length],
      });
    }
    if (!heli) spawnHeli(player.x, player.z);
    heli.x = player.x;
    heli.z = player.z + 80;
    heli.y = 30;
    heli.group.position.set(heli.x, heli.y, heli.z);
  }

  function getDispatch(player) {
    if (wanted() === 0 && cars.length === 0) return 'STANDBY — No active units.';
    const lines = [];
    for (const c of cars) {
      const d = Math.round(Math.hypot(c.x - player.x, c.z - player.z));
      lines.push(`${c.unit} · ${c.standDown ? 'STAND DOWN' : 'PURSUIT'} · ${d} m`);
    }
    if (heli) {
      const d = Math.round(Math.hypot(heli.x - player.x, heli.z - player.z));
      lines.push(`AIR 1 · HELICOPTER · ${d} m`);
    }
    return lines.join('<br>');
  }

  function reset() {
    heat = 0;
    timeSinceSeen = 0;
    lastCrime = {};
    shake = 0;
    while (cars.length) removeCar(cars[0]);
    removeHeli();
  }

  return {
    update,
    addHeat,
    setWanted,
    get wanted() { return wanted(); },
    get heat() { return heat; },
    get heliActive() { return !!heli && wanted() >= 3; },
    get shake() { return shake; },
    get list() { return cars.map((c) => ({ unit: c.unit, x: c.x, z: c.z, heading: c.heading, speed: c.speed, standDown: c.standDown })); },
    get heliPos() { return heli ? { x: heli.x, z: heli.z, y: heli.y } : null; },
    stageChase,
    getDispatch,
    reset,
  };
}
