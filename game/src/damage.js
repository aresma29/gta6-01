// VICE BAY — Stage 3: vehicle damage + smoke.
// Written fresh for the rebuild. Applies condition loss to any car object
// (plain JS: { condition, dent, x, z, heading, ... }) and runs a smoke
// sprite pool for badly damaged cars. No line is copied from any earlier
// build.
import * as THREE from 'three';
import { clamp } from './util.js';

const SMOKE_MAX = 24;

/** Soft round smoke puff texture, generated on a canvas. */
function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(60,60,66,0.85)');
  grad.addColorStop(0.6, 'rgba(50,50,56,0.45)');
  grad.addColorStop(1, 'rgba(40,40,46,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function createDamage(scene) {
  const smokeTex = makeSmokeTexture();
  const puffs = [];
  for (let i = 0; i < SMOKE_MAX; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smokeTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(1.6, 1.6, 1);
    s.visible = false;
    scene.add(s);
    puffs.push({ sprite: s, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
  }
  let nextPuff = 0;
  // Per-car smoke timers so a wreck puffs steadily instead of every frame.
  const smokeTimers = new Map();

  function spawnPuff(x, y, z) {
    const p = puffs[nextPuff];
    nextPuff = (nextPuff + 1) % SMOKE_MAX;
    p.sprite.position.set(x, y, z);
    p.sprite.visible = true;
    p.life = 0;
    p.maxLife = 1.1 + Math.random() * 0.5;
    p.vx = (Math.random() - 0.5) * 0.6;
    p.vy = 1.2 + Math.random() * 0.8;
    p.vz = (Math.random() - 0.5) * 0.6;
    p.sprite.material.opacity = 0.75;
    const sc = 1.4 + Math.random() * 0.9;
    p.sprite.scale.set(sc, sc, 1);
  }

  /**
   * Lower a car's condition. Shows the dent patch below 60 and starts
   * smoke below 45. Returns the new condition.
   */
  function damageCar(car, amount) {
    if (!car) return 0;
    car.condition = clamp((car.condition ?? 100) - amount, 0, 100);
    if (car.dent) car.dent.visible = car.condition < 60;
    return car.condition;
  }

  /** Advance smoke. Call every frame with dt (clamped to [0, 0.05]). */
  function update(dt, cars) {
    const d = clamp(dt, 0, 0.05);
    // Emit puffs from badly damaged cars.
    if (cars) {
      for (const car of cars) {
        if (!car || (car.condition ?? 100) >= 45) continue;
        const key = car;
        const t = (smokeTimers.get(key) || 0) + d;
        if (t > 0.22) {
          smokeTimers.set(key, 0);
          const fx = Math.sin(car.heading) * 1.6;
          const fz = Math.cos(car.heading) * 1.6;
          spawnPuff(car.x + fx, 1.3, car.z + fz);
        } else {
          smokeTimers.set(key, t);
        }
      }
    }
    // Age + rise + fade the puffs.
    for (const p of puffs) {
      if (!p.sprite.visible) continue;
      p.life += d;
      if (p.life >= p.maxLife) {
        p.sprite.visible = false;
        p.sprite.material.opacity = 0;
        continue;
      }
      const k = p.life / p.maxLife;
      p.sprite.position.x += p.vx * d;
      p.sprite.position.y += p.vy * d;
      p.sprite.position.z += p.vz * d;
      const sc = 1.4 + k * 2.2;
      p.sprite.scale.set(sc, sc, 1);
      p.sprite.material.opacity = 0.75 * (1 - k);
    }
  }

  function reset() {
    for (const p of puffs) {
      p.sprite.visible = false;
      p.sprite.material.opacity = 0;
    }
    smokeTimers.clear();
  }

  return { damageCar, update, reset, get puffCount() {
    let n = 0;
    for (const p of puffs) if (p.sprite.visible) n++;
    return n;
  } };
}
