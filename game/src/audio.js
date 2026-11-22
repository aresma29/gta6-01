// Sound effects, synthesised with the Web Audio API — no audio files,
// nothing fetched. Every effect is a short oscillator/noise burst.
// The context is created on the first user gesture (browsers require it).

let ctx = null;
let muted = false;
let sirenTimer = null;
let engineOsc = null;
let engineGain = null;

export function setMuted(value) {
  muted = value;
  if (engineGain) engineGain.gain.value = 0;
}

export function isMuted() {
  return muted;
}

function ensureCtx() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Call once from a user gesture (start button / key press). */
export function unlockAudio() {
  ensureCtx();
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol || 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

function noiseBurst(dur, vol, lowpass) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass || 1200;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol || 0.15, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

export const sfx = {
  click() {
    tone(660, 0.07, 'square', 0.06);
  },
  pickup() {
    tone(880, 0.09, 'sine', 0.1);
    setTimeout(() => tone(1320, 0.12, 'sine', 0.1), 70);
  },
  punch() {
    noiseBurst(0.12, 0.2, 900);
  },
  hurt() {
    tone(160, 0.18, 'sawtooth', 0.12, 90);
  },
  crash() {
    noiseBurst(0.25, 0.25, 700);
    tone(90, 0.2, 'sawtooth', 0.1, 50);
  },
  steal() {
    tone(440, 0.1, 'square', 0.08, 660);
  },
  mission() {
    tone(523, 0.12, 'sine', 0.12);
    setTimeout(() => tone(659, 0.12, 'sine', 0.12), 110);
    setTimeout(() => tone(784, 0.2, 'sine', 0.12), 220);
  },
  fail() {
    tone(220, 0.25, 'sawtooth', 0.1, 140);
  },
  busted() {
    tone(330, 0.2, 'square', 0.1, 220);
    setTimeout(() => tone(220, 0.3, 'square', 0.1, 165), 180);
  },
};

/** A looping two-tone police siren while wanted > 0. */
export function setSiren(on) {
  if (sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
  if (!on) return;
  let high = false;
  sirenTimer = setInterval(() => {
    if (!muted) tone(high ? 950 : 700, 0.28, 'sine', 0.045);
    high = !high;
  }, 300);
}

/** A quiet engine hum while driving; call with the car's speed (0 = off). */
export function setEngine(speed) {
  if (muted || speed < 20) {
    if (engineGain) engineGain.gain.value = 0;
    return;
  }
  const c = ensureCtx();
  if (!c) return;
  if (!engineOsc) {
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = c.createGain();
    engineGain.gain.value = 0;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(c.destination);
    engineOsc.start();
  }
  const freq = 55 + (speed / 560) * 90;
  engineOsc.frequency.setTargetAtTime(freq, c.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(0.035, c.currentTime, 0.05);
}
