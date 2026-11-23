// combat.js — punch + weapons for VICE BAY 3D (Stage 3). Written fresh in
// the rebuild recording. FISTS / BAT / PISTOL (Q cycles, F uses the equipped
// weapon); punch swings and lands at 0.3 of the swing; the pistol is a
// hitscan with a tracer + muzzle flash, 45 m reach. SMG stays locked.
// Crimes add wanted heat (punch +1 star, pistol +2 stars, with cooldowns).

import * as THREE from 'three';

const WEAPONS = ['FISTS', 'BAT', 'PISTOL'];
const PUNCH_TIME = 0.4; // swing duration (game seconds)
const PUNCH_HIT_AT = 0.3; // fraction of the swing when the hit lands
const PUNCH_RANGE = 2.2;
const PUNCH_ARC = 1.05; // ~60 degrees
const PISTOL_RANGE = 45;
const PISTOL_ARC = 0.18; // ~10 degrees

export function createCombat(scene, opts) {
  const parts = opts.parts;
  const npcs = opts.npcs;
  const police = opts.police;
  const player = opts.player;

  let weaponIdx = 0;
  let time = 0;
  let punchT = -1; // -1 = not swinging, else seconds into the swing
  let punchHitDone = false;
  let lastPunch = -10;
  let lastShot = -10;
  let tracerLife = 0;

  // --- weapon meshes in the player's right hand ---
  const bat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8 })
  );
  bat.position.set(0, -0.85, 0.1);
  bat.rotation.x = Math.PI / 2.4;
  bat.visible = false;
  parts.armR.add(bat);
  const pistol = new THREE.Group();
  const pistolBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.5, roughness: 0.4 })
  );
  pistol.add(pistolBody);
  const pistolGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a20, metalness: 0.5, roughness: 0.4 })
  );
  pistolGrip.position.set(0, -0.12, -0.06);
  pistol.add(pistolGrip);
  pistol.position.set(0, -0.82, 0.12);
  pistol.visible = false;
  parts.armR.add(pistol);

  // --- pistol tracer + muzzle flash ---
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 })
  );
  flash.visible = false;
  scene.add(flash);

  function refreshWeaponMeshes() {
    bat.visible = WEAPONS[weaponIdx] === 'BAT';
    pistol.visible = WEAPONS[weaponIdx] === 'PISTOL';
  }

  function cycleWeapon() {
    weaponIdx = (weaponIdx + 1) % WEAPONS.length;
    refreshWeaponMeshes();
    return WEAPONS[weaponIdx];
  }

  function punch() {
    if (punchT >= 0) return false;
    if (time - lastPunch < 3) return false;
    lastPunch = time;
    punchT = 0;
    punchHitDone = false;
    return true;
  }

  function shoot() {
    if (time - lastShot < 5) return false;
    lastShot = time;
    const dirX = Math.sin(player.heading);
    const dirZ = Math.cos(player.heading);
    const mx = player.x + dirX * 0.6;
    const mz = player.z + dirZ * 0.6;
    const my = (player.y || 0) + 1.4;
    const target = npcs.nearestInFront(player.x, player.z, player.heading, PISTOL_RANGE, PISTOL_ARC);
    let endX = player.x + dirX * PISTOL_RANGE;
    let endZ = player.z + dirZ * PISTOL_RANGE;
    let endY = my;
    if (target) {
      endX = target.x;
      endZ = target.z;
      endY = 1.0;
      npcs.knockDown(target);
      police.addHeat(40, 'pistol', 5);
    }
    // Tracer + muzzle flash.
    tracerGeo.setFromPoints([new THREE.Vector3(mx, my, mz), new THREE.Vector3(endX, endY, endZ)]);
    tracer.visible = true;
    tracerMat.opacity = 0.9;
    tracerLife = 0.15;
    flash.position.set(mx, my, mz);
    flash.visible = true;
    flash.material.opacity = 0.95;
    return true;
  }

  function useWeapon() {
    if (WEAPONS[weaponIdx] === 'PISTOL') return shoot();
    return punch();
  }

  function update(dt) {
    time += dt;
    // Pistol tracer / flash fade.
    if (tracerLife > 0) {
      tracerLife -= dt;
      tracerMat.opacity = Math.max(0, tracerLife / 0.15) * 0.9;
      flash.material.opacity = Math.max(0, tracerLife / 0.15) * 0.95;
      if (tracerLife <= 0) {
        tracer.visible = false;
        flash.visible = false;
      }
    }
    // Punch swing: overrides the arm pose while active (called after pose()).
    if (punchT >= 0) {
      punchT += dt;
      const frac = punchT / PUNCH_TIME;
      if (frac >= PUNCH_HIT_AT && !punchHitDone) {
        punchHitDone = true;
        const target = npcs.nearestInFront(player.x, player.z, player.heading, PUNCH_RANGE, PUNCH_ARC);
        if (target) {
          npcs.knockDown(target);
          police.addHeat(20, 'punch', 3);
        }
      }
      if (frac >= 1) {
        punchT = -1;
      } else {
        // Swing the right arm forward and back.
        parts.armR.rotation.x = -1.4 * Math.sin(frac * Math.PI);
        parts.armR.rotation.z = -0.3 * Math.sin(frac * Math.PI);
      }
    }
  }

  function reset() {
    weaponIdx = 0;
    punchT = -1;
    punchHitDone = false;
    lastPunch = -10;
    lastShot = -10;
    tracer.visible = false;
    flash.visible = false;
    refreshWeaponMeshes();
  }

  return {
    update,
    useWeapon,
    cycleWeapon,
    punch,
    shoot,
    reset,
    get weapon() { return WEAPONS[weaponIdx]; },
    get weapons() { return [...WEAPONS]; },
    get punchPhase() { return punchT < 0 ? 0 : punchT / PUNCH_TIME; },
  };
}
