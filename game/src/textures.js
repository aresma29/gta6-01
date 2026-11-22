// VICE BAY — procedural canvas textures (facades, signs, billboards, ground).
// Written fresh for the rebuild. All art is generated at runtime; no image
// files are loaded, so the game stays fully offline.
import * as THREE from 'three';

/** Make a canvas, draw on it with the callback, return a CanvasTexture. */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A building facade: base colour, floor bands, a grid of windows (some lit). */
export function facadeTexture(base, litRatio, rng) {
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    // Subtle vertical shading so the facade is not flat.
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.25)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.18;
        const y = r * ch + ch * 0.2;
        const ww = cw * 0.64;
        const wh = ch * 0.6;
        if (rng() < litRatio) {
          // Lit window: warm gold, brighter near the bottom floors.
          const warm = 200 + Math.floor(rng() * 55);
          ctx.fillStyle = `rgb(${warm},${Math.floor(warm * 0.72)},90)`;
          ctx.fillRect(x, y, ww, wh);
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x, y, ww, wh * 0.25);
        } else {
          ctx.fillStyle = 'rgba(10,14,28,0.85)';
          ctx.fillRect(x, y, ww, wh);
          ctx.fillStyle = 'rgba(120,140,200,0.18)';
          ctx.fillRect(x, y, ww, wh * 0.3);
        }
      }
    }
    // Ground-floor shopfront band.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, h - ch * 1.2, w, ch * 1.2);
    ctx.fillStyle = 'rgba(255,190,90,0.75)';
    ctx.fillRect(0, h - ch * 1.2, w, 4);
  });
}

/** An illuminated landmark sign: bold text on a dark panel with a glow edge. */
export function signTexture(label, fg, bg) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = fg;
    ctx.font = 'bold 64px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 2);
  });
}

/** A tall vertical neon sign (VICEBAY): pink letters stacked down a panel. */
export function neonTowerTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    ctx.fillStyle = '#12041f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff5fd0';
    ctx.shadowColor = '#ff5fd0';
    ctx.shadowBlur = 22;
    ctx.font = 'bold 62px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const letters = 'VICEBAY';
    for (let i = 0; i < letters.length; i++) {
      ctx.fillText(letters[i], w / 2, 40 + i * 58);
    }
  });
}

/** A billboard face: gradient sky, big title, small subtitle. */
export function billboardTexture(title, sub, top, bottom) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, h / 2 - 8);
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(sub, w / 2, h / 2 + 42);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  });
}

/** The ground: asphalt roads on a grid, sidewalks, plaza, beach sand. */
export function groundTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    // Base: dark asphalt with a faint noise.
    ctx.fillStyle = '#23232b';
    ctx.fillRect(0, 0, w, h);
    const px = (x) => ((x + 240) / 480) * w;
    const pz = (z) => ((z + 240) / 480) * h;
    // City blocks (slightly lighter concrete).
    ctx.fillStyle = '#2e2e38';
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const x0 = px(-224 + i * 64);
        const z0 = pz(-224 + j * 64);
        ctx.fillRect(x0, z0, (52 / 480) * w, (52 / 480) * h);
      }
    }
    // Roads: centre dashes.
    ctx.fillStyle = '#e8c85a';
    for (const r of [-192, -128, -64, 0, 64, 128, 192]) {
      for (let d = -230; d < 230; d += 24) {
        ctx.fillRect(px(r) - 2, pz(d), 4, 12);
        ctx.fillRect(px(d), pz(r) - 2, 12, 4);
      }
    }
    // Central plaza: warm stone circle.
    ctx.fillStyle = '#8a6f52';
    ctx.beginPath();
    ctx.arc(px(0), pz(0), (30 / 480) * w, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px(0), pz(0), (30 / 480) * w, 0, Math.PI * 2);
    ctx.stroke();
    // Beach sand (south edge, z > 185) and the sea beyond it.
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(0, pz(185), w, pz(240) - pz(185));
    ctx.fillStyle = '#1b7f8e';
    ctx.fillRect(0, pz(210), w, pz(240) - pz(210));
  });
}

/** The sea surface: teal with lighter wave streaks (offset animated in-game). */
export function seaTexture() {
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0e6f80';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(140,220,235,${0.05 + Math.random() * 0.12})`;
      const y = Math.random() * h;
      ctx.fillRect(0, y, w, 2 + Math.random() * 5);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,240,200,0.10)';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 3 + Math.random() * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/** A dusk sky dome: purple zenith, magenta band, gold horizon. */
export function skyTexture() {
  return canvasTexture(64, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a1052');
    g.addColorStop(0.35, '#6b2a7a');
    g.addColorStop(0.6, '#c65a7a');
    g.addColorStop(0.78, '#ff9a4d');
    g.addColorStop(1, '#ffd27a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
