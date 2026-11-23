// character.js — a procedural humanoid for VICE BAY 3D (Stage 1).
// Red jacket, cap, face; walk/run swing, body bob, run lean, jump tuck.
// Built from boxes only (no external model). Units are metres.

import * as THREE from 'three';

const SKIN = 0xd9a066;
const JACKET = 0xc22e2e;
const JACKET_DARK = 0x8f1f1f;
const SHIRT = 0xf2ead8;
const PANTS = 0x2a3550;
const SHOE = 0x1c1c22;
const CAP = 0xb02020;
const HAIR = 0x2a1c12;

function box(w, h, d, colour, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.85, metalness: 0.02 })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * Build the character. Returns { group, parts, pose }.
 * `parts` holds the pivots: hips (legs), shoulders (arms), torso, head.
 * pose(phase, speedNorm, airborne, idleTime) drives the animation.
 */
export function buildCharacter() {
  const group = new THREE.Group();
  const parts = {};

  // Legs: pivot at the hip (y = 0.95). Thigh + shin + foot in one pivot each.
  const legL = new THREE.Group();
  legL.position.set(-0.13, 0.95, 0);
  legL.add(box(0.2, 0.45, 0.22, PANTS, 0, -0.22, 0));
  legL.add(box(0.2, 0.45, 0.2, PANTS, 0, -0.68, 0));
  legL.add(box(0.22, 0.1, 0.34, SHOE, 0, -0.92, 0.05));
  group.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.13, 0.95, 0);
  legR.add(box(0.2, 0.45, 0.22, PANTS, 0, -0.22, 0));
  legR.add(box(0.2, 0.45, 0.2, PANTS, 0, -0.68, 0));
  legR.add(box(0.22, 0.1, 0.34, SHOE, 0, -0.92, 0.05));
  group.add(legR);
  parts.legL = legL;
  parts.legR = legR;

  // Torso: red jacket, white shirt V, collar, gold chain.
  const torso = new THREE.Group();
  torso.position.set(0, 0.95, 0);
  torso.add(box(0.56, 0.68, 0.3, JACKET, 0, 0.34, 0));
  torso.add(box(0.2, 0.4, 0.02, SHIRT, 0, 0.42, 0.16)); // shirt V
  torso.add(box(0.58, 0.08, 0.32, JACKET_DARK, 0, 0.66, 0)); // collar band
  torso.add(box(0.34, 0.05, 0.02, 0xd8a83a, 0, 0.56, 0.17)); // gold chain
  // Jacket pocket flaps.
  torso.add(box(0.14, 0.08, 0.02, JACKET_DARK, -0.16, 0.18, 0.16));
  torso.add(box(0.14, 0.08, 0.02, JACKET_DARK, 0.16, 0.18, 0.16));
  group.add(torso);
  parts.torso = torso;

  // Arms: pivot at the shoulder (y = 1.55). Upper + forearm + hand.
  const armL = new THREE.Group();
  armL.position.set(-0.35, 1.58, 0);
  armL.add(box(0.16, 0.36, 0.18, JACKET, 0, -0.18, 0));
  armL.add(box(0.14, 0.34, 0.16, JACKET, 0, -0.52, 0));
  armL.add(box(0.15, 0.12, 0.16, SKIN, 0, -0.76, 0));
  group.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.35, 1.58, 0);
  armR.add(box(0.16, 0.36, 0.18, JACKET, 0, -0.18, 0));
  armR.add(box(0.14, 0.34, 0.16, JACKET, 0, -0.52, 0));
  armR.add(box(0.15, 0.12, 0.16, SKIN, 0, -0.76, 0));
  group.add(armR);
  parts.armL = armL;
  parts.armR = armR;

  // Head: skin, face (eyes), hair, red cap with brim.
  const head = new THREE.Group();
  head.position.set(0, 1.68, 0);
  head.add(box(0.32, 0.32, 0.3, SKIN, 0, 0.16, 0));
  head.add(box(0.05, 0.05, 0.02, 0x14141c, -0.07, 0.18, 0.16)); // eye L
  head.add(box(0.05, 0.05, 0.02, 0x14141c, 0.07, 0.18, 0.16)); // eye R
  head.add(box(0.34, 0.1, 0.32, HAIR, 0, 0.3, -0.02)); // hair
  head.add(box(0.34, 0.09, 0.32, CAP, 0, 0.36, 0)); // cap crown
  head.add(box(0.34, 0.04, 0.2, CAP, 0, 0.32, 0.22)); // cap brim
  group.add(head);
  parts.head = head;

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  /**
   * Drive the animation.
   * @param {number} phase — gait phase (radians), advances with distance moved.
   * @param {number} speedNorm — 0 idle, ~0.55 walk, 1 run.
   * @param {boolean} airborne — true while jumping/falling.
   * @param {number} idleTime — seconds since the last movement (breathing).
   */
  function pose(phase, speedNorm, airborne, idleTime) {
    const swing = 0.15 + speedNorm * 0.75;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    if (airborne) {
      // Jump tuck: knees up, arms out.
      parts.legL.rotation.x = -0.9;
      parts.legR.rotation.x = -0.5;
      parts.armL.rotation.x = -0.7;
      parts.armR.rotation.x = -0.7;
      parts.armL.rotation.z = 0.5;
      parts.armR.rotation.z = -0.5;
      parts.torso.rotation.x = 0.08;
      parts.torso.position.y = 0.95;
    } else if (speedNorm > 0.05) {
      parts.legL.rotation.x = s * swing;
      parts.legR.rotation.x = -s * swing;
      parts.armL.rotation.x = -s * swing * 0.85;
      parts.armR.rotation.x = s * swing * 0.85;
      parts.armL.rotation.z = 0.12;
      parts.armR.rotation.z = -0.12;
      // Run lean + bob.
      parts.torso.rotation.x = 0.06 + speedNorm * 0.14;
      parts.torso.position.y = 0.95 + Math.abs(c) * 0.045 * speedNorm;
      parts.head.rotation.x = -0.04 - speedNorm * 0.08;
    } else {
      // Idle: gentle breathing, arms at rest.
      const b = Math.sin(idleTime * 1.8) * 0.02;
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
      parts.armL.rotation.x = b;
      parts.armR.rotation.x = -b;
      parts.armL.rotation.z = 0.08;
      parts.armR.rotation.z = -0.08;
      parts.torso.rotation.x = 0;
      parts.torso.position.y = 0.95 + b;
      parts.head.rotation.x = 0;
    }
  }

  return { group, parts, pose };
}
