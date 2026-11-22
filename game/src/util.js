// VICE BAY 3D — small utilities: seeded random, math helpers, keyboard + mouse input.
// Written fresh for the 3D build. No dependency on the 2D game.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// Shortest signed angle difference (radians).
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t;
}
export function dist2D(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

// Keyboard + pointer input. Held keys are read per frame; one-shot presses
// (jump, punch, enter, pause, confirm) are queued as flags and taken once.
export const ACT_JUMP = 1;
export const ACT_PUNCH = 2;
export const ACT_ENTER = 4;
export const ACT_PAUSE = 8;
export const ACT_CONFIRM = 16;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const RUN_KEYS = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let lookDX = 0, lookDY = 0; // accumulated mouse-drag deltas, consumed per frame
  let dragging = false;
  let lastX = 0, lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { if (!e.repeat) actions |= ACT_JUMP; e.preventDefault(); }
    else if (e.code === 'KeyF') { if (!e.repeat) actions |= ACT_PUNCH; }
    else if (e.code === 'KeyE') { if (!e.repeat) actions |= ACT_ENTER; }
    else if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) actions |= ACT_PAUSE; }
    else if (e.code === 'Enter') { if (!e.repeat) actions |= ACT_CONFIRM; }
    held.add(e.code);
    if (MOVE_KEYS.has(e.code) || RUN_KEYS.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lookDX += e.clientX - lastX;
    lookDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    isDown(code) { return held.has(code); },
    get run() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    // -1..1 forward (W) / back (S), and -1..1 left (A) / right (D).
    moveAxes() {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { f, s };
    },
    takeActions() { const a = actions; actions = 0; return a; },
    takeLook() { const l = { dx: lookDX, dy: lookDY }; lookDX = 0; lookDY = 0; return l; },
  };
}
