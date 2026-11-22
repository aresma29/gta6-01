// Save / load through localStorage. A save holds the player's position,
// health, money, mission progress, wanted level and elapsed time; loading
// restores the run to that state. Storage can be off (private windows),
// so every call is wrapped and failures are silent.

import { SAVE_KEY, BEST_KEY } from './config.js';

function read(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveGame(data) {
  return write(SAVE_KEY, data);
}

export function loadGame() {
  return read(SAVE_KEY);
}

export function hasSave() {
  return read(SAVE_KEY) !== null;
}

export function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best lasts this visit only when storage is off.
  }
}
