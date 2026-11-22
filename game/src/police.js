// VICE BAY 3D — police: wanted level (0–5 stars), police cars (pursuit +
// ram), and a police helicopter with a tracking spotlight. All geometry is
// procedural; no external assets. Written fresh for Stage 3.
// Forward is local +Z; heading h means forward = (sin h, cos h).
import * as THREE from '../vendor/three/three.module.min.js';
import { makeCar } from './actors.js';
import { clamp, lerpAngle, dist2D, makeRng, angleDiff } from './util.js';
import { nearestRoad, resolveCollision } from './city.js';

const UNIT_NAMES = ['UNIT 12', 'UNIT 07', 'UNIT 23', 'UNIT 31'];
const HEAT_PER_STAR = 20;
const DECAY_HEAT_PER_S = 1.5; // while unseen: 1 star fades in ~13 s
const DECAY_UNSEEN_DIST = 45; // no police within this range = unseen
const DECAY_GRACE_S = 8; // no decay right after a crime

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// Black hood + grille + bumpers + glass on top of a makeCar('police') so the
// car reads as a black-and-white VBPD interceptor, not a plain white sedan.
function detailPoliceCar(car) {
  const g = car.group;
  const { L, W, spec } = car;
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.5, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.25, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.12, metalness: 0.55 });
  function bx(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
  }
  // Black hood panel (front) + black trunk panel (rear).
  bx(W * 0.86, 0.05, L * 0.26, dark, 0, 0.35 + spec.bodyH + 0.02, L * 0.34);
  bx(W * 0.86, 0.05, L * 0.26, dark, 0, 0.35 + spec.bodyH + 0.02, -L * 0.34);
  // Grille + bumpers.
  bx(W * 0.52, 0.2, 0.07, dark, 0, 0.58, L / 2 + 0.02);
  bx(W * 0.96, 0.16, 0.12, chrome, 0, 0.36, L / 2 + 0.05);
  bx(W * 0.96, 0.16, 0.12, chrome, 0, 0.36, -L / 2 - 0.05);
  // Windshield + side glass.
  const cabY = 0.35 + spec.bodyH + spec.cabH / 2 - 0.05;
  bx(W * 0.72, spec.cabH * 0.82, 0.04, glass, 0, cabY, -L * 0.04 + L * 0.24 - 0.02);
  for (const sx of [-1, 1]) {
    bx(0.04, spec.cabH * 0.62, L * 0.36, glass, sx * W * 0.42, cabY, -L * 0.04);
  }
}

export function createPolice(scene, city, vehicles) {
  const rng = makeRng(777);
  const glowTex = makeGlowTexture();
  let wanted = 0, heat = 0, time = 0, lastCrimeAt = -100;
  let lastSpeedingAt = -100, lastAssaultAt = -100, lastShootAt = -100;
  const cars = []; // {group, wheels, pivots, lightBar, glow, x, z, heading, speed, steer, state, leaveT, hitCd, reverseT, name}
  let heli = null; // {group, rotor, tailRotor, spot, cone, pool, x, y, z, phase}
  let heliLeaving = 0;
  let unitIdx = 0;

  function addWanted(n) {
    if (n <= 0) return;
    heat = Math.min(100, heat + n * HEAT_PER_STAR);
    wanted = heat <= 0 ? 0 : Math.min(5, Math.ceil(heat / HEAT_PER_STAR));
    lastCrimeAt = time;
  }
  function setWanted(n) {
    wanted = clamp(n, 0, 5);
    heat = wanted * HEAT_PER_STAR;
    lastCrimeAt = time;
  }
  function desiredCount() {
    return wanted === 0 ? 0 : (wanted >= 3 ? 3 : 2);
  }
  function maxBuildingHeight(x, z) {
    let h = 0;
    for (const b of city.buildings) {
      if (Math.abs(b.x - x) < b.w / 2 + 15 && Math.abs(b.z - z) < b.d / 2 + 15) {
        if (b.h > h) h = b.h;
      }
    }
    return h;
  }

  // --- Police car ---
  function spawnPoliceCar(x, z, heading) {
    const built = makeCar('police', 0xe8e8e8);
    detailPoliceCar(built);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading;
    scene.add(built.group);
    // Flashing glow above the light bar (alternates red/blue).
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff2020, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.85,
    }));
    glow.scale.set(5, 5, 1);
    glow.position.set(0, 2.3, 0);
    built.group.add(glow);
    const car = {
      ...built,
      name: UNIT_NAMES[unitIdx++ % UNIT_NAMES.length],
      x, z, heading, speed: 0, steer: 0,
      isTraffic: false, isParked: false, isPolice: true, isPlayer: false,
      state: 'pursue', leaveT: 0, hitCd: 0, reverseT: 0, flashPhase: rng.next(),
    };
    cars.push(car);
    vehicles.list.push(car);
    return car;
  }
  function removePoliceCar(car) {
    scene.remove(car.group);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    const j = vehicles.list.indexOf(car);
    if (j >= 0) vehicles.list.splice(j, 1);
  }
  function spawnPointNear(player, dist) {
    const a = rng.next() * Math.PI * 2;
    let x = clamp(player.x + Math.sin(a) * dist, -220, 220);
    let z = clamp(player.z + Math.cos(a) * dist, -220, 200);
    const r = nearestRoad(x, z);
    if (r.axis === 'x') x = r.at; else z = r.at;
    return { x, z };
  }
  function syncPolice(player) {
    const want = desiredCount();
    while (cars.length < want) {
      const p = spawnPointNear(player, 70);
      const c = spawnPoliceCar(p.x, p.z, Math.atan2(player.x - p.x, player.z - p.z));
      c.speed = 12;
    }
    if (wanted === 0) {
      for (const c of cars) if (c.state === 'pursue') { c.state = 'leaving'; c.leaveT = 3; }
    }
  }

  // --- Helicopter ---
  function buildHelicopter() {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 });
    const navy = new THREE.MeshStandardMaterial({ color: 0x1e2a4a, roughness: 0.5, metalness: 0.2 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.12, metalness: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.6, metalness: 0.3 });
    function bx(w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    }
    // Body + nose + navy stripe + glass cockpit.
    bx(2.2, 1.6, 3.4, white, 0, 0, 0);
    bx(2.24, 0.5, 3.42, navy, 0, -0.2, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), white);
    nose.scale.set(1, 0.75, 1.1); nose.position.set(0, 0, 1.8); nose.castShadow = true; g.add(nose);
    bx(1.9, 0.9, 0.5, glass, 0, 0.25, 1.7);
    // Tail boom + fin + tail rotor.
    bx(0.5, 0.5, 4.6, white, 0, 0.25, -3.8);
    bx(0.18, 1.6, 1.0, navy, 0, 0.7, -5.9);
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.35, 0.5, -5.9);
    const tr1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.12), dark);
    const tr2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 2.2), dark);
    tailRotor.add(tr1, tr2);
    g.add(tailRotor);
    // Main rotor (two crossing blades) + a translucent blur disc.
    const rotor = new THREE.Group();
    rotor.position.y = 1.15;
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 11), dark);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.35), dark);
    rotor.add(b1, b2);
    g.add(rotor);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.18;
    g.add(disc);
    // Skids.
    for (const sx of [-1, 1]) {
      bx(0.12, 0.12, 3.2, dark, sx * 1.0, -1.05, 0.2);
      bx(0.1, 0.5, 0.1, dark, sx * 1.0, -0.8, 0.9);
      bx(0.1, 0.5, 0.1, dark, sx * 1.0, -0.8, -0.6);
    }
    // Searchlight housing under the nose.
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.5 })
    );
    lamp.position.set(0, -0.95, 1.2);
    g.add(lamp);
    // Spotlight (aimed at the player) + the visible cone + the ground pool.
    const spot = new THREE.SpotLight(0xfff2c0, 2.2, 220, 0.14, 0.5, 0);
    scene.add(spot);
    scene.add(spot.target);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    scene.add(cone);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.08;
    scene.add(pool);
    scene.add(g);
    return { group: g, rotor, tailRotor, spot, cone, pool, x: 0, y: 30, z: 0, phase: 0 };
  }
  function spawnHelicopter(player) {
    if (heli) return heli;
    heli = buildHelicopter();
    heli.x = player.x;
    heli.y = 30;
    heli.z = player.z + 50;
    heli.group.position.set(heli.x, heli.y, heli.z);
    heliLeaving = 0;
    return heli;
  }
  function removeHelicopter() {
    if (!heli) return;
    scene.remove(heli.group);
    scene.remove(heli.spot);
    scene.remove(heli.cone);
    scene.remove(heli.pool);
    heli = null;
  }

  // --- Per-frame update. Returns { rammed } for the camera shake hook. ---
  function update(dt, player, vehicles) {
    time += dt;
    const events = { rammed: false };
    const playerCar = vehicles.playerCar;
    const px = player.x, pz = player.z;
    const playerSpeed = Math.abs(player.speed);

    // Wanted decay: only when no police is near and no recent crime.
    if (wanted > 0 && time - lastCrimeAt > DECAY_GRACE_S) {
      let nearest = Infinity;
      for (const c of cars) nearest = Math.min(nearest, dist2D(px, pz, c.x, c.z));
      if (nearest > DECAY_UNSEEN_DIST || cars.length === 0) {
        heat = Math.max(0, heat - DECAY_HEAT_PER_S * dt);
        const w = heat <= 0 ? 0 : Math.min(5, Math.ceil(heat / HEAT_PER_STAR));
        if (w !== wanted) wanted = w;
      }
    }
    // Speeding right past a police car is a crime.
    if (playerCar && playerSpeed > 25) {
      for (const c of cars) {
        if (dist2D(px, pz, c.x, c.z) < 30 && time - lastSpeedingAt > 10) {
          lastSpeedingAt = time;
          addWanted(1);
          break;
        }
      }
    }

    syncPolice(player);

    // --- Police cars ---
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.flashPhase += dt * 4;
      // Siren light bar: red/blue alternate; the glow sprite follows.
      const redOn = (c.flashPhase % 1) < 0.5;
      if (c.lightBar && c.lightBar.userData) {
        c.lightBar.userData.red.material.emissiveIntensity = redOn ? 3.2 : 0.15;
        c.lightBar.userData.blue.material.emissiveIntensity = redOn ? 0.15 : 3.2;
      }
      if (c.glow) {
        c.glow.material.color.setHex(redOn ? 0xff2020 : 0x2040ff);
        c.glow.material.opacity = 0.55 + 0.35 * Math.sin(c.flashPhase * Math.PI * 2);
      }
      if (c.hitCd > 0) c.hitCd -= dt;
      if (c.reverseT > 0) c.reverseT -= dt;

      if (c.state === 'leaving') {
        c.leaveT -= dt;
        // Drive away from the player, then despawn.
        const away = Math.atan2(c.x - px, c.z - pz);
        c.heading = lerpAngle(c.heading, away, 1 - Math.exp(-2 * dt));
        c.speed = Math.min(c.speed + 12 * dt, 16);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        if (c.leaveT <= 0) { removePoliceCar(c); continue; }
      } else {
        // Pursuit: steer at the player, chase slightly faster than them.
        const desired = Math.atan2(px - c.x, pz - c.z);
        const diff = angleDiff(c.heading, desired);
        c.steer = clamp(diff * 0.6, -0.55, 0.55);
        c.heading = lerpAngle(c.heading, desired, 1 - Math.exp(-2.4 * dt));
        const targetSpeed = c.reverseT > 0 ? -6 : Math.min(playerSpeed + 5, 30);
        const accel = targetSpeed > c.speed ? 16 : 30;
        c.speed += clamp(targetSpeed - c.speed, -accel * dt, accel * dt);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
        const res = resolveCollision(city.colliders, c.x, c.z, 1.9);
        c.x = res.x; c.z = res.z;
        c.x = clamp(c.x, -235, 235); c.z = clamp(c.z, -235, 206);
        // Ram the player car: bleed its speed, damage it, shake the camera.
        const d = dist2D(c.x, c.z, px, pz);
        if (playerCar && d < 4.2) {
          playerCar.speed *= 0.6;
          c.speed *= 0.7;
          if (vehicles.damagePlayerCar) vehicles.damagePlayerCar(1);
          events.rammed = true;
        } else if (!playerCar && d < 2.5 && c.hitCd <= 0) {
          // Run the on-foot player down: damage + knockback.
          c.hitCd = 1.5;
          c.reverseT = 0.8;
          player.health = Math.max(0, player.health - 12);
          const ux = (px - c.x) / (d || 1), uz = (pz - c.z) / (d || 1);
          const pr = resolveCollision(city.colliders, px + ux * 3, pz + uz * 3, 0.55);
          player.x = clamp(pr.x, -235, 235);
          player.z = clamp(pr.z, -235, 206);
          events.rammed = true;
        }
      }
      // Car-car push-apart (police vs every other vehicle).
      for (const o of vehicles.list) {
        if (o === c) continue;
        const d = dist2D(c.x, c.z, o.x, o.z);
        if (d < 3.4 && d > 0.01) {
          const push = 3.4 - d;
          c.x += ((c.x - o.x) / d) * push;
          c.z += ((c.z - o.z) / d) * push;
        }
      }
      // Wheels: spin + front steer.
      const spin = (c.speed * dt) / 0.36;
      for (const p of c.pivots) p.pivot.rotation.y = p.front ? -c.steer * 0.85 : 0;
      for (const w of c.wheels) w.rotation.x += spin;
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
    }

    // --- Helicopter (wanted >= 3) ---
    if (wanted >= 3) {
      if (!heli) spawnHelicopter(player);
      heliLeaving = 0;
      const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
      // Follow ahead of the player (so the chase-cam sees it) and above the
      // local rooftops; sway gently so it reads as alive.
      const sway = Math.sin(time * 0.3) * 12;
      const tx = px + fx * 80 + (-fz) * sway;
      const tz = pz + fz * 80 + fx * sway;
      const ty = Math.max(26, maxBuildingHeight(tx, tz) + 10);
      heli.x += (tx - heli.x) * (1 - Math.exp(-1.2 * dt));
      heli.z += (tz - heli.z) * (1 - Math.exp(-1.2 * dt));
      heli.y += (ty - heli.y) * (1 - Math.exp(-1.0 * dt));
      heli.y += Math.sin(time * 0.9) * 0.15 * dt * 10;
      heli.phase += dt;
      heli.group.position.set(heli.x, heli.y, heli.z);
      heli.group.rotation.y = Math.atan2(px - heli.x, pz - heli.z);
      heli.rotor.rotation.y += 25 * dt;
      heli.tailRotor.rotation.x += 30 * dt;
      // Spotlight: from the heli down to the player (cone + pool + light).
      heli.spot.position.set(heli.x, heli.y - 1, heli.z);
      heli.spot.target.position.set(px, 0, pz);
      heli.spot.target.updateMatrixWorld();
      const dx = px - heli.x, dy = 0 - heli.y, dz = pz - heli.z;
      const dist = Math.hypot(dx, dy, dz);
      const midX = (heli.x + px) / 2, midY = heli.y / 2, midZ = (heli.z + pz) / 2;
      heli.cone.position.set(midX, midY, midZ);
      heli.cone.scale.set(6, dist, 6);
      heli.cone.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-dx / dist, -dy / dist, -dz / dist).normalize()
      );
      heli.pool.position.set(px, 0.08, pz);
    } else if (heli) {
      // Wanted fell: climb away and despawn.
      heliLeaving += dt;
      heli.y += 12 * dt;
      heli.z -= 10 * dt;
      heli.group.position.set(heli.x, heli.y, heli.z);
      heli.rotor.rotation.y += 25 * dt;
      heli.tailRotor.rotation.x += 30 * dt;
      if (heliLeaving > 4) removeHelicopter();
    }
    return events;
  }

  // --- Dispatch board data: named units + roles + live distances ---
  function units(player) {
    const out = [];
    for (const c of cars) {
      out.push({ name: c.name, role: c.state === 'leaving' ? 'STAND DOWN' : 'PURSUIT', dist: Math.round(dist2D(player.x, player.z, c.x, c.z)) });
    }
    if (heli) {
      out.push({ name: 'AIR 1', role: 'HELICOPTER', dist: Math.round(dist2D(player.x, player.z, heli.x, heli.z)) });
    }
    return out;
  }

  function placeCarAt(i, x, z, heading, speed) {
    while (cars.length <= i) {
      const p = { x: 0, z: 0 };
      spawnPoliceCar(p.x, p.z, 0);
    }
    const c = cars[i];
    c.x = x; c.z = z; c.heading = heading; c.speed = speed || 0;
    c.state = 'pursue';
    c.group.position.set(x, 0, z);
    c.group.rotation.y = heading;
    return c;
  }
  function placeHeliAt(x, y, z) {
    if (!heli) spawnHelicopter({ x: 0, z: 0, heading: 0 });
    heli.x = x; heli.y = y; heli.z = z;
    heli.group.position.set(x, y, z);
    return heli;
  }
  // Stage the chase: wanted 4, three police cars, the helicopter above-ahead.
  // The two lead police cars sit in open lanes ahead (right, then left) so
  // the chase-cam sees them clearly; the third closes in from behind.
  function stageChase() {
    setWanted(4);
    placeCarAt(0, -3, 82, 0, 24);
    placeCarAt(1, 5, 132, 0, 20);
    placeCarAt(2, -5, 148, 0, 18);
    placeHeliAt(0, 24, 158);
  }
  function reset() {
    for (let i = cars.length - 1; i >= 0; i--) removePoliceCar(cars[i]);
    removeHelicopter();
    wanted = 0; heat = 0; lastCrimeAt = -100;
  }

  return {
    get wanted() { return wanted; },
    get heat() { return heat; },
    get cars() { return cars; },
    get heli() { return heli; },
    addWanted,
    setWanted,
    update,
    units,
    reset,
    heliActive() { return !!heli; },
    placeCarAt,
    placeHeliAt,
    stageChase,
  };
}
