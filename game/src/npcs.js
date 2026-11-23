// npcs.js — pedestrians for VICE BAY 3D (Stage 3). Written fresh in the
// rebuild recording. Eight varied walkers on the sidewalks; they flee from
// police chases and moving cars, and fall down when punched or shot, then
// get up and flee. Deterministic (seeded) spawn points, no network.

import * as THREE from 'three';
import { clamp, dampAngle, mulberry32, rand, pick } from './util.js';

const ROADS = [-192, -128, -64, 0, 64, 128, 192];
const SHIRTS = [0xd24a6a, 0x4a8ad2, 0xe8b04b, 0x6a4ad2, 0x3aa86a, 0xd2d2d2, 0x2a2a33, 0xc96a2b, 0x8a5a3a, 0x5a8a7a];
const PANTS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x2a4a2a, 0x6a6a7a];
const SKINS = [0xd9a066, 0xc98a5a, 0xe8b88a, 0x8a5a3a, 0xf2c9a0];
const HATS = [0xc22e2e, 0x2a4a8a, 0xe8b04b, null, null, null, null, null];

function buildNPCMesh(shirt, pants, skin, scale, hat) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  // Legs (pivot at the hip so they can swing).
  const legL = new THREE.Group();
  legL.position.set(-0.12, 0.9, 0);
  legL.add(box(0.17, 0.85, 0.19, pantsMat, 0, -0.42, 0));
  g.add(legL);
  const legR = new THREE.Group();
  legR.position.set(0.12, 0.9, 0);
  legR.add(box(0.17, 0.85, 0.19, pantsMat, 0, -0.42, 0));
  g.add(legR);
  // Torso + arms.
  g.add(box(0.5, 0.62, 0.28, shirtMat, 0, 1.22, 0));
  const armL = new THREE.Group();
  armL.position.set(-0.32, 1.48, 0);
  armL.add(box(0.14, 0.6, 0.15, shirtMat, 0, -0.3, 0));
  g.add(armL);
  const armR = new THREE.Group();
  armR.position.set(0.32, 1.48, 0);
  armR.add(box(0.14, 0.6, 0.15, shirtMat, 0, -0.3, 0));
  g.add(armR);
  // Head (+ optional hat).
  g.add(box(0.3, 0.3, 0.28, skinMat, 0, 1.68, 0));
  if (hat !== null) {
    g.add(box(0.32, 0.09, 0.3, new THREE.MeshStandardMaterial({ color: hat, roughness: 0.8 }), 0, 1.86, 0));
  }
  g.scale.setScalar(scale);
  return { group: g, legL, legR, armL, armR };
}

export function createNPCs(scene, opts) {
  const rng = mulberry32(11);
  const list = [];

  function sidewalkPoint() {
    // A point 8.5 m off a road centreline, inside the city.
    const road = pick(rng, ROADS);
    const along = rand(rng, -190, 190);
    const side = pick(rng, [-8.5, 8.5]);
    if (rng() < 0.5) return { x: road + side, z: along, axis: 'z' };
    return { x: along, z: road + side, axis: 'x' };
  }

  for (let i = 0; i < 8; i++) {
    const p = sidewalkPoint();
    const shirt = SHIRTS[i % SHIRTS.length];
    const pants = PANTS[i % PANTS.length];
    const skin = SKINS[i % SKINS.length];
    const scale = rand(rng, 0.92, 1.08);
    const hat = HATS[i % HATS.length];
    const parts = buildNPCMesh(shirt, pants, skin, scale, hat);
    parts.group.position.set(p.x, 0, p.z);
    const heading = p.axis === 'z' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    parts.group.rotation.y = heading;
    scene.add(parts.group);
    list.push({
      ...parts,
      x: p.x, z: p.z, heading, axis: p.axis,
      speed: rand(rng, 1.0, 1.5), phase: rng() * 6.28,
      down: false, downT: 0, flee: 0, fleeX: 0, fleeZ: 0,
      id: i,
    });
  }

  function update(dt, player, police, vehicles) {
    for (const n of list) {
      if (n.down) {
        // Lying flat; get up after 2 s, then flee.
        n.downT += dt;
        n.group.rotation.x = dampAngle(n.group.rotation.x, -Math.PI / 2, 8, dt);
        if (n.downT > 2) {
          n.down = false;
          n.downT = 0;
          n.group.rotation.x = 0;
          n.flee = 3;
          const a = Math.atan2(n.x - player.x, n.z - player.z);
          n.fleeX = Math.sin(a);
          n.fleeZ = Math.cos(a);
        }
        continue;
      }
      // --- flee triggers: police chase within 12 m, moving car within 5 m ---
      let fx = 0;
      let fz = 0;
      let fleeing = n.flee > 0;
      if (police) {
        for (const c of police.list) {
          const d = Math.hypot(c.x - n.x, c.z - n.z);
          if (d < 12) {
            fleeing = true;
            fx += (n.x - c.x) / (d || 1);
            fz += (n.z - c.z) / (d || 1);
          }
        }
      }
      if (vehicles) {
        const all = [...vehicles.cars, ...vehicles.traffic];
        if (vehicles.driving) all.push(vehicles.driving);
        for (const car of all) {
          const d = Math.hypot(car.x - n.x, car.z - n.z);
          if (d < 5 && Math.abs(car.speed || 0) > 2) {
            fleeing = true;
            fx += (n.x - car.x) / (d || 1);
            fz += (n.z - car.z) / (d || 1);
          }
        }
      }
      if (fleeing) {
        if (n.flee <= 0) {
          const len = Math.hypot(fx, fz) || 1;
          n.fleeX = fx / len;
          n.fleeZ = fz / len;
          n.flee = 2;
        }
        n.flee = Math.max(0, n.flee - dt);
        const targetHeading = Math.atan2(n.fleeX, n.fleeZ);
        n.heading = dampAngle(n.heading, targetHeading, 6, dt);
        n.speed = dampAngle(n.speed, 3.2, 2, dt);
        n.x += Math.sin(n.heading) * n.speed * dt;
        n.z += Math.cos(n.heading) * n.speed * dt;
      } else {
        // Stroll along the sidewalk; turn around at the city edge.
        n.speed = dampAngle(n.speed, 1.2, 2, dt);
        n.x += Math.sin(n.heading) * n.speed * dt;
        n.z += Math.cos(n.heading) * n.speed * dt;
        const atEdge = n.axis === 'z'
          ? (n.z > 195 || n.z < -195)
          : (n.x > 195 || n.x < -195);
        if (atEdge) n.heading += Math.PI;
      }
      n.x = clamp(n.x, -235, 235);
      n.z = clamp(n.z, -235, 235);
      // Walk swing.
      n.phase += n.speed * dt * 3.2;
      const s = Math.sin(n.phase) * 0.5;
      n.legL.rotation.x = s;
      n.legR.rotation.x = -s;
      n.armL.rotation.x = -s * 0.7;
      n.armR.rotation.x = s * 0.7;
      n.group.position.set(n.x, 0, n.z);
      n.group.rotation.y = n.heading;
    }
  }

  function knockDown(npc) {
    if (!npc || npc.down) return false;
    npc.down = true;
    npc.downT = 0;
    return true;
  }

  // Nearest NPC within maxDist of (x, z) and within maxAngle of `heading`.
  function nearestInFront(x, z, heading, maxDist, maxAngle) {
    let best = null;
    let bestD = maxDist;
    for (const n of list) {
      if (n.down) continue;
      const dx = n.x - x;
      const dz = n.z - z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const ang = Math.abs(((Math.atan2(dx, dz) - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (ang > maxAngle) continue;
      best = n;
      bestD = d;
    }
    return best;
  }

  function reset() {
    for (const n of list) {
      const p = sidewalkPoint();
      n.x = p.x;
      n.z = p.z;
      n.axis = p.axis;
      n.heading = p.axis === 'z' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      n.down = false;
      n.downT = 0;
      n.flee = 0;
      n.speed = 1.2;
      n.group.rotation.x = 0;
      n.group.position.set(n.x, 0, n.z);
      n.group.rotation.y = n.heading;
    }
  }

  return {
    update,
    knockDown,
    nearestInFront,
    reset,
    get list() {
      return list.map((n) => ({ id: n.id, x: n.x, z: n.z, heading: n.heading, down: n.down, speed: n.speed }));
    },
    get all() { return list; },
  };
}
