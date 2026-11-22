// VICE BAY — procedural dusk coastal city (480x480 m, seeded).
// Written fresh for the rebuild. Roads on a 7x7 grid, five districts,
// six named landmarks, neon, billboards, beach + sea, palms, props.
import * as THREE from 'three';
import { mulberry32, pick, rand, randInt } from './util.js';
import {
  facadeTexture,
  signTexture,
  neonTowerTexture,
  billboardTexture,
  groundTexture,
  seaTexture,
  skyTexture,
} from './textures.js';

export const WORLD = 480;
export const HALF = 240;
export const ROADS = [-192, -128, -64, 0, 64, 128, 192];

const DISTRICT_COLORS = {
  downtown: ['#5a4a6e', '#6e5468', '#4a5a78', '#7a5a4a', '#5e6e5a'],
  harbour: ['#5e5a52', '#6b5a48', '#4e5e66'],
  market: ['#7a5a3a', '#6e4a5a', '#5a6e4a'],
  beach: ['#c9a06a', '#d9b380', '#b98a5a'],
  hills: ['#6e7a5a', '#7a6e5a', '#5a6e6e'],
};

function districtAt(x, z) {
  if (Math.abs(x) < 128 && Math.abs(z) < 128) return 'downtown';
  if (x < -128) return 'harbour';
  if (x > 128) return 'market';
  if (z > 128) return 'beach';
  return 'hills';
}

function makeBox(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.05,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = opts.shadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}

/** A simple prop car (not drivable in Stage 1): body, cabin, wheels. */
function makePropCar(color) {
  const g = new THREE.Group();
  const body = makeBox(4.2, 0.85, 1.9, color, { roughness: 0.35, metalness: 0.5 });
  body.position.y = 0.62;
  g.add(body);
  const cabin = makeBox(2.2, 0.7, 1.7, '#1a2233', { roughness: 0.2, metalness: 0.6 });
  cabin.position.set(-0.2, 1.35, 0);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 1 });
  for (const [wx, wz] of [[1.35, 0.85], [1.35, -0.85], [-1.35, 0.85], [-1.35, -0.85]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.34, wz);
    g.add(wheel);
  }
  return g;
}

/** A palm tree: curved trunk + a crown of fronds. */
function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#7a5a38', roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 5.2, 7), trunkMat);
  trunk.position.y = 2.6;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  trunk.castShadow = true;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: '#2e7a3a', roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), frondMat);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 5.3, Math.sin(a) * 1.1);
    frond.rotation.set(0, -a, 0.5);
    frond.rotation.y = -a + Math.PI / 2;
    frond.rotation.x = -0.5;
    frond.castShadow = true;
    g.add(frond);
  }
  return g;
}

/** A streetlight: pole + arm + a warm glowing lamp head. */
function makeStreetlight() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.12, 6, 6),
    new THREE.MeshStandardMaterial({ color: '#2a2a30', roughness: 0.6, metalness: 0.6 })
  );
  pole.position.y = 3;
  pole.castShadow = true;
  g.add(pole);
  const arm = makeBox(1.4, 0.1, 0.1, '#2a2a30', { shadow: false });
  arm.position.set(0.7, 5.9, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.28),
    new THREE.MeshBasicMaterial({ color: '#ffd9a0' })
  );
  lamp.position.set(1.35, 5.85, 0);
  g.add(lamp);
  return g;
}

/**
 * Build the city into the scene.
 * Returns the colliders, counts and the animated sea texture.
 */
export function buildCity(scene) {
  const rng = mulberry32(1);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- ground (roads, blocks, plaza, beach) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- sea (south, beyond the beach) + animated texture ---
  const seaTex = seaTexture();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 130),
    new THREE.MeshStandardMaterial({
      map: seaTex,
      color: '#2fa8b8',
      emissive: '#0a4a55',
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.1,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.15, 272);
  sea.receiveShadow = true;
  group.add(sea);

  // --- sky dome ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false })
  );
  group.add(sky);

  // --- buildings: one or two per block (36 blocks, plaza kept open) ---
  const facadeCache = new Map();
  const getFacade = (color, lit) => {
    const key = color + '|' + lit;
    if (!facadeCache.has(key)) facadeCache.set(key, facadeTexture(color, lit, mulberry32(key.length * 7919 + 13)));
    return facadeCache.get(key);
  };
  let buildingCount = 0;
  const blockCentres = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      blockCentres.push({ x: -160 + i * 64, z: -160 + j * 64 });
    }
  }
  for (const block of blockCentres) {
    if (block.x === 0 && block.z === 0) continue; // the plaza stays open
    const district = districtAt(block.x, block.z);
    const palette = DISTRICT_COLORS[district];
    const perBlock = district === 'downtown' ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.45 ? 2 : 1);
    for (let k = 0; k < perBlock; k++) {
      const ox = perBlock === 2 ? (k === 0 ? -13 : 13) : 0;
      const oz = perBlock === 2 ? (k === 0 ? -13 : 13) : 0;
      const bx = block.x + ox + rand(rng, -3, 3);
      const bz = block.z + oz + rand(rng, -3, 3);
      let w;
      let d;
      let h;
      if (district === 'downtown') {
        w = rand(rng, 16, 24);
        d = rand(rng, 16, 24);
        h = rand(rng, 26, 58);
      } else if (district === 'harbour') {
        w = rand(rng, 22, 30);
        d = rand(rng, 16, 22);
        h = rand(rng, 8, 14);
      } else if (district === 'beach') {
        w = rand(rng, 12, 18);
        d = rand(rng, 12, 18);
        h = rand(rng, 8, 16);
      } else {
        w = rand(rng, 14, 20);
        d = rand(rng, 14, 20);
        h = rand(rng, 9, 20);
      }
      const color = pick(rng, palette);
      const lit = district === 'downtown' ? 0.55 : 0.42;
      const mat = new THREE.MeshStandardMaterial({ map: getFacade(color, lit), roughness: 0.9 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(bx, h / 2, bz);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      // Roof cap + a rooftop prop on taller buildings.
      const cap = makeBox(w + 0.6, 0.7, d + 0.6, '#1c1c22', { shadow: false });
      cap.position.set(bx, h + 0.35, bz);
      group.add(cap);
      if (h > 24 && rng() < 0.7) {
        const prop = pick(rng, ['ac', 'antenna', 'tank']);
        if (prop === 'ac') {
          const ac = makeBox(2.2, 1.1, 1.6, '#3a3a42', { shadow: false });
          ac.position.set(bx + rand(rng, -4, 4), h + 1.2, bz + rand(rng, -4, 4));
          group.add(ac);
        } else if (prop === 'antenna') {
          const ant = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.12, 6, 5),
            new THREE.MeshStandardMaterial({ color: '#333338', roughness: 0.6, metalness: 0.7 })
          );
          ant.position.set(bx, h + 3.4, bz);
          group.add(ant);
        } else {
          const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(1.6, 1.6, 2.4, 10),
            new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: 0.8 })
          );
          tank.position.set(bx + rand(rng, -4, 4), h + 1.9, bz + rand(rng, -4, 4));
          tank.castShadow = true;
          group.add(tank);
        }
      }
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      buildingCount++;
    }
  }

  // --- landmarks: 6 named buildings with illuminated signs ---
  const signMat = (label, fg, bg) =>
    new THREE.MeshBasicMaterial({ map: signTexture(label, fg, bg) });
  const landmarks = [
    { label: 'HOSPITAL', x: -32, z: -96, fg: '#ffffff', bg: '#8a1a1a', cross: true },
    { label: 'BANK', x: 32, z: -32, fg: '#ffd76a', bg: '#1a2a4a' },
    { label: 'GARAGE', x: -96, z: 32, fg: '#7ae0ff', bg: '#12303a' },
    { label: 'SAFEHOUSE', x: 96, z: -96, fg: '#b8ff9a', bg: '#1a3a1a' },
    { label: 'MARKET', x: 160, z: 32, fg: '#ffb35a', bg: '#3a2410' },
    { label: 'HARBOUR', x: -160, z: -32, fg: '#9ad0ff', bg: '#10283a' },
  ];
  for (const lm of landmarks) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), signMat(lm.label, lm.fg, lm.bg));
    // Face the nearest road: signs on the south face of the landmark block.
    sign.position.set(lm.x, 10, lm.z + 12);
    group.add(sign);
    if (lm.cross) {
      const crossMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
      const cV = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 0.4), crossMat);
      cV.position.set(lm.x, 14.5, lm.z + 12);
      const cH = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 0.4), crossMat);
      cH.position.set(lm.x, 14.5, lm.z + 12);
      group.add(cV, cH);
    }
  }

  // --- vertical VICEBAY neon tower sign (on the tallest downtown tower) ---
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 18),
    new THREE.MeshBasicMaterial({ map: neonTowerTexture() })
  );
  neon.position.set(32, 30, -20);
  group.add(neon);

  // --- 4 billboards ---
  const boards = [
    { title: 'VICE BAY', sub: 'SUNSET STRIP', top: '#ff5fa2', bottom: '#3a1052', x: -64, z: 96, ry: 0 },
    { title: 'SUNSET GT', sub: 'DRIVE THE NIGHT', top: '#ff8a3d', bottom: '#5a1a3a', x: 96, z: 160, ry: Math.PI },
    { title: 'VICE FM 98.5', sub: 'SUNSET DRIVE', top: '#3d8aff', bottom: '#1a1052', x: 160, z: -160, ry: -Math.PI / 2 },
    { title: 'CORAL COLA', sub: 'TASTE THE COAST', top: '#3dd0c0', bottom: '#0a3a52', x: -160, z: 160, ry: Math.PI / 2 },
  ];
  for (const bd of boards) {
    const tex = billboardTexture(bd.title, bd.sub, bd.top, bd.bottom);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    board.position.set(bd.x, 9, bd.z);
    board.rotation.y = bd.ry;
    group.add(board);
    const post = makeBox(0.5, 6, 0.5, '#222228', { shadow: false });
    post.position.set(bd.x, 3, bd.z);
    group.add(post);
  }

  // --- plaza fountain (centre) ---
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7.6, 1.1, 24),
    new THREE.MeshStandardMaterial({ color: '#8a8a96', roughness: 0.7 })
  );
  basin.position.set(0, 0.55, 0);
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(6.4, 6.4, 0.3, 24),
    new THREE.MeshStandardMaterial({ color: '#2fa8c8', emissive: '#0a4a66', emissiveIntensity: 0.6, roughness: 0.2 })
  );
  water.position.set(0, 1.0, 0);
  group.add(water);
  const spout = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 12, 10),
    new THREE.MeshStandardMaterial({ color: '#3aa8d8', emissive: '#0a5a7a', emissiveIntensity: 0.5, roughness: 0.25 })
  );
  spout.position.set(0, 2.2, 0);
  spout.castShadow = true;
  group.add(spout);
  colliders.push({ minX: -7.6, maxX: 7.6, minZ: -7.6, maxZ: 7.6 });

  // --- palms (~40): beach, sidewalks, plaza edges ---
  let palmCount = 0;
  const palmSpots = [];
  for (let i = 0; i < 18; i++) palmSpots.push({ x: rand(rng, -220, 220), z: rand(rng, 190, 232) });
  for (let i = 0; i < 14; i++) palmSpots.push({ x: pick(rng, ROADS) + rand(rng, -8, 8), z: rand(rng, -200, 180) });
  for (let i = 0; i < 8; i++) palmSpots.push({ x: rand(rng, -40, 40), z: rand(rng, -40, 40) });
  for (const p of palmSpots) {
    if (Math.abs(p.x) < 12 && Math.abs(p.z) < 12) continue; // keep the fountain clear
    const palm = makePalm(rng);
    palm.position.set(p.x, 0, p.z);
    group.add(palm);
    palmCount++;
  }

  // --- streetlights along every road ---
  for (const r of ROADS) {
    for (let d = -200; d <= 200; d += 64) {
      const sl = makeStreetlight();
      sl.position.set(r + 7, 0, d);
      sl.rotation.y = -Math.PI / 2;
      group.add(sl);
      const sl2 = makeStreetlight();
      sl2.position.set(d, 0, r - 7);
      group.add(sl2);
    }
  }

  // --- harbour containers (west) ---
  const containerColors = ['#b3541e', '#1e6db3', '#3a8a3a', '#b3a11e'];
  for (let i = 0; i < 10; i++) {
    const c = makeBox(6, 2.6, 2.6, pick(rng, containerColors), { roughness: 0.85 });
    const cx = rand(rng, -220, -150);
    const cz = rand(rng, -120, 40);
    c.position.set(cx, 1.3 + (i % 3 === 2 ? 2.6 : 0), cz);
    c.rotation.y = (rng() < 0.5 ? 0 : Math.PI / 2);
    group.add(c);
    if (i % 3 !== 2) colliders.push({ minX: cx - 3, maxX: cx + 3, minZ: cz - 1.3, maxZ: cz + 1.3 });
  }

  // --- beach umbrellas + lifeguard stand ---
  const umbrellaColors = ['#e84a5a', '#f2a541', '#4a90e8', '#7ac74f', '#b45ae8'];
  for (let i = 0; i < 5; i++) {
    const ux = -80 + i * 40 + rand(rng, -6, 6);
    const uz = 196 + rand(rng, -3, 3);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.9 })
    );
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaColors[i], roughness: 0.9, side: THREE.DoubleSide })
    );
    canopy.position.set(ux, 3.0, uz);
    canopy.castShadow = true;
    group.add(canopy);
  }
  const stand = new THREE.Group();
  const sLeg1 = makeBox(0.25, 3.4, 0.25, '#e8e0d0', { shadow: false });
  sLeg1.position.set(-0.8, 1.7, 0);
  const sLeg2 = makeBox(0.25, 3.4, 0.25, '#e8e0d0', { shadow: false });
  sLeg2.position.set(0.8, 1.7, 0);
  const sTop = makeBox(2.6, 0.3, 2.2, '#d94a3a', { shadow: false });
  sTop.position.set(0, 3.5, 0);
  const sRoof = makeBox(2.8, 0.15, 2.4, '#f2ede0', { shadow: false });
  sRoof.position.set(0, 4.6, 0);
  stand.add(sLeg1, sLeg2, sTop, sRoof);
  stand.position.set(24, 0, 196);
  group.add(stand);

  // --- street props: benches, hydrants, bins ---
  for (let i = 0; i < 12; i++) {
    const bx = pick(rng, ROADS) + rand(rng, -9, 9);
    const bz = rand(rng, -200, 180);
    const bench = makeBox(2.2, 0.5, 0.7, '#6b4a2a', { shadow: false });
    bench.position.set(bx, 0.45, bz);
    group.add(bench);
  }
  for (let i = 0; i < 10; i++) {
    const hx = pick(rng, ROADS) + rand(rng, -9, 9);
    const hz = rand(rng, -200, 180);
    const hyd = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: '#c22a2a', roughness: 0.7 })
    );
    hyd.position.set(hx, 0.45, hz);
    hyd.castShadow = true;
    group.add(hyd);
  }

  // --- 10 parked prop cars (visual only in Stage 1) ---
  const propColors = ['#c22a2a', '#2a6ac2', '#e8b62a', '#3a8a5a', '#e8e8e8', '#2a2a30'];
  for (let i = 0; i < 10; i++) {
    const car = makePropCar(propColors[i % propColors.length]);
    const road = pick(rng, ROADS);
    const along = rand(rng, -200, 200);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) {
      car.position.set(road + side * 8, 0, along);
      car.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.position.set(along, 0, road + side * 8);
      car.rotation.y = side > 0 ? 0 : Math.PI;
    }
    group.add(car);
  }

  // --- park trees (a few green blobs in blocks) ---
  for (let i = 0; i < 14; i++) {
    const tx = rand(rng, -200, 200);
    const tz = rand(rng, -200, 170);
    if (Math.abs(tx) < 14 && Math.abs(tz) < 14) continue;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 1 })
    );
    trunk.position.set(tx, 1.1, tz);
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(rand(rng, 1.6, 2.6), 8, 6),
      new THREE.MeshStandardMaterial({ color: '#3a7a3a', roughness: 1 })
    );
    crown.position.set(tx, 3.2, tz);
    crown.castShadow = true;
    group.add(crown);
  }

  return {
    group,
    colliders,
    buildingCount,
    palmCount,
    sea,
    seaTex,
    roads: ROADS,
  };
}

/** Which district a world position is in (for the HUD location line). */
export function districtName(x, z) {
  if (z > 185) return 'SUNSET STRAND';
  if (Math.abs(x) < 16 && Math.abs(z) < 16) return 'VICE PLAZA';
  if (Math.abs(x) < 128 && Math.abs(z) < 128) return 'DOWNTOWN';
  if (x < -128) return 'HARBOUR';
  if (x > 128) return 'MARKET';
  if (z > 128) return 'OCEAN DRIVE';
  return 'HILLS';
}
