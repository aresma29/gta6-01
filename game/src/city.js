// VICE BAY — the city itself. A seeded generator lays out the road grid,
// the blocks between the roads, the buildings inside them, parks, trees and
// the named landmarks the missions point at. Everything is deterministic
// from the seed, so a screenshot seed always builds the same city.
//
// Walkable: roads, sidewalks, parks, sand. Blocked: buildings, water
// (the harbour on the west edge, the sea on the south edge), the map edge.

import { WORLD, PALETTE } from './config.js';
import { makeRng, pick, int } from './rng.js';

const BUILDING_COLOURS = [
  PALETTE.building,
  PALETTE.building2,
  PALETTE.building3,
  PALETTE.building4,
];

/** Named places the missions and the HUD point at. */
export const LANDMARKS = {
  garage: { x: 1600, y: 800, label: 'Garage' },
  market: { x: 2200, y: 1300, label: 'Market' },
  beach: { x: 1600, y: 2200, label: 'Beach' },
  safehouse: { x: 1000, y: 300, label: 'Safehouse' },
  plaza: { x: 1600, y: 1300, label: 'Plaza' },
  bank: { x: 1600, y: 1800, label: 'Bank' },
  harbour: { x: 400, y: 1300, label: 'Harbour' },
  hospital: { x: 1000, y: 1800, label: 'Hospital' },
};

function roadBand(centre) {
  const half = WORLD.roadWidth / 2;
  return [centre - half, centre + half];
}

export function isOnRoadX(x) {
  for (let i = 0; i < WORLD.roadsX.length; i += 1) {
    const [lo, hi] = roadBand(WORLD.roadsX[i]);
    if (x >= lo && x <= hi) return true;
  }
  return false;
}

export function isOnRoadY(y) {
  for (let i = 0; i < WORLD.roadsY.length; i += 1) {
    const [lo, hi] = roadBand(WORLD.roadsY[i]);
    if (y >= lo && y <= hi) return true;
  }
  return false;
}

export function isOnRoad(x, y) {
  return isOnRoadX(x) || isOnRoadY(y);
}

function inWater(x, y) {
  if (x < WORLD.harbourX) return true;
  if (y >= WORLD.seaY) return true;
  return false;
}

function nearLandmark(x, y, clearance) {
  const names = Object.keys(LANDMARKS);
  for (let i = 0; i < names.length; i += 1) {
    const lm = LANDMARKS[names[i]];
    if (Math.abs(x - lm.x) < clearance && Math.abs(y - lm.y) < clearance) return true;
  }
  return false;
}

/** Build the whole city from a seed. Returns { buildings, parks, trees }. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const trees = [];

  // Block columns and rows: the strips between neighbouring roads.
  const colEdges = [WORLD.harbourX + 40, ...WORLD.roadsX, WORLD.width - 40];
  const rowEdges = [40, ...WORLD.roadsY, WORLD.seaY - 80];
  const half = WORLD.roadWidth / 2;

  for (let c = 0; c < colEdges.length - 1; c += 1) {
    for (let r = 0; r < rowEdges.length - 1; r += 1) {
      const x0 = colEdges[c] + half + 14;
      const x1 = colEdges[c + 1] - half - 14;
      const y0 = rowEdges[r] + half + 14;
      const y1 = rowEdges[r + 1] - half - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // A park instead of buildings, sometimes (never in the harbour/beach).
      const centreX = (x0 + x1) / 2;
      const centreY = (y0 + y1) / 2;
      if (rng() < 0.16 && !nearLandmark(centreX, centreY, 320)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const treeCount = int(rng, 4, 9);
        for (let t = 0; t < treeCount; t += 1) {
          trees.push({
            x: x0 + 20 + rng() * (x1 - x0 - 40),
            y: y0 + 20 + rng() * (y1 - y0 - 40),
          });
        }
        continue;
      }
      // One or two buildings per block.
      const count = rng() < 0.55 ? 1 : 2;
      for (let b = 0; b < count; b += 1) {
        let bx;
        let by;
        let bw;
        let bh;
        if (count === 1) {
          bw = (x1 - x0) * (0.55 + rng() * 0.3);
          bh = (y1 - y0) * (0.55 + rng() * 0.3);
          bx = x0 + (x1 - x0 - bw) / 2;
          by = y0 + (y1 - y0 - bh) / 2;
        } else {
          const vertical = rng() < 0.5;
          if (vertical) {
            bw = (x1 - x0) * (0.4 + rng() * 0.12);
            bh = (y1 - y0) * (0.7 + rng() * 0.15);
            bx = b === 0 ? x0 + 8 : x1 - bw - 8;
            by = y0 + (y1 - y0 - bh) / 2;
          } else {
            bw = (x1 - x0) * (0.7 + rng() * 0.15);
            bh = (y1 - y0) * (0.4 + rng() * 0.12);
            bx = x0 + (x1 - x0 - bw) / 2;
            by = b === 0 ? y0 + 8 : y1 - bh - 8;
          }
        }
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        if (nearLandmark(cx, cy, 170)) continue;
        if (inWater(cx, cy)) continue;
        const downtown =
          Math.abs(cx - 1600) < 700 && Math.abs(cy - 1300) < 600;
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          colour: pick(rng, BUILDING_COLOURS),
          // Downtown towers read taller (more window rows when drawn).
          floors: downtown ? int(rng, 5, 9) : int(rng, 2, 5),
          seed: Math.floor(rng() * 100000),
        });
      }
      // A street tree or two on the block corners.
      if (rng() < 0.5) {
        trees.push({ x: x0 + 16, y: y0 + 16 });
        trees.push({ x: x1 - 16, y: y1 - 16 });
      }
    }
  }
  return { buildings, parks, trees };
}

/**
 * True when the circle at (x, y) with radius r touches a building, the
 * water, or the edge of the map. Roads, sidewalks, parks and sand are open.
 */
export function blockedAt(city, x, y, r) {
  if (x - r < 0 || x + r > WORLD.width || y - r < 0 || y + r > WORLD.height) return true;
  if (inWater(x, y)) return true;
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Push a circle out of whatever it overlaps (one pass; call per frame). */
export function resolveCollision(city, p, r) {
  if (inWater(p.x, p.y)) {
    // Step back toward the map centre until out of the water.
    const cx = WORLD.width / 2;
    const cy = WORLD.height / 2;
    const dx = cx - p.x;
    const dy = cy - p.y;
    const len = Math.hypot(dx, dy) || 1;
    p.x += (dx / len) * 8;
    p.y += (dy / len) * 8;
    return;
  }
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - nx;
    const dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = nx + (dx / d) * r;
      p.y = ny + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre is inside the building: push out along the shortest side.
      const left = p.x - b.x;
      const right = b.x + b.w - p.x;
      const top = p.y - b.y;
      const bottom = b.y + b.h - p.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = b.x - r;
      else if (m === right) p.x = b.x + b.w + r;
      else if (m === top) p.y = b.y - r;
      else p.y = b.y + b.h + r;
    }
  }
  p.x = Math.max(r, Math.min(WORLD.width - r, p.x));
  p.y = Math.max(r, Math.min(WORLD.height - r, p.y));
}

/** A random point on a road (for spawning traffic). */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const x = WORLD.roadsX[Math.floor(rng() * WORLD.roadsX.length)];
    const y = 60 + rng() * (WORLD.height - 200);
    return { x, y, alongX: false };
  }
  const y = WORLD.roadsY[Math.floor(rng() * WORLD.roadsY.length)];
  const x = 320 + rng() * (WORLD.width - 380);
  return { x, y, alongX: true };
}

/** A random walkable point near a road (for spawning pedestrians). */
export function randomWalkPoint(rng) {
  const p = randomRoadPoint(rng);
  return {
    x: p.x + (rng() - 0.5) * 160,
    y: p.y + (rng() - 0.5) * 160,
  };
}
