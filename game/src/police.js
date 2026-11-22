// VICE BAY — Stage 3: wanted level, police pursuit, helicopter.
// Written fresh for the rebuild. Police cars REALLY chase the player
// (spawn on roads, steer at the player, ram on contact); the helicopter
// follows at 3+ stars with a spotlight that tracks the player. No line is
// copied from any earlier build.
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, resolveCollisions } from './util.js';
import { HALF } from './city.js';

const POLICE_TOP = 32; // police cars are slightly faster than most traffic
const POLICE_COUNT = [0, 1, 2, 3, 4, 4]; // by stars 0..5
const UNIT_IDS = ['VBPD-07', 'VBPD-12', 'VBPD-23', 'VBPD-31'];
const HELI_ALT = 32; // helicopter cruise altitude (above market/beach roofs)
const COOLDOWNS = { assault: 3, pistol: 5, speed: 10 };

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.4,
    metalness: opts.metalness ?? 0.5,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Black-and-white VBPD cruiser with a flashing light bar. */
function buildPoliceCarMesh() {
  const g = new THREE.Group();
  const white = std(0xf2f2f2, { roughness: 0.3, metalness: 0.6 });
  const black = std(0x14141a, { roughness: 0.5, metalness: 0.4 });
  const glass = std(0x16202e, { roughness: 0.15, metalness: 0.7 });
  // Body (white) + black hood/trunk panels + black bumpers.
  g.add(box(2.0, 0.62, 4.4, white, 0, 0.62, 0));
  g.add(box(1.9, 0.1, 1.1, black, 0, 0.95, 1.55));
  g.add(box(1.9, 0.1, 1.0, black, 0, 0.95, -1.6));
  g.add(box(2.02, 0.22, 0.35, black, 0, 0.42, 2.2));
  g.add(box(2.02, 0.22, 0.35, black, 0, 0.42, -2.2));
  // Cabin + glass.
  g.add(box(1.7, 0.55, 2.2, white, 0, 1.2, -0.2));
  g.add(box(1.72, 0.4, 2.0, glass, 0, 1.18, -0.2));
  // Grille + headlights / taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xd41e1e, emissiveIntensity: 1.2 });
  g.add(box(0.5, 0.18, 0.06, headMat, -0.6, 0.62, 2.22));
  g.add(box(0.5, 0.18, 0.06, headMat, 0.6, 0.62, 2.22));
  g.add(box(0.5, 0.16, 0.06, tailMat, -0.6, 0.62, -2.22));
  g.add(box(0.5, 0.16, 0.06, tailMat, 0.6, 0.62, -2.22));
  // Light bar: red (left) + blue (right), flashing by emissive.
  const redMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 0.2 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0033ff, emissiveIntensity: 0.2 });
  const barBase = box(1.5, 0.12, 0.5, black, 0, 1.55, -0.2);
  g.add(barBase);
  const red = box(0.62, 0.2, 0.42, redMat, -0.38, 1.62, -0.2);
  const blue = box(0.62, 0.2, 0.42, blueMat, 0.38, 1.62, -0.2);
  g.add(red);
  g.add(blue);
  // Glow sprite above the roof (flashes with the bar).
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, opacity: 0, depthWrite: false,
  }));
  glow.position.set(0, 2.4, -0.2);
  glow.scale.set(4, 4, 1);
  g.add(glow);
  // Wheels (pivot so they can spin).
  const wheels = [];
  const tyreMat = std(0x111111, { roughness: 0.9, metalness: 0.1 });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.38, wz);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    pivot.add(tyre);
    g.add(pivot);
    wheels.push(pivot);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: g, redMat, blueMat, glow, wheels };
}

/** VBPD helicopter: body, tail, spinning rotors, searchlight. */
function buildHelicopterMesh() {
  const g = new THREE.Group();
  const white = std(0xf2f2f2, { roughness: 0.35, metalness: 0.5 });
  const navy = std(0x1a2a4a, { roughness: 0.4, metalness: 0.5 });
  const glass = std(0x16202e, { roughness: 0.15, metalness: 0.7 });
  // Body + nose glass + navy stripe.
  g.add(box(2.4, 1.8, 4.6, white, 0, 0, 0));
  g.add(box(2.0, 0.9, 1.2, glass, 0, 0.1, 2.2));
  g.add(box(2.44, 0.35, 4.0, navy, 0, -0.4, 0));
  // Tail boom + fin.
  g.add(box(0.7, 0.7, 5.0, white, 0, 0.3, -4.4));
  g.add(box(0.25, 1.6, 1.0, navy, 0, 0.8, -6.6));
  // Skids.
  for (const sx of [-1, 1]) {
    g.add(box(0.18, 0.18, 4.2, navy, sx * 1.1, -1.25, 0));
    g.add(box(0.18, 0.5, 0.18, navy, sx * 1.1, -1.0, 1.2));
    g.add(box(0.18, 0.5, 0.18, navy, sx * 1.1, -1.0, -1.2));
  }
  // Searchlight housing under the nose.
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.5, 12),
    std(0x222222, { roughness: 0.5, metalness: 0.6 })
  );
  housing.position.set(0, -1.1, 1.6);
  g.add(housing);
  // Main rotor (blur disc + 2 blades) + tail rotor.
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.35, 0);
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.25, roughness: 0.4 })
  );
  rotor.add(disc);
  for (const a of [0, Math.PI / 2]) {
    const blade = box(9.0, 0.08, 0.5, std(0x222222, { roughness: 0.5, metalness: 0.5 }), 0, 0, 0);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.5, 0.4, -6.6);
  for (const a of [0, Math.PI / 2]) {
    const blade = box(0.12, 1.8, 0.3, std(0x222222, { roughness: 0.5, metalness: 0.5 }), 0, 0, 0);
    blade.rotation.z = a;
    tailRotor.add(blade);
  }
  g.add(tailRotor);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: g, rotor, tailRotor };
}

export function createPolice(scene, city, vehicles, player, damage) {
  let heat = 0;
  let unseenTime = 0; // seconds since any police car was within 45 m
  let flashPhase = 0;
  let shake = 0;
  const lastAdd = {};
  const cars = [];
  let heli = null;
  let heliActive = false;
  let standingDownUntil = 0;

  // --- spotlight rig (built once, reused) ---
  const spot = new THREE.SpotLight(0xfff2b0, 600, 160, 0.45, 0.5, 1.1);
  spot.visible = false;
  scene.add(spot);
  scene.add(spot.target);
  const coneGeo = new THREE.ConeGeometry(5.5, 1, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.visible = false;
  scene.add(cone);
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,242,176,0.85)');
    grad.addColorStop(0.6, 'rgba(255,242,176,0.3)');
    grad.addColorStop(1, 'rgba(255,242,176,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.15;
  pool.visible = false;
  scene.add(pool);

  const upVec = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();

  function getStars() {
    return Math.min(5, Math.floor(heat / 20));
  }

  function pickSpawn() {
    // A point on a real road, 60–90 m from the player (retry a few times).
    const roads = city.roads;
    for (let tries = 0; tries < 8; tries++) {
      const road = roads[Math.floor(Math.random() * roads.length)];
      const along = -HALF + 20 + Math.random() * (HALF * 2 - 40);
      const vertical = Math.random() < 0.5;
      const x = vertical ? road : along;
      const z = vertical ? along : road;
      const d = Math.hypot(x - player.x, z - player.z);
      if (d >= 60 && d <= 95) return { x, z };
    }
    const a = Math.random() * Math.PI * 2;
    return { x: player.x + Math.sin(a) * 70, z: player.z + Math.cos(a) * 70 };
  }

  function spawnCar() {
    const mesh = buildPoliceCarMesh();
    const spot0 = pickSpawn();
    const car = {
      id: UNIT_IDS[cars.length % UNIT_IDS.length],
      x: spot0.x,
      z: spot0.z,
      heading: Math.atan2(player.x - spot0.x, player.z - spot0.z),
      speed: 0,
      top: POLICE_TOP,
      condition: 100,
      reverseTimer: 0,
      standingDown: false,
      standDownTimer: 0,
      ...mesh,
    };
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    scene.add(car.group);
    cars.push(car);
    return car;
  }

  function spawnHeli() {
    const mesh = buildHelicopterMesh();
    const h = {
      x: player.x,
      z: player.z - 30,
      y: HELI_ALT,
      sway: Math.random() * Math.PI * 2,
      ...mesh,
    };
    h.group.position.set(h.x, h.y, h.z);
    scene.add(h.group);
    heli = h;
    heliActive = true;
    spot.visible = true;
    cone.visible = true;
    pool.visible = true;
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli.group);
    heli = null;
    heliActive = false;
    spot.visible = false;
    cone.visible = false;
    pool.visible = false;
  }

  function addHeat(n, reason) {
    const now = performance.now() / 1000;
    if (reason && COOLDOWNS[reason]) {
      if (now - (lastAdd[reason] || -99) < COOLDOWNS[reason]) return false;
      lastAdd[reason] = now;
    }
    heat = clamp(heat + n, 0, 100);
    return true;
  }

  function setWanted(n) {
    heat = clamp(n, 0, 5) * 20;
    if (n <= 0) {
      for (const c of cars) c.standingDown = true;
    }
  }

  /**
   * Stage a chase for the `?shot=chase` screenshot: wanted 4, two lead
   * police cars in open lanes ahead of the player (right then left), a
   * third closing from behind, the helicopter above-ahead. The player is
   * expected to be driving south (heading 0, +z) on the central road.
   */
  function stageChase() {
    heat = 80;
    // Clear any existing units, then place the staged ones.
    for (const c of cars) scene.remove(c.group);
    cars.length = 0;
    const ahead = [
      { x: 10, z: player.z + 34, heading: 0 },
      { x: -2, z: player.z + 52, heading: 0 },
      { x: 6, z: player.z - 28, heading: 0 },
    ];
    for (const s of ahead) {
      const car = spawnCar();
      car.x = s.x;
      car.z = s.z;
      car.heading = s.heading;
      car.speed = 18;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
    if (!heliActive) spawnHeli();
    if (heli) {
      heli.x = player.x;
      heli.z = player.z + 42;
      heli.y = HELI_ALT;
      heli.group.position.set(heli.x, heli.y, heli.z);
    }
  }

  /** Damage a police car (pistol hits / rams). Returns new condition. */
  function damagePoliceCar(car, amount) {
    if (!car) return 0;
    car.condition = clamp((car.condition ?? 100) - amount, 0, 100);
    return car.condition;
  }

  function getUnits() {
    const units = cars.map((c) => ({
      id: c.id,
      role: c.standingDown ? 'STAND DOWN' : 'PURSUIT',
      dist: Math.round(Math.hypot(c.x - player.x, c.z - player.z)),
    }));
    if (heliActive) {
      units.push({
        id: 'AIR 1',
        role: 'HELICOPTER',
        dist: Math.round(Math.hypot(heli.x - player.x, heli.z - player.z)),
      });
    }
    return units;
  }

  function update(dt) {
    const d = clamp(dt, 0, 0.05);
    const stars = getStars();
    flashPhase += d;
    shake = Math.max(0, shake - d * 2.2);

    // --- wanted decay: heat falls only after 8 s with no police near. ---
    let nearest = Infinity;
    for (const c of cars) {
      nearest = Math.min(nearest, Math.hypot(c.x - player.x, c.z - player.z));
    }
    if (cars.length === 0) {
      unseenTime = 0;
    } else if (nearest > 45) {
      unseenTime += d;
    } else {
      unseenTime = 0;
    }
    if (unseenTime > 8 && heat > 0) {
      heat = Math.max(0, heat - 1.5 * d);
    }

    // --- spawn / stand down police cars to match the wanted level. ---
    const target = POLICE_COUNT[getStars()];
    while (cars.length < target) spawnCar();
    if (getStars() === 0) {
      for (const c of cars) c.standingDown = true;
    }
    // Remove stood-down cars once far away or after a while.
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.standingDown) {
        c.standDownTimer += d;
        const dist = Math.hypot(c.x - player.x, c.z - player.z);
        if (dist > 130 || c.standDownTimer > 9) {
          scene.remove(c.group);
          cars.splice(i, 1);
        }
      }
    }

    // --- helicopter at 3+ stars. ---
    if (getStars() >= 3 && !heliActive) spawnHeli();
    if (getStars() < 3 && heliActive) removeHeli();

    // --- speeding near a police car is a crime. ---
    if (vehicles.driving && vehicles.car) {
      const spd = Math.abs(vehicles.car.speed);
      if (spd > 25 && nearest < 30) addHeat(20, 'speed');
    }

    // --- police pursuit + rams. ---
    const playerCar = vehicles.driving ? vehicles.car : null;
    for (const c of cars) {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const dist = Math.hypot(dx, dz);
      if (c.standingDown) {
        // Drive away from the player, then despawn (handled above).
        const away = Math.atan2(-dx, -dz);
        c.heading += clamp(angleDelta(c.heading, away), -1.2 * d, 1.2 * d);
        c.speed = lerp(c.speed, 12, damp(1.5, d));
      } else if (c.reverseTimer > 0) {
        c.reverseTimer -= d;
        c.speed = lerp(c.speed, -5, damp(4, d));
      } else {
        // Pursuit: steer at the player, chase slightly faster than them.
        const desired = Math.atan2(dx, dz);
        const turnRate = 2.0;
        c.heading += clamp(angleDelta(c.heading, desired), -turnRate * d, turnRate * d);
        const targetSpeed = playerCar
          ? Math.min(POLICE_TOP, Math.abs(playerCar.speed) + 5)
          : Math.min(14, 6 + dist * 0.12);
        // A damaged cruiser is slower.
        const effTop = POLICE_TOP * (0.55 + 0.45 * (c.condition / 100));
        c.speed = lerp(c.speed, Math.min(targetSpeed, effTop), damp(1.6, d));
      }
      c.x += Math.sin(c.heading) * c.speed * d;
      c.z += Math.cos(c.heading) * c.speed * d;
      const resolved = resolveCollisions(c.x, c.z, 1.1, city.colliders);
      if (resolved.x !== c.x || resolved.z !== c.z) {
        c.x = resolved.x;
        c.z = resolved.z;
        c.speed *= 0.7;
      }
      c.x = clamp(c.x, -HALF + 4, HALF - 4);
      c.z = clamp(c.z, -HALF + 4, HALF - 4);
      // Ram the player's car.
      if (playerCar && dist < 3.4 && !c.standingDown && c.reverseTimer <= 0) {
        damage.damageCar(playerCar, 1.5);
        playerCar.speed *= 0.6;
        shake = 1;
        c.speed *= 0.4;
        c.reverseTimer = 0.6;
      }
      // Ram the player on foot.
      if (!playerCar && dist < 2.3 && !c.standingDown && c.reverseTimer <= 0) {
        player.health = Math.max(0, (player.health ?? 100) - 12);
        // Push the player away from the car (dx/dz point car -> player).
        const push = 3;
        const len = Math.max(0.001, dist);
        player.x += (dx / len) * push;
        player.z += (dz / len) * push;
        // The car backs off so it does not pin the player.
        c.reverseTimer = 0.8;
        shake = 1;
      }
      // Mesh + wheels + flashing light bar.
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading;
      for (const w of c.wheels) w.rotation.x += (c.speed * d) / 0.38;
      const on = Math.floor(flashPhase * 4) % 2 === 0;
      c.redMat.emissiveIntensity = on ? 2.4 : 0.15;
      c.blueMat.emissiveIntensity = on ? 0.15 : 2.4;
      c.glow.material.opacity = on ? 0.55 : 0.25;
      c.glow.material.color.setHex(on ? 0xff3333 : 0x3366ff);
    }

    // --- helicopter follow + spotlight. ---
    if (heliActive && heli) {
      heli.sway += d * 0.5;
      const aheadX = player.x + Math.sin(player.yaw) * 18;
      const aheadZ = player.z + Math.cos(player.yaw) * 18;
      heli.x = lerp(heli.x, aheadX + Math.sin(heli.sway) * 6, damp(1.2, d));
      heli.z = lerp(heli.z, aheadZ + Math.cos(heli.sway * 0.7) * 6, damp(1.2, d));
      heli.y = lerp(heli.y, HELI_ALT, damp(1.5, d));
      heli.group.position.set(heli.x, heli.y, heli.z);
      heli.group.rotation.y = Math.atan2(player.x - heli.x, player.z - heli.z);
      heli.group.rotation.z = Math.sin(heli.sway) * 0.08;
      heli.rotor.rotation.y += d * 22;
      heli.tailRotor.rotation.x += d * 30;
      // Spotlight: light + cone + ground pool all track the player.
      spot.position.set(heli.x, heli.y - 1, heli.z);
      spot.target.position.set(player.x, 0, player.z);
      tmpDir.set(player.x - heli.x, 0 - heli.y, player.z - heli.z);
      const distToPlayer = tmpDir.length();
      tmpDir.normalize();
      cone.position.set(
        heli.x + tmpDir.x * (distToPlayer / 2),
        heli.y + tmpDir.y * (distToPlayer / 2),
        heli.z + tmpDir.z * (distToPlayer / 2)
      );
      cone.quaternion.setFromUnitVectors(upVec, tmpDir.clone().negate());
      cone.scale.set(1, distToPlayer, 1);
      coneMat.opacity = 0.14 + Math.sin(flashPhase * 3) * 0.03;
      pool.position.set(player.x, 0.15, player.z);
    }

    // Keep the HUD wanted level in sync.
    player.wanted = getStars();
  }

  function reset() {
    heat = 0;
    unseenTime = 0;
    shake = 0;
    for (const c of cars) scene.remove(c.group);
    cars.length = 0;
    removeHeli();
    player.wanted = 0;
  }

  return {
    update,
    addHeat,
    setWanted,
    stageChase,
    damagePoliceCar,
    getUnits,
    reset,
    get heat() {
      return heat;
    },
    get stars() {
      return getStars();
    },
    get cars() {
      return cars;
    },
    get heliActive() {
      return heliActive;
    },
    get helicopter() {
      return heli;
    },
    get shake() {
      return shake;
    },
    getState() {
      return {
        heat: Math.round(heat),
        stars: getStars(),
        policeCount: cars.length,
        heliActive,
        units: getUnits(),
      };
    },
  };
}
