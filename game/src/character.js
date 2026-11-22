// VICE BAY 3D — improved character model: a proper humanoid with a shaped
// torso, a head with a face, arms ending in HANDS and legs ending in FEET,
// and a more natural walk/run animation (arm swing, leg stride, body lean,
// knee bend, jump tuck). Forward is local +Z; set group.rotation.y = heading
// so forward becomes (sin(heading), 0, cos(heading)) in the world.
// Written fresh for Stage 2 (visual upgrade ordered by the owner).
import * as THREE from '../vendor/three/three.module.min.js';

function box(w, h, d, colour, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colour, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.ei ?? 1 })
  );
  m.castShadow = true;
  return m;
}

// A humanoid standing on the ground (feet at y=0), ~1.85 m tall.
// Legs: thigh + shin (knee pivot) + shoe. Arms: upper arm + forearm
// (elbow pivot) + hand. Torso: hips + chest + shoulder bar + collar.
// Head: sphere + hair cap + eyes on the face (+Z).
export function makeCharacter({ shirt = 0xc0392b, pants = 0x2c3e50, skin = 0xc9976b, scale = 1, hat = false, police = false } = {}) {
  const g = new THREE.Group();
  const parts = {};
  const shirtCol = police ? 0x1e2a4a : shirt;
  const shoeCol = 0x1c1e24;
  const hairCol = 0x241a12;

  // --- Legs (hip pivot at y=0.95) ---
  function makeLeg(side) { // side -1 left, +1 right
    const hip = new THREE.Group();
    hip.position.set(side * 0.13, 0.95, 0);
    const thigh = box(0.2, 0.5, 0.23, pants);
    thigh.position.y = -0.25;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.5;
    hip.add(knee);
    const shin = box(0.17, 0.44, 0.2, pants);
    shin.position.y = -0.22;
    knee.add(shin);
    // Shoe: a flat box at the bottom, jutting forward (+Z).
    const shoe = box(0.19, 0.11, 0.36, shoeCol, { rough: 0.6 });
    shoe.position.set(0, -0.46, 0.07);
    knee.add(shoe);
    g.add(hip);
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // --- Torso: hips + chest + shoulders + collar ---
  const hips = box(0.52, 0.24, 0.32, pants);
  hips.position.y = 1.04;
  g.add(hips);
  const chest = box(0.6, 0.56, 0.36, shirtCol);
  chest.position.y = 1.42;
  g.add(chest);
  // A slightly darker jacket panel on the chest front (a zip line).
  const zip = box(0.06, 0.5, 0.02, 0x000000, { rough: 0.9 });
  zip.material = new THREE.MeshStandardMaterial({ color: 0x2a1a1a, roughness: 0.9 });
  zip.position.set(0, 1.42, 0.19);
  g.add(zip);
  const shoulders = box(0.66, 0.14, 0.38, shirtCol);
  shoulders.position.y = 1.68;
  g.add(shoulders);
  const collar = box(0.3, 0.08, 0.05, shirtCol);
  collar.position.set(0, 1.74, 0.18);
  g.add(collar);

  // --- Head: sphere + hair + eyes (face on +Z) ---
  const head = new THREE.Group();
  head.position.y = 1.86;
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 16, 12),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 })
  );
  skull.castShadow = true;
  head.add(skull);
  // Hair: a flattened dark sphere covering the top and back of the head.
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: hairCol, roughness: 0.95 })
  );
  hair.position.y = 0.02;
  hair.rotation.x = -0.35;
  head.add(hair);
  // Eyes: two small dark boxes on the face.
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.06, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 })
    );
    eye.position.set(sx * 0.085, 0.02, 0.225);
    head.add(eye);
  }
  // Nose: a tiny skin box.
  const nose = box(0.05, 0.09, 0.05, skin);
  nose.position.set(0, -0.05, 0.24);
  head.add(nose);
  g.add(head);

  // --- Arms (shoulder pivot at y=1.62) ---
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.38, 1.62, 0);
    const upper = box(0.17, 0.36, 0.2, shirtCol);
    upper.position.y = -0.18;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    shoulder.add(elbow);
    const fore = box(0.15, 0.32, 0.17, police ? 0x1e2a4a : shirtCol);
    fore.position.y = -0.16;
    elbow.add(fore);
    // Hand: a skin-coloured fist at the end of the forearm.
    const hand = box(0.15, 0.17, 0.17, skin, { rough: 0.7 });
    hand.position.y = -0.38;
    elbow.add(hand);
    g.add(shoulder);
    return { shoulder, elbow };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  if (hat) {
    const cap = box(0.5, 0.08, 0.5, 0x1e2a4a);
    cap.position.y = 2.06;
    g.add(cap);
    const brim = box(0.5, 0.05, 0.22, 0x1e2a4a);
    brim.position.set(0, 2.02, 0.28);
    g.add(brim);
  }
  if (police) {
    const badge = box(0.1, 0.1, 0.02, 0xffd60a, { emissive: 0x664400, ei: 0.5 });
    badge.position.set(-0.16, 1.5, 0.19);
    g.add(badge);
  }

  g.scale.setScalar(scale);
  parts.legL = legL.hip; parts.kneeL = legL.knee;
  parts.legR = legR.hip; parts.kneeR = legR.knee;
  parts.armL = armL.shoulder; parts.elbowL = armL.elbow;
  parts.armR = armR.shoulder; parts.elbowR = armR.elbow;
  parts.torso = chest; parts.head = head;
  return { group: g, parts, bob: 0 };
}

// Pose the character. phase advances with movement; amp 0 = idle, ~0.6 walk,
// ~0.95 run. punchT 0..1 while a punch is playing. lean = forward lean
// (radians). airT 0..1 while airborne (jump tuck). Sets c.bob (vertical bob,
// added to the group y by the caller).
export function poseCharacter(c, phase, amp, punchT, lean = 0, airT = 0) {
  const s = Math.sin(phase);
  const s2 = Math.sin(phase + Math.PI);
  // Legs: thighs swing opposite; knees bend as the leg lifts (phase-shifted).
  c.parts.legL.rotation.x = s * amp * 0.85;
  c.parts.legR.rotation.x = s2 * amp * 0.85;
  c.parts.kneeL.rotation.x = Math.max(0, Math.sin(phase + 0.7)) * amp * 1.05;
  c.parts.kneeR.rotation.x = Math.max(0, Math.sin(phase + Math.PI + 0.7)) * amp * 1.05;
  // Arms: swing opposite to the same-side leg, elbows slightly bent.
  c.parts.armL.rotation.x = s2 * amp * 0.65;
  c.parts.armR.rotation.x = s * amp * 0.65;
  c.parts.elbowL.rotation.x = -0.3 - Math.max(0, s2) * amp * 0.35;
  c.parts.elbowR.rotation.x = -0.3 - Math.max(0, s) * amp * 0.35;
  // Arms hang slightly out from the body.
  c.parts.armL.rotation.z = 0.1;
  c.parts.armR.rotation.z = -0.1;
  if (punchT > 0) {
    const p = Math.sin(punchT * Math.PI);
    c.parts.armR.rotation.x = -1.55 * p;
    c.parts.elbowR.rotation.x = -0.08 * p;
    c.parts.armR.rotation.z = -0.15 * p;
  }
  // Jump tuck: thighs forward, knees bent, arms out.
  if (airT > 0) {
    c.parts.legL.rotation.x = 0.55 * airT + s * amp * 0.3;
    c.parts.legR.rotation.x = 0.35 * airT + s2 * amp * 0.3;
    c.parts.kneeL.rotation.x = 1.0 * airT;
    c.parts.kneeR.rotation.x = 0.8 * airT;
    c.parts.armL.rotation.x = -0.5 * airT;
    c.parts.armR.rotation.x = -0.5 * airT;
    c.parts.armL.rotation.z = 0.45 * airT;
    c.parts.armR.rotation.z = -0.45 * airT;
  }
  // Torso: forward lean with speed + a slight side sway; head stays level.
  c.parts.torso.rotation.x = lean;
  c.parts.torso.rotation.z = Math.sin(phase) * amp * 0.05;
  c.parts.head.rotation.x = -lean * 0.6;
  c.bob = Math.abs(Math.cos(phase)) * 0.045 * amp;
}
