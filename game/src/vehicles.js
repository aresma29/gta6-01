// game/src/vehicles.js — VICE BAY vehicle system (Stage 2 rebuild, fresh).
// Five drivable cars, arcade driving physics, a cinematic chase-cam hook,
// and traffic cars on waypoint loops. Self-contained: this module owns the
// car meshes, the driving physics, the traffic AI and car collisions.
// It never touches the DOM, the player mesh or the camera — main3d.js owns
// those and calls into this module (createVehicleSystem returns the API).
//
// Conventions: heading h means forward = (sin h, 0, cos h) in world xz.
// A car's local forward is +Z (front bumper at +Z), so group.rotation.y = h.
// Right-hand traffic: the right side of a heading (dx, dz) is (-dz, dx).

export const CAR_DEFS = [
  { id: 'sunset-gt', name: 'SUNSET GT', type: 'SPORTS', color: 0xc81e2b, topSpeed: 34, accel: 15, brake: 24, grip: 1.0, length: 4.4, width: 1.9, spoiler: true },
  { id: 'coral-sedan', name: 'CORAL SEDAN', type: 'SEDAN', color: 0x2a9d8f, topSpeed: 27, accel: 11, brake: 19, grip: 0.9, length: 4.2, width: 1.85 },
  { id: 'harbour-truck', name: 'HARBOUR TRUCK', type: 'TRUCK', color: 0x5a6b7c, topSpeed: 23, accel: 8, brake: 17, grip: 0.8, length: 5.4, width: 2.1, truck: true },
  { id: 'palm-taxi', name: 'PALM TAXI', type: 'TAXI', color: 0xf4b400, topSpeed: 28, accel: 12, brake: 19, grip: 0.9, length: 4.2, width: 1.85, taxi: true },
  { id: 'beach-van', name: 'BEACH VAN', type: 'VAN', color: 0x7fb069, topSpeed: 25, accel: 9, brake: 18, grip: 0.85, length: 4.9, width: 2.0, van: true },
];

// Traffic loops: rectangles on the REAL road grid (roads at -192, -128, -64,
// 0, 64, 128, 192). Each loop is a list of corner waypoints, driven
// clockwise; the car keeps a right-lane offset of 2.2 m from the road centre.
const TRAFFIC_LOOPS = [
  { def: 'coral-sedan', waypoints: [[-128, -128], [128, -128], [128, -64], [-128, -64]] },
  { def: 'palm-taxi', waypoints: [[-64, 64], [64, 64], [64, 128], [-64, 128]] },
  { def: 'beach-van', waypoints: [[128, -192], [192, -192], [192, 64], [128, 64]] },
  { def: 'coral-sedan', waypoints: [[-192, -64], [-128, -64], [-128, 192], [-192, 192]] },
];

const WHEEL_RADIUS = 0.34;
const LANE_OFFSET = 2.2;

function mat(color, rough = 0.35, metal = 0.5) {
  return { color, roughness: rough, metalness: metal };
}

function box(THREE, w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// Build one procedural car mesh. Returns { group, steerFL, steerFR, spinFL,
// spinFR, spinRL, spinRR } — steer pivots turn the front wheels, spin groups
// rotate the wheels around their axles.
export function buildCarMesh(THREE, def) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial(mat(def.color, 0.32, 0.55));
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8, metalness: 0.2 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95, metalness: 0 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.35, metalness: 0.8 });

  const L = def.length;
  const W = def.width;

  if (def.truck) {
    // Cab + open bed.
    group.add(box(THREE, W, 0.9, 1.5, bodyMat, 0, 0.75, L / 2 - 0.85));
    group.add(box(THREE, W * 0.86, 0.75, 1.1, glassMat, 0, 1.5, L / 2 - 0.95));
    group.add(box(THREE, W, 0.65, L - 1.7, bodyMat, 0, 0.62, -L / 2 + (L - 1.7) / 2 + 0.1));
    // Bed walls.
    group.add(box(THREE, 0.08, 0.5, L - 1.7, bodyMat, -W / 2 + 0.04, 1.0, -L / 2 + (L - 1.7) / 2 + 0.1));
    group.add(box(THREE, 0.08, 0.5, L - 1.7, bodyMat, W / 2 - 0.04, 1.0, -L / 2 + (L - 1.7) / 2 + 0.1));
    group.add(box(THREE, W, 0.5, 0.08, bodyMat, 0, 1.0, -L / 2 + 0.1));
    // Cargo crates in the bed.
    group.add(box(THREE, 0.9, 0.6, 0.9, new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 0.9, metalness: 0 }), -0.4, 1.25, -1.2));
    group.add(box(THREE, 0.7, 0.5, 0.7, new THREE.MeshStandardMaterial({ color: 0x4a6b8a, roughness: 0.9, metalness: 0 }), 0.5, 1.2, -0.4));
  } else if (def.van) {
    // Tall single-box van with a long side window band.
    group.add(box(THREE, W, 1.15, L, bodyMat, 0, 0.85, 0));
    group.add(box(THREE, W * 0.92, 0.55, L * 0.72, glassMat, 0, 1.55, -0.1));
    group.add(box(THREE, W * 0.94, 0.1, L * 0.72, bodyMat, 0, 1.88, -0.1));
    group.add(box(THREE, W * 0.5, 0.28, 0.06, glassMat, 0, 1.45, L / 2 + 0.01));
  } else {
    // Sedan / sports / taxi: low body + cabin + glass.
    group.add(box(THREE, W, 0.55, L, bodyMat, 0, 0.55, 0));
    group.add(box(THREE, W * 0.82, 0.5, L * 0.46, bodyMat, 0, 1.02, -L * 0.08));
    group.add(box(THREE, W * 0.78, 0.42, L * 0.4, glassMat, 0, 1.04, -L * 0.08));
    // Hood scoop for the sports hero.
    if (def.spoiler) {
      group.add(box(THREE, W * 0.5, 0.08, 0.7, darkMat, 0, 0.86, L * 0.28));
      // Rear spoiler: blade + two supports.
      group.add(box(THREE, W * 0.92, 0.06, 0.32, darkMat, 0, 1.12, -L / 2 + 0.18));
      group.add(box(THREE, 0.08, 0.22, 0.08, darkMat, -W * 0.32, 1.0, -L / 2 + 0.18));
      group.add(box(THREE, 0.08, 0.22, 0.08, darkMat, W * 0.32, 1.0, -L / 2 + 0.18));
      // Side skirts.
      group.add(box(THREE, 0.1, 0.14, L * 0.7, darkMat, -W / 2 - 0.02, 0.32, 0));
      group.add(box(THREE, 0.1, 0.14, L * 0.7, darkMat, W / 2 + 0.02, 0.32, 0));
    }
  }

  // Grille, bumpers, lights, mirrors — shared by all types.
  group.add(box(THREE, W * 0.6, 0.16, 0.08, darkMat, 0, 0.55, L / 2 + 0.01));
  group.add(box(THREE, W, 0.16, 0.12, darkMat, 0, 0.32, L / 2 + 0.02));
  group.add(box(THREE, W, 0.16, 0.12, darkMat, 0, 0.32, -L / 2 - 0.02));
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb5, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0d0d, emissive: 0xc81e1e, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.1 });
  group.add(box(THREE, 0.34, 0.14, 0.06, headMat, -W * 0.32, 0.72, L / 2 + 0.02));
  group.add(box(THREE, 0.34, 0.14, 0.06, headMat, W * 0.32, 0.72, L / 2 + 0.02));
  group.add(box(THREE, 0.34, 0.12, 0.06, tailMat, -W * 0.32, 0.72, -L / 2 - 0.02));
  group.add(box(THREE, 0.34, 0.12, 0.06, tailMat, W * 0.32, 0.72, -L / 2 - 0.02));
  group.add(box(THREE, 0.1, 0.08, 0.22, bodyMat, -W / 2 - 0.05, 1.05, L * 0.22));
  group.add(box(THREE, 0.1, 0.08, 0.22, bodyMat, W / 2 + 0.05, 1.05, L * 0.22));
  if (def.taxi) {
    const signMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf4b400, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.1 });
    group.add(box(THREE, 0.7, 0.18, 0.3, signMat, 0, def.van ? 1.98 : 1.42, 0));
    group.add(box(THREE, W * 0.7, 0.06, L * 0.5, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.2 }), 0, 0.86, 0));
  }

  // Wheels: steer pivot -> spin group -> cylinder (axis along X).
  const wheels = {};
  const wheelZ = { f: L * 0.32, r: -L * 0.32 };
  const wheelX = W / 2 - 0.08;
  for (const [key, sx, sz] of [['FL', -wheelX, wheelZ.f], ['FR', wheelX, wheelZ.f], ['RL', -wheelX, wheelZ.r], ['RR', wheelX, wheelZ.r]]) {
    const steer = new THREE.Group();
    steer.position.set(sx, WHEEL_RADIUS, sz);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 14), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.28, 10), hubMat);
    hub.rotation.z = Math.PI / 2;
    spin.add(tyre);
    spin.add(hub);
    steer.add(spin);
    group.add(steer);
    wheels[key] = { steer, spin, angle: 0 };
  }

  return { group, wheels };
}

export function createVehicleSystem(THREE, scene, opts = {}) {
  const colliders = opts.colliders || []; // [{minX,maxX,minZ,maxZ}]
  const bounds = opts.bounds || 238;

  const parked = [];
  const traffic = [];
  let driving = false;
  let current = null;

  // One headlight, repositioned onto the driven car each frame.
  const headlight = new THREE.SpotLight(0xfff2cc, 0, 45, 0.55, 0.6, 1.4);
  headlight.castShadow = false;
  const headTarget = new THREE.Object3D();
  scene.add(headlight);
  scene.add(headTarget);
  headlight.target = headTarget;

  function makeCar(def, x, z, heading, isTraffic) {
    const { group, wheels } = buildCarMesh(THREE, def);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      def, group, wheels, heading,
      x, z, speed: 0, steer: 0,
      condition: 92 + Math.floor(Math.random() * 8), // 92-99%
      isTraffic: !!isTraffic,
      loop: null, loopIndex: 0, cruise: 9,
      spinAngle: 0,
    };
    return car;
  }

  function spawnParked(spawn) {
    // Anchor on the road the player starts beside: the hero GT on the east
    // side of the road (a clear lane south for the drive shot), the rest
    // parked on the west side so the hero's lane stays clear.
    const ax = spawn ? spawn.x : 0;
    const az = spawn ? spawn.z : 24;
    const spots = [
      ['sunset-gt', 6, 0], ['coral-sedan', -6, 13], ['palm-taxi', -6, -13],
      ['beach-van', -6, 26], ['harbour-truck', -6, -26],
    ];
    for (const [id, dx, dz] of spots) {
      const def = CAR_DEFS.find((d) => d.id === id);
      const car = makeCar(def, ax + dx, az + dz, 0, false);
      car.home = { x: ax + dx, z: az + dz, heading: 0 };
      car.homeCondition = car.condition;
      parked.push(car);
    }
    return parked;
  }

  function spawnTraffic() {
    for (const loop of TRAFFIC_LOOPS) {
      const def = CAR_DEFS.find((d) => d.id === loop.def);
      const [wx, wz] = loop.waypoints[0];
      const [nx, nz] = loop.waypoints[1];
      const heading = Math.atan2(nx - wx, nz - wz);
      const car = makeCar(def, wx, wz, heading, true);
      car.loop = loop.waypoints;
      car.loopIndex = 1;
      car.cruise = 8 + Math.random() * 3;
      car.home = { x: wx, z: wz, heading };
      car.homeCondition = car.condition;
      traffic.push(car);
    }
    return traffic;
  }

  function allCars() {
    return parked.concat(traffic);
  }

  function heroCar() {
    return parked.find((c) => c.def.id === 'sunset-gt') || parked[0] || null;
  }

  function nearestCar(x, z, maxDist = 4) {
    let best = null;
    let bestD = maxDist;
    for (const car of parked) {
      if (car === current) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enter(car) {
    if (!car) return false;
    driving = true;
    current = car;
    car.speed = Math.max(car.speed, 0);
    headlight.intensity = 120;
    return true;
  }

  function exit() {
    if (!current) return null;
    const car = current;
    driving = false;
    current = null;
    headlight.intensity = 0;
    // Step out on the car's right side (driver side), clear of the body.
    const rx = -Math.cos(car.heading);
    const rz = Math.sin(car.heading);
    return { x: car.x + rx * (car.def.width / 2 + 0.9), z: car.z + rz * (car.def.width / 2 + 0.9) };
  }

  function exitPosition(car) {
    const rx = -Math.cos(car.heading);
    const rz = Math.sin(car.heading);
    return { x: car.x + rx * (car.def.width / 2 + 0.9), z: car.z + rz * (car.def.width / 2 + 0.9) };
  }

  // Axis-aligned box of the car's rotated footprint (for player collision).
  function carAABB(car) {
    const c = Math.abs(Math.cos(car.heading));
    const s = Math.abs(Math.sin(car.heading));
    const hx = (car.def.length / 2) * s + (car.def.width / 2) * c + 0.3;
    const hz = (car.def.length / 2) * c + (car.def.width / 2) * s + 0.3;
    return { minX: car.x - hx, maxX: car.x + hx, minZ: car.z - hz, maxZ: car.z + hz };
  }

  function solidAABBs() {
    const out = [];
    for (const car of allCars()) {
      if (car === current) continue; // the driven car is not solid to its driver
      out.push(carAABB(car));
    }
    return out;
  }

  function collideBuildings(car) {
    // Check centre + front + rear points against every building AABB.
    const pts = [
      [car.x, car.z],
      [car.x + Math.sin(car.heading) * car.def.length * 0.42, car.z + Math.cos(car.heading) * car.def.length * 0.42],
      [car.x - Math.sin(car.heading) * car.def.length * 0.42, car.z - Math.cos(car.heading) * car.def.length * 0.42],
    ];
    const r = car.def.width / 2 + 0.25;
    let hit = false;
    for (const [px, pz] of pts) {
      for (const b of colliders) {
        if (px > b.minX - r && px < b.maxX + r && pz > b.minZ - r && pz < b.maxZ + r) {
          // Push out along the smallest penetration axis.
          const pushL = (px + r) - b.minX;
          const pushR = b.maxX - (px - r);
          const pushU = (pz + r) - b.minZ;
          const pushD = b.maxZ - (pz - r);
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) car.x += pushL;
          else if (m === pushR) car.x -= pushR;
          else if (m === pushU) car.z += pushU;
          else car.z -= pushD;
          hit = true;
        }
      }
    }
    if (hit) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.45;
      if (impact > 6 && car === current) {
        car.condition = Math.max(40, car.condition - 2);
      }
    }
    // World bounds.
    if (car.x < -bounds) { car.x = -bounds; car.speed *= 0.5; }
    if (car.x > bounds) { car.x = bounds; car.speed *= 0.5; }
    if (car.z < -bounds) { car.z = -bounds; car.speed *= 0.5; }
    if (car.z > bounds) { car.z = bounds; car.speed *= 0.5; }
    return hit;
  }

  function collideCars() {
    const cars = allCars();
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const minD = 3.1;
        if (d > 0.01 && d < minD) {
          const push = (minD - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push; a.z -= nz * push;
          b.x += nx * push; b.z += nz * push;
          const hard = Math.abs(a.speed - b.speed) > 4;
          a.speed *= 0.75;
          b.speed *= 0.75;
          if (hard && (a === current || b === current)) {
            const hit = a === current ? a : b;
            hit.condition = Math.max(40, hit.condition - 1);
          }
        }
      }
    }
  }

  function updateDriving(dt, input) {
    const car = current;
    if (!car) return;
    const def = car.def;
    // Steering: less lock at speed, eases toward the target.
    const speedRatio = Math.min(1, Math.abs(car.speed) / def.topSpeed);
    const maxSteer = 0.55 - 0.37 * speedRatio;
    const steerTarget = (input.left ? 1 : 0) * maxSteer - (input.right ? 1 : 0) * maxSteer;
    const steerRate = input.handbrake ? 9 : 6;
    car.steer += Math.max(-steerRate * dt, Math.min(steerRate * dt, steerTarget - car.steer));

    // Longitudinal: accelerate / brake / reverse / drag / handbrake.
    if (input.forward) {
      car.speed += def.accel * dt * (car.speed < 0 ? 2.2 : 1);
    } else if (input.back) {
      if (car.speed > 0.5) car.speed -= def.brake * dt;
      else car.speed -= def.accel * 0.55 * dt; // reverse
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4.5 * dt);
    }
    if (input.handbrake) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
    }
    // Drag + top-speed cap (condition scales the top speed a little).
    car.speed -= car.speed * 0.12 * dt;
    const top = def.topSpeed * (0.75 + 0.25 * (car.condition / 100));
    const revTop = 8;
    car.speed = Math.max(-revTop, Math.min(top, car.speed));
    if (Math.abs(car.speed) < 0.05 && !input.forward && !input.back) car.speed = 0;

    // Bicycle-model turn: rate = speed / wheelbase * tan(steer).
    const wheelbase = def.length * 0.62;
    car.heading += (car.speed / wheelbase) * Math.tan(car.steer) * dt * (input.handbrake ? 1.5 : 1);

    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    collideBuildings(car);

    // Wheels: spin with speed, front wheels follow the steering.
    car.spinAngle += (car.speed * dt) / WHEEL_RADIUS;
    for (const key of ['FL', 'FR', 'RL', 'RR']) {
      const w = car.wheels[key];
      w.spin.rotation.x = car.spinAngle;
      if (key === 'FL' || key === 'FR') w.steer.rotation.y = car.steer;
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;

    // Headlight follows the driven car.
    headlight.position.set(
      car.x + Math.sin(car.heading) * (car.def.length / 2),
      1.0,
      car.z + Math.cos(car.heading) * (car.def.length / 2)
    );
    headTarget.position.set(
      car.x + Math.sin(car.heading) * 22, 0.2,
      car.z + Math.cos(car.heading) * 22
    );
  }

  function updateTraffic(dt, playerPos) {
    for (const car of traffic) {
      if (!car.loop || car.loop.length < 2) continue;
      const target = car.loop[car.loopIndex % car.loop.length];
      const next = car.loop[(car.loopIndex + 1) % car.loop.length];
      // Right-lane offset for the segment target -> next.
      const sdx = next[0] - target[0];
      const sdz = next[1] - target[1];
      const segLen = Math.hypot(sdx, sdz) || 1;
      const rx = -sdz / segLen;
      const rz = sdx / segLen;
      const tx = target[0] + rx * LANE_OFFSET;
      const tz = target[1] + rz * LANE_OFFSET;

      // Blocked? Something ahead within 12 m (car or the player).
      let blocked = false;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const checkAhead = (ox, oz, range) => {
        const dx = ox - car.x;
        const dz = oz - car.z;
        const d = Math.hypot(dx, dz);
        if (d < range && d > 0.01) {
          const dot = (dx * fx + dz * fz) / d;
          if (dot > 0.6) return true;
        }
        return false;
      };
      for (const other of allCars()) {
        if (other === car) continue;
        if (checkAhead(other.x, other.z, 12)) { blocked = true; break; }
      }
      if (!blocked && playerPos && !driving) {
        if (checkAhead(playerPos.x, playerPos.z, 7)) blocked = true;
      }

      const desired = blocked ? 0 : car.cruise;
      if (car.speed < desired) car.speed = Math.min(desired, car.speed + 6 * dt);
      else if (car.speed > desired) car.speed = Math.max(desired, car.speed - 14 * dt);

      // Steer toward the (lane-offset) waypoint.
      const want = Math.atan2(tx - car.x, tz - car.z);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = Math.max(-1.9 * dt, Math.min(1.9 * dt, diff));
      car.heading += turn;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;

      if (Math.hypot(tx - car.x, tz - car.z) < 5) {
        car.loopIndex = (car.loopIndex + 1) % car.loop.length;
      }

      car.spinAngle += (car.speed * dt) / WHEEL_RADIUS;
      for (const key of ['FL', 'FR', 'RL', 'RR']) {
        car.wheels[key].spin.rotation.x = car.spinAngle;
      }
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
    }
    collideCars();
  }

  function update(dt, input, playerPos) {
    const step = Math.min(Math.max(dt, 0), 0.05);
    if (driving) updateDriving(step, input || {});
    updateTraffic(step, playerPos);
  }

  // Put every car back at its spawn spot (used by the restart button).
  function reset() {
    for (const car of allCars()) {
      if (car.home) {
        car.x = car.home.x;
        car.z = car.home.z;
        car.heading = car.home.heading;
      }
      car.speed = 0;
      car.steer = 0;
      car.spinAngle = 0;
      car.condition = car.homeCondition || 95;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      if (car.isTraffic) car.loopIndex = 1;
    }
    driving = false;
    current = null;
    headlight.intensity = 0;
  }

  return {
    CAR_DEFS,
    parked,
    traffic,
    get driving() { return driving; },
    get current() { return current; },
    get speedKmh() { return current ? Math.abs(current.speed) * 3.6 : 0; },
    spawnParked,
    spawnTraffic,
    allCars,
    heroCar,
    nearestCar,
    enter,
    exit,
    exitPosition,
    solidAABBs,
    update,
    reset,
    setSpeed(car, v) { if (car) car.speed = v; },
  };
}
