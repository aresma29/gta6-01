// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// sets the world to a real, playable state — a car on the road, a police
// pursuit, a mission in progress — then plays the real rules forward for a
// fixed number of steps, so the frame is what a short game really looks
// like and the same seed always gives the same frame.

import { STEP, WORLD } from './config.js';
import { LANDMARKS } from './city.js';
import { stepWorld, startMission } from './world.js';

const DRIVE_STEPS = 70;
const CHASE_STEPS = 110;
const MISSION_STEPS = 50;

/** Drive straight ahead (W held). */
function driveInput() {
  return { axes: { x: 0, y: -1 }, run: false, enter: false, attack: false };
}

/** No input. */
function idleInput() {
  return { axes: { x: 0, y: 0 }, run: false, enter: false, attack: false };
}

/** Put the player in the nearest parked car and start driving. */
function putPlayerInCar(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < world.cars.length; i += 1) {
    const c = world.cars[i];
    if (c.kind !== 'parked') continue;
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best) return null;
  // Move the player to the car and enter it.
  p.x = best.x;
  p.y = best.y;
  p.inCar = best;
  best.kind = 'player';
  best.speed = 0;
  // Face along the road the car sits on.
  const onX = Math.abs(best.x - 1600) < Math.abs(best.y - 1300);
  best.angle = onX ? 0 : Math.PI / 2;
  return best;
}

function placePoliceNear(world, count) {
  const p = world.player;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + 0.6;
    const d = 320 + i * 90;
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    const car = {
      x, y, angle: Math.atan2(p.y - y, p.x - x), speed: 300,
      colour: '#1f2a37', kind: 'police', health: 150, driver: false,
      steer: 0, alongX: true, dir: 1, cruise: 200,
      turnCooldown: 0, ramCooldown: 0,
    };
    world.cars.push(car);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Names: start, drive, chase, mission. Any other name is start.
 */
export function stageShot(name, world) {
  const p = world.player;
  if (name === 'drive') {
    // In a car, rolling along a road with traffic around. The start is a
    // road intersection far from the garage, so the drive itself is the
    // shot (the garage job must not complete mid-shot).
    p.x = 1000;
    p.y = 1300;
    p.inCar = null;
    const car = putPlayerInCar(world);
    if (car) {
      car.x = 1000;
      car.y = 1300;
      car.angle = 0;
      car.speed = 260;
      p.x = car.x;
      p.y = car.y;
    }
    for (let i = 0; i < DRIVE_STEPS; i += 1) {
      stepWorld(world, STEP, driveInput());
    }
    return { screen: 'play', best: 0 };
  }
  if (name === 'chase') {
    // Three stars, three police cars closing in on the player's car.
    p.x = 1600;
    p.y = 1300;
    p.inCar = null;
    const car = putPlayerInCar(world);
    if (car) {
      car.x = 1600;
      car.y = 1300;
      car.angle = 0;
      car.speed = 320;
      p.x = car.x;
      p.y = car.y;
    }
    world.wanted = 3;
    world.lastCrimeAt = world.time;
    placePoliceNear(world, 3);
    for (let i = 0; i < CHASE_STEPS; i += 1) {
      stepWorld(world, STEP, driveInput());
    }
    return { screen: 'play', best: 0 };
  }
  if (name === 'mission') {
    // On foot at Downtown Plaza, rivals closing in, the marker overhead.
    startMission(world, 3);
    p.x = LANDMARKS.plaza.x - 140;
    p.y = LANDMARKS.plaza.y + 120;
    p.inCar = null;
    p.angle = Math.atan2(
      LANDMARKS.plaza.y - p.y, LANDMARKS.plaza.x - p.x,
    );
    for (let i = 0; i < MISSION_STEPS; i += 1) {
      stepWorld(world, STEP, idleInput());
    }
    return { screen: 'play', best: 0 };
  }
  // Start: the title screen over a living downtown.
  world.camera.x = 1600 - 640;
  world.camera.y = 1300 - 360;
  world.camera.x = Math.max(0, Math.min(WORLD.width - 1280, world.camera.x));
  world.camera.y = Math.max(0, Math.min(WORLD.height - 720, world.camera.y));
  for (let i = 0; i < 30; i += 1) {
    stepWorld(world, STEP, idleInput());
  }
  // Keep the camera over downtown for the title backdrop.
  world.camera.x = 1600 - 640;
  world.camera.y = 1300 - 360;
  return { screen: 'title', best: 0 };
}
