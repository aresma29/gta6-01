// VICE BAY — shared helpers (seeded RNG, math, collision).
// Written fresh for the rebuild; no line is copied from any earlier build.

/** Deterministic RNG (mulberry32) so the city is identical for a given seed. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
/** Shortest signed angle difference, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Pick one element from an array using the given RNG. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
/** Random float in [lo, hi). */
export function rand(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
/** Random integer in [lo, hi]. */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/**
 * Axis-aligned box collider: { minX, maxX, minZ, maxZ }.
 * Pushes a circle (x, z, radius) out of the box; returns the pushed
 * position, or null when the circle does not touch the box.
 */
export function pushOutOfBox(x, z, radius, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    return { x: x + (dx / d) * push, z: z + (dz / d) * push };
  }
  // Centre is inside the box: push out along the smallest penetration axis.
  const pl = x - box.minX + radius;
  const pr = box.maxX - x + radius;
  const pt = z - box.minZ + radius;
  const pb = box.maxZ - z + radius;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - radius, z };
  if (m === pr) return { x: box.maxX + radius, z };
  if (m === pt) return { x, z: box.minZ - radius };
  return { x, z: box.maxZ + radius };
}

/** Resolve a circle against a list of AABB colliders (two passes). */
export function resolveCollisions(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const box of colliders) {
      const out = pushOutOfBox(px, pz, radius, box);
      if (out) {
        px = out.x;
        pz = out.z;
      }
    }
  }
  return { x: px, z: pz };
}
