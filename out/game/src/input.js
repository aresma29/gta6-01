// Keyboard input: tracks which physical keys are held and which were just
// pressed this frame (so a tap on E or Space fires once, not every frame).

import { KEYS } from './config.js';

const held = new Set();
const pressed = new Set();
let anyKey = false;

function codeOf(event) {
  return event.code;
}

export function initInput() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(codeOf(event));
    pressed.add(codeOf(event));
    anyKey = true;
    // Space scrolls the page; the game owns it.
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
}

/** True while any of the codes in `list` is held down. */
export function isHeld(list) {
  for (let i = 0; i < list.length; i += 1) {
    if (held.has(list[i])) return true;
  }
  return false;
}

/** True only on the frame the key went down (consumed by endFrame). */
export function wasPressed(list) {
  for (let i = 0; i < list.length; i += 1) {
    if (pressed.has(list[i])) return true;
  }
  return false;
}

/** True if the player pressed any key since the last frame. */
export function anyPressed() {
  return anyKey;
}

/** Clear the just-pressed set; call once per frame after the update. */
export function endFrame() {
  pressed.clear();
  anyKey = false;
}

/** Movement axes from the held keys: x in [-1, 1], y in [-1, 1]. */
export function moveAxes() {
  let x = 0;
  let y = 0;
  if (isHeld(KEYS.left)) x -= 1;
  if (isHeld(KEYS.right)) x += 1;
  if (isHeld(KEYS.up)) y -= 1;
  if (isHeld(KEYS.down)) y -= 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}
