// VICE BAY — the city. A seeded 480x480 m dusk coastal metropolis:
// a road grid, ~70 buildings in five districts, a beach and a teal sea,
// palms, streetlights, landmarks with illuminated signs, billboards and
// street props. Returns the group, the building colliders and the layout
// the HUD minimap and the district names read.

import * as THREE from 'three';
import { makeRng, pick, range, clamp } from './util.js';
import {
  facadeSet,
  roofTexture,
  groundTexture,
  seaTexture,
  billboardTexture,
  signTexture,
} from './textures.js';

/** The city layout, shared with the minimap and the district names. */
export const LAYOUT = {
  half: 240,
  roads: [-192, -128, -64, 0, 64, 128, 192],
  roadW: 10,
  beachX: 200,
  parks: [
    [-160, -160, 48, 48],
    [96, 128, 48, 48],
  ],
};

/** Name the district a position sits in (shown live in the HUD). */
export function districtAt(x, z) {
  if (Math.abs(x) < 40 && Math.abs(z) < 40) return 'VICE PLAZA';
  if (x > 192) return 'SUNSET STRAND';
  if (x < -128) return 'HARBOUR';
  if (Math.abs(x) < 96 && Math.abs(z) < 96) return 'DOWNTOWN';
  if (z > 96) return 'MARKET ROW';
  if (z < -96) return 'HILLS';
  return 'MIDTOWN';
}

/** Shared geometries / materials, built once and reused by every mesh. */
function makeShared() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const sph = new THREE.SphereGeometry(1, 12, 8);
  const cone = new THREE.ConeGeometry(1, 1, 6);
  return {
    box,
    cyl,
    sph,
    cone,
    trunk: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.85 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.85 }),
    pole: new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.4 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
    benchWood: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }),
    benchIron: new THREE.MeshStandardMaterial({ color: 0x333338, roughness: 0.6, metalness: 0.4 }),
    hydrant: new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.6 }),
    bin: new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.8 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.9 }),
    water: new THREE.MeshStandardMaterial({
      color: 0x3a8ab8,
      roughness: 0.25,
      metalness: 0.1,
      emissive: 0x0a3a4a,
      emissiveIntensity: 0.5,
    }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }),
  };
}

/** A single building: a box with a facade texture and a roof cap. */
function makeBuilding(shared, facades, roof, x, z, w, d, h, facadeIdx) {
  const group = new THREE.Group();
  const facade = facades[facadeIdx % facades.length];
  const side = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.85 });
  const top = new THREE.MeshStandardMaterial({ map: roof, roughness: 0.95 });
  const mesh = new THREE.Mesh(shared.box, [side, side, top, top, side, side]);
  mesh.scale.set(w, h, d);
  mesh.position.set(0, h / 2, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.position.set(x, 0, z);
  return group;
}

/** A landmark: a taller building with an illuminated sign plane on its face. */
function makeLandmark(shared, facades, roof, def) {
  const g = makeBuilding(shared, facades, roof, def.x, def.z, def.w, def.d, def.h, def.facade);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(def.signW, def.signH),
    new THREE.MeshBasicMaterial({ map: signTexture(def.name, { vertical: def.vertical, color: def.color }), transparent: false })
  );
  // Face the sign toward the nearest road (south by default, or the given yaw).
  sign.position.set(0, def.h * 0.62, def.d / 2 + 0.15);
  sign.rotation.y = def.yaw || 0;
  g.add(sign);
  if (def.cross) {
    // Hospital red cross on the roof edge.
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
    const h1 = new THREE.Mesh(shared.box, crossMat);
    h1.scale.set(6, 1.4, 1.4);
    h1.position.set(0, def.h + 0.8, def.d / 2 + 0.1);
    const h2 = new THREE.Mesh(shared.box, crossMat);
    h2.scale.set(1.4, 6, 1.4);
    h2.position.set(0, def.h + 0.8, def.d / 2 + 0.1);
    g.add(h1, h2);
  }
  return g;
}

/** A palm: a leaning trunk and a crown of drooping fronds. */
function makePalm(shared, rng) {
  const g = new THREE.Group();
  const lean = range(rng, -0.12, 0.12);
  const trunk = new THREE.Mesh(shared.cyl, shared.trunk);
  trunk.scale.set(0.22, 5.5, 0.22);
  trunk.position.y = 2.75;
  trunk.rotation.z = lean;
  trunk.castShadow = true;
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(lean * 5.5, 5.6, 0);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(shared.cone, i % 2 === 0 ? shared.leaf : shared.leaf2);
    const a = (i / 7) * Math.PI * 2;
    frond.scale.set(0.55, 3.2, 0.12);
    frond.position.set(Math.cos(a) * 1.3, -0.4, Math.sin(a) * 1.3);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    frond.castShadow = true;
    crown.add(frond);
  }
  // Coconuts.
  const nuts = new THREE.Mesh(shared.sph, shared.trunk);
  nuts.scale.set(0.22, 0.22, 0.22);
  nuts.position.set(0.3, -0.5, 0.2);
  crown.add(nuts);
  g.add(crown);
  return g;
}

/** A streetlight: pole, arm and a warm glowing bulb. */
function makeStreetlight(shared) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(shared.cyl, shared.pole);
  pole.scale.set(0.09, 6, 0.09);
  pole.position.y = 3;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(shared.box, shared.pole);
  arm.scale.set(0.12, 0.12, 1.6);
  arm.position.set(0, 5.9, 0.7);
  g.add(arm);
  const head = new THREE.Mesh(shared.box, shared.pole);
  head.scale.set(0.5, 0.18, 0.9);
  head.position.set(0, 5.85, 1.4);
  g.add(head);
  const bulb = new THREE.Mesh(shared.sph, shared.lampGlow);
  bulb.scale.set(0.22, 0.14, 0.3);
  bulb.position.set(0, 5.72, 1.4);
  g.add(bulb);
  return g;
}

/** A billboard on two poles, facing a road. */
function makeBillboard(shared, kind, x, z, yaw) {
  const g = new THREE.Group();
  for (const dx of [-3.2, 3.2]) {
    const pole = new THREE.Mesh(shared.cyl, shared.pole);
    pole.scale.set(0.14, 7, 0.14);
    pole.position.set(dx, 3.5, 0);
    g.add(pole);
  }
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 4.5),
    new THREE.MeshBasicMaterial({ map: billboardTexture(kind) })
  );
  face.position.set(0, 8.2, 0);
  face.castShadow = true;
  g.add(face);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), shared.pole);
  back.position.set(0, 8.2, -0.06);
  back.rotation.y = Math.PI;
  g.add(back);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

/** A bench, a hydrant and a bin — small street props sharing materials. */
function makeBench(shared, x, z, yaw) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(shared.box, shared.benchWood);
  seat.scale.set(2.2, 0.12, 0.6);
  seat.position.y = 0.5;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(shared.box, shared.benchWood);
  back.scale.set(2.2, 0.6, 0.1);
  back.position.set(0, 0.85, -0.28);
  back.rotation.x = -0.15;
  g.add(back);
  for (const dx of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(shared.box, shared.benchIron);
    leg.scale.set(0.1, 0.5, 0.55);
    leg.position.set(dx, 0.25, 0);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

function makeHydrant(shared, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shared.cyl, shared.hydrant);
  body.scale.set(0.22, 0.7, 0.22);
  body.position.y = 0.35;
  g.add(body);
  const cap = new THREE.Mesh(shared.sph, shared.hydrant);
  cap.scale.set(0.24, 0.18, 0.24);
  cap.position.y = 0.75;
  g.add(cap);
  g.position.set(x, 0, z);
  return g;
}

function makeBin(shared, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(shared.cyl, shared.bin);
  body.scale.set(0.35, 0.9, 0.35);
  body.position.y = 0.45;
  g.add(body);
  const lid = new THREE.Mesh(shared.cyl, shared.pole);
  lid.scale.set(0.37, 0.08, 0.37);
  lid.position.y = 0.92;
  g.add(lid);
  g.position.set(x, 0, z);
  return g;
}

/** A parked prop car (not drivable in Stage 1): body, cabin, wheels. */
function makePropCar(shared, x, z, yaw, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(shared.box, paint);
  body.scale.set(1.8, 0.55, 4.2);
  body.position.y = 0.45;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(shared.box, shared.glass);
  cabin.scale.set(1.6, 0.5, 2.2);
  cabin.position.set(0, 0.95, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(shared.cyl, shared.tyre);
    wheel.scale.set(0.34, 0.24, 0.34);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    g.add(wheel);
  }
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  return g;
}

/** A tree: trunk + two canopy spheres. */
function makeTree(shared, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(shared.cyl, shared.trunk);
  trunk.scale.set(0.18, 2.4, 0.18);
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  g.add(trunk);
  const c1 = new THREE.Mesh(shared.sph, pick(rng, [shared.leaf, shared.leaf2]));
  c1.scale.set(1.6, 1.3, 1.6);
  c1.position.y = 3.1;
  c1.castShadow = true;
  g.add(c1);
  const c2 = new THREE.Mesh(shared.sph, shared.leaf2);
  c2.scale.set(1.0, 0.8, 1.0);
  c2.position.set(0.7, 3.8, 0.3);
  g.add(c2);
  return g;
}

/** The plaza fountain: a stone basin, water and a centre column. */
function makeFountain(shared) {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(shared.cyl, shared.stone);
  basin.scale.set(9, 0.9, 9);
  basin.position.y = 0.45;
  basin.receiveShadow = true;
  g.add(basin);
  const water = new THREE.Mesh(shared.cyl, shared.water);
  water.scale.set(8.2, 0.25, 8.2);
  water.position.y = 0.85;
  g.add(water);
  const column = new THREE.Mesh(shared.cyl, shared.stone);
  column.scale.set(1.1, 2.6, 1.1);
  column.position.y = 1.6;
  column.castShadow = true;
  g.add(column);
  const top = new THREE.Mesh(shared.sph, shared.water);
  top.scale.set(1.4, 1.0, 1.4);
  top.position.y = 3.1;
  g.add(top);
  g.position.set(0, 0, 0);
  return g;
}

/**
 * Build the whole city for a seed. Returns { group, colliders, sea, layout }.
 * colliders are AABBs {minX,maxX,minZ,maxZ,height} the player (and later
 * cars) collide with. sea is the animated sea texture.
 */
export function buildCity(seed = 1) {
  const rng = makeRng(seed);
  const shared = makeShared();
  const facades = facadeSet(seed);
  const roof = roofTexture(rng);
  const group = new THREE.Group();
  const colliders = [];

  // Ground: one textured plane for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(LAYOUT.half * 2, LAYOUT.half * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(LAYOUT), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Sea: a big teal plane east of the beach, slightly below the sand.
  const seaTex = seaTexture();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, LAYOUT.half * 2 + 40),
    new THREE.MeshStandardMaterial({
      map: seaTex,
      roughness: 0.3,
      metalness: 0.1,
      emissive: 0x0a3a44,
      emissiveIntensity: 0.55,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(LAYOUT.half + 160, -0.35, 0);
  group.add(sea);

  // Buildings: one per block, two in downtown blocks. Blocks are the cells
  // between the roads; the plaza, parks and the beach strip hold no buildings.
  const edges = [-LAYOUT.half, ...LAYOUT.roads, LAYOUT.half];
  const plazaBlock = (x0, x1, z0, z1) => x0 < 40 && x1 > -40 && z0 < 40 && z1 > -40;
  const inPark = (cx, cz) => LAYOUT.parks.some(([px, pz, pw, pd]) => cx >= px && cx <= px + pw && cz >= pz && cz <= pz + pd);
  let buildingCount = 0;
  for (let bi = 0; bi < edges.length - 1; bi++) {
    for (let bj = 0; bj < edges.length - 1; bj++) {
      const x0 = edges[bi] + LAYOUT.roadW / 2 + 2;
      const x1 = edges[bi + 1] - LAYOUT.roadW / 2 - 2;
      const z0 = edges[bj] + LAYOUT.roadW / 2 + 2;
      const z1 = edges[bj + 1] - LAYOUT.roadW / 2 - 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (x0 >= 192) continue; // beach strip: sand, no buildings
      if (plazaBlock(x0, x1, z0, z1)) continue; // central plaza
      if (inPark(cx, cz)) continue; // parks
      const downtown = Math.abs(cx) < 96 && Math.abs(cz) < 96;
      const harbour = cx < -128;
      const market = cz > 96;
      const hills = cz < -96;
      const bw = x1 - x0;
      const bd = z1 - z0;
      const place = (fx, fz, fw, fd, fh, fIdx) => {
        const b = makeBuilding(shared, facades, roof, fx, fz, fw, fd, fh, fIdx);
        group.add(b);
        colliders.push({ minX: fx - fw / 2, maxX: fx + fw / 2, minZ: fz - fd / 2, maxZ: fz + fd / 2, height: fh });
        buildingCount++;
      };
      if (downtown) {
        // A tower plus a lower podium beside it.
        const h = range(rng, 26, 58);
        const w = range(rng, 16, 24);
        const d = range(rng, 16, 24);
        place(cx - 6, cz - 4, w, d, h, Math.floor(rng() * facades.length));
        place(cx + 14, cz + 12, range(rng, 10, 14), range(rng, 10, 14), range(rng, 8, 14), Math.floor(rng() * facades.length));
      } else if (harbour) {
        // Wide low warehouses.
        place(cx, cz, range(rng, 22, 30), range(rng, 14, 20), range(rng, 8, 13), Math.floor(rng() * facades.length));
      } else if (market) {
        place(cx, cz, range(rng, 14, 22), range(rng, 12, 18), range(rng, 10, 18), Math.floor(rng() * facades.length));
      } else if (hills) {
        place(cx, cz, range(rng, 10, 16), range(rng, 10, 16), range(rng, 6, 11), Math.floor(rng() * facades.length));
      } else {
        place(cx, cz, range(rng, 12, 20), range(rng, 12, 20), range(rng, 9, 20), Math.floor(rng() * facades.length));
      }
    }
  }

  // Landmarks: named buildings with illuminated signs (they replace the
  // procedural building nearest their spot by sitting on top of the grid).
  const landmarks = [
    { name: 'HOSPITAL', x: -32, z: -96, w: 26, d: 20, h: 22, facade: 2, signW: 16, signH: 3.2, color: '#ff5a5a', cross: true, yaw: 0 },
    { name: 'BANK', x: 32, z: -32, w: 22, d: 18, h: 34, facade: 3, signW: 12, signH: 2.6, color: '#ffd27a', yaw: 0 },
    { name: 'GARAGE', x: -96, z: 32, w: 24, d: 18, h: 14, facade: 1, signW: 13, signH: 2.8, color: '#5ad2ff', yaw: 0 },
    { name: 'SAFEHOUSE', x: 96, z: -96, w: 20, d: 16, h: 18, facade: 5, signW: 14, signH: 2.6, color: '#b08aff', yaw: 0 },
    { name: 'MARKET', x: -32, z: 128, w: 28, d: 18, h: 16, facade: 0, signW: 13, signH: 2.8, color: '#7aff8a', yaw: 0 },
    { name: 'HARBOUR', x: -160, z: 0, w: 30, d: 20, h: 15, facade: 4, signW: 14, signH: 2.8, color: '#ff9a5a', yaw: Math.PI / 2 },
  ];
  for (const def of landmarks) {
    const lm = makeLandmark(shared, facades, roof, def);
    group.add(lm);
    colliders.push({ minX: def.x - def.w / 2, maxX: def.x + def.w / 2, minZ: def.z - def.d / 2, maxZ: def.z + def.d / 2, height: def.h });
    buildingCount++;
  }
  // The VICE BAY tower sign: a tall downtown tower with a vertical neon sign.
  const tower = makeBuilding(shared, facades, roof, 64, -64, 20, 20, 52, 3);
  group.add(tower);
  colliders.push({ minX: 54, maxX: 74, minZ: -74, maxZ: -54, height: 52 });
  buildingCount++;
  const vbSign = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 30),
    new THREE.MeshBasicMaterial({ map: signTexture('VICEBAY', { vertical: true, color: '#ff5a8a' }) })
  );
  vbSign.position.set(64, 30, -53.8);
  group.add(vbSign);

  // Billboards.
  const boards = [
    { kind: 'vicebay', x: 170, z: 60, yaw: Math.PI },
    { kind: 'sunsetgt', x: -64, z: -160, yaw: 0 },
    { kind: 'vicefm', x: -128, z: 160, yaw: 0 },
    { kind: 'coral', x: -192, z: -64, yaw: Math.PI / 2 },
  ];
  for (const b of boards) group.add(makeBillboard(shared, b.kind, b.x, b.z, b.yaw));

  // Palms: a beach row, a boulevard row and a few in the parks.
  const palmSpots = [];
  for (let z = -220; z <= 220; z += 28) palmSpots.push([range(rng, 208, 232), z]);
  for (let z = -160; z <= 160; z += 40) palmSpots.push([range(rng, 6, 10), z]);
  for (const [px, pz] of [[-150, -150], [-130, -140], [105, 140], [130, 155]]) palmSpots.push([px, pz]);
  for (const [px, pz] of palmSpots) {
    const palm = makePalm(shared, rng);
    palm.position.set(px, 0, pz);
    palm.rotation.y = rng() * Math.PI * 2;
    group.add(palm);
  }

  // Streetlights along every road, every 32 m, alternating sides.
  for (const r of LAYOUT.roads) {
    for (let v = -224; v <= 224; v += 32) {
      const lamp = makeStreetlight(shared);
      lamp.position.set(r + 6, 0, v);
      lamp.rotation.y = Math.PI;
      group.add(lamp);
      const lamp2 = makeStreetlight(shared);
      lamp2.position.set(v, 0, r - 6);
      lamp2.rotation.y = Math.PI / 2;
      group.add(lamp2);
    }
  }

  // Street props: benches, hydrants and bins along the sidewalks.
  for (let i = 0; i < 16; i++) {
    const bench = makeBench(shared, pick(rng, LAYOUT.roads) + 7, range(rng, -200, 200), pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    group.add(bench);
  }
  for (let i = 0; i < 10; i++) {
    group.add(makeHydrant(shared, pick(rng, LAYOUT.roads) + 7, range(rng, -200, 200)));
  }
  for (let i = 0; i < 10; i++) {
    group.add(makeBin(shared, pick(rng, LAYOUT.roads) - 7, range(rng, -200, 200)));
  }

  // Parked prop cars along the curbs.
  const propColors = [0xd8d8d8, 0x8a8a8a, 0x3a6a8a, 0x7a8a6a, 0xa88a5a];
  for (let i = 0; i < 10; i++) {
    const road = pick(rng, LAYOUT.roads);
    const along = range(rng, -200, 200);
    const side = rng() < 0.5 ? 1 : -1;
    const car = makePropCar(shared, road + side * 7.5, along, side > 0 ? 0 : Math.PI, pick(rng, propColors));
    group.add(car);
    colliders.push({ minX: road + side * 7.5 - 2.2, maxX: road + side * 7.5 + 2.2, minZ: along - 1.1, maxZ: along + 1.1, height: 1.6 });
  }

  // Plaza fountain, park trees, harbour containers.
  group.add(makeFountain(shared));
  colliders.push({ minX: -9, maxX: 9, minZ: -9, maxZ: 9, height: 3.2 });
  for (const [px, pz, pw, pd] of LAYOUT.parks) {
    for (let i = 0; i < 6; i++) {
      const tree = makeTree(shared, rng);
      tree.position.set(px + 6 + rng() * (pw - 12), 0, pz + 6 + rng() * (pd - 12));
      group.add(tree);
    }
  }
  const containerColors = [0xc25a3a, 0x3a7a5a, 0x3a5a8a, 0xd8a03a];
  for (let i = 0; i < 6; i++) {
    const cont = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color: containerColors[i % containerColors.length], roughness: 0.7, metalness: 0.3 }));
    cont.scale.set(6, 2.6, 2.6);
    cont.position.set(-200 + (i % 3) * 8, 1.3 + Math.floor(i / 3) * 2.7, -40 + (i % 2) * 14);
    cont.castShadow = true;
    group.add(cont);
    colliders.push({ minX: cont.position.x - 3, maxX: cont.position.x + 3, minZ: cont.position.z - 1.3, maxZ: cont.position.z + 1.3, height: 2.6 });
  }

  // Beach props: umbrellas and a lifeguard stand.
  const umbrellaColors = [0xc94f5e, 0x3a7a8a, 0xd8a03a, 0x7a5ac9, 0x4a9a5a];
  for (let i = 0; i < 5; i++) {
    const ux = 212 + i * 5;
    const uz = -80 + i * 42;
    const pole = new THREE.Mesh(shared.cyl, shared.pole);
    pole.scale.set(0.07, 2.6, 0.07);
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const top = new THREE.Mesh(shared.cone, new THREE.MeshStandardMaterial({ color: umbrellaColors[i % umbrellaColors.length], roughness: 0.8 }));
    top.scale.set(2.2, 0.9, 2.2);
    top.position.set(ux, 2.9, uz);
    top.castShadow = true;
    group.add(top);
  }
  const stand = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(shared.box, shared.benchWood);
    leg.scale.set(0.14, 3.4, 0.14);
    leg.position.set(sx, 1.7, sz);
    stand.add(leg);
  }
  const cab = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8 }));
  cab.scale.set(2.6, 1.6, 2.2);
  cab.position.y = 4.0;
  cab.castShadow = true;
  stand.add(cab);
  const standRoof = new THREE.Mesh(shared.box, new THREE.MeshStandardMaterial({ color: 0xc94f5e, roughness: 0.8 }));
  standRoof.scale.set(3.0, 0.18, 2.6);
  standRoof.position.y = 4.9;
  stand.add(standRoof);
  stand.position.set(224, 0, 24);
  group.add(stand);
  colliders.push({ minX: 222.6, maxX: 225.4, minZ: 22.6, maxZ: 25.4, height: 5 });

  return { group, colliders, sea: seaTex, layout: LAYOUT, buildingCount };
}
