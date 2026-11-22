// VICE BAY 3D — procedural coastal metropolis. Seeded, so the city is the
// same every run. All geometry is boxes / cylinders / cones with canvas
// textures; no external assets. Written fresh for the 3D build.
import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng, clamp } from './util.js';
import { buildingTexture, groundTexture, waterTexture } from './textures.js';

export const WORLD = 480;                 // ground plane size (m)
export const ROADS = [-168, -112, -56, 0, 56, 112, 168];
export const ROAD_W = 12;
export const BLOCK_CENTRES = [-140, -84, -28, 28, 84, 140];

const PARKS = new Set(['-140,-84', '84,-140', '-84,140', '140,84']);
// Landmark block -> { name, colour, height, w, d }.
const LANDMARKS = {
  '-140,-140': { name: 'hospital', colour: 0xe8e8e8, h: 18, w: 30, d: 26 },
  '28,28':     { name: 'bank', colour: 0xc9a227, h: 42, w: 26, d: 26 },
  '28,-84':    { name: 'garage', colour: 0x7a7f88, h: 10, w: 30, d: 20 },
  '140,-140':  { name: 'safehouse', colour: 0x8a6f4d, h: 9, w: 18, d: 16 },
  '140,28':    { name: 'market', colour: 0x9a7b4f, h: 14, w: 28, d: 24 },
  '-140,84':   { name: 'harbour', colour: 0x5a6a7a, h: 12, w: 30, d: 26 },
};

function district(bx, bz) {
  if (bx < -112) return 'harbour';
  if (Math.abs(bx) < 56 && Math.abs(bz) < 56) return 'downtown';
  if (bx > 112) return 'market';
  if (bz > 112) return 'beach';
  if (bz < -112) return 'hills';
  return 'mid';
}

export function buildCity(scene, seed = 1337) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const buildings = [];   // {x,z,w,d,h,colour,name?} for minimap + spawn logic

  // --- Ground (one textured plane) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: groundTexture(seed), roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- Sea (animated water plane, south edge) ---
  const waterTex = waterTexture();
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(6, 1);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, 36),
    new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94, emissive: 0x14424f, emissiveIntensity: 0.85 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.06, 227);
  group.add(water);

  // --- Buildings (InstancedMesh + roof caps) ---
  const placements = [];
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      const key = `${bx},${bz}`;
      if (PARKS.has(key)) continue;
      const lm = LANDMARKS[key];
      if (lm) {
        placements.push({ x: bx, z: bz, w: lm.w, d: lm.d, h: lm.h, colour: lm.colour, name: lm.name });
        continue;
      }
      const dist = district(bx, bz);
      const n = dist === 'downtown' ? rng.int(1, 2) : rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        let w, d, h;
        if (dist === 'downtown') { w = rng.range(18, 26); d = rng.range(18, 26); h = rng.range(28, 68); }
        else if (dist === 'harbour') { w = rng.range(24, 34); d = rng.range(16, 24); h = rng.range(8, 14); }
        else if (dist === 'hills') { w = rng.range(10, 16); d = rng.range(10, 16); h = rng.range(6, 10); }
        else if (dist === 'beach') { w = rng.range(12, 20); d = rng.range(12, 18); h = rng.range(8, 16); }
        else { w = rng.range(14, 22); d = rng.range(14, 22); h = rng.range(12, 26); }
        const ox = n === 1 ? 0 : rng.range(-8, 8);
        const oz = n === 1 ? 0 : rng.range(-8, 8);
        const x = clamp(bx + ox, bx - 14, bx + 14);
        const z = clamp(bz + oz, bz - 14, bz + 14);
        const palette = dist === 'downtown'
          ? [0x9aa3b2, 0x7d8aa0, 0xa89a80, 0x8d929c, 0x6f7f95]
          : dist === 'harbour' ? [0x6a7076, 0x7a6a5a, 0x5a6a7a, 0x8a7a6a]
          : dist === 'hills' ? [0xb09a7a, 0x9a8a7a, 0xc0a080, 0x8a9a7a]
          : dist === 'beach' ? [0xd8c8a0, 0xc0b090, 0xe8d8b0, 0x9ab0c0]
          : [0x8d929c, 0xa89a80, 0x7d8aa0, 0xb0a090];
        placements.push({ x, z, w, d, h, colour: rng.pick(palette) });
      }
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const facade = buildingTexture(seed + 7);
  const bMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.85, metalness: 0.05 });
  const bMesh = new THREE.InstancedMesh(boxGeo, bMat, placements.length);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  roofGeo.translate(0, 0.5, 0);
  const roofMesh = new THREE.InstancedMesh(
    roofGeo, new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.9 }), placements.length
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  placements.forEach((b, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    p.set(b.x, 0, b.z); s.set(b.w, b.h, b.d);
    m.compose(p, q, s); bMesh.setMatrixAt(i, m);
    col.setHex(b.colour); bMesh.setColorAt(i, col);
    p.set(b.x, b.h, b.z); s.set(b.w + 0.5, 0.7, b.d + 0.5);
    m.compose(p, q, s); roofMesh.setMatrixAt(i, m);
    colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 });
    buildings.push(b);
  });
  bMesh.castShadow = true; bMesh.receiveShadow = true;
  roofMesh.castShadow = true;
  group.add(bMesh); group.add(roofMesh);

  // Hospital red cross on the roof (two thin boxes).
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.6, emissive: 0x400000 });
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 3), crossMat);
  cross1.position.set(-140, 18.8, -140);
  const cross2 = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 10), crossMat);
  cross2.position.set(-140, 18.8, -140);
  group.add(cross1); group.add(cross2);

  // Harbour containers (coloured boxes near the docks).
  const contCols = [0xc0563a, 0x3a7ac0, 0x4a9a4a, 0xc0a03a, 0x8a5ac0];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(
      new THREE.BoxGeometry(10, 3, 3),
      new THREE.MeshStandardMaterial({ color: contCols[i % contCols.length], roughness: 0.8 })
    );
    c.position.set(-168 + rng.range(-6, 6), 1.5, 56 + i * 5.5);
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    c.castShadow = true;
    group.add(c);
    colliders.push({ minX: c.position.x - 5, maxX: c.position.x + 5, minZ: c.position.z - 2, maxZ: c.position.z + 2 });
  }

  // --- Trees (parks + hills + beach palms) ---
  const treeSpots = [];
  for (const [bx, bz] of [[-140, -84], [84, -140], [-84, 140], [140, 84]]) {
    for (let i = 0; i < 10; i++) treeSpots.push({ x: bx + rng.range(-18, 18), z: bz + rng.range(-18, 18), palm: false });
  }
  for (let i = 0; i < 14; i++) treeSpots.push({ x: -210 + i * 32 + rng.range(-6, 6), z: 186 + rng.range(-2, 4), palm: true });
  for (let i = 0; i < 12; i++) treeSpots.push({ x: rng.range(-180, 180), z: rng.range(-200, -120), palm: false });

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }), treeSpots.length);
  const leafGeo = new THREE.ConeGeometry(1.9, 4.2, 8);
  leafGeo.translate(0, 4.4, 0);
  const leafMesh = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 1 }), treeSpots.length);
  const palmLeafGeo = new THREE.SphereGeometry(2.0, 8, 6);
  palmLeafGeo.scale(1, 0.45, 1); palmLeafGeo.translate(0, 5.2, 0);
  const palmLeafMesh = new THREE.InstancedMesh(palmLeafGeo, new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 1 }), treeSpots.length);
  treeSpots.forEach((t, i) => {
    const sc = t.palm ? 1.5 : rng.range(0.8, 1.3);
    p.set(t.x, 0, t.z); s.set(sc, sc, sc); q.identity();
    m.compose(p, q, s); trunkMesh.setMatrixAt(i, m);
    m.compose(p, q, s); (t.palm ? palmLeafMesh : leafMesh).setMatrixAt(i, m);
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    (t.palm ? leafMesh : palmLeafMesh).setMatrixAt(i, hide);
  });
  trunkMesh.castShadow = true; leafMesh.castShadow = true; palmLeafMesh.castShadow = true;
  group.add(trunkMesh); group.add(leafMesh); group.add(palmLeafMesh);

  // --- Streetlights (along the roads) ---
  const lightSpots = [];
  for (const r of ROADS) {
    for (let v = -196; v <= 196; v += 56) {
      lightSpots.push({ x: r + 7.5, z: v });
      lightSpots.push({ x: v, z: r + 7.5 });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.2, 6);
  poleGeo.translate(0, 2.6, 0);
  const poleMesh = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, metalness: 0.4 }), lightSpots.length);
  const lampGeo = new THREE.SphereGeometry(0.34, 8, 6);
  const lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.9 }), lightSpots.length);
  lightSpots.forEach((L, i) => {
    p.set(L.x, 0, L.z); s.set(1, 1, 1); q.identity();
    m.compose(p, q, s); poleMesh.setMatrixAt(i, m);
    p.set(L.x, 5.3, L.z);
    m.compose(p, q, s); lampMesh.setMatrixAt(i, m);
  });
  group.add(poleMesh); group.add(lampMesh);

  // --- Fountain at the central plaza (0,0) ---
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 7, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8d929c, roughness: 0.8 })
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const fountainWater = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.3, 20),
    new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.2, metalness: 0.2 })
  );
  fountainWater.position.set(0, 1.25, 0);
  group.add(fountainWater);
  colliders.push({ minX: -7, maxX: 7, minZ: -7, maxZ: 7 });

  scene.add(group);

  const byName = {};
  for (const b of buildings) if (b.name) byName[b.name] = b;

  return {
    group, colliders, buildings, water, waterTex,
    roads: ROADS,
    landmarks: {
      hospital: byName.hospital || { x: -140, z: -140 },
      bank: byName.bank || { x: 28, z: 28 },
      garage: byName.garage || { x: 28, z: -84 },
      safehouse: byName.safehouse || { x: 140, z: -140 },
      market: byName.market || { x: 140, z: 28 },
      harbour: byName.harbour || { x: -140, z: 84 },
      plaza: { x: 0, z: 0 },
      beach: { x: 0, z: 196 },
    },
    playerStart: { x: 28, z: -62, heading: Math.PI },
    update(dt) {
      waterTex.offset.x += dt * 0.02;
      waterTex.offset.y += dt * 0.008;
    },
  };
}

// Is the point (x,z) inside any building collider? (circle radius r.)
export function collides(colliders, x, z, r) {
  for (const c of colliders) {
    const cx = clamp(x, c.minX, c.maxX);
    const cz = clamp(z, c.minZ, c.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

// Push a circle (x,z,r) out of all colliders it touches. Returns the new x,z.
export function resolveCollision(colliders, x, z, r) {
  for (let iter = 0; iter < 3; iter++) {
    let hit = false;
    for (const c of colliders) {
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      let dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 < 1e-6) { dx = 0; dz = -1; }
        const d = Math.sqrt(dx * dx + dz * dz);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      }
    }
    if (!hit) break;
  }
  return { x, z };
}

// Nearest road centre line to (x,z): returns {axis:'x'|'z', at:number, dist}.
export function nearestRoad(x, z) {
  let best = { axis: 'x', at: ROADS[0], dist: Infinity };
  for (const r of ROADS) {
    const dx = Math.abs(x - r), dz = Math.abs(z - r);
    if (dx < best.dist) best = { axis: 'x', at: r, dist: dx };
    if (dz < best.dist) best = { axis: 'z', at: r, dist: dz };
  }
  return best;
}
