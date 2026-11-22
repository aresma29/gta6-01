// VICE BAY 3D — procedural canvas textures. Everything is drawn in code;
// no image files are loaded. Written fresh for the 3D build.
import * as THREE from '../vendor/three/three.module.min.js';
import { makeRng } from './util.js';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Building facade: a window grid. The texture is mapped once per box face;
// the roof is covered by a separate flat cap in the city builder.
export function buildingTexture(seed) {
  const rng = makeRng(seed);
  const lit = rng.pick(['#ffd98a', '#ffe9b0', '#9fd8ff', '#ffb08a']);
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#8d929c'; g.fillRect(0, 0, w, h);
    const cols = 5, rows = 12, cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const on = rng.chance(0.42);
        g.fillStyle = on ? lit : '#20242e';
        g.fillRect(x * cw + 3, y * ch + 4, cw - 6, ch - 8);
        if (on && rng.chance(0.5)) {
          g.fillStyle = 'rgba(255,255,255,0.25)';
          g.fillRect(x * cw + 3, y * ch + 4, cw - 6, 3);
        }
      }
    }
    // Ground-floor shopfront strip.
    g.fillStyle = '#3a3f4a'; g.fillRect(0, h - 18, w, 18);
    g.fillStyle = 'rgba(255,217,138,0.85)';
    for (let x = 0; x < cols; x++) g.fillRect(x * cw + 4, h - 14, cw - 8, 10);
  });
}

// Ground: the whole city seen from above — roads, sidewalks, block plots,
// parks, the beach strip and lane markings. World 480 x 480 m maps to the
// canvas; road centre lines are at the same coordinates the city builder uses.
export function groundTexture(seed) {
  const rng = makeRng(seed);
  const S = 2048, WORLD = 480;
  const toPx = (v) => ((v + WORLD / 2) / WORLD) * S;
  const ROADS = [-168, -112, -56, 0, 56, 112, 168];
  const ROAD_W = 12;
  return canvasTex(S, S, (g) => {
    // Base: building-plot grey.
    g.fillStyle = '#5d6066'; g.fillRect(0, 0, S, S);
    // Parks (fixed, match the city builder's park blocks).
    const parks = [[-140, -84], [84, -140], [-84, 140], [140, 84]];
    for (const [bx, bz] of parks) {
      g.fillStyle = '#3f7a3a';
      g.fillRect(toPx(bx - 22), toPx(bz - 22), toPx(44) - toPx(0), toPx(44) - toPx(0));
      g.fillStyle = '#356b31';
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.arc(toPx(bx - 18 + rng.next() * 36), toPx(bz - 18 + rng.next() * 36), 4 + rng.next() * 7, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Sidewalks: light border around every block.
    g.fillStyle = '#8f9296';
    for (let i = 0; i < ROADS.length - 1; i++) {
      for (let j = 0; j < ROADS.length - 1; j++) {
        const x0 = ROADS[i] + ROAD_W / 2, x1 = ROADS[i + 1] - ROAD_W / 2;
        const z0 = ROADS[j] + ROAD_W / 2, z1 = ROADS[j + 1] - ROAD_W / 2;
        g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
      }
    }
    // Roads: dark asphalt strips.
    g.fillStyle = '#2e3138';
    for (const r of ROADS) {
      g.fillRect(toPx(r - ROAD_W / 2), 0, toPx(ROAD_W) - toPx(0), S);
      g.fillRect(0, toPx(r - ROAD_W / 2), S, toPx(ROAD_W) - toPx(0));
    }
    // Lane dashes.
    g.fillStyle = '#d8c95a';
    for (const r of ROADS) {
      for (let v = -228; v < 228; v += 16) {
        g.fillRect(toPx(r - 0.4), toPx(v), toPx(0.8) - toPx(0), toPx(7) - toPx(0));
        g.fillRect(toPx(v), toPx(r - 0.4), toPx(7) - toPx(0), toPx(0.8) - toPx(0));
      }
    }
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(240,240,240,0.85)';
    for (const rx of ROADS) {
      for (const rz of ROADS) {
        for (let k = -2; k <= 2; k++) {
          g.fillRect(toPx(rx - 5 + k * 2), toPx(rz - 7), toPx(1.2) - toPx(0), toPx(2.4) - toPx(0));
          g.fillRect(toPx(rx + 5 + k * 2), toPx(rz - 7), toPx(1.2) - toPx(0), toPx(2.4) - toPx(0));
        }
      }
    }
    // Beach strip (south, z 180..210) and the plaza (centre).
    g.fillStyle = '#d9c48f';
    g.fillRect(0, toPx(180), S, toPx(210) - toPx(180));
    g.fillStyle = '#c9b078';
    for (let i = 0; i < 60; i++) {
      g.beginPath();
      g.arc(rng.next() * S, toPx(182 + rng.next() * 26), 2 + rng.next() * 4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#7d7f88';
    g.beginPath(); g.arc(toPx(0), toPx(0), toPx(26) - toPx(0), 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4f7a8a';
    g.beginPath(); g.arc(toPx(0), toPx(0), toPx(8) - toPx(0), 0, Math.PI * 2); g.fill();
  });
}

// Sea: a simple repeating wave texture, scrolled at runtime for movement.
export function waterTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1b5f7a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.20)';
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      const y = 10 + i * 18;
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + i) * 4);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
  });
}
