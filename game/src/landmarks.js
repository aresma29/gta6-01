// landmarks.js — neon ferris wheel, VICE BAY tower sign, Ocean Drive
// billboard (VICE BAY 3D, Stage 3). Written fresh in the rebuild recording.
// All textures canvas-generated; no external assets, no network.

import * as THREE from 'three';
import { neonTexture, billboardTexture } from './textures.js';

export function buildLandmarks(scene, landmarks) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- neon ferris wheel on the beach (0, 198) ---------------------------
  // The wheel face is in the XY plane (faces north/south), so the chase-cam
  // driving south sees it face-on, dead ahead. A `rotor` group spins slowly;
  // cabins counter-rotate so they stay upright.
  const wheel = new THREE.Group();
  wheel.position.set(0, 0, 198);
  const rotor = new THREE.Group();
  rotor.position.set(0, 13, 0);
  wheel.add(rotor);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, emissive: 0xff5fa2, emissiveIntensity: 1.1, roughness: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.45, 10, 40), rimMat);
  rotor.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a44, emissive: 0xffd24a, emissiveIntensity: 0.5 }));
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 11, 0.3), spokeMat);
    spoke.position.set(Math.cos(a) * 5.5, Math.sin(a) * 5.5, 0);
    spoke.rotation.z = a + Math.PI / 2;
    rotor.add(spoke);
  }
  const cabinCols = [0xff5fa2, 0xffd24a, 0x4a8ad2, 0x3aa86a, 0xff7a3d, 0x8a4fd0, 0x2a9a9a, 0xe8e0d0];
  const cabins = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.8, 1.6),
      new THREE.MeshStandardMaterial({ color: cabinCols[i], emissive: cabinCols[i], emissiveIntensity: 0.35, roughness: 0.6 })
    );
    cabin.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0);
    rotor.add(cabin);
    cabins.push(cabin);
  }
  // A-frame supports (static, not part of the rotor).
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 14.5, 8), legMat);
    leg.position.set(sx * 3.2, 6.5, 0);
    leg.rotation.z = sx * 0.22;
    wheel.add(leg);
  }
  group.add(wheel);

  // ---- vertical VICE BAY neon on the BANK tower (south face) --------------
  const bank = landmarks.BANK;
  if (bank) {
    const signTex = neonTexture('VICEBAY');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 30),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.8, roughness: 0.6 })
    );
    sign.position.set(bank.x, bank.h * 0.72, bank.z + bank.d / 2 + 0.15);
    sign.rotation.y = 0; // south face, readable from the south
    group.add(sign);
  }

  // ---- Ocean Drive billboard by the beach road (faces north, readable by
  // the chase-cam driving south) -------------------------------------------
  const bbTex = billboardTexture(['OCEAN DRIVE', 'VICE BAY · SUNSET STRIP']);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 8),
    new THREE.MeshStandardMaterial({ map: bbTex, emissive: 0xffffff, emissiveMap: bbTex, emissiveIntensity: 0.4 })
  );
  board.position.set(64, 15, 170);
  board.rotation.y = Math.PI; // face north, toward the oncoming chase-cam
  group.add(board);
  const bbPole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 8), new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.8 }));
  bbPole.position.set(64, 6, 170);
  group.add(bbPole);

  let rot = 0;
  function update(dt) {
    // Slow rotation; cabins counter-rotate so they stay upright.
    rot += dt * 0.12;
    rotor.rotation.z = rot;
    for (const cabin of cabins) cabin.rotation.z = -rot;
  }

  return { update, wheel, group };
}
