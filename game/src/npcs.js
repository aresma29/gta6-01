// VICE BAY — Stage 3: pedestrians (NPCs).
// Written fresh for the rebuild. 8+ pedestrians walk the sidewalks, flee
// from police chases and attacks, and fall down when hit. No line is copied
// from any earlier build.
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta, mulberry32, pick, rand, resolveCollisions } from './util.js';
import { HALF, ROADS } from './city.js';
import { loadGLBCharacter } from './glbCharacter.js';

const NPC_COUNT = 10;
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xfd79a8, 0x6c5ce7, 0x00cec9];
const PANTS = [0x23283a, 0x3a3a44, 0x4a3728, 0x2a3a2a, 0x333a4a];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const HATS = [0x222222, 0x8a5a2a, 0x4a6a8a];

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.05,
  });
}

/** A simple humanoid with varied clothes/skin/hat. Fresh build. */
function buildPedestrian(rng) {
  const g = new THREE.Group();
  const shirt = pick(rng, SHIRTS);
  const pants = pick(rng, PANTS);
  const skin = pick(rng, SKINS);
  const scale = 0.92 + rng() * 0.16;
  // Legs (thigh + shin + foot).
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.14 * side, 0.88, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.2), std(pants));
    thigh.position.y = -0.22;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.42, 0.17), std(pants));
    shin.position.y = -0.2;
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.3), std(0x1a1a1a));
    foot.position.set(0, -0.42, 0.06);
    knee.add(foot);
    hip.add(knee);
    g.add(hip);
    legs.push({ hip, knee });
  }
  // Torso + arms.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), std(shirt));
  torso.position.y = 1.2;
  g.add(torso);
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.32 * side, 1.46, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.16), std(shirt));
    upper.position.y = -0.2;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.38, 0.14), std(skin));
    fore.position.y = -0.18;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.13), std(skin));
    hand.position.y = -0.4;
    elbow.add(hand);
    shoulder.add(elbow);
    g.add(shoulder);
    arms.push({ shoulder, elbow });
  }
  // Head + hair / hat.
  const head = new THREE.Group();
  head.position.y = 1.72;
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), std(skin));
  head.add(skull);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), std(0x2a1a12));
  hair.position.y = 0.18;
  head.add(hair);
  if (rng() < 0.35) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 12), std(pick(rng, HATS)));
    hat.position.y = 0.24;
    head.add(hat);
  }
  g.add(head);
  g.scale.setScalar(scale);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { group: g, legs, arms, head, scale };
}

/** A sidewalk point: on a road line, offset 8.5 m to the side. */
function sidewalkPoint(rng, roads) {
  const road = pick(rng, roads);
  const along = -HALF + 16 + rng() * (HALF * 2 - 32);
  const side = rng() < 0.5 ? -8.5 : 8.5;
  if (rng() < 0.5) return { x: road + side, z: along };
  return { x: along, z: road + side };
}

export function createNPCs(scene, city, player, vehicles) {
  const rng = mulberry32(7);
  const npcs = [];
  const roads = city.roads || ROADS;

  for (let i = 0; i < NPC_COUNT; i++) {
    const built = buildPedestrian(rng);
    const p = sidewalkPoint(rng, roads);
    const npc = {
      x: p.x,
      z: p.z,
      heading: rng() * Math.PI * 2,
      speed: 0.9 + rng() * 0.7,
      walkPhase: rng() * 6,
      state: 'walk', // walk | flee | down
      downTimer: 0,
      fleeTimer: 0,
      targetX: p.x,
      targetZ: p.z,
      ...built,
    };
    npc.group.position.set(npc.x, 0, npc.z);
    npc.group.rotation.y = npc.heading;
    scene.add(npc.group);
    npcs.push(npc);
  }

  // --- visual prototype: NPC[0] uses the rigged GLB female (CC0
  // Quaternius Casual Female). Loads async; the procedural NPC stays until
  // the GLB is ready, and stays permanently if it fails to load.
  loadGLBCharacter('./assets/Casual_Female.glb').then((c) => {
    if (!c) return;
    const npc = npcs[0];
    if (!npc) return;
    scene.remove(npc.group);
    npc.group = c.group;
    npc.glb = c;
    npc.group.position.set(npc.x, 0, npc.z);
    npc.group.rotation.y = npc.heading;
    scene.add(npc.group);
  });

  /** Knock an NPC down (punch / pistol / car hit). It gets up and flees. */
  function knockDown(npc) {
    if (!npc || npc.state === 'down') return;
    npc.state = 'down';
    npc.downTimer = 0;
    npc.group.rotation.x = -Math.PI / 2; // fall flat on the back
    npc.group.position.y = 0.25;
  }

  function update(dt, ctx) {
    const d = clamp(dt, 0, 0.05);
    const policeCars = (ctx && ctx.policeCars) || [];
    const chaseNear = (x, z, r) => {
      for (const c of policeCars) {
        if (Math.hypot(c.x - x, c.z - z) < r) return true;
      }
      return false;
    };
    for (const npc of npcs) {
      if (npc.state === 'down') {
        npc.downTimer += d;
        if (npc.downTimer > 2.2) {
          // Get up and flee from the player.
          npc.state = 'flee';
          npc.fleeTimer = 4;
          npc.group.rotation.x = 0;
          npc.group.position.y = 0;
          const away = Math.atan2(npc.x - player.x, npc.z - player.z);
          npc.heading = away;
        }
        continue;
      }
      // Flee triggers: a police chase nearby, the player attacking close,
      // or a fast car heading at them.
      let fleeing = npc.state === 'flee';
      if (chaseNear(npc.x, npc.z, 14)) fleeing = true;
      const pd = Math.hypot(player.x - npc.x, player.z - npc.z);
      if (pd < 3.5 && ctx && ctx.playerAttacking) fleeing = true;
      if (vehicles.driving && vehicles.car) {
        const cd = Math.hypot(vehicles.car.x - npc.x, vehicles.car.z - npc.z);
        if (cd < 6 && Math.abs(vehicles.car.speed) > 8) fleeing = true;
      }
      if (fleeing) {
        npc.state = 'flee';
        npc.fleeTimer = Math.max(npc.fleeTimer, 1.5);
        const away = Math.atan2(npc.x - player.x, npc.z - player.z);
        npc.heading += clamp(angleDelta(npc.heading, away), -3 * d, 3 * d);
        const spd = 3.4;
        npc.x += Math.sin(npc.heading) * spd * d;
        npc.z += Math.cos(npc.heading) * spd * d;
        npc.walkPhase += spd * d * 2.2;
        npc.fleeTimer -= d;
        if (npc.fleeTimer <= 0 && !chaseNear(npc.x, npc.z, 14)) npc.state = 'walk';
      } else {
        // Wander: walk toward the current target; pick a new sidewalk
        // target when close or after a while.
        npc.state = 'walk';
        const dx = npc.targetX - npc.x;
        const dz = npc.targetZ - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 2) {
          const p = sidewalkPoint(rng, roads);
          npc.targetX = p.x;
          npc.targetZ = p.z;
        } else {
          const desired = Math.atan2(dx, dz);
          npc.heading += clamp(angleDelta(npc.heading, desired), -2 * d, 2 * d);
          npc.x += Math.sin(npc.heading) * npc.speed * d;
          npc.z += Math.cos(npc.heading) * npc.speed * d;
          npc.walkPhase += npc.speed * d * 1.8;
        }
      }
      // Keep on the map and out of buildings.
      const resolved = resolveCollisions(npc.x, npc.z, 0.4, city.colliders);
      npc.x = clamp(resolved.x, -HALF + 4, HALF - 4);
      npc.z = clamp(resolved.z, -HALF + 4, HALF - 4);
      // Mesh + walk swing (GLB NPCs drive their AnimationMixer instead).
      npc.group.position.set(npc.x, 0, npc.z);
      npc.group.rotation.y = npc.heading;
      if (npc.glb) {
        const spd = npc.state === 'flee' ? 3.4 : npc.speed;
        npc.glb.update(d, spd, false);
      } else {
        const swing = Math.sin(npc.walkPhase) * 0.55;
        npc.legs[0].hip.rotation.x = swing;
        npc.legs[1].hip.rotation.x = -swing;
        npc.legs[0].knee.rotation.x = Math.max(0, -Math.sin(npc.walkPhase)) * 0.7;
        npc.legs[1].knee.rotation.x = Math.max(0, Math.sin(npc.walkPhase)) * 0.7;
        npc.arms[0].shoulder.rotation.x = -swing * 0.7;
        npc.arms[1].shoulder.rotation.x = swing * 0.7;
      }
    }
  }

  function reset() {
    for (const npc of npcs) {
      const p = sidewalkPoint(rng, roads);
      npc.x = p.x;
      npc.z = p.z;
      npc.state = 'walk';
      npc.downTimer = 0;
      npc.group.rotation.x = 0;
      npc.group.position.set(npc.x, 0, npc.z);
    }
  }

  return {
    update,
    knockDown,
    reset,
    get list() {
      return npcs;
    },
    get count() {
      return npcs.length;
    },
    getState() {
      let walking = 0;
      let fleeing = 0;
      let down = 0;
      for (const n of npcs) {
        if (n.state === 'walk') walking++;
        else if (n.state === 'flee') fleeing++;
        else down++;
      }
      return { count: npcs.length, walking, fleeing, down };
    },
  };
}
