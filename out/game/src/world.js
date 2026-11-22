// VICE BAY — the world: player, cars, traffic, pedestrians, police,
// rivals, missions and the wanted system. One fixed-step update per call.
// Everything here is plain data + arithmetic; rendering lives in render.js.

import {
  WORLD, PLAYER, CAR, TRAFFIC, PED, POLICE, WANTED, ENEMY, MISSIONS,
} from './config.js';
import {
  buildCity, blockedAt, resolveCollision, isOnRoadX, isOnRoadY,
  randomRoadPoint, randomWalkPoint, LANDMARKS,
} from './city.js';
import { makeRng, pick } from './rng.js';

export const EVENT_PICKUP = 1;
export const EVENT_PUNCH = 2;
export const EVENT_HURT = 4;
export const EVENT_CRASH = 8;
export const EVENT_STEAL = 16;
export const EVENT_MISSION = 32;
export const EVENT_FAIL = 64;
export const EVENT_BUSTED = 128;
export const EVENT_WASTED = 256;
export const EVENT_WANTED = 512;
export const EVENT_MONEY = 1024;

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function makeCar(x, y, angle, colour, kind) {
  return {
    x, y, angle, speed: 0, colour, kind: kind || 'parked',
    health: 100, driver: kind === 'traffic',
    steer: 0, alongX: true, dir: 1, cruise: TRAFFIC.speed,
    turnCooldown: 0, ramCooldown: 0,
  };
}

export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(seed);
  const world = {
    seed,
    city,
    time: 0,
    state: 'title',
    player: {
      x: LANDMARKS.garage.x + 40,
      y: LANDMARKS.garage.y + 120,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      health: PLAYER.health, money: 0,
      inCar: null, punchCooldown: 0, hurtCooldown: 0,
    },
    cars: [],
    peds: [],
    enemies: [],
    pickups: [],
    wanted: 0,
    wantedTimer: 0,
    lastCrimeAt: -999,
    missionIndex: 0,
    mission: null,
    missionMsg: '',
    missionMsgAt: 0,
    defeated: 0,
    allDone: false,
    camera: { x: 0, y: 0 },
    bustedAt: 0,
    wastedAt: 0,
    stats: { stolen: 0, defeated: 0, missions: 0, earned: 0 },
    policeGrab: 0,
    events: 0,
  };
  seedCars(world, rng);
  seedPeds(world, rng);
  startMission(world, 0);
  return world;
}

function seedCars(world, rng) {
  // Parked cars along the roads (free to take) plus the traffic fleet.
  const colours = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#f1c40f', '#16a085'];
  for (let i = 0; i < 14; i += 1) {
    const p = randomRoadPoint(rng);
    const along = p.alongX;
    const off = (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 - 24);
    const x = along ? p.x : p.x + off;
    const y = along ? p.y + off : p.y;
    const angle = along ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    if (blockedAt(world.city, x, y, 30)) continue;
    world.cars.push(makeCar(x, y, angle, pick(rng, colours), 'parked'));
  }
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const p = randomRoadPoint(rng);
    const car = makeCar(p.x, p.y, p.alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(rng, colours), 'traffic');
    car.alongX = p.alongX;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.cruise = TRAFFIC.speed * (0.85 + rng() * 0.3);
    car.speed = car.cruise;
    world.cars.push(car);
  }
}

function seedPeds(world, rng) {
  for (let i = 0; i < PED.count; i += 1) {
    const p = randomWalkPoint(rng);
    world.peds.push({
      id: i, x: p.x, y: p.y, angle: rng() * TAU,
      speed: PED.speed * (0.7 + rng() * 0.6),
      tx: p.x, ty: p.y, down: 0, runAway: 0,
      colour: pick(rng, ['#e8e8e8', '#f5d76e', '#7fb3d5', '#d98880']),
    });
  }
}

function setMessage(world, text) {
  world.missionMsg = text;
  world.missionMsgAt = world.time;
}

/** (Re)start the mission at `index`; index >= missions.length means done. */
export function startMission(world, index) {
  world.missionIndex = index;
  world.defeated = 0;
  if (index >= MISSIONS.length) {
    world.mission = null;
    world.allDone = true;
    setMessage(world, 'KING OF VICE BAY — every job done. Free roam!');
    return;
  }
  const m = MISSIONS[index];
  let stage = 'target';
  if (m.pickup) stage = 'pickup';
  else if (m.id === 'turf') stage = 'defeat';
  const mission = {
    id: m.id, name: m.name, giver: m.giver, text: m.text,
    target: m.target || null, targetLabel: m.targetLabel || '',
    pickup: m.pickup || null, pickupLabel: m.pickupLabel || '',
    reward: m.reward, timeLeft: m.timeLimit || 0,
    stage,
    needCar: !!m.needCar, defeatCount: m.defeatCount || 0,
    vanAt: m.vanAt || null, vanLabel: m.vanLabel || '',
    van: null,
  };
  world.mission = mission;
  if (m.wantedOnStart) {
    world.wanted = Math.max(world.wanted, m.wantedOnStart);
    world.lastCrimeAt = world.time;
  }
  if (m.id === 'score' && m.vanAt) {
    const van = makeCar(m.vanAt.x, m.vanAt.y, Math.PI / 2, '#b0b6bd', 'van');
    van.health = 200;
    world.cars.push(van);
    mission.van = van;
  }
  if (m.id === 'turf') {
    spawnEnemies(world, LANDMARKS.plaza.x, LANDMARKS.plaza.y, 6);
  }
  setMessage(world, `${m.name} — ${m.text}`);
}

function spawnEnemies(world, cx, cy, count) {
  const rng = makeRng(world.seed + world.missionIndex * 7919 + 13);
  for (let i = 0; i < count; i += 1) {
    const a = rng() * TAU;
    const r = 60 + rng() * 180;
    world.enemies.push({
      id: world.enemies.length + i,
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      angle: rng() * TAU, health: ENEMY.health,
      attackCooldown: 0, down: 0, wander: 0,
    });
  }
}

function nearestCar(world, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (let i = 0; i < world.cars.length; i += 1) {
    const c = world.cars[i];
    if (c.kind === 'police' || c.kind === 'wreck') continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function addWanted(world, amount) {
  if (amount <= 0) return;
  const before = world.wanted;
  world.wanted = Math.min(WANTED.max, world.wanted + amount);
  world.lastCrimeAt = world.time;
  world.wantedTimer = 0;
  if (world.wanted > before) world.events |= EVENT_WANTED;
}

function respawn(world, kind) {
  const p = world.player;
  p.x = LANDMARKS.hospital.x + 60;
  p.y = LANDMARKS.hospital.y + 60;
  p.vx = 0;
  p.vy = 0;
  p.health = PLAYER.health;
  p.inCar = null;
  p.punchCooldown = 0;
  world.wanted = 0;
  world.policeGrab = 0;
  const lost = Math.floor(p.money * 0.2);
  p.money -= lost;
  if (kind === 'busted') {
    world.bustedAt = world.time;
    setMessage(world, `BUSTED — the force took $${lost}. Back on the street.`);
  } else {
    world.wastedAt = world.time;
    setMessage(world, `WASTED — the hospital patched you up. Lost $${lost}.`);
  }
  // A timed mission restarts on respawn; the others keep their progress.
  if (world.mission && world.mission.id === 'package') {
    startMission(world, world.missionIndex);
  }
}

function completeMission(world) {
  const m = world.mission;
  if (!m) return;
  world.player.money += m.reward;
  world.stats.missions += 1;
  world.stats.earned += m.reward;
  setMessage(world, `${m.name} COMPLETE — +$${m.reward}`);
  startMission(world, world.missionIndex + 1);
}

function updatePlayer(world, dt, input) {
  const p = world.player;
  const axes = input.axes;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.hurtCooldown > 0) p.hurtCooldown -= dt;

  if (p.inCar) {
    updateDriving(world, dt, input);
    return;
  }

  // On foot: accelerate toward the wanted velocity, then move + collide.
  const running = input.run;
  const top = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const tx = axes.x * top;
  const ty = axes.y * top;
  p.vx += (tx - p.vx) * Math.min(1, (PLAYER.accel / top) * dt);
  p.vy += (ty - p.vy) * Math.min(1, (PLAYER.accel / top) * dt);
  if (Math.abs(p.vx) > 4 || Math.abs(p.vy) > 4) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  resolveCollision(world.city, p, PLAYER.radius);

  // Enter a car.
  if (input.enter) {
    const car = nearestCar(world, p.x, p.y, CAR.enterRange);
    if (car) {
      if (car.kind === 'traffic' && car.driver) {
        // Steal it: the driver bails out as a pedestrian.
        car.driver = false;
        world.peds.push({
          id: world.peds.length + 1000, x: car.x + 40, y: car.y + 40,
          angle: 0, speed: PED.speed, tx: car.x + 200, ty: car.y + 200,
          down: 0, runAway: 2, colour: '#f5d76e',
        });
        addWanted(world, WANTED.stealCar);
        world.stats.stolen += 1;
        world.events |= EVENT_STEAL;
        setMessage(world, 'Car stolen — the driver called it in. Lose the heat!');
      }
      p.inCar = car;
      car.kind = car.kind === 'van' ? 'van' : 'player';
      car.speed = 0;
    }
  }

  // Punch.
  if (input.attack && p.punchCooldown <= 0) {
    p.punchCooldown = PLAYER.punchCooldown;
    world.events |= EVENT_PUNCH;
    punch(world);
  }
}

function punch(world) {
  const p = world.player;
  // Rivals first.
  for (let i = 0; i < world.enemies.length; i += 1) {
    const e = world.enemies[i];
    if (e.down > 0) continue;
    const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
    if (d < PLAYER.punchRange + ENEMY.radius) {
      const facing = Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.angle));
      if (facing < Math.PI * 0.75) {
        e.health -= PLAYER.punchDamage;
        if (e.health <= 0) {
          e.down = 999;
          world.stats.defeated += 1;
          world.player.money += ENEMY.dropMoney;
          world.events |= EVENT_MONEY;
          if (world.mission && world.mission.id === 'turf') {
            world.defeated += 1;
            setMessage(world, `Rival down — ${world.defeated}/${world.mission.defeatCount}`);
          }
        }
        return;
      }
    }
  }
  // Civilians: hitting one is a crime.
  for (let i = 0; i < world.peds.length; i += 1) {
    const ped = world.peds[i];
    if (ped.down > 0) continue;
    const d = Math.sqrt(dist2(p.x, p.y, ped.x, ped.y));
    if (d < PLAYER.punchRange + 12) {
      ped.down = 2.5;
      ped.runAway = 4;
      addWanted(world, WANTED.hitPed);
      return;
    }
  }
}

function updateDriving(world, dt, input) {
  const p = world.player;
  const car = p.inCar;
  if (!car) {
    p.inCar = null;
    return;
  }
  const axes = input.axes;
  // Throttle: W accelerates, S brakes (or reverses once stopped).
  let throttle = 0;
  if (axes.y < 0) throttle = 1;
  else if (axes.y > 0) throttle = car.speed > 5 ? -1.4 : -0.6;
  const steer = axes.x;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) car.speed += CAR.brake * throttle * dt;
  else car.speed *= Math.max(0, 1 - 1.6 * dt);
  car.speed = clamp(car.speed, -CAR.reverseTop, CAR.topSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 180, 0, 1);
  car.angle += steer * CAR.steer * steerAuthority * (car.speed >= 0 ? 1 : -1) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!blockedAt(world.city, nx, ny, 24)) {
    car.x = nx;
    car.y = ny;
  } else if (!blockedAt(world.city, nx, car.y, 24)) {
    car.x = nx;
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 200) {
      car.health -= 6;
      world.events |= EVENT_CRASH;
    }
  } else if (!blockedAt(world.city, car.x, ny, 24)) {
    car.y = ny;
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 200) {
      car.health -= 6;
      world.events |= EVENT_CRASH;
    }
  } else {
    if (Math.abs(car.speed) > 240) {
      car.health -= 10;
      world.events |= EVENT_CRASH;
    }
    car.speed *= -0.25;
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Wrecked: the player is thrown out on foot.
  if (car.health <= 0) {
    car.health = 0;
    car.kind = 'wreck';
    p.inCar = null;
    p.x = car.x + 50;
    p.y = car.y + 50;
    p.vx = 0;
    p.vy = 0;
    resolveCollision(world.city, p, PLAYER.radius);
    setMessage(world, 'Your ride is wrecked. Find another one.');
  }
  // Get out.
  if (input.enter) {
    p.inCar = null;
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 44;
    p.y = car.y + Math.sin(side) * 44;
    p.vx = 0;
    p.vy = 0;
    resolveCollision(world.city, p, PLAYER.radius);
    if (car.kind === 'player') car.kind = 'parked';
  }
}

function updateTraffic(world, dt) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    if (c.kind !== 'traffic') continue;
    // Slow down for the car ahead on the same road.
    let blocked = false;
    for (let j = 0; j < cars.length; j += 1) {
      if (i === j) continue;
      const o = cars[j];
      if (o.kind === 'police') continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      const side = Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle));
      if (ahead > 0 && ahead < TRAFFIC.minGap && side < 40) {
        blocked = true;
        break;
      }
    }
    const target = blocked ? 0 : c.cruise;
    c.speed += (target - c.speed) * Math.min(1, 2 * dt);
    // At an intersection, sometimes turn onto the cross road.
    c.turnCooldown -= dt;
    if (c.turnCooldown <= 0) {
      const onCrossX = isOnRoadX(c.x);
      const onCrossY = isOnRoadY(c.y);
      if (onCrossX && onCrossY) {
        c.turnCooldown = 1.2;
        if (Math.random() < 0.3) {
          if (c.alongX) {
            c.alongX = false;
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            c.x = nearestRoadX(c.x);
          } else {
            c.alongX = true;
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.angle = c.dir > 0 ? 0 : Math.PI;
            c.y = nearestRoadY(c.y);
          }
        }
      }
    }
    // Turn around at the map edges.
    if (c.alongX && (c.x < 320 || c.x > WORLD.width - 80)) {
      c.dir *= -1;
      c.angle = c.dir > 0 ? 0 : Math.PI;
    }
    if (!c.alongX && (c.y < 80 || c.y > WORLD.height - 200)) {
      c.dir *= -1;
      c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.speed > 0 && blockedAt(world.city, c.x, c.y, 22)) {
      // Nudged off the road: snap back to the nearest road centre line.
      if (c.alongX) c.y = nearestRoadY(c.y);
      else c.x = nearestRoadX(c.x);
    }
  }
}

function nearestRoadX(x) {
  let best = WORLD.roadsX[0];
  let bestD = Math.abs(x - best);
  for (let i = 1; i < WORLD.roadsX.length; i += 1) {
    const d = Math.abs(x - WORLD.roadsX[i]);
    if (d < bestD) {
      bestD = d;
      best = WORLD.roadsX[i];
    }
  }
  return best;
}

function nearestRoadY(y) {
  let best = WORLD.roadsY[0];
  let bestD = Math.abs(y - best);
  for (let i = 1; i < WORLD.roadsY.length; i += 1) {
    const d = Math.abs(y - WORLD.roadsY[i]);
    if (d < bestD) {
      bestD = d;
      best = WORLD.roadsY[i];
    }
  }
  return best;
}

function updatePeds(world, dt) {
  const p = world.player;
  for (let i = 0; i < world.peds.length; i += 1) {
    const ped = world.peds[i];
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    if (ped.runAway > 0) ped.runAway -= dt;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const np = randomWalkPoint(makeRng((world.seed + i * 31 + Math.floor(world.time * 7)) >>> 0));
      ped.tx = np.x;
      ped.ty = np.y;
      continue;
    }
    const speed = ped.runAway > 0 ? PED.speed * 2.2 : ped.speed;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    if (blockedAt(world.city, ped.x, ped.y, 10)) {
      ped.tx = ped.x - dx;
      ped.ty = ped.y - dy;
    }
    // A car hitting a pedestrian knocks them down; the player's car is a crime.
    for (let j = 0; j < world.cars.length; j += 1) {
      const c = world.cars[j];
      if (c.kind === 'parked' || c.kind === 'wreck') continue;
      if (Math.abs(c.speed) < 40) continue;
      if (dist2(ped.x, ped.y, c.x, c.y) < 34 * 34) {
        ped.down = 2.5;
        ped.runAway = 4;
        if (c === p.inCar) {
          addWanted(world, WANTED.hitPed);
          world.events |= EVENT_CRASH;
        }
        break;
      }
    }
  }
}

function updatePolice(world, dt) {
  const p = world.player;
  const wantedCount = Math.min(world.wanted, POLICE.maxCars);
  let police = world.cars.filter((c) => c.kind === 'police');
  // Spawn more while the heat is on (at the map corners, off screen).
  if (police.length < wantedCount) {
    const edge = [
      { x: 300, y: 200 }, { x: 2900, y: 200 },
      { x: 300, y: 2100 }, { x: 2900, y: 2100 },
    ];
    const spot = edge[Math.floor(Math.random() * edge.length)];
    const car = makeCar(spot.x, spot.y, angleTo(spot.x, spot.y, p.x, p.y), '#1f2a37', 'police');
    car.health = 150;
    world.cars.push(car);
    police = world.cars.filter((c) => c.kind === 'police');
  }
  // Any police car far from a cold trail gives up and leaves.
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const c = world.cars[i];
    if (c.kind !== 'police') continue;
    if (world.wanted === 0 && Math.sqrt(dist2(c.x, c.y, p.x, p.y)) > 1400) {
      world.cars.splice(i, 1);
    }
  }
  // Chase: steer toward the player, ram on contact.
  for (let i = 0; i < police.length; i += 1) {
    const c = police[i];
    if (c.ramCooldown > 0) c.ramCooldown -= dt;
    const want = angleTo(c.x, c.y, p.x, p.y);
    const diff = angleDiff(want, c.angle);
    c.angle += clamp(diff, -POLICE.steer * dt, POLICE.steer * dt);
    c.speed += (POLICE.topSpeed - c.speed) * Math.min(1, 1.4 * dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!blockedAt(world.city, nx, ny, 24)) {
      c.x = nx;
      c.y = ny;
    } else {
      c.speed *= 0.5;
      c.angle += 0.6 * dt;
    }
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    // Ram the player's car.
    if (p.inCar && d < 62 && c.ramCooldown <= 0) {
      c.ramCooldown = 1.0;
      p.inCar.health -= POLICE.ramDamage;
      p.inCar.speed *= 0.6;
      world.events |= EVENT_CRASH;
      if (p.inCar.health <= 0) {
        p.inCar.health = 0;
        p.inCar.kind = 'wreck';
        p.inCar = null;
        p.x = c.x + 60;
        p.y = c.y + 60;
        resolveCollision(world.city, p, PLAYER.radius);
        setMessage(world, 'Your ride is wrecked. Run!');
      }
    }
    // Grab the player on foot.
    if (!p.inCar && d < 46) {
      world.policeGrab += dt;
      if (world.policeGrab >= POLICE.grabSeconds) {
        world.policeGrab = 0;
        world.events |= EVENT_BUSTED;
        respawn(world, 'busted');
        return;
      }
    } else {
      world.policeGrab = Math.max(0, world.policeGrab - dt * 2);
    }
  }
  // Wanted decays when no crime lately and no police car can see the player.
  if (world.wanted > 0 && world.time - world.lastCrimeAt > POLICE.decaySeconds) {
    let seen = false;
    for (let i = 0; i < police.length; i += 1) {
      if (Math.sqrt(dist2(police[i].x, police[i].y, p.x, p.y)) < POLICE.sightRange) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      world.wantedTimer += dt;
      if (world.wantedTimer > 3) {
        world.wanted -= 1;
        world.wantedTimer = 0;
        setMessage(world, world.wanted === 0 ? 'Clean — the heat is off.' : `Wanted down to ${world.wanted} star${world.wanted === 1 ? '' : 's'}.`);
      }
    } else {
      world.wantedTimer = 0;
    }
  }
}

function updateEnemies(world, dt) {
  const p = world.player;
  for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
    const e = world.enemies[i];
    if (e.down > 0) {
      if (e.down === 999) {
        world.enemies.splice(i, 1);
        continue;
      }
      e.down -= dt;
      continue;
    }
    if (e.attackCooldown > 0) e.attackCooldown -= dt;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    if (d < ENEMY.chaseRange && !p.inCar) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.x += Math.cos(e.angle) * ENEMY.speed * dt;
      e.y += Math.sin(e.angle) * ENEMY.speed * dt;
      resolveCollision(world.city, e, ENEMY.radius);
      if (d < ENEMY.attackRange && e.attackCooldown <= 0) {
        e.attackCooldown = ENEMY.attackCooldown;
        if (p.hurtCooldown <= 0) {
          p.health -= ENEMY.damage;
          p.hurtCooldown = 0.6;
          world.events |= EVENT_HURT;
          if (p.health <= 0) {
            p.health = 0;
            world.events |= EVENT_WASTED;
            respawn(world, 'wasted');
            return;
          }
        }
      }
    } else {
      // Wander around the plaza.
      e.wander -= dt;
      if (e.wander <= 0) {
        e.wander = 1 + Math.random() * 2;
        e.angle = Math.random() * TAU;
      }
      e.x += Math.cos(e.angle) * ENEMY.speed * 0.5 * dt;
      e.y += Math.sin(e.angle) * ENEMY.speed * 0.5 * dt;
      resolveCollision(world.city, e, ENEMY.radius);
    }
  }
}

function updatePickups(world, dt) {
  const p = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pk = world.pickups[i];
    pk.age += dt;
    if (pk.age > 25) {
      world.pickups.splice(i, 1);
      continue;
    }
    if (dist2(p.x, p.y, pk.x, pk.y) < 36 * 36) {
      if (pk.kind === 'health') {
        p.health = Math.min(PLAYER.health, p.health + 40);
        world.events |= EVENT_PICKUP;
      } else {
        p.money += pk.amount;
        world.events |= EVENT_MONEY;
      }
      world.pickups.splice(i, 1);
    }
  }
  // Keep a couple of health pickups around the city.
  const healthCount = world.pickups.filter((k) => k.kind === 'health').length;
  if (healthCount < 3 && Math.random() < dt * 0.1) {
    const spots = [
      LANDMARKS.hospital, LANDMARKS.plaza, LANDMARKS.market, LANDMARKS.beach,
    ];
    const s = spots[Math.floor(Math.random() * spots.length)];
    world.pickups.push({
      kind: 'health', x: s.x + (Math.random() - 0.5) * 160,
      y: s.y + (Math.random() - 0.5) * 160, age: 0, amount: 0,
    });
  }
}

function updateMissions(world, dt) {
  const m = world.mission;
  const p = world.player;
  if (!m) return;
  if (m.timeLeft > 0) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      world.events |= EVENT_FAIL;
      setMessage(world, `${m.name} FAILED — out of time. Try again.`);
      startMission(world, world.missionIndex);
      return;
    }
  }
  const at = (t, range) => t && Math.sqrt(dist2(p.x, p.y, t.x, t.y)) < range;
  if (m.stage === 'pickup' && at(m.pickup, 80)) {
    m.stage = 'target';
    world.events |= EVENT_PICKUP;
    setMessage(world, `Package picked up — deliver it to the ${m.targetLabel}.`);
    return;
  }
  if (m.stage === 'defeat') {
    if (world.defeated >= m.defeatCount) {
      world.events |= EVENT_MISSION;
      completeMission(world);
    }
    return;
  }
  if (m.stage === 'target') {
    if (m.id === 'wheels') {
      if (p.inCar && at(m.target, 110)) {
        world.events |= EVENT_MISSION;
        completeMission(world);
      }
      return;
    }
    if (m.id === 'score') {
      if (m.van && p.inCar === m.van && at(m.target, 130)) {
        world.events |= EVENT_MISSION;
        completeMission(world);
      }
      return;
    }
    if (m.id === 'getaway') {
      if (at(m.target, 110)) {
        world.wanted = 0;
        world.events |= EVENT_MISSION;
        completeMission(world);
      }
      return;
    }
    if (at(m.target, 100)) {
      world.events |= EVENT_MISSION;
      completeMission(world);
    }
  }
}

function updateCamera(world) {
  const p = world.player;
  const viewW = 1280;
  const viewH = 720;
  const tx = clamp(p.x - viewW / 2, 0, WORLD.width - viewW);
  const ty = clamp(p.y - viewH / 2, 0, WORLD.height - viewH);
  world.camera.x += (tx - world.camera.x) * 0.12;
  world.camera.y += (ty - world.camera.y) * 0.12;
}

/** One fixed step. `input` is { axes, run, enter, attack }. Returns events. */
export function stepWorld(world, dt, input) {
  world.events = 0;
  world.time += dt;
  updatePlayer(world, dt, input);
  updateTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt);
  updateEnemies(world, dt);
  updatePickups(world, dt);
  updateMissions(world, dt);
  // Slow health regen out of combat.
  const p = world.player;
  if (p.hurtCooldown <= 0 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + 1.6 * dt);
  }
  updateCamera(world);
  return world.events;
}

/** Reset the run (new game) but keep the city and the seed. */
export function resetRun(world) {
  const seed = world.seed;
  const fresh = createWorld(seed);
  world.player = fresh.player;
  world.cars = fresh.cars;
  world.peds = fresh.peds;
  world.enemies = fresh.enemies;
  world.pickups = fresh.pickups;
  world.wanted = 0;
  world.wantedTimer = 0;
  world.lastCrimeAt = -999;
  world.missionIndex = 0;
  world.mission = fresh.mission;
  world.missionMsg = fresh.missionMsg;
  world.defeated = 0;
  world.allDone = false;
  world.time = 0;
  world.policeGrab = 0;
  world.stats = { stolen: 0, defeated: 0, missions: 0, earned: 0 };
  startMission(world, 0);
}

/** Serialize the run for save/load. */
export function saveState(world) {
  const p = world.player;
  return {
    x: p.x, y: p.y, health: p.health, money: p.money,
    missionIndex: world.missionIndex, wanted: world.wanted,
    time: world.time, allDone: world.allDone,
  };
}

export function loadState(world, data) {
  if (!data) return false;
  resetRun(world);
  const p = world.player;
  p.x = data.x;
  p.y = data.y;
  p.health = data.health;
  p.money = data.money;
  world.time = data.time || 0;
  startMission(world, data.missionIndex || 0);
  return true;
}
