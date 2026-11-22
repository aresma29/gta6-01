// VICE BAY 3D — combat: punch + weapons (fists / bat / pistol), weapon
// switching with Q, melee hits on NPCs, and a pistol hitscan with a tracer
// and muzzle flash. On foot only. Written fresh for Stage 3.
import * as THREE from '../vendor/three/three.module.min.js';
import { ACT_PUNCH, ACT_WEAPON } from './util.js';

const WEAPONS = [
  { id: 'fists', name: 'FISTS', reach: 1.7, dmg: 10, knock: 1.5 },
  { id: 'bat', name: 'BAT', reach: 2.3, dmg: 18, knock: 3 },
  { id: 'pistol', name: 'PISTOL', reach: 45, dmg: 35, knock: 1 },
];
const PUNCH_TIME = 0.35; // game-seconds for one punch swing
const PUNCH_HIT_AT = 0.3; // fraction of the swing when the hit lands
const PUNCH_COOLDOWN = 0.45;

function makeMuzzleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,180,1)');
  grad.addColorStop(0.4, 'rgba(255,200,80,0.7)');
  grad.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createCombat(scene, player, playerMesh, npcs, police) {
  let weaponIndex = 0;
  let punchT = 0; // 0 = idle, 0..1 while a punch is playing
  let punchCooldown = 0;
  let punchHitDone = true;
  let lastAssaultAt = -100, lastShootAt = -100;
  let tracerT = 0, muzzleT = 0;
  let time = 0;
  const tmpV = new THREE.Vector3();

  // A bat + a pistol in the player's right hand (visible per weapon).
  const bat = new THREE.Group();
  {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.7 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.7, 8), wood);
    barrel.rotation.x = Math.PI / 2 - 0.4;
    barrel.position.set(0, -0.1, 0.28);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), wood);
    knob.position.set(0, -0.38, -0.05);
    bat.add(barrel, knob);
  }
  bat.position.set(0, -0.42, 0.05);
  bat.visible = false;
  playerMesh.parts.elbowR.add(bat);
  const pistol = new THREE.Group();
  {
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.35, metalness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.26), gunmetal);
    body.position.set(0, -0.05, 0.12);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), gunmetal);
    grip.position.set(0, -0.16, 0.02);
    pistol.add(body, grip);
  }
  pistol.position.set(0, -0.42, 0.05);
  pistol.visible = false;
  playerMesh.parts.elbowR.add(pistol);

  // Tracer line + muzzle flash for the pistol.
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeMuzzleTexture(), blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.95,
  }));
  muzzle.scale.set(1.2, 1.2, 1);
  muzzle.visible = false;
  scene.add(muzzle);

  function handPos() {
    playerMesh.parts.elbowR.getWorldPosition(tmpV);
    return tmpV;
  }

  function applyMelee() {
    const w = WEAPONS[weaponIndex];
    const npc = npcs.nearest(player.x, player.z, w.reach, player.heading, 1.2);
    if (!npc) return;
    npcs.hit(npc, player.x, player.z, w.knock);
    if (time - lastAssaultAt > 3) {
      lastAssaultAt = time;
      police.addWanted(1);
    }
  }

  function applyShot() {
    const w = WEAPONS[weaponIndex];
    const hand = handPos().clone();
    const npc = npcs.nearest(player.x, player.z, w.reach, player.heading, 0.22);
    let end;
    if (npc) {
      npcs.hit(npc, player.x, player.z, w.knock);
      end = new THREE.Vector3(npc.x, 1.2, npc.z);
      if (time - lastShootAt > 5) {
        lastShootAt = time;
        police.addWanted(2);
      }
    } else {
      end = new THREE.Vector3(
        player.x + Math.sin(player.heading) * w.reach,
        1.2,
        player.z + Math.cos(player.heading) * w.reach
      );
    }
    const pos = tracerGeo.attributes.position.array;
    pos[0] = hand.x; pos[1] = hand.y; pos[2] = hand.z;
    pos[3] = end.x; pos[4] = end.y; pos[5] = end.z;
    tracerGeo.attributes.position.needsUpdate = true;
    tracer.visible = true;
    tracerT = 0.08;
    muzzle.position.copy(hand);
    muzzle.visible = true;
    muzzleT = 0.06;
  }

  function update(dt, actions, player, playerMesh, vehicles) {
    time += dt;
    if (punchCooldown > 0) punchCooldown -= dt;
    if (tracerT > 0) { tracerT -= dt; if (tracerT <= 0) tracer.visible = false; }
    if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzle.visible = false; }
    if (punchT > 0) {
      const prev = punchT;
      punchT = Math.min(1, punchT + dt / PUNCH_TIME);
      if (!punchHitDone && prev < PUNCH_HIT_AT && punchT >= PUNCH_HIT_AT) {
        punchHitDone = true;
        if (WEAPONS[weaponIndex].id === 'pistol') applyShot();
        else applyMelee();
      }
      if (punchT >= 1) punchT = 0;
    }
    if (actions & ACT_WEAPON) {
      weaponIndex = (weaponIndex + 1) % WEAPONS.length;
      bat.visible = WEAPONS[weaponIndex].id === 'bat';
      pistol.visible = WEAPONS[weaponIndex].id === 'pistol';
    }
    // F = punch (fists/bat) or shoot (pistol). On foot only.
    if ((actions & ACT_PUNCH) && !vehicles.playerCar && punchCooldown <= 0 && punchT === 0) {
      punchCooldown = PUNCH_COOLDOWN;
      punchT = 0.01;
      punchHitDone = false;
    }
  }

  function reset() {
    weaponIndex = 0;
    punchT = 0;
    punchCooldown = 0;
    bat.visible = false;
    pistol.visible = false;
    tracer.visible = false;
    muzzle.visible = false;
  }

  return {
    weapons: WEAPONS,
    get weaponIndex() { return weaponIndex; },
    get punchT() { return punchT; },
    update,
    reset,
  };
}
