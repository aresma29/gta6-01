// util.js — seeded RNG, math helpers, AABB collision (VICE BAY 3D, Stage 1).
// Node/browser, no dependencies. Deterministic: same seed -> same sequence.

/** mulberry32: a small fast seeded PRNG. Returns a function yielding [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Exponential damp toward target (frame-rate independent). */
export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Damp an angle toward a target angle (handles wraparound). */
export function dampAngle(current, target, lambda, dt) {
  return current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));
}

export const rand = (rng, lo, hi) => lo + rng() * (hi - lo);

export const randInt = (rng, lo, hi) => Math.floor(rand(rng, lo, hi + 1));

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** An axis-aligned box on the ground plane: { minX, maxX, minZ, maxZ }. */
export function makeBox(cx, cz, hx, hz) {
  return { minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

/**
 * Push a circle (px, pz, radius) out of one AABB. Returns [x, z] (possibly
 * unchanged) — the closest point outside the box, or the original position
 * when there is no overlap.
 */
export function pushOutOfBox(px, pz, radius, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return [px, pz];
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    return [px + dx * push, pz + dz * push];
  }
  // Centre is inside the box: push out along the smallest penetration axis.
  const left = px - box.minX + radius;
  const right = box.maxX - px + radius;
  const top = pz - box.minZ + radius;
  const bottom = box.maxZ - pz + radius;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return [box.minX - radius, pz];
  if (m === right) return [box.maxX + radius, pz];
  if (m === top) return [px, box.minZ - radius];
  return [px, box.maxZ + radius];
}

/**
 * Resolve a circle against a list of AABBs (a few passes so corners settle).
 * Returns [x, z].
 */
export function resolveCollisions(px, pz, radius, colliders) {
  let x = px;
  let z = pz;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const box of colliders) {
      const [nx, nz] = pushOutOfBox(x, z, radius, box);
      if (nx !== x || nz !== z) {
        x = nx;
        z = nz;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, z];
}
