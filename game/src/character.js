// VICE BAY — the player character: a shaped procedural humanoid.
// Written fresh for the rebuild. Red jacket, face, hair, cap, hands, feet,
// gold chain. Walk/run animation with limb swing, knee bend, body bob,
// run lean and a jump tuck.
import * as THREE from 'three';
import { clamp } from './util.js';

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
  });
}

/** Build Jax, the player character. Returns { group, parts }. */
export function buildCharacter() {
  const group = new THREE.Group();
  const parts = {};

  // --- legs (thigh + shin + foot, so knees can bend) ---
  function makeLeg(side) {
    const leg = new THREE.Group();
    leg.position.set(0.16 * side, 0.92, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.24), std('#23283a'));
    thigh.position.y = -0.25;
    thigh.castShadow = true;
    leg.add(thigh);
    const shin = new THREE.Group();
    shin.position.y = -0.5;
    const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.42, 0.2), std('#23283a'));
    shinMesh.position.y = -0.21;
    shinMesh.castShadow = true;
    shin.add(shinMesh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.34), std('#e8e8e8'));
    foot.position.set(0, -0.44, 0.06);
    foot.castShadow = true;
    shin.add(foot);
    leg.add(shin);
    group.add(leg);
    return { hip: leg, knee: shin };
  }
  parts.legL = makeLeg(-1);
  parts.legR = makeLeg(1);

  // --- torso: red jacket with a shirt V, collar and a gold chain ---
  const torso = new THREE.Group();
  torso.position.y = 0.92;
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), std('#c22a2a', { roughness: 0.7 }));
  jacket.position.y = 0.31;
  jacket.castShadow = true;
  torso.add(jacket);
  const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), std('#f2ede0'));
  shirtV.position.set(0, 0.42, 0.17);
  torso.add(shirtV);
  const collarL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.06), std('#8a1a1a'));
  collarL.position.set(-0.14, 0.6, 0.17);
  collarL.rotation.z = 0.35;
  torso.add(collarL);
  const collarR = collarL.clone();
  collarR.position.x = 0.14;
  collarR.rotation.z = -0.35;
  torso.add(collarR);
  const chain = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.018, 6, 16, Math.PI),
    std('#ffd76a', { roughness: 0.3, metalness: 0.9 })
  );
  chain.position.set(0, 0.52, 0.17);
  chain.rotation.x = Math.PI;
  torso.add(chain);
  group.add(torso);
  parts.torso = torso;

  // --- arms (shoulder + forearm + hand) ---
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(0.34 * side, 1.46, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.18), std('#c22a2a', { roughness: 0.7 }));
    upper.position.y = -0.21;
    upper.castShadow = true;
    arm.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.44;
    const foreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.38, 0.15), std('#c89878'));
    foreMesh.position.y = -0.19;
    foreMesh.castShadow = true;
    fore.add(foreMesh);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.16), std('#c89878'));
    hand.position.y = -0.44;
    hand.castShadow = true;
    fore.add(hand);
    arm.add(fore);
    group.add(arm);
    return { shoulder: arm, elbow: fore };
  }
  parts.armL = makeArm(-1);
  parts.armR = makeArm(1);

  // --- head: face, eyes, hair, cap ---
  const head = new THREE.Group();
  head.position.y = 1.68;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), std('#c89878'));
  skull.position.y = 0.16;
  skull.castShadow = true;
  head.add(skull);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#14141a' });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.02), eyeMat);
    eye.position.set(0.07 * s, 0.18, 0.16);
    head.add(eye);
  }
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), std('#1a1210'));
  hair.position.y = 0.33;
  head.add(hair);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.09, 10), std('#1a1a22'));
  cap.position.y = 0.38;
  head.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.16), std('#1a1a22'));
  brim.position.set(0, 0.35, 0.2);
  head.add(brim);
  group.add(head);
  parts.head = head;

  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group, parts };
}

/**
 * Animate the character.
 * phase advances with distance walked; speed is m/s; jumping is airborne.
 */
export function animateCharacter(ch, phase, speed, jumping, dt) {
  const { parts } = ch;
  const moving = speed > 0.3;
  const swing = moving ? clamp(speed / 9, 0.25, 1) : 0;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  // Legs: opposite swing, knees bend on the back-swing.
  parts.legL.hip.rotation.x = s * 0.75 * swing;
  parts.legR.hip.rotation.x = -s * 0.75 * swing;
  parts.legL.knee.rotation.x = Math.max(0, -c) * 0.9 * swing + (jumping ? 0.9 : 0);
  parts.legR.knee.rotation.x = Math.max(0, c) * 0.9 * swing + (jumping ? 0.9 : 0);
  // Arms: opposite to the legs, elbows slightly bent.
  parts.armL.shoulder.rotation.x = -s * 0.6 * swing;
  parts.armR.shoulder.rotation.x = s * 0.6 * swing;
  parts.armL.elbow.rotation.x = -0.35 - Math.max(0, s) * 0.25 * swing;
  parts.armR.elbow.rotation.x = -0.35 - Math.max(0, -s) * 0.25 * swing;
  // Torso: forward lean at a run, a little bob, and a jump tuck.
  const lean = moving ? 0.06 + (speed / 9) * 0.14 : 0.02;
  parts.torso.rotation.x = jumping ? 0.22 : lean;
  parts.torso.position.y = 0.92 + (moving ? Math.abs(c) * 0.045 * swing : Math.sin(performance.now() * 0.002) * 0.012);
  // Head looks slightly ahead when running.
  parts.head.rotation.x = jumping ? -0.12 : -lean * 0.5;
  void dt;
}
