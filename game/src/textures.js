// VICE BAY — procedural canvas textures. No external images: every facade,
// road, billboard and sign is drawn on a canvas at load time and turned into
// a THREE.CanvasTexture. Deterministic for a given seed.

import * as THREE from 'three';
import { makeRng, pick, range } from './util.js';

/** Make a blank canvas + 2d context. */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

/** Turn a canvas into a texture the renderer can use. */
function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

/**
 * A building facade: a window grid over a base colour. About 55% of the
 * windows are lit warm (dusk), the rest dark glass. Optional ground-floor
 * shopfront band with an awning.
 */
export function facadeTexture(rng, opts = {}) {
  const base = opts.base || '#7a6a58';
  const cols = opts.cols || 6;
  const floors = opts.floors || 10;
  const litRatio = opts.litRatio === undefined ? 0.55 : opts.litRatio;
  const shopfront = !!opts.shopfront;
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 512);
  // Subtle vertical shading so the facade is not flat.
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);
  // Floor bands.
  const floorH = 512 / floors;
  const colW = 256 / cols;
  for (let f = 0; f < floors; f++) {
    const y = f * floorH;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y + floorH - 3, 256, 3);
    for (let col = 0; col < cols; col++) {
      const x = col * colW + colW * 0.18;
      const w = colW * 0.64;
      const h = floorH * 0.58;
      const lit = rng() < litRatio;
      if (lit) {
        const warm = pick(rng, ['#ffd27a', '#ffbe5c', '#ffe9a8', '#ffb347']);
        ctx.fillStyle = warm;
        ctx.fillRect(x, y + floorH * 0.18, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x, y + floorH * 0.18, w, h * 0.25);
      } else {
        ctx.fillStyle = '#141a22';
        ctx.fillRect(x, y + floorH * 0.18, w, h);
        ctx.fillStyle = 'rgba(140,170,200,0.25)';
        ctx.fillRect(x, y + floorH * 0.18, w, h * 0.3);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(x, y + floorH * 0.18, w, h);
    }
  }
  if (shopfront) {
    // Glass storefront + striped awning along the ground floor.
    ctx.fillStyle = '#20262e';
    ctx.fillRect(0, 512 - 64, 256, 64);
    ctx.fillStyle = '#9fc4d8';
    ctx.fillRect(8, 512 - 56, 240, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(8, 512 - 56, 240, 12);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#c94f5e' : '#f2e6d0';
      ctx.fillRect(i * 32, 512 - 72, 32, 10);
    }
  }
  return toTexture(c);
}

/** A set of facade variants for one city seed, so buildings do not repeat. */
export function facadeSet(seed) {
  const rng = makeRng(seed * 7919 + 13);
  const bases = ['#7a6a58', '#8a5a4a', '#5a6a7a', '#6a6a5e', '#4a5a6a', '#9a7a5a', '#5e4a5e'];
  const set = [];
  for (let i = 0; i < 7; i++) {
    set.push(
      facadeTexture(rng, {
        base: bases[i % bases.length],
        cols: 4 + Math.floor(rng() * 4),
        floors: 6 + Math.floor(rng() * 10),
        litRatio: 0.45 + rng() * 0.2,
        shopfront: rng() < 0.4,
      })
    );
  }
  return set;
}

/** Dark roof cap with vents and a parapet line. */
export function roofTexture(rng) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 118, 128, 10);
  // Vents / AC boxes.
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#55555e';
    ctx.fillRect(14 + rng() * 80, 16 + rng() * 80, 18, 14);
  }
  return toTexture(c);
}

/**
 * The ground: a 2048px map of the whole 480x480 m city. Draws sidewalks,
 * the road grid with dashed centrelines, crosswalks at intersections, a
 * central plaza, two parks and the beach sand strip on the east edge.
 * layout: { half: 240, roads: [...positions], roadW: 10, beachX: 200 }.
 */
export function groundTexture(layout) {
  const S = 2048;
  const half = layout.half;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  const m2px = S / (half * 2);
  const [c, ctx] = canvas(S, S);
  // Sidewalk base.
  ctx.fillStyle = '#8d8578';
  ctx.fillRect(0, 0, S, S);
  // Parks (green blocks) — two fixed park blocks.
  ctx.fillStyle = '#4a7a4a';
  for (const [px, pz, pw, pd] of layout.parks) {
    ctx.fillRect(toPx(px), toPx(pz), pw * m2px, pd * m2px);
  }
  // Roads (asphalt).
  ctx.fillStyle = '#2c2c31';
  for (const r of layout.roads) {
    ctx.fillRect(toPx(r - layout.roadW / 2), 0, layout.roadW * m2px, S);
    ctx.fillRect(0, toPx(r - layout.roadW / 2), S, layout.roadW * m2px);
  }
  // Dashed centrelines.
  ctx.fillStyle = '#d8c25a';
  ctx.setLineDash([14, 18]);
  ctx.lineWidth = 3;
  for (const r of layout.roads) {
    ctx.beginPath();
    ctx.moveTo(toPx(r), 0);
    ctx.lineTo(toPx(r), S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toPx(r));
    ctx.lineTo(S, toPx(r));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = '#e8e8e8';
  for (const rx of layout.roads) {
    for (const rz of layout.roads) {
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(toPx(rx + i * 2.2) - 4, toPx(rz - layout.roadW / 2) - 2, 8, layout.roadW * m2px * 0.28);
        ctx.fillRect(toPx(rx + i * 2.2) - 4, toPx(rz + layout.roadW / 2) - layout.roadW * m2px * 0.28 + 2, 8, layout.roadW * m2px * 0.28);
      }
    }
  }
  // Central plaza: warm pavement circle + ring.
  const pc = toPx(0);
  ctx.fillStyle = '#b8a888';
  ctx.beginPath();
  ctx.arc(pc, pc, 34 * m2px, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a7a62';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(pc, pc, 34 * m2px, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#7a9ab8';
  ctx.beginPath();
  ctx.arc(pc, pc, 10 * m2px, 0, Math.PI * 2);
  ctx.fill();
  // Beach sand on the east strip.
  ctx.fillStyle = '#d8b878';
  ctx.fillRect(toPx(layout.beachX), 0, (half - layout.beachX) * m2px, S);
  // Sand speckle.
  const rng = makeRng(99);
  ctx.fillStyle = 'rgba(120,90,40,0.25)';
  for (let i = 0; i < 900; i++) {
    ctx.fillRect(toPx(layout.beachX) + rng() * (half - layout.beachX) * m2px, rng() * S, 3, 3);
  }
  const t = toTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Teal sea with soft wave bands. Offset the texture over time to animate it. */
export function seaTexture() {
  const [c, ctx] = canvas(512, 512);
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#2a8a8a');
  grad.addColorStop(0.5, '#1a6a7a');
  grad.addColorStop(1, '#2a7a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  const rng = makeRng(7);
  for (let i = 0; i < 26; i++) {
    const y = rng() * 512;
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 5);
    }
    ctx.stroke();
  }
  const t = toTexture(c, 6, 6);
  return t;
}

/** A billboard face. kind: 'vicebay' | 'sunsetgt' | 'vicefm' | 'coral'. */
export function billboardTexture(kind) {
  const [c, ctx] = canvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff7a3c');
  grad.addColorStop(0.55, '#c94f7a');
  grad.addColorStop(1, '#4a3a8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  // Sun disc.
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.arc(400, 90, 52, 0, Math.PI * 2);
  ctx.fill();
  // Sea band.
  ctx.fillStyle = '#2a7a8a';
  ctx.fillRect(0, 180, 512, 76);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(0, 180, 512, 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'vicebay') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 92px Arial';
    ctx.fillText('VICE BAY', 256, 84);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 34px Arial';
    ctx.fillText('SUNSET STRIP · OCEAN DRIVE', 256, 150);
  } else if (kind === 'sunsetgt') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 76px Arial';
    ctx.fillText('SUNSET GT', 256, 78);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('0–100 IN 3.1s · VICE MOTORS', 256, 140);
  } else if (kind === 'vicefm') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px Arial';
    ctx.fillText('VICE FM', 256, 80);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('98.5 · SUNSET DRIVE', 256, 148);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px Arial';
    ctx.fillText('CORAL COLA', 256, 80);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 32px Arial';
    ctx.fillText('TASTE THE SUNSET', 256, 146);
  }
  return toTexture(c);
}

/**
 * An illuminated landmark sign: glowing letters on a dark panel.
 * vertical=true stacks the letters (for a tower sign).
 */
export function signTexture(text, opts = {}) {
  const vertical = !!opts.vertical;
  const color = opts.color || '#ff5a8a';
  const [c, ctx] = canvas(vertical ? 128 : 512, vertical ? 512 : 128);
  ctx.fillStyle = '#14141c';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (vertical) {
    ctx.font = 'bold 64px Arial';
    const letters = text.split('');
    const step = 512 / (letters.length + 1);
    letters.forEach((ch, i) => ctx.fillText(ch, 64, step * (i + 1)));
  } else {
    ctx.font = 'bold 72px Arial';
    ctx.fillText(text, 256, 66);
  }
  const t = toTexture(c);
  t.anisotropy = 4;
  return t;
}

/** A plain sand texture for the beach props area (umbrellas sit on it). */
export function sandTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d8b878';
  ctx.fillRect(0, 0, 256, 256);
  const rng = makeRng(31);
  ctx.fillStyle = 'rgba(120,90,40,0.3)';
  for (let i = 0; i < 500; i++) {
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }
  return toTexture(c, 8, 8);
}
