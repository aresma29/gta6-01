// VICE BAY — shared helpers: a seeded random generator, maths and AABB collision.
// Everything here is deterministic: the same seed always builds the same city.

/** A small seeded PRNG (mulberry32). Seed 1 is the shipped city. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a value in [min, max) from the rng. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one entry of an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Clamp v into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest-arc angle lerp (for yaw smoothing). */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Push a circle (x, z, radius) out of an axis-aligned box {minX, maxX, minZ, maxZ}.
 * Returns the corrected centre and whether a push happened.
 */
export function pushOutOfBox(x, z, radius, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return { x, z, hit: false };
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    return { x: x + dx * push, z: z + dz * push, hit: true };
  }
  // Centre is inside the box: push out along the smallest penetration axis.
  const pl = x - box.minX;
  const pr = box.maxX - x;
  const pt = z - box.minZ;
  const pb = box.maxZ - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - radius, z, hit: true };
  if (m === pr) return { x: box.maxX + radius, z, hit: true };
  if (m === pt) return { x, z: box.minZ - radius, hit: true };
  return { x, z: box.maxZ + radius, hit: true };
}
