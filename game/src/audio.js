// VICE BAY 3D — synthesized Web Audio sound. No audio files are loaded.
// The context is created lazily on the first user gesture (the Start click).
// Written fresh for the 3D build.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = 0, sirenHigh = false;
  let humOsc = null, humGain = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return false; }
    // Engine: sawtooth through a lowpass; pitch follows speed.
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 60;
    engineFilter = ctx.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start();
    // Siren: a square wave that alternates tone.
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'square'; sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
    sirenOsc.start();
    // City hum: low filtered noise, very quiet.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const humFilter = ctx.createBiquadFilter(); humFilter.type = 'lowpass'; humFilter.frequency.value = 180;
    humGain = ctx.createGain(); humGain.gain.value = 0.012;
    noise.connect(humFilter); humFilter.connect(humGain); humGain.connect(ctx.destination);
    noise.start();
    humOsc = noise;
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (ctx) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        if (humGain) humGain.gain.value = 0;
      }
    },
    isMuted() { return muted; },
    // speed01 0..1 while driving; 0 (or null) = engine off.
    engine(speed01) {
      if (!ensure() || muted) return;
      if (speed01 == null || speed01 <= 0.02) { engineGain.gain.value = 0; return; }
      engineOsc.frequency.value = 55 + speed01 * 165;
      engineGain.gain.value = 0.035 + speed01 * 0.05;
    },
    siren(on) {
      if (!ensure() || muted) return;
      if (!on) { sirenGain.gain.value = 0; return; }
      sirenTimer += 1 / 60;
      if (sirenTimer > 0.42) { sirenTimer = 0; sirenHigh = !sirenHigh; sirenOsc.frequency.value = sirenHigh ? 950 : 700; }
      sirenGain.gain.value = 0.028;
    },
    punch() { noiseBurst(0.12, 0.25, 500); blip(90, 0.12, 'sine', 0.2, 45); },
    crash() { noiseBurst(0.3, 0.3, 700); blip(70, 0.25, 'sine', 0.22, 35); },
    pickup() { blip(660, 0.1, 'sine', 0.14); setTimeout(() => blip(990, 0.14, 'sine', 0.14), 90); },
    coin() { blip(880, 0.08, 'square', 0.07); setTimeout(() => blip(1320, 0.12, 'square', 0.07), 70); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sine', 0.15), i * 110)); },
    busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.1), i * 160)); },
    thud() { blip(70, 0.15, 'sine', 0.22, 40); },
  };
}
