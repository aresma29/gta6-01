// missions.js — 4 story missions for VICE BAY 3D (Stage 4). Written fresh in
// the rebuild recording. Sequential missions with markers, timers, rewards.
// Money starts at $250; completing all four pays $700 more ($950 total).
// Markers: a glowing beacon + ground ring at the current target. No network.

import * as THREE from 'three';

const MISSION_DEFS = [
  {
    id: 'm1', name: 'BEACH RUN', reward: 100, time: 90,
    desc: 'Drive to the ferris wheel on Sunset Strand.',
    kind: 'reach', target: { x: 0, z: 198, r: 12, label: 'FERRIS WHEEL' },
  },
  {
    id: 'm2', name: 'PACKAGE RUN', reward: 150, time: 120,
    desc: 'Pick up the package at the Market, deliver it to the Safehouse.',
    kind: 'legs',
    legs: [
      { x: 64, z: -64, r: 10, label: 'PICK UP' },
      { x: -64, z: -64, r: 10, label: 'DELIVER' },
    ],
  },
  {
    id: 'm3', name: 'LOSE THE HEAT', reward: 200, time: 180,
    desc: 'Get to 3 stars, then lose the cops (wanted back to 0).',
    kind: 'heat', needStars: 3,
  },
  {
    id: 'm4', name: 'CHECKPOINT DASH', reward: 250, time: 150,
    desc: 'Hit all 3 checkpoints in order, fast.',
    kind: 'checkpoints',
    checkpoints: [
      { x: -128, z: -128, r: 10, label: 'CP 1' },
      { x: 128, z: 64, r: 10, label: 'CP 2' },
      { x: 0, z: 198, r: 10, label: 'CP 3' },
    ],
  },
];

export function createMissions(scene, opts) {
  const player = opts.player;
  const police = opts.police;
  const onReward = opts.onReward || (() => {});
  const onEvent = opts.onEvent || (() => {});

  // ---- marker: glowing beacon + ground ring at the current target -------
  const marker = new THREE.Group();
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd24a, transparent: true, opacity: 0.28,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 30, 12, 1, true), beaconMat);
  beacon.position.y = 15;
  marker.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd24a, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  marker.add(ring);
  marker.visible = false;
  scene.add(marker);

  let current = null; // { def, legIdx, cpIdx, timeLeft, maxWanted, phase }
  const completed = new Set();
  let lastResult = null; // { kind: 'complete'|'fail', name, reward } for the HUD
  let lastResultT = 0;
  let pulseT = 0;

  function placeMarker(x, z, r) {
    marker.position.set(x, 0, z);
    marker.scale.set(r, 1, r);
    marker.visible = true;
  }

  function hideMarker() {
    marker.visible = false;
  }

  function nextId() {
    for (const d of MISSION_DEFS) if (!completed.has(d.id)) return d.id;
    return null;
  }

  function start(id) {
    const def = MISSION_DEFS.find((d) => d.id === (id || nextId()));
    if (!def) return false;
    current = {
      def, legIdx: 0, cpIdx: 0, timeLeft: def.time,
      maxWanted: 0, phase: 'go',
    };
    lastResult = null;
    if (def.kind === 'reach') placeMarker(def.target.x, def.target.z, def.target.r);
    else if (def.kind === 'legs') placeMarker(def.legs[0].x, def.legs[0].z, def.legs[0].r);
    else if (def.kind === 'checkpoints') placeMarker(def.checkpoints[0].x, def.checkpoints[0].z, def.checkpoints[0].r);
    else hideMarker(); // heat: no fixed target
    onEvent('start', def);
    return true;
  }

  function complete() {
    if (!current) return;
    const def = current.def;
    completed.add(def.id);
    onReward(def.reward);
    lastResult = { kind: 'complete', name: def.name, reward: def.reward };
    lastResultT = 4;
    hideMarker();
    onEvent('complete', def);
    current = null;
  }

  function fail() {
    if (!current) return;
    const def = current.def;
    lastResult = { kind: 'fail', name: def.name, reward: 0 };
    lastResultT = 4;
    hideMarker();
    onEvent('fail', def);
    current = null;
  }

  function distTo(x, z) {
    return Math.hypot(player.x - x, player.z - z);
  }

  function update(dt) {
    pulseT += dt;
    if (marker.visible) {
      beaconMat.opacity = 0.2 + 0.12 * Math.sin(pulseT * 3);
      ring.rotation.z += dt * 0.8;
    }
    if (lastResultT > 0) lastResultT -= dt;
    if (!current) return;
    const def = current.def;
    current.timeLeft -= dt;
    if (current.timeLeft <= 0) {
      fail();
      return;
    }
    if (def.kind === 'reach') {
      if (distTo(def.target.x, def.target.z) <= def.target.r) complete();
    } else if (def.kind === 'legs') {
      const leg = def.legs[current.legIdx];
      if (distTo(leg.x, leg.z) <= leg.r) {
        current.legIdx++;
        if (current.legIdx >= def.legs.length) complete();
        else {
          const nx = def.legs[current.legIdx];
          placeMarker(nx.x, nx.z, nx.r);
          onEvent('leg', def);
        }
      }
    } else if (def.kind === 'checkpoints') {
      const cp = def.checkpoints[current.cpIdx];
      if (distTo(cp.x, cp.z) <= cp.r) {
        current.cpIdx++;
        if (current.cpIdx >= def.checkpoints.length) complete();
        else {
          const nx = def.checkpoints[current.cpIdx];
          placeMarker(nx.x, nx.z, nx.r);
          onEvent('checkpoint', def);
        }
      }
    } else if (def.kind === 'heat') {
      const w = police ? police.wanted : player.wanted;
      if (w > current.maxWanted) current.maxWanted = w;
      if (current.phase === 'go' && current.maxWanted >= def.needStars) current.phase = 'cool';
      if (current.phase === 'cool' && w === 0) complete();
    }
  }

  function reset() {
    current = null;
    completed.clear();
    lastResult = null;
    lastResultT = 0;
    hideMarker();
  }

  // ---- HUD / test-facing state -------------------------------------------
  function currentTarget() {
    if (!current) return null;
    const def = current.def;
    if (def.kind === 'reach') return { ...def.target };
    if (def.kind === 'legs') return { ...def.legs[current.legIdx] };
    if (def.kind === 'checkpoints') return { ...def.checkpoints[current.cpIdx] };
    return null; // heat: no fixed target
  }

  // Next action inside the CURRENT mission (for the HUD NEXT line).
  // Empty when no mission is running (the panel then names the next mission).
  function nextStep() {
    if (!current) return '';
    const def = current.def;
    if (def.kind === 'reach') return `Drive to ${def.target.label}`;
    if (def.kind === 'legs') return def.legs[current.legIdx].label;
    if (def.kind === 'checkpoints') return def.checkpoints[current.cpIdx].label;
    if (def.kind === 'heat') {
      return current.phase === 'go'
        ? `Raise heat to ${def.needStars} stars`
        : 'Lose the cops';
    }
    return '';
  }

  function status() {
    if (lastResultT > 0 && lastResult) {
      return lastResult.kind === 'complete'
        ? `MISSION COMPLETE — ${lastResult.name} · +$${lastResult.reward}`
        : `MISSION FAILED — ${lastResult.name} · press N to retry`;
    }
    if (!current) {
      const nid = nextId();
      if (!nid) return 'ALL MISSIONS COMPLETE — Vice Bay is yours, Jax.';
      const d = MISSION_DEFS.find((x) => x.id === nid);
      return `Next: ${d.name} · $${d.reward} · press N to start`;
    }
    const def = current.def;
    const t = Math.max(0, Math.ceil(current.timeLeft));
    if (def.kind === 'heat') {
      const w = police ? police.wanted : player.wanted;
      const ph = current.phase === 'go'
        ? `get to ${def.needStars} stars (now ${w})`
        : `lose them — wanted ${w}`;
      return `${def.name} · ${ph} · ${t}s · $${def.reward}`;
    }
    const tgt = currentTarget();
    const d = tgt ? Math.round(distTo(tgt.x, tgt.z)) : 0;
    const step = def.kind === 'legs' ? ` (${current.legIdx + 1}/${def.legs.length})`
      : def.kind === 'checkpoints' ? ` (${current.cpIdx + 1}/${def.checkpoints.length})` : '';
    return `${def.name}${step} · ${tgt ? tgt.label : ''} ${d}m · ${t}s · $${def.reward}`;
  }

  return {
    defs: MISSION_DEFS,
    get current() { return current; },
    get completed() { return [...completed]; },
    get doneCount() { return completed.size; },
    get lastResult() { return lastResult; },
    nextId, start, update, reset,
    get target() { return currentTarget(); },
    get status() { return status(); },
    get nextStep() { return nextStep(); },
  };
}
