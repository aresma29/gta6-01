// VICE BAY 3D — pedestrians: varied NPCs walking the sidewalks, fleeing
// from police chases and attacks, knocked down by punches and cars. All
// geometry is procedural humanoids with varied outfits and proportions;
// no external assets. Written fresh for Stage 3.
import * as THREE from '../vendor/three/three.module.min.js';
import { makeHumanoid, poseHumanoid } from './actors.js';
import { clamp, lerpAngle, dist2D, makeRng } from './util.js';
import { ROADS, resolveCollision } from './city.js';

const SHIRTS = [0x3a7ac0, 0x4a9a4a, 0xd8a03a, 0x8a5ac0, 0xe8e8e8, 0x2a2a2a, 0xc05a7a, 0x5a9a8a, 0xc0392b, 0x7a9a3a];
const PANTS = [0x2c3e50, 0x5a4a3a, 0x7a7f88, 0x3a3a4a, 0x4a5a6a];
const SKINS = [0xc9976b, 0x8a5a3a, 0xe8b88a, 0x6a4a2a, 0xd8a070];
const COUNT = 8;

export function createNPCs(scene, city, count = COUNT) {
  const rng = makeRng(4242);
  const list = [];

  // A sidewalk point: beside a road line, offset ~8.5 m (off the asphalt).
  function sidewalkTarget() {
    const r = ROADS[Math.floor(rng.next() * ROADS.length)];
    const c = rng.range(-200, 200);
    const side = rng.chance(0.5) ? 8.5 : -8.5;
    if (rng.chance(0.5)) return { x: r + side, z: c };
    return { x: c, z: r + side };
  }

  for (let i = 0; i < count; i++) {
    const h = makeHumanoid({
      shirt: SHIRTS[Math.floor(rng.next() * SHIRTS.length)],
      pants: PANTS[Math.floor(rng.next() * PANTS.length)],
      skin: SKINS[Math.floor(rng.next() * SKINS.length)],
      scale: rng.range(0.92, 1.08),
      hat: i === 2 || i === 5,
    });
    const t = sidewalkTarget();
    const n = {
      mesh: h,
      x: t.x, z: t.z,
      heading: rng.next() * Math.PI * 2,
      speed: 0, walkSpeed: rng.range(1.2, 1.8),
      walkPhase: rng.next() * 6,
      target: sidewalkTarget(),
      state: 'walk', // 'walk' | 'flee' | 'down'
      stateT: 0, downK: 0,
      threatX: 0, threatZ: 0,
    };
    h.group.position.set(n.x, 0, n.z);
    h.group.rotation.y = n.heading;
    scene.add(h.group);
    list.push(n);
  }

  function fleeFrom(n, tx, tz) {
    n.state = 'flee';
    n.stateT = 3;
    n.threatX = tx; n.threatZ = tz;
  }

  function update(dt, player, vehicles, police) {
    const playerCar = vehicles.playerCar;
    for (const n of list) {
      if (n.state === 'down') {
        n.stateT -= dt;
        n.downK = Math.min(1, n.downK + dt * 4);
        if (n.stateT <= 0) {
          n.state = 'flee';
          n.stateT = 3;
          n.threatX = player.x; n.threatZ = player.z;
        }
      } else {
        n.downK = Math.max(0, n.downK - dt * 3);
        // Threats: a police chase passing by, or a moving car closing in.
        if (n.state !== 'flee') {
          if (police && police.wanted > 0) {
            for (const c of police.cars) {
              if (dist2D(n.x, n.z, c.x, c.z) < 12) { fleeFrom(n, c.x, c.z); break; }
            }
          }
          if (n.state !== 'flee' && playerCar && Math.abs(playerCar.speed) > 3) {
            if (dist2D(n.x, n.z, playerCar.x, playerCar.z) < 5) fleeFrom(n, playerCar.x, playerCar.z);
          }
        }
        if (n.state === 'flee') {
          n.stateT -= dt;
          const away = Math.atan2(n.x - n.threatX, n.z - n.threatZ);
          n.heading = lerpAngle(n.heading, away, 1 - Math.exp(-6 * dt));
          n.speed = 4.5;
          if (n.stateT <= 0) { n.state = 'walk'; n.target = sidewalkTarget(); }
        } else {
          // Walk to the current sidewalk target, then pick a new one.
          const dx = n.target.x - n.x, dz = n.target.z - n.z;
          const d = Math.hypot(dx, dz);
          if (d < 2) { n.target = sidewalkTarget(); }
          else {
            n.heading = lerpAngle(n.heading, Math.atan2(dx, dz), 1 - Math.exp(-4 * dt));
            n.speed = n.walkSpeed;
          }
        }
        n.x += Math.sin(n.heading) * n.speed * dt;
        n.z += Math.cos(n.heading) * n.speed * dt;
        const res = resolveCollision(city.colliders, n.x, n.z, 0.5);
        n.x = res.x; n.z = res.z;
        n.x = clamp(n.x, -235, 235); n.z = clamp(n.z, -235, 206);
      }
      // Pose: walk/run swing; lying flat while down (lerped by downK).
      n.walkPhase += n.speed * dt * 1.7;
      const amp = n.state === 'flee' ? 0.95 : (n.state === 'walk' ? 0.6 : 0);
      poseHumanoid(n.mesh, n.walkPhase, amp, 0, 0);
      n.mesh.group.position.set(n.x, 0, n.z);
      n.mesh.group.rotation.y = n.heading;
      n.mesh.group.rotation.x = -1.5 * n.downK;
    }
  }

  // Knock an NPC down (punch, pistol, car hit): they fall, then flee.
  function hit(n, fromX, fromZ, knock) {
    const d = dist2D(n.x, n.z, fromX, fromZ) || 1;
    const ux = (n.x - fromX) / d, uz = (n.z - fromZ) / d;
    const res = resolveCollision(city.colliders, n.x + ux * 1.5 * knock, n.z + uz * 1.5 * knock, 0.5);
    n.x = clamp(res.x, -235, 235);
    n.z = clamp(res.z, -235, 206);
    n.state = 'down';
    n.stateT = 1.5;
    return true;
  }

  // Nearest NPC within maxDist and (optionally) in front of a heading.
  function nearest(x, z, maxDist, heading, maxAngle) {
    let best = null, bd = maxDist;
    for (const n of list) {
      const d = dist2D(x, z, n.x, n.z);
      if (d >= bd) continue;
      if (heading !== undefined && maxAngle !== undefined) {
        const want = Math.atan2(n.x - x, n.z - z);
        let diff = Math.abs(want - heading) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > maxAngle) continue;
      }
      bd = d; best = n;
    }
    return best;
  }

  function place(i, x, z, heading) {
    const n = list[i];
    if (!n) return;
    n.x = x; n.z = z; n.heading = heading;
    n.state = 'walk'; n.stateT = 0; n.downK = 0;
    n.target = { x: x + Math.sin(heading) * 30, z: z + Math.cos(heading) * 30 };
    n.mesh.group.position.set(x, 0, z);
    n.mesh.group.rotation.y = heading;
    n.mesh.group.rotation.x = 0;
  }

  function reset() {
    for (const n of list) {
      const t = sidewalkTarget();
      n.x = t.x; n.z = t.z;
      n.state = 'walk'; n.stateT = 0; n.downK = 0;
      n.target = sidewalkTarget();
      n.mesh.group.position.set(n.x, 0, n.z);
      n.mesh.group.rotation.x = 0;
    }
  }

  return { list, update, hit, nearest, place, reset };
}
