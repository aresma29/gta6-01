// audio.js — Web Audio synth for VICE BAY 3D (Stage 4). Written fresh in the
// rebuild recording. No audio files, no network — everything is synthesized
// with oscillators + filtered noise. Headless-safe: if there is no
// AudioContext (headless Chromium) every call is a silent no-op, so the
// tests never fail on audio. Mute with M (main3d.js calls setMuted).

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHi = false;
  let sirenT = 0;
  let sirenOn = false;

  function ensure() {
    if (ctx || muted) return !!ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { /* headless: ignore */ }
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    try {
      resume();
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol || 0.15, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) { /* headless: ignore */ }
  }

  function noiseBurst(dur, vol, freq) {
    if (!ensure()) return;
    try {
      resume();
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = freq || 800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
    } catch (e) { /* headless: ignore */ }
  }

  function startEngine() {
    if (!ensure() || engineOsc) return;
    try {
      resume();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch (e) { engineOsc = null; }
  }

  function stopEngine() {
    if (!engineOsc) return;
    try { engineOsc.stop(); } catch (e) { /* ignore */ }
    engineOsc = null;
    engineGain = null;
    engineFilter = null;
  }

  function startSiren() {
    if (!ensure() || sirenOsc) return;
    try {
      resume();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.035;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenHi = false;
      sirenT = 0;
      sirenOn = true;
    } catch (e) { sirenOsc = null; sirenOn = false; }
  }

  function stopSiren() {
    if (!sirenOsc) return;
    try { sirenOsc.stop(); } catch (e) { /* ignore */ }
    sirenOsc = null;
    sirenGain = null;
    sirenOn = false;
  }

  function update(dt, state) {
    if (muted) return;
    const driving = !!(state && state.driving);
    const speed = (state && state.speed) || 0;
    const wanted = (state && state.wanted) || 0;
    // Engine hum follows speed; only while driving.
    if (driving) {
      startEngine();
      if (engineOsc && engineGain) {
        try {
          engineOsc.frequency.value = 55 + Math.abs(speed) * 4;
          engineGain.gain.value = 0.05;
        } catch (e) { /* ignore */ }
      }
    } else {
      stopEngine();
    }
    // Siren wail while wanted >= 1 (two alternating tones).
    if (wanted >= 1) {
      startSiren();
      if (sirenOsc) {
        sirenT += dt;
        if (sirenT > 0.45) {
          sirenT = 0;
          sirenHi = !sirenHi;
          try { sirenOsc.frequency.value = sirenHi ? 880 : 660; } catch (e) { /* ignore */ }
        }
      }
    } else {
      stopSiren();
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (muted) {
      stopEngine();
      stopSiren();
    }
  }

  return {
    update,
    setMuted,
    get muted() { return muted; },
    get ready() { return !!ctx; },
    punch() { tone(130, 0.12, 'sine', 0.25, 55); noiseBurst(0.08, 0.12, 300); },
    pistol() { noiseBurst(0.09, 0.3, 1200); tone(1800, 0.05, 'square', 0.08, 300); },
    pickup() { tone(880, 0.12, 'sine', 0.15); setTimeout(() => tone(1320, 0.15, 'sine', 0.15), 90); },
    checkpoint() { tone(660, 0.1, 'sine', 0.15); setTimeout(() => tone(990, 0.12, 'sine', 0.15), 80); },
    missionComplete() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sine', 0.18), i * 110));
    },
    missionFail() { tone(330, 0.3, 'sawtooth', 0.12, 110); },
  };
}
