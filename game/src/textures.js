// textures.js — procedural canvas textures for VICE BAY 3D (Stage 1).
// Every texture is drawn on a 2D canvas at load time: no external assets.
// Uses THREE.CanvasTexture; caller sets colorSpace where needed.

import * as THREE from 'three';
import { rand, randInt, pick } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, { srgb = true, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = 4;
  return t;
}

const WINDOW_COLOURS = ['#ffd98a', '#ffe9b0', '#ffcf6e', '#9fd8ff', '#ffffff'];
const FACADE_BASE = ['#7a6a8a', '#8a7a6a', '#6a7a8a', '#9a8a7a', '#5a5a6a', '#8a6a7a'];

/**
 * A building facade: base colour, floor bands, a grid of windows (some lit
 * warm, some dark), a darker ground floor. `w`/`h` are the texture pixels;
 * `floors`/`cols` set the window grid.
 */
export function facadeTexture(rng, { w = 256, h = 512, floors = 8, cols = 4, base = null } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const baseCol = base || pick(rng, FACADE_BASE);
  g.fillStyle = baseCol;
  g.fillRect(0, 0, w, h);
  // Subtle vertical shading so the face is not flat.
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const marginX = Math.floor(w * 0.08);
  const marginY = Math.floor(h * 0.03);
  const cellW = (w - marginX * 2) / cols;
  const cellH = (h - marginY * 2) / floors;
  for (let f = 0; f < floors; f++) {
    // A darker band between floors.
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(0, marginY + f * cellH, w, 2);
    for (let col = 0; col < cols; col++) {
      const x = marginX + col * cellW + cellW * 0.18;
      const y = marginY + f * cellH + cellH * 0.2;
      const ww = cellW * 0.64;
      const wh = cellH * 0.55;
      const lit = rng() < 0.55;
      g.fillStyle = lit ? pick(rng, WINDOW_COLOURS) : '#1a1a26';
      g.fillRect(x, y, ww, wh);
      if (lit) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.fillRect(x, y, ww, wh * 0.25);
      }
      // Window frame.
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 2;
      g.strokeRect(x, y, ww, wh);
    }
  }
  // Ground floor: shopfront band (darker, with an awning line).
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, h - cellH * 0.9, w, cellH * 0.9);
  g.fillStyle = '#c9a86a';
  g.fillRect(0, h - cellH * 0.9, w, 4);
  return tex(c);
}

/** A landmark sign: big text on a dark plate with a coloured border. */
export function signTexture(text, { w = 512, h = 128, bg = '#14141f', fg = '#ffe9b0', border = '#e8b04b' } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = border;
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.52)}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return tex(c);
}

/** A tall vertical neon sign (emissive pink). */
export function neonTexture(text, { w = 128, h = 512, colour = '#ff5fa2' } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#0d0d18';
  g.fillRect(0, 0, w, h);
  g.fillStyle = colour;
  g.font = `bold ${Math.floor(w * 0.62)}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // Vertical letters, top to bottom.
  const letters = [...text];
  const step = h / (letters.length + 1);
  letters.forEach((ch, i) => g.fillText(ch, w / 2, step * (i + 1)));
  const t = tex(c);
  return t;
}

/** A billboard: a short headline over a sunset gradient. */
export function billboardTexture(lines, { w = 512, h = 256, accent = '#ff9a3d' } = {}) {
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a2a5a');
  grad.addColorStop(0.55, '#c94b6a');
  grad.addColorStop(1, '#ff9a3d');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Sun disc.
  g.fillStyle = '#ffe9b0';
  g.beginPath();
  g.arc(w * 0.78, h * 0.42, h * 0.22, 0, Math.PI * 2);
  g.fill();
  // Sea band.
  g.fillStyle = '#1f6a7a';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.floor(h * 0.26)}px Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((line, i) => {
    g.fillText(line, w / 2, h * 0.3 + i * h * 0.3);
  });
  g.fillStyle = accent;
  g.fillRect(0, h - 10, w, 10);
  return tex(c);
}

/**
 * The ground texture for the 480x480 m city, drawn at 1024x1024 px
 * (2.133 px per metre). Roads on the 7x7 grid, sidewalks, city blocks,
 * beach sand at the south edge. The sea is a separate plane.
 */
export function groundTexture() {
  const S = 1024;
  const M = S / 480; // px per metre
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const toPx = (v) => (v + 240) * M;
  // Base: block fill.
  g.fillStyle = '#3d3a44';
  g.fillRect(0, 0, S, S);
  // Beach sand (south edge, z > 160).
  g.fillStyle = '#d9c08a';
  g.fillRect(0, toPx(160), S, S - toPx(160));
  // City blocks (between roads): slightly lighter pavement.
  const roads = [-192, -128, -64, 0, 64, 128, 192];
  for (let i = 0; i < roads.length - 1; i++) {
    for (let j = 0; j < roads.length - 1; j++) {
      const x0 = roads[i] + 7;
      const z0 = roads[j] + 7;
      const x1 = roads[i + 1] - 7;
      const z1 = roads[j + 1] - 7;
      g.fillStyle = (i + j) % 2 === 0 ? '#4a4653' : '#44404e';
      g.fillRect(toPx(x0), toPx(z0), (x1 - x0) * M, (z1 - z0) * M);
    }
  }
  // Roads: dark asphalt with centre dashes.
  g.fillStyle = '#23222a';
  for (const r of roads) {
    g.fillRect(toPx(r - 6), 0, 12 * M, S);
    g.fillRect(0, toPx(r - 6), S, 12 * M);
  }
  g.fillStyle = '#c9c9a0';
  for (const r of roads) {
    for (let d = -228; d < 240; d += 16) {
      g.fillRect(toPx(d), toPx(r - 0.6), 8 * M, 1.2 * M);
      g.fillRect(toPx(r - 0.6), toPx(d), 1.2 * M, 8 * M);
    }
  }
  // Sidewalk edges along roads.
  g.strokeStyle = '#8a8694';
  g.lineWidth = 2;
  for (const r of roads) {
    g.strokeRect(toPx(r - 7), 0, 14 * M, S);
    g.strokeRect(0, toPx(r - 7), S, 14 * M);
  }
  // Crosswalks at the central intersections.
  g.fillStyle = '#d8d8d8';
  for (const rx of [0, 64, -64]) {
    for (const rz of [0, 64, -64]) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(toPx(rx + k * 2.4 - 0.8), toPx(rz - 6), 1.6 * M, 12 * M);
      }
    }
  }
  // Plaza circle at the centre.
  g.fillStyle = '#6a5a7a';
  g.beginPath();
  g.arc(toPx(0), toPx(0), 26 * M, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4a8a9a';
  g.beginPath();
  g.arc(toPx(0), toPx(0), 9 * M, 0, Math.PI * 2);
  g.fill();
  return tex(c);
}

/** The sea: teal with soft wave bands (offset-animated at runtime). */
export function seaTexture() {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#1f7a8a';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 3;
  for (let y = 16; y < 256; y += 32) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 16) {
      const yy = y + Math.sin(x * 0.09) * 4;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,220,150,0.10)';
  g.fillRect(0, 0, 256, 40);
  return tex(c, { repeat: [6, 6] });
}

/** The dusk sky dome: purple zenith -> magenta -> orange -> gold horizon. */
export function skyTexture() {
  const c = canvas(16, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#160f38');
  grad.addColorStop(0.35, '#4a2566');
  grad.addColorStop(0.6, '#b03a5a');
  grad.addColorStop(0.8, '#ff6a25');
  grad.addColorStop(1, '#ffcf6a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  return tex(c, { srgb: true });
}
