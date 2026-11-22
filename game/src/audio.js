// VICE BAY — Stage 4: synthesized audio (Web Audio, no external files).
// Written fresh for Stage 4. Engine hum (pitch follows speed), police
// siren when wanted, gunshot, punch thud, reward chime, ambient city
// pad. Everything is generated locally — zero network requests, fully
// offline. Mute (M) silences the master gain. Never throws: if the
// AudioContext is unavailable, every call is a safe no-op.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let ambientOsc1 = null;
  let ambientOsc2 = null;
  let ambientGain = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // --- engine: sawtooth through a lowpass, pitch follows speed. ---
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 42;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // --- siren: sine wail, LFO sweeps 700 <-> 1300 Hz. ---
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 1000;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.55;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      // --- ambient: two detuned low sines, very quiet city pad. ---
      ambientOsc1 = ctx.createOscillator();
      ambientOsc1.type = 'sine';
      ambientOsc1.frequency.value = 55;
      ambientOsc2 = ctx.createOscillator();
      ambientOsc2.type = 'sine';
      ambientOsc2.frequency.value = 82.5;
      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.035;
      ambientOsc1.connect(ambientGain);
      ambientOsc2.connect(ambientGain);
      ambientGain.connect(master);
      ambientOsc1.start();
      ambientOsc2.start();
      started = true;
      return true;
    } catch (e) {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) {
      master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
    }
  }

  /** Engine hum: pitch + volume follow the driven car's speed. */
  function setEngine(speed, driving) {
    if (!ctx || !engineOsc) return;
    const s = Math.abs(speed || 0);
    const t = ctx.currentTime;
    engineOsc.frequency.setTargetAtTime(42 + s * 4.5, t, 0.1);
    engineFilter.frequency.setTargetAtTime(320 + s * 30, t, 0.1);
    engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.min(0.1, s * 0.003) : 0, t, 0.1);
  }

  /** Siren wail on while the player is wanted. */
  function setSiren(on) {
    if (!ctx || !sirenGain) return;
    sirenGain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.2);
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq || 1800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    } catch (e) { /* ignore */ }
  }

  function gunshot() {
    noiseBurst(0.16, 0.35, 2200);
    blip(90, 0.12, 'sine', 0.25);
  }

  function punch() {
    blip(150, 0.12, 'sine', 0.3);
    noiseBurst(0.08, 0.18, 700);
  }

  function chime() {
    blip(880, 0.18, 'sine', 0.22, 0);
    blip(1108, 0.18, 'sine', 0.22, 0.12);
    blip(1318, 0.3, 'sine', 0.22, 0.24);
  }

  function failTone() {
    blip(220, 0.25, 'sawtooth', 0.12, 0);
    blip(165, 0.35, 'sawtooth', 0.12, 0.18);
  }

  return {
    ensure,
    resume,
    setMuted,
    setEngine,
    setSiren,
    gunshot,
    punch,
    chime,
    failTone,
    getState() {
      return {
        available: !!ctx,
        ctxState: ctx ? ctx.state : 'none',
        muted,
        engineOn: !!(ctx && engineGain && engineGain.gain.value > 0),
        sirenOn: !!(ctx && sirenGain && sirenGain.gain.value > 0),
        started,
      };
    },
  };
}
