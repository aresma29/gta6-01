// VICE BAY — the player character. A procedural humanoid with a shaped body:
// a torso in a red jacket, a head with a face, hair and a cap, arms ending in
// hands and legs ending in feet. The walk/run cycle swings the limbs, bobs
// the body and leans forward at a run; a jump tucks the legs.

import * as THREE from 'three';
import { clamp } from './util.js';

/** Build the character group. Returns { group, parts, animate }. */
export function makeCharacter() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a6a, roughness: 0.7 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xc23a2e, roughness: 0.75 });
  const jacketDark = new THREE.MeshStandardMaterial({ color: 0x8a2a22, roughness: 0.75 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.85 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.5 });

  const group = new THREE.Group();

  // Legs: thigh + shin as one pivoting limb each, with a foot at the end.
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.14 * side, 0.95, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.24), pants);
    thigh.position.y = -0.25;
    thigh.castShadow = true;
    hip.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.2), pants);
    shin.position.y = -0.68;
    shin.castShadow = true;
    hip.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.1, 0.34), shoes);
    foot.position.set(0, -0.92, 0.06);
    foot.castShadow = true;
    hip.add(foot);
    group.add(hip);
    return hip;
  }

  // Arms: upper + forearm, ending in a hand.
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.34 * side, 1.52, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.2), jacket);
    upper.position.y = -0.21;
    upper.castShadow = true;
    shoulder.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.17), jacketDark);
    fore.position.y = -0.58;
    fore.castShadow = true;
    shoulder.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
    hand.position.y = -0.82;
    hand.castShadow = true;
    shoulder.add(hand);
    group.add(shoulder);
    return shoulder;
  }

  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Torso: a shaped jacket — a chest box, a waist band and an open shirt V.
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.36), jacket);
  chest.position.y = 1.26;
  chest.castShadow = true;
  group.add(chest);
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.16, 0.34), jacketDark);
  waist.position.y = 0.98;
  group.add(waist);
  const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.05), shirt);
  shirtV.position.set(0, 1.38, 0.19);
  group.add(shirtV);
  // Jacket collar.
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.06), jacketDark);
  collar.position.set(0, 1.58, 0.19);
  collar.rotation.x = -0.3;
  group.add(collar);

  // Head: skin sphere, hair cap, eyes, nose and a baseball cap.
  const head = new THREE.Group();
  head.position.y = 1.78;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  skull.castShadow = true;
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 0.03;
  head.add(hair);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
    eye.position.set(0.075 * s, 0.02, 0.19);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.06), skin);
  nose.position.set(0, -0.05, 0.21);
  head.add(nose);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 16), capMat);
  cap.position.y = 0.17;
  head.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), capMat);
  brim.position.set(0, 0.14, 0.26);
  head.add(brim);
  group.add(head);

  // A small gold chain — the character's one piece of jewellery.
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd8a03a, roughness: 0.3, metalness: 0.8 }));
  chain.position.set(0, 1.56, 0.16);
  chain.rotation.x = 0.5;
  group.add(chain);

  /**
   * Animate one frame. speed is the horizontal speed (m/s), dt the frame
   * time, jumping whether the character is airborne, and phase is advanced
   * by the caller (distance travelled / stride). Returns the new phase.
   */
  function animate(phase, speed, dt, jumping) {
    const moving = speed > 0.3;
    const run = speed > 6.5;
    const swing = moving ? (run ? 0.85 : 0.55) : 0;
    const stride = run ? 1.9 : 1.35;
    const nextPhase = phase + (speed * dt) / stride;
    const s = Math.sin(nextPhase * Math.PI * 2);
    const c = Math.cos(nextPhase * Math.PI * 2);
    legL.rotation.x = s * swing;
    legR.rotation.x = -s * swing;
    armL.rotation.x = -s * swing * 0.9;
    armR.rotation.x = s * swing * 0.9;
    armL.rotation.z = 0.12;
    armR.rotation.z = -0.12;
    // Knees: bend the shin a little at the back of the swing.
    legL.rotation.x += Math.max(0, -c) * 0.25;
    legR.rotation.x += Math.max(0, c) * 0.25;
    // Body bob + forward lean at a run; a jump tucks the legs.
    const bob = moving ? Math.abs(c) * (run ? 0.07 : 0.045) : Math.sin(performance.now() * 0.002) * 0.012;
    group.position.y = bob;
    group.rotation.x = run ? 0.14 : moving ? 0.05 : 0;
    if (jumping) {
      legL.rotation.x = -0.7;
      legR.rotation.x = 0.5;
      armL.rotation.x = -0.9;
      armR.rotation.x = -0.9;
      group.rotation.x = 0.08;
    }
    // Idle breathing: a faint chest rise when standing still.
    if (!moving && !jumping) {
      chest.scale.y = 1 + Math.sin(performance.now() * 0.0025) * 0.015;
    } else {
      chest.scale.y = 1;
    }
    return nextPhase;
  }

  return { group, parts: { legL, legR, armL, armR, head, chest }, animate };
}

/** Height of the character's feet above the ground when standing (for the camera). */
export const CHARACTER_EYE_HEIGHT = 1.65;
