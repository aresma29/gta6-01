// VICE BAY 3D — procedural actors: humanoids and cars. All geometry is
// boxes / spheres / cylinders with flat colours; no external assets.
// Forward is local +Z; set group.rotation.y = heading so forward becomes
// (sin(heading), 0, cos(heading)) in the world. Written fresh for the 3D build.
import * as THREE from '../vendor/three/three.module.min.js';

function box(w, h, d, colour, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colour, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 })
  );
  m.castShadow = true;
  return m;
}

// A humanoid standing on the ground (feet at y=0). Parts are groups pivoted
// at the shoulder / hip so walk / punch animation is a rotation.
export function makeHumanoid({ shirt = 0xc0392b, pants = 0x2c3e50, skin = 0xc9976b, scale = 1, hat = false, police = false } = {}) {
  const g = new THREE.Group();
  const parts = {};

  const legL = new THREE.Group(); legL.position.set(-0.12, 0.78, 0);
  const legLMesh = box(0.17, 0.78, 0.2, pants); legLMesh.position.y = -0.39; legL.add(legLMesh);
  const legR = new THREE.Group(); legR.position.set(0.12, 0.78, 0);
  const legRMesh = box(0.17, 0.78, 0.2, pants); legRMesh.position.y = -0.39; legR.add(legRMesh);
  const torso = box(0.58, 0.68, 0.34, police ? 0x1e2a4a : shirt); torso.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  head.position.y = 1.68; head.castShadow = true;
  const armL = new THREE.Group(); armL.position.set(-0.37, 1.42, 0);
  const armLMesh = box(0.15, 0.66, 0.18, police ? 0x1e2a4a : shirt); armLMesh.position.y = -0.32; armL.add(armLMesh);
  const armR = new THREE.Group(); armR.position.set(0.37, 1.42, 0);
  const armRMesh = box(0.15, 0.66, 0.18, police ? 0x1e2a4a : shirt); armRMesh.position.y = -0.32; armR.add(armRMesh);

  g.add(legL, legR, torso, head, armL, armR);
  if (hat) {
    const cap = box(0.5, 0.08, 0.5, 0x1e2a4a); cap.position.y = 1.9; g.add(cap);
    const brim = box(0.5, 0.05, 0.2, 0x1e2a4a); brim.position.set(0, 1.86, 0.28); g.add(brim);
  }
  if (police) {
    const badge = box(0.1, 0.1, 0.02, 0xffd60a, { emissive: 0x664400, ei: 0.5 });
    badge.position.set(-0.15, 1.28, 0.18); g.add(badge);
  }
  g.scale.setScalar(scale);
  parts.legL = legL; parts.legR = legR; parts.armL = armL; parts.armR = armR;
  parts.torso = torso; parts.head = head;
  return { group: g, parts };
}

// Pose a humanoid. phase advances with movement; amp 0 = idle, ~0.6 walk,
// ~0.95 run. punchT 0..1 while a punch is playing (right arm extends).
export function poseHumanoid(h, phase, amp, punchT, lean = 0) {
  const s = Math.sin(phase), c = Math.cos(phase);
  h.parts.legL.rotation.x = s * amp;
  h.parts.legR.rotation.x = -s * amp;
  h.parts.armL.rotation.x = -s * amp * 0.8;
  h.parts.armR.rotation.x = s * amp * 0.8;
  if (punchT > 0) {
    const p = Math.sin(punchT * Math.PI);
    h.parts.armR.rotation.x = -1.6 * p;
    h.parts.armR.rotation.z = -0.2 * p;
  }
  h.parts.torso.rotation.x = lean;
  h.group.position.y = Math.abs(c) * 0.05 * amp;
}

export const CAR_TYPES = {
  sedan:   { L: 4.2, W: 1.9, bodyH: 0.72, cabH: 0.55, maxSpeed: 26, accel: 14, colour: 0xb03030 },
  sports:  { L: 4.0, W: 2.0, bodyH: 0.55, cabH: 0.45, maxSpeed: 34, accel: 18, colour: 0xd43a2f },
  taxi:    { L: 4.2, W: 1.9, bodyH: 0.72, cabH: 0.55, maxSpeed: 26, accel: 14, colour: 0xf0c020 },
  truck:   { L: 6.2, W: 2.3, bodyH: 1.0, cabH: 0.0, maxSpeed: 20, accel: 10, colour: 0x5a6a7a },
  van:     { L: 4.9, W: 2.1, bodyH: 1.5, cabH: 0.0, maxSpeed: 22, accel: 11, colour: 0x8d929c },
  police:  { L: 4.2, W: 1.95, bodyH: 0.72, cabH: 0.55, maxSpeed: 32, accel: 16, colour: 0xe8e8e8 },
  armoured:{ L: 5.0, W: 2.2, bodyH: 1.7, cabH: 0.0, maxSpeed: 22, accel: 11, colour: 0x6a7076 },
};

export function makeCar(type = 'sedan', colour = null) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const c = colour ?? spec.colour;
  const g = new THREE.Group();
  const L = spec.L, W = spec.W, bodyH = spec.bodyH;
  // Build the car with length along Z (front at +Z).
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, bodyH, L),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.45 })
  );
  body.castShadow = true;
  body.position.y = 0.35 + bodyH / 2;
  g.add(body);
  if (spec.cabH > 0) {
    const cab = box(W * 0.82, spec.cabH, L * 0.48, 0x1a2028, { rough: 0.2, metal: 0.3 });
    cab.position.set(0, 0.35 + bodyH + spec.cabH / 2 - 0.05, -L * 0.04);
    g.add(cab);
  } else if (type === 'truck') {
    const cab = box(W * 0.92, 1.0, L * 0.22, c, { rough: 0.4, metal: 0.3 });
    cab.position.set(0, 0.35 + 1.0, L * 0.36);
    g.add(cab);
    const cargo = box(W * 0.95, 1.5, L * 0.55, 0x7a7f88, { rough: 0.7 });
    cargo.position.set(0, 0.35 + 0.75, -L * 0.2);
    g.add(cargo);
  }
  // Headlights / taillights.
  const hl = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.2 });
  const tl = new THREE.MeshStandardMaterial({ color: 0xaa2020, emissive: 0xaa2020, emissiveIntensity: 0.9 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), hl);
    h.position.set(sx * W * 0.32, 0.62, L / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tl);
    t.position.set(sx * W * 0.32, 0.62, -L / 2 - 0.02); g.add(t);
  }
  // Police light bar.
  let lightBar = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const bar = box(0.3, 0.14, 1.1, 0x222222); bar.position.y = 0; lightBar.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.position.set(0, 0, 0.3); lightBar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.position.set(0, 0, -0.3); lightBar.add(blue);
    lightBar.position.set(0, 0.35 + bodyH + (spec.cabH || 0) + 0.08, -L * 0.04);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    // Black doors (a thin dark box on each side) for the police look.
    const door = box(0.04, 0.5, L * 0.5, 0x1e2a4a); door.position.set(W / 2 + 0.01, 0.7, 0); g.add(door);
    const door2 = door.clone(); door2.position.x = -W / 2 - 0.01; g.add(door2);
  }
  // Wheels (axle along X). Front wheels steer: each front wheel sits in a pivot group.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.9 });
  const wheels = [];
  const pivots = [];
  for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 - 0.05), 0.36, sz * L * 0.32);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    pivot.add(wheel);
    g.add(pivot);
    wheels.push(wheel);
    pivots.push({ pivot, front });
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return {
    group: g, wheels, pivots, lightBar,
    spec: { ...spec },
    L, W,
    radius: Math.max(L, W) * 0.5,
  };
}
