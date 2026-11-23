// city.js — a seeded procedural coastal city for VICE BAY 3D (Stage 1).
// 480x480 m, 7x7 road grid, ~70 buildings in 5 districts, 6 landmarks,
// a neon tower, billboards, a plaza fountain, palms, streetlights, a beach
// and an animated sea. Deterministic (seed 1). All art procedural.

import * as THREE from 'three';
import { mulberry32, rand, randInt, pick, makeBox } from './util.js';
import {
  facadeTexture, signTexture, neonTexture, billboardTexture,
  groundTexture, seaTexture, skyTexture,
} from './textures.js';

export const ROADS = [-192, -128, -64, 0, 64, 128, 192];
export const WORLD = 240; // half-size of the city (metres)

export function districtAt(x, z) {
  if (z > 130) return 'SUNSET STRAND';
  if (z < -130) return 'HILLS';
  if (x > 130) return 'HARBOUR';
  if (x < -130) return 'MARKET';
  return 'DOWNTOWN';
}

function stdMat(opts) {
  return new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.02, ...opts });
}

export function buildCity(scene) {
  const rng = mulberry32(1);
  const colliders = [];
  const buildings = [];
  const landmarks = {};

  // ---- ground, sea, sky -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    stdMat({ map: groundTexture() })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const seaTex = seaTexture();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 260),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.35, metalness: 0.1, emissive: 0x0a3a4a, emissiveIntensity: 0.35 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 240 + 130);
  scene.add(sea);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // ---- shared facade variants (a few materials, reused) -----------------
  const facades = [];
  for (let i = 0; i < 5; i++) {
    facades.push(facadeTexture(rng, { floors: randInt(rng, 6, 12), cols: randInt(rng, 3, 5) }));
  }
  const facadeMats = facades.map((t) => stdMat({ map: t }));
  const roofMat = stdMat({ color: 0x2a2a33 });
  const concreteMat = stdMat({ color: 0x8a8694 });

  function addBuilding(cx, cz, w, h, d, mat, name = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    // Roof cap.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), roofMat);
    roof.position.set(cx, h + 0.35, cz);
    roof.castShadow = true;
    scene.add(roof);
    const box = makeBox(cx, cz, w / 2 + 0.3, d / 2 + 0.3);
    colliders.push(box);
    const rec = { x: cx, z: cz, w, h, d, name };
    buildings.push(rec);
    if (name) landmarks[name] = rec;
    return rec;
  }

  function addSign(cx, cy, cz, w, h, texture, rotY = 0) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.55, roughness: 0.6 })
    );
    sign.position.set(cx, cy, cz);
    sign.rotation.y = rotY;
    scene.add(sign);
    return sign;
  }

  // ---- landmarks (fixed, named, signed) ---------------------------------
  const LM = [
    { name: 'HOSPITAL', x: -96, z: -32, w: 34, h: 30, d: 26, sign: 'HOSPITAL', cross: true },
    { name: 'BANK', x: 96, z: -32, w: 30, h: 36, d: 26, sign: 'BANK' },
    { name: 'GARAGE', x: -32, z: 96, w: 30, h: 16, d: 24, sign: 'GARAGE' },
    { name: 'SAFEHOUSE', x: 32, z: -96, w: 26, h: 22, d: 22, sign: 'SAFEHOUSE' },
    { name: 'MARKET', x: -96, z: 96, w: 36, h: 18, d: 28, sign: 'MARKET' },
    { name: 'HARBOUR', x: 160, z: 32, w: 40, h: 14, d: 30, sign: 'HARBOUR' },
  ];
  for (const lm of LM) {
    const mat = facadeMats[randInt(rng, 0, facadeMats.length - 1)];
    addBuilding(lm.x, lm.z, lm.w, lm.h, lm.d, mat, lm.name);
    // Sign on the south face (facing the road / plaza).
    addSign(lm.x, lm.h * 0.72, lm.z + lm.d / 2 + 0.15, Math.min(lm.w * 0.8, 24), 5, signTexture(lm.sign), 0);
    if (lm.cross) {
      // Red cross above the hospital sign.
      const crossMat = new THREE.MeshStandardMaterial({ color: 0xd21f2b, emissive: 0xd21f2b, emissiveIntensity: 0.7 });
      const v = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5, 0.3), crossMat);
      v.position.set(lm.x, lm.h + 2.5, lm.z + lm.d / 2 + 0.2);
      scene.add(v);
      const hz = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 0.3), crossMat);
      hz.position.set(lm.x, lm.h + 2.5, lm.z + lm.d / 2 + 0.2);
      scene.add(hz);
    }
  }

  // ---- neon tower (tall, vertical pink VICEBAY sign) --------------------
  const tower = addBuilding(0, -160, 24, 62, 24, facadeMats[1], 'NEON TOWER');
  addSign(0, 34, -160 + 12 + 0.15, 7, 40, neonTexture('VICEBAY'), 0);

  // ---- billboards --------------------------------------------------------
  const BB = [
    { x: -64, z: -128, lines: ['VICE BAY', 'SUNSET STRIP'], rotY: 0 },
    { x: 64, z: 128, lines: ['SUNSET GT', 'DRIVE THE NIGHT'], rotY: Math.PI },
    { x: -128, z: 64, lines: ['VICE FM 98.5', 'SUNSET DRIVE'], rotY: Math.PI / 2 },
    { x: 128, z: -64, lines: ['CORAL COLA', 'TASTE THE COAST'], rotY: -Math.PI / 2 },
  ];
  for (const b of BB) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 8), stdMat({ color: 0x3a3a44 }));
    pole.position.set(b.x, 6, b.z);
    pole.castShadow = true;
    scene.add(pole);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 8),
      new THREE.MeshStandardMaterial({ map: billboardTexture(b.lines), emissive: 0xffffff, emissiveMap: billboardTexture(b.lines), emissiveIntensity: 0.35 })
    );
    board.position.set(b.x, 15, b.z);
    board.rotation.y = b.rotY;
    scene.add(board);
    colliders.push(makeBox(b.x, b.z, 1, 1));
  }

  // ---- regular buildings (one or two per block) --------------------------
  const landmarkCells = new Set(LM.map((l) => `${Math.round(l.x / 64)},${Math.round(l.z / 64)}`));
  landmarkCells.add('0,-3'); // neon tower cell
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      const bx0 = ROADS[i] + 8;
      const bz0 = ROADS[j] + 8;
      const bx1 = ROADS[i + 1] - 8;
      const bz1 = ROADS[j + 1] - 8;
      const cellKey = `${Math.round(((bx0 + bx1) / 2) / 64)},${Math.round(((bz0 + bz1) / 2) / 64)}`;
      // Plaza block at the centre: leave open for the fountain.
      if (Math.abs((bx0 + bx1) / 2) < 40 && Math.abs((bz0 + bz1) / 2) < 40) continue;
      if (landmarkCells.has(cellKey)) continue;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      const district = districtAt(cx, cz);
      const n = rng() < 0.6 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = rand(rng, 16, 26);
        const d = rand(rng, 16, 26);
        let h;
        if (district === 'DOWNTOWN') h = rand(rng, 24, 56);
        else if (district === 'HARBOUR' || district === 'MARKET') h = rand(rng, 10, 20);
        else h = rand(rng, 7, 13);
        const ox = n === 2 ? (k === 0 ? -11 : 11) : 0;
        const oz = n === 2 ? (k === 0 ? -11 : 11) : 0;
        const mat = facadeMats[randInt(rng, 0, facadeMats.length - 1)];
        addBuilding(cx + ox, cz + oz, w, h, d, mat);
      }
    }
  }

  // ---- plaza fountain ----------------------------------------------------
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 1.2, 24), concreteMat);
  basin.position.set(0, 0.6, 0);
  basin.castShadow = true;
  basin.receiveShadow = true;
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(8.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.15, metalness: 0.3, emissive: 0x0a3a4a, emissiveIntensity: 0.4 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 1.25, 0);
  scene.add(water);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 4, 12), concreteMat);
  column.position.set(0, 3, 0);
  column.castShadow = true;
  scene.add(column);
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffc860, emissiveIntensity: 0.9 })
  );
  orb.position.set(0, 5.6, 0);
  scene.add(orb);
  colliders.push(makeBox(0, 0, 10, 10));

  // ---- palms (instanced: trunk + crown) ---------------------------------
  const palmSpots = [];
  for (let i = 0; i < 22; i++) palmSpots.push([rand(rng, -220, 220), rand(rng, 168, 232)]); // beach
  for (let i = 0; i < 10; i++) palmSpots.push([rand(rng, -200, 200), rand(rng, -200, 200)]); // parks / streets
  for (let i = 0; i < 8; i++) palmSpots.push([pick(rng, ROADS) + pick(rng, [-9, 9]), rand(rng, -200, 200)]);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 6, 7);
  const trunkMat = stdMat({ color: 0x6a4a2a });
  const crownGeo = new THREE.ConeGeometry(2.4, 2.2, 8);
  const crownMat = stdMat({ color: 0x2a7a3a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  palmSpots.forEach(([x, z], i) => {
    const s = rand(rng, 0.85, 1.25);
    m4.makeScale(s, s, s);
    m4.setPosition(x, 3 * s, z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s * 0.7, s);
    m4.setPosition(x, (6 + 0.8) * s, z);
    crowns.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  scene.add(trunks);
  scene.add(crowns);

  // ---- streetlights (instanced: pole + lamp) -----------------------------
  const lightSpots = [];
  for (const r of ROADS) {
    for (let d = -192; d <= 192; d += 64) {
      lightSpots.push([r + 8, d]);
      lightSpots.push([r - 8, d + 32]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = stdMat({ color: 0x2a2a33 });
  const lampGeo = new THREE.SphereGeometry(0.4, 10, 8);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lightSpots.length);
  lightSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 3, z);
    poles.setMatrixAt(i, m4);
    m4.setPosition(x, 6.2, z);
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(lamps);

  // ---- harbour containers ------------------------------------------------
  const contCols = [0x8a4a2a, 0x2a5a8a, 0x3a7a4a, 0x9a8a3a];
  for (let i = 0; i < 12; i++) {
    const x = rand(rng, 150, 215);
    const z = rand(rng, -60, 110);
    const w = rand(rng, 8, 12);
    const h = rand(rng, 2.5, 5);
    const d = rand(rng, 2.5, 3.5);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stdMat({ color: pick(rng, contCols) }));
    box.position.set(x, h / 2, z);
    box.rotation.y = pick(rng, [0, Math.PI / 2]);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    if (h < 3.5) colliders.push(makeBox(x, z, w / 2, d / 2));
  }

  // ---- beach umbrellas + lifeguard stand --------------------------------
  const umbCols = [0xd24a6a, 0x4a8ad2, 0xe8b04b, 0x6a4ad2, 0x3aa86a];
  for (let i = 0; i < 5; i++) {
    const x = -120 + i * 55 + rand(rng, -8, 8);
    const z = rand(rng, 185, 215);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), stdMat({ color: 0xd8d8d8 }));
    pole.position.set(x, 1.5, z);
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 10), stdMat({ color: umbCols[i] }));
    top.position.set(x, 3.4, z);
    top.castShadow = true;
    scene.add(top);
  }
  // Lifeguard stand at (24, 200).
  const lgBase = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 3), stdMat({ color: 0xe8e0d0 }));
  lgBase.position.set(24, 2.25, 200);
  lgBase.castShadow = true;
  scene.add(lgBase);
  const lgRoof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), stdMat({ color: 0xd24a3a }));
  lgRoof.position.set(24, 4.7, 200);
  scene.add(lgRoof);
  colliders.push(makeBox(24, 200, 1.8, 1.8));

  // ---- small props: benches, hydrants, bins ------------------------------
  const benchMat = stdMat({ color: 0x6a4a2a });
  const hydMat = stdMat({ color: 0xc22e2e });
  const binMat = stdMat({ color: 0x2a4a2a });
  for (let i = 0; i < 14; i++) {
    const x = pick(rng, ROADS) + pick(rng, [-10, 10]);
    const z = rand(rng, -200, 160);
    const kind = i % 3;
    if (kind === 0) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
      b.position.set(x, 0.5, z);
      b.castShadow = true;
      scene.add(b);
    } else if (kind === 1) {
      const hy = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), hydMat);
      hy.position.set(x, 0.45, z);
      scene.add(hy);
    } else {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 1, 8), binMat);
      bin.position.set(x, 0.5, z);
      scene.add(bin);
    }
  }

  // ---- parked prop cars (simple: body + cabin + wheel strip) -------------
  const carCols = [0xc22e2e, 0x2a8a8a, 0xe8b04b, 0xd8d8d8, 0x2a4a8a, 0x3a7a4a, 0xd26a2a, 0x8a4ad2];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.2, metalness: 0.4 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const x = pick(rng, ROADS) + pick(rng, [-3, 3]);
    const z = rand(rng, -180, 150);
    const rotY = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 4.4), stdMat({ color: carCols[i] }));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), glassMat);
    cabin.position.set(0, 1.1, -0.2);
    cabin.castShadow = true;
    g.add(cabin);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 4.5), tyreMat);
    strip.position.y = 0.22;
    g.add(strip);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    colliders.push(makeBox(x, z, 2.6, 2.6));
  }

  return {
    colliders,
    buildings,
    buildingCount: buildings.length,
    palmCount: palmSpots.length,
    sea,
    seaTex,
    roads: ROADS,
    landmarks,
    tower,
  };
}
