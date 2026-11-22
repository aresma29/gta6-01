// VICE BAY 3D — city details: rooftop props, named signage, billboards,
// traffic lights, street props, beach details and extra palms. All geometry
// is procedural; no external assets. Written fresh for Stage 2 (visual
// upgrade ordered by the owner). Builds on the city data (buildings, roads).
import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng } from './util.js';

// A canvas texture with a text label (for signs and billboards).
function textTexture(text, { w = 512, h = 128, bg = '#14181e', fg = '#ffd60a', sub = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg;
  g.font = `900 ${sub ? 64 : 72}px system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, sub ? h / 2 - 16 : h / 2);
  if (sub) {
    g.font = '700 34px system-ui, sans-serif';
    g.fillStyle = '#f2f4f8';
    g.fillText(sub, w / 2, h / 2 + 36);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function box(w, h, d, colour, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colour, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 })
  );
  m.castShadow = true;
  return m;
}

export function buildCityDetails(scene, city) {
  const rng = makeRng(777);
  const group = new THREE.Group();
  const updaters = [];

  // --- Rooftop props: AC units, antennas, water towers (on building roofs) ---
  const acSpots = [];
  const antSpots = [];
  const towerSpots = [];
  for (const b of city.buildings) {
    if (b.name) continue; // landmarks get signage instead
    const n = b.h > 26 ? 3 : b.h > 14 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      acSpots.push({ x: b.x + rng.range(-b.w / 4, b.w / 4), y: b.h + 0.4, z: b.z + rng.range(-b.d / 4, b.d / 4) });
    }
    if (rng.chance(0.45)) antSpots.push({ x: b.x + rng.range(-b.w / 4, b.w / 4), y: b.h, z: b.z + rng.range(-b.d / 4, b.d / 4) });
    if (b.h > 26 && rng.chance(0.5)) towerSpots.push({ x: b.x + rng.range(-b.w / 4, b.w / 4), y: b.h, z: b.z + rng.range(-b.d / 4, b.d / 4) });
  }
  const acGeo = new THREE.BoxGeometry(1.6, 0.8, 1.2);
  const acMesh = new THREE.InstancedMesh(acGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.7, metalness: 0.3 }), Math.max(acSpots.length, 1));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  acSpots.forEach((a, i) => {
    p3.set(a.x, a.y, a.z); s3.set(1, 1, 1); q.identity();
    m4.compose(p3, q, s3); acMesh.setMatrixAt(i, m4);
  });
  acMesh.castShadow = true;
  group.add(acMesh);
  const antGeo = new THREE.CylinderGeometry(0.06, 0.1, 5, 6);
  antGeo.translate(0, 2.5, 0);
  const antMesh = new THREE.InstancedMesh(antGeo, new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.6, metalness: 0.5 }), Math.max(antSpots.length, 1));
  antSpots.forEach((a, i) => {
    p3.set(a.x, a.y, a.z); s3.set(1, 1, 1); q.identity();
    m4.compose(p3, q, s3); antMesh.setMatrixAt(i, m4);
  });
  group.add(antMesh);
  for (const t of towerSpots) {
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 2.6, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a6a5a, roughness: 0.8 })
    );
    tank.position.set(t.x, t.y + 2.2, t.z);
    tank.castShadow = true;
    group.add(tank);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 1.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8 })
    );
    roof.position.set(t.x, t.y + 4.1, t.z);
    group.add(roof);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.14, 1.4, 0.14, 0x5a4a3a);
      leg.position.set(t.x + lx * 1.1, t.y + 0.7, t.z + lz * 1.1);
      group.add(leg);
    }
  }

  // --- Named signage on the landmark buildings (south face, near the top) ---
  const SIGNS = [
    { name: 'hospital', label: 'HOSPITAL', sub: 'VICE BAY GENERAL', bg: '#1e3a2a', fg: '#7ee787' },
    { name: 'bank', label: 'BANK', sub: 'CORAL NATIONAL', bg: '#3a2a10', fg: '#ffd60a' },
    { name: 'garage', label: 'GARAGE', sub: 'RICO\'S — 24H', bg: '#22262e', fg: '#7ec8ff' },
    { name: 'safehouse', label: 'SAFEHOUSE', sub: 'PALM COURT', bg: '#2a2018', fg: '#ffb060' },
    { name: 'market', label: 'MARKET', sub: 'CORAL ROW', bg: '#2a1e10', fg: '#ffd60a' },
    { name: 'harbour', label: 'HARBOUR', sub: 'DOCKS 1–9', bg: '#10202a', fg: '#7ec8ff' },
  ];
  for (const sg of SIGNS) {
    const b = city.landmarks[sg.name];
    if (!b) continue;
    const tex = textTexture(sg.label, { bg: sg.bg, fg: sg.fg, sub: sg.sub });
    const w = sg.label.length * 1.1 + 6;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.25),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6 })
    );
    // Landmarks store x/z and (for buildings) w/d/h; fall back to a default size.
    const bw = b.w || 26, bh = b.h || 14;
    sign.position.set(b.x, Math.max(bh - 3, 6), b.z + (b.d || 24) / 2 + 0.15);
    sign.castShadow = false;
    group.add(sign);
  }

  // --- Billboards (downtown, on tall poles) ---
  const BOARDS = [
    { x: -62, z: -62, label: 'VICE BAY', sub: 'SUNSET STRAND · 18:42', bg: '#1a1030', fg: '#ffd60a' },
    { x: 62, z: 62, label: 'SUNSET GT', sub: 'DRIVE IT — CORAL MOTORS', bg: '#2a0e0e', fg: '#ff8a80' },
    { x: -62, z: 62, label: 'VICE FM 98.5', sub: 'SUNSET DRIVE — ALL NIGHT', bg: '#0e1a2a', fg: '#7ec8ff' },
    { x: 62, z: -62, label: 'CORAL COLA', sub: 'TASTE THE BAY', bg: '#2a1a10', fg: '#7ee787' },
  ];
  for (const bd of BOARDS) {
    const pole = box(0.5, 9, 0.5, 0x2a2d33, { metal: 0.4 });
    pole.position.set(bd.x, 4.5, bd.z);
    group.add(pole);
    const tex = textTexture(bd.label, { bg: bd.bg, fg: bd.fg, sub: bd.sub });
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 3.25),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.6 })
    );
    board.position.set(bd.x, 10.4, bd.z);
    board.rotation.y = Math.PI / 4;
    group.add(board);
    const back = box(13.2, 3.4, 0.2, 0x1a1d22);
    back.position.set(bd.x, 10.4, bd.z);
    back.rotation.y = Math.PI / 4;
    back.position.z -= 0.12;
    group.add(back);
  }

  // --- Traffic lights at 4 major intersections (cycle green/yellow/red) ---
  const lights = [];
  for (const [ix, iz] of [[0, 0], [56, 0], [0, 56], [-56, 0]]) {
    const pole = box(0.28, 6.4, 0.28, 0x2a2d33, { metal: 0.4 });
    pole.position.set(ix + 7.2, 3.2, iz + 7.2);
    group.add(pole);
    const arm = box(3.4, 0.24, 0.24, 0x2a2d33, { metal: 0.4 });
    arm.position.set(ix + 5.6, 6.2, iz + 7.2);
    group.add(arm);
    const head = box(0.5, 1.5, 0.5, 0x14161a);
    head.position.set(ix + 4.0, 5.9, iz + 7.2);
    group.add(head);
    const mk = (colour) => {
      const mm = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: 0.15 })
      );
      return mm;
    };
    const red = mk(0xff2020); red.position.set(ix + 4.0, 6.35, iz + 7.2 + 0.26);
    const yel = mk(0xffc020); yel.position.set(ix + 4.0, 5.9, iz + 7.2 + 0.26);
    const grn = mk(0x20e060); grn.position.set(ix + 4.0, 5.45, iz + 7.2 + 0.26);
    group.add(red); group.add(yel); group.add(grn);
    lights.push({ red, yel, grn, phase: rng.next() * 9 });
  }
  updaters.push((dt) => {
    for (const L of lights) {
      L.phase = (L.phase + dt) % 9;
      const on = L.phase < 4 ? 'grn' : L.phase < 5 ? 'yel' : 'red';
      L.red.material.emissiveIntensity = on === 'red' ? 2.2 : 0.12;
      L.yel.material.emissiveIntensity = on === 'yel' ? 2.2 : 0.12;
      L.grn.material.emissiveIntensity = on === 'grn' ? 2.2 : 0.12;
    }
  });

  // --- Street props: benches, hydrants, bins (plaza + downtown sidewalks) ---
  const propSpots = [];
  for (let i = 0; i < 8; i++) propSpots.push({ x: -20 + i * 6, z: 12, kind: 'bench' });
  for (let i = 0; i < 6; i++) propSpots.push({ x: 12, z: -20 + i * 8, kind: 'bench' });
  for (let i = 0; i < 8; i++) propSpots.push({ x: rng.range(-160, 160), z: rng.range(-160, 160), kind: 'hydrant' });
  for (let i = 0; i < 10; i++) propSpots.push({ x: rng.range(-160, 160), z: rng.range(-160, 160), kind: 'bin' });
  for (const p of propSpots) {
    // Keep props on sidewalks (off the road centre lines).
    if (Math.abs(p.x % 56) < 8 || Math.abs(p.z % 56) < 8) continue;
    if (p.kind === 'bench') {
      const seat = box(2.2, 0.12, 0.6, 0x7a5a3a);
      seat.position.set(p.x, 0.5, p.z);
      group.add(seat);
      const back = box(2.2, 0.7, 0.1, 0x7a5a3a);
      back.position.set(p.x, 0.85, p.z - 0.28);
      group.add(back);
    } else if (p.kind === 'hydrant') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8),
        new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.5 })
      );
      body.position.set(p.x, 0.35, p.z);
      body.castShadow = true;
      group.add(body);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xd43a2f, roughness: 0.5 })
      );
      cap.position.set(p.x, 0.75, p.z);
      group.add(cap);
    } else {
      const bin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.28, 0.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.8 })
      );
      bin.position.set(p.x, 0.4, p.z);
      bin.castShadow = true;
      group.add(bin);
    }
  }

  // --- Beach: umbrellas + a lifeguard stand ---
  const umbrellaCols = [0xff6b35, 0x2a9a9a, 0xffd60a, 0x7a4a8a, 0xe5484d];
  for (let i = 0; i < 6; i++) {
    const ux = -150 + i * 58 + rng.range(-8, 8);
    const uz = 194 + rng.range(-3, 4);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.8 })
    );
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: umbrellaCols[i % umbrellaCols.length], roughness: 0.85 })
    );
    top.position.set(ux, 2.9, uz);
    top.castShadow = true;
    group.add(top);
  }
  // Lifeguard stand (tall frame + seat + roof) near the water.
  const lgX = 40, lgZ = 200;
  for (const [lx, lz] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) {
    const leg = box(0.16, 3.4, 0.16, 0xf2f4f8, { rough: 0.7 });
    leg.position.set(lgX + lx, 1.7, lgZ + lz);
    group.add(leg);
  }
  const lgSeat = box(2.6, 0.18, 2.2, 0xf2f4f8, { rough: 0.7 });
  lgSeat.position.set(lgX, 3.4, lgZ);
  group.add(lgSeat);
  const lgRoof = box(3.0, 0.14, 2.6, 0xd43a2f, { rough: 0.7 });
  lgRoof.position.set(lgX, 4.6, lgZ);
  group.add(lgRoof);
  const lgSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.6),
    new THREE.MeshStandardMaterial({ map: textTexture('LIFEGUARD', { w: 256, h: 64, bg: '#d43a2f', fg: '#ffffff' }), emissive: 0xffffff, emissiveMap: textTexture('LIFEGUARD', { w: 256, h: 64, bg: '#d43a2f', fg: '#ffffff' }), emissiveIntensity: 0.4 })
  );
  lgSign.position.set(lgX, 4.1, lgZ + 1.32);
  group.add(lgSign);

  // --- Extra palms (beach row + downtown) ---
  const palmSpots = [];
  for (let i = 0; i < 16; i++) palmSpots.push({ x: -220 + i * 28 + rng.range(-5, 5), z: 184 + rng.range(-2, 3), s: 1.4 });
  for (let i = 0; i < 8; i++) palmSpots.push({ x: rng.range(-160, 160), z: rng.range(-160, 160), s: 1.1 });
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6);
  trunkGeo.translate(0, 1.2, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }), palmSpots.length);
  const palmGeo = new THREE.SphereGeometry(2.0, 8, 6);
  palmGeo.scale(1, 0.45, 1); palmGeo.translate(0, 5.2, 0);
  const palmMesh = new THREE.InstancedMesh(palmGeo, new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 1 }), palmSpots.length);
  palmSpots.forEach((t, i) => {
    p3.set(t.x, 0, t.z); s3.set(t.s, t.s, t.s); q.identity();
    m4.compose(p3, q, s3); trunkMesh.setMatrixAt(i, m4);
    m4.compose(p3, q, s3); palmMesh.setMatrixAt(i, m4);
  });
  trunkMesh.castShadow = true; palmMesh.castShadow = true;
  group.add(trunkMesh); group.add(palmMesh);

  scene.add(group);
  return {
    group,
    update(dt) { for (const u of updaters) u(dt); },
  };
}
