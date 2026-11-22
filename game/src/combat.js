// VICE BAY — Stage 3: combat (punch / bat / pistol).
// Written fresh for the rebuild. Melee has real range checks, the pistol is
// a hitscan with a tracer + muzzle flash, weapon switching is live in the
// HUD, and the player's health regenerates when not wanted. No line is
// copied from any earlier build.
import * as THREE from 'three';
import { clamp, angleDelta } from './util.js';

const WEAPONS = ['FISTS', 'BAT', 'PISTOL'];
const MELEE_RANGE = { FISTS: 2.3, BAT: 2.7 };
const PISTOL_RANGE = 45;
const PISTOL_DAMAGE = 12; // to a police car's condition

/** A simple bat mesh held in the player's right hand. */
function buildBat() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7, metalness: 0.05 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.85, 10), wood);
  barrel.position.y = 0.55;
  g.add(barrel);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
  grip.position.y = 0.05;
  g.add(grip);
  return g;
}

/** A simple pistol mesh held in the player's right hand. */
function buildPistol() {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.34), dark);
  slide.position.set(0, 0.08, 0.12);
  g.add(slide);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.12), dark);
  grip.position.set(0, -0.04, -0.02);
  grip.rotation.x = 0.25;
  g.add(grip);
  return g;
}

export function createCombat(scene, player, npcs, police, damage) {
  let weaponIndex = 0; // FISTS
  let attackCooldown = 0;
  let swingTimer = 0; // melee swing animation (0..1)
  let lastDamageAt = -99;
  let time = 0;

  // Tracer line + muzzle flash for the pistol.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 1),
  ]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffe9a0, 0, 12, 1.5);
  scene.add(flash);

  // Weapon meshes attached to the player's right hand (positioned each
  // frame from the player's position + facing; kept simple: they hang at
  // the player's side and rise on a swing).
  const bat = buildBat();
  const pistol = buildPistol();
  bat.visible = false;
  pistol.visible = false;
  scene.add(bat);
  scene.add(pistol);

  function getWeapon() {
    return WEAPONS[weaponIndex];
  }

  function switchWeapon() {
    weaponIndex = (weaponIndex + 1) % WEAPONS.length;
    bat.visible = getWeapon() === 'BAT';
    pistol.visible = getWeapon() === 'PISTOL';
    return getWeapon();
  }

  /** Nearest NPC within range and in front of the player. */
  function nearestNPC(range) {
    let best = null;
    let bestD = range;
    for (const npc of npcs.list) {
      if (npc.state === 'down') continue;
      const dx = npc.x - player.x;
      const dz = npc.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.abs(angleDelta(player.yaw, Math.atan2(dx, dz)));
      if (ang > 0.9) continue; // must be roughly in front
      bestD = d;
      best = npc;
    }
    return best;
  }

  /** Nearest police car within range and in front of the player. */
  function nearestPoliceCar(range) {
    let best = null;
    let bestD = range;
    for (const car of police.cars) {
      const dx = car.x - player.x;
      const dz = car.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.abs(angleDelta(player.yaw, Math.atan2(dx, dz)));
      if (ang > 0.6) continue;
      bestD = d;
      best = car;
    }
    return best;
  }

  /** Fire the pistol: hitscan vs NPCs and police cars, tracer + flash. */
  function firePistol() {
    const w = getWeapon();
    if (w !== 'PISTOL') return false;
    // Muzzle at the player's chest, forward along the facing.
    const mx = player.x + Math.sin(player.yaw) * 0.6;
    const mz = player.z + Math.cos(player.yaw) * 0.6;
    const my = (player.y || 0) + 1.35;
    // Target: nearest NPC or police car within range + front cone.
    let target = null;
    let targetPos = null;
    let bestD = PISTOL_RANGE;
    for (const npc of npcs.list) {
      if (npc.state === 'down') continue;
      const dx = npc.x - player.x;
      const dz = npc.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.abs(angleDelta(player.yaw, Math.atan2(dx, dz)));
      if (ang > 0.35) continue;
      bestD = d;
      target = npc;
      targetPos = { x: npc.x, y: 1.0, z: npc.z };
    }
    for (const car of police.cars) {
      const dx = car.x - player.x;
      const dz = car.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.abs(angleDelta(player.yaw, Math.atan2(dx, dz)));
      if (ang > 0.35) continue;
      bestD = d;
      target = car;
      targetPos = { x: car.x, y: 0.9, z: car.z };
    }
    const end = targetPos || {
      x: player.x + Math.sin(player.yaw) * PISTOL_RANGE,
      y: my,
      z: player.z + Math.cos(player.yaw) * PISTOL_RANGE,
    };
    // Tracer + flash.
    tracerGeo.setFromPoints([
      new THREE.Vector3(mx, my, mz),
      new THREE.Vector3(end.x, end.y, end.z),
    ]);
    tracer.visible = true;
    tracerMat.opacity = 0.9;
    flash.position.set(mx, my, mz);
    flash.intensity = 60;
    if (target) {
      if (target.state !== undefined) {
        npcs.knockDown(target);
      } else {
        police.damagePoliceCar(target, PISTOL_DAMAGE);
        damage.damageCar(target, PISTOL_DAMAGE);
      }
    }
    police.addHeat(40, 'pistol');
    return true;
  }

  /** Melee swing: punch (FISTS) or bat. Hits the nearest NPC in range. */
  function meleeAttack() {
    const w = getWeapon();
    const range = MELEE_RANGE[w] || 2.3;
    const target = nearestNPC(range);
    swingTimer = 1;
    if (target) {
      npcs.knockDown(target);
      police.addHeat(20, 'assault');
      return true;
    }
    // A swing at a police car dents it a little.
    const car = nearestPoliceCar(range + 0.4);
    if (car) {
      police.damagePoliceCar(car, 4);
      damage.damageCar(car, 4);
      police.addHeat(20, 'assault');
      return true;
    }
    return false;
  }

  /** F = attack with the current weapon. Returns true if it hit something. */
  function attack() {
    if (attackCooldown > 0) return false;
    attackCooldown = getWeapon() === 'PISTOL' ? 0.45 : 0.6;
    if (getWeapon() === 'PISTOL') return firePistol();
    return meleeAttack();
  }

  function update(dt) {
    const d = clamp(dt, 0, 0.05);
    time += d;
    attackCooldown = Math.max(0, attackCooldown - d);
    swingTimer = Math.max(0, swingTimer - d * 2.5);
    // Tracer + flash fade.
    if (tracer.visible) {
      tracerMat.opacity = Math.max(0, tracerMat.opacity - d * 5);
      if (tracerMat.opacity <= 0) tracer.visible = false;
    }
    flash.intensity = Math.max(0, flash.intensity - d * 400);
    // Weapon meshes follow the player's right hand.
    const hx = player.x + Math.sin(player.yaw + 0.5) * 0.45;
    const hz = player.z + Math.cos(player.yaw + 0.5) * 0.45;
    const hy = (player.y || 0) + 1.05 + (swingTimer > 0 ? Math.sin(swingTimer * Math.PI) * 0.45 : 0);
    bat.position.set(hx, hy, hz);
    bat.rotation.set(0, player.yaw, swingTimer > 0 ? -1.1 : 0.5);
    pistol.position.set(hx, hy, hz);
    pistol.rotation.set(0, player.yaw, 0);
    // Health regen when not wanted (and not just damaged).
    if ((player.wanted || 0) === 0 && time - lastDamageAt > 4) {
      player.health = Math.min(100, (player.health ?? 100) + 2 * d);
    }
  }

  /** Record that the player just took damage (pauses regen). */
  function noteDamage() {
    lastDamageAt = time;
  }

  function reset() {
    weaponIndex = 0;
    attackCooldown = 0;
    swingTimer = 0;
    bat.visible = false;
    pistol.visible = false;
    tracer.visible = false;
    flash.intensity = 0;
  }

  return {
    update,
    attack,
    switchWeapon,
    noteDamage,
    reset,
    get weapon() {
      return getWeapon();
    },
    get weapons() {
      return WEAPONS;
    },
    get swingTimer() {
      return swingTimer;
    },
    getState() {
      return { weapon: getWeapon(), cooldown: Math.round(attackCooldown * 100) / 100 };
    },
  };
}
