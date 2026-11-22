// VICE BAY — Stage 4: story missions for the fixer Rico.
// Written fresh for Stage 4. Four jobs, run in sequence: each has a
// marker (in-world beacon + minimap), an objective, and a money reward
// that is actually added to the player's money on completion. No line is
// copied from any earlier build (there was no mission code before).
import * as THREE from 'three';
import { clamp } from './util.js';

const REACH_DIST = 8; // metres from a marker that counts as "arrived"

const MISSION_DEFS = [
  {
    id: 'beach-run',
    name: 'BEACH RUN',
    giver: 'RICO',
    brief: 'Drive to the beach marker. First job — do not keep the client waiting.',
    reward: 100,
    type: 'reach',
    target: { x: 0, z: 190 },
    timer: 0,
  },
  {
    id: 'package-run',
    name: 'PACKAGE RUN',
    giver: 'RICO',
    brief: 'Deliver the package to the market marker. 90 seconds — the buyer walks at 91.',
    reward: 150,
    type: 'reach',
    target: { x: -128, z: 64 },
    timer: 90,
  },
  {
    id: 'lose-the-heat',
    name: 'LOSE THE HEAT',
    giver: 'RICO',
    brief: 'Get the VBPD to 3 stars, then lose them completely. No heat, no job.',
    reward: 200,
    type: 'heat',
    target: null,
    timer: 0,
  },
  {
    id: 'checkpoint-dash',
    name: 'CHECKPOINT DASH',
    giver: 'RICO',
    brief: 'Hit all three checkpoints in order. Fastest courier in Vice Bay gets paid.',
    reward: 250,
    type: 'checkpoints',
    target: null,
    timer: 0,
    checkpoints: [
      { x: 64, z: -128 },
      { x: -64, z: 128 },
      { x: 0, z: -192 },
    ],
  },
];

/** A tall gold beacon + ground ring marking the active objective. */
function buildBeacon() {
  const g = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffd76a, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 12, 1, true), beamMat);
  beam.position.y = 20;
  g.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd76a, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 6, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  g.visible = false;
  return { group: g, beam, ring };
}

export function createMissions(scene, player, police, callbacks) {
  const cb = callbacks || {};
  const beacon = buildBeacon();
  scene.add(beacon.group);

  let current = -1; // index into MISSION_DEFS, -1 = none yet
  let status = 'idle'; // idle | active | complete | failed | done
  let phase = 1; // heat mission: 1 = get 3 stars, 2 = lose them
  let timerLeft = 0;
  let cpIndex = 0;
  let flash = ''; // one-shot message for the HUD ("MISSION COMPLETE +$150")
  let flashUntil = 0;
  let completed = [];

  function activeDef() {
    return current >= 0 && current < MISSION_DEFS.length ? MISSION_DEFS[current] : null;
  }

  function currentTarget() {
    const def = activeDef();
    if (!def || status !== 'active') return null;
    if (def.type === 'checkpoints') return def.checkpoints[cpIndex] || null;
    return def.target;
  }

  function placeBeacon() {
    const t = currentTarget();
    if (t) {
      beacon.group.position.set(t.x, 0, t.z);
      beacon.group.visible = true;
    } else {
      beacon.group.visible = false;
    }
  }

  function startMission(i) {
    if (i < 0 || i >= MISSION_DEFS.length) return false;
    current = i;
    const def = MISSION_DEFS[i];
    status = 'active';
    phase = 1;
    timerLeft = def.timer || 0;
    cpIndex = 0;
    flash = '';
    placeBeacon();
    return true;
  }

  function startNext() {
    // Skip / advance: from idle start M1; from active/failed move on;
    // after the last mission, replay from M1.
    if (status === 'done' || current >= MISSION_DEFS.length - 1) return startMission(0);
    return startMission(current + 1);
  }

  function complete() {
    const def = activeDef();
    if (!def) return;
    player.money = (player.money || 0) + def.reward;
    completed.push(def.id);
    flash = `MISSION COMPLETE — ${def.name} +$${def.reward}`;
    flashUntil = performance.now() + 6000;
    if (cb.onComplete) cb.onComplete(def);
    if (current >= MISSION_DEFS.length - 1) {
      status = 'done';
      current = -1;
      placeBeacon();
    } else {
      startMission(current + 1);
    }
  }

  function fail(reason) {
    const def = activeDef();
    status = 'failed';
    flash = `MISSION FAILED — ${def ? def.name : ''} (${reason}). Press N to retry.`;
    flashUntil = performance.now() + 6000;
    if (cb.onFail) cb.onFail(def, reason);
  }

  function update(dt) {
    const d = clamp(dt, 0, 0.05);
    if (status !== 'active') return;
    const def = activeDef();
    if (!def) return;
    // Pulse the beacon.
    const pulse = 0.7 + Math.sin(performance.now() * 0.004) * 0.3;
    beacon.ring.scale.setScalar(pulse);
    beacon.beam.material.opacity = 0.25 + pulse * 0.15;
    // Timed missions.
    if (def.timer > 0) {
      timerLeft -= d;
      if (timerLeft <= 0) {
        timerLeft = 0;
        fail('time up');
        return;
      }
    }
    const distTo = (t) => Math.hypot(player.x - t.x, player.z - t.z);
    if (def.type === 'reach') {
      if (def.target && distTo(def.target) < REACH_DIST) complete();
    } else if (def.type === 'checkpoints') {
      const cp = def.checkpoints[cpIndex];
      if (cp && distTo(cp) < REACH_DIST) {
        cpIndex++;
        if (cpIndex >= def.checkpoints.length) {
          complete();
        } else {
          placeBeacon();
        }
      }
    } else if (def.type === 'heat') {
      if (phase === 1 && (player.wanted || 0) >= 3) {
        phase = 2;
      } else if (phase === 2 && (player.wanted || 0) === 0) {
        complete();
      }
    }
  }

  function reset() {
    current = -1;
    status = 'idle';
    phase = 1;
    timerLeft = 0;
    cpIndex = 0;
    flash = '';
    completed = [];
    placeBeacon();
  }

  return {
    update,
    reset,
    startMission,
    startNext,
    get defs() {
      return MISSION_DEFS.map((m) => ({ id: m.id, name: m.name, reward: m.reward }));
    },
    getState() {
      const def = activeDef();
      const t = currentTarget();
      let progress = '';
      if (status === 'active' && def) {
        if (def.type === 'reach' && t) {
          progress = `${Math.round(Math.hypot(player.x - t.x, player.z - t.z))} m to marker`;
        } else if (def.type === 'checkpoints') {
          progress = `checkpoint ${cpIndex + 1}/${def.checkpoints.length}`;
        } else if (def.type === 'heat') {
          progress = phase === 1 ? 'get 3 stars' : 'lose the heat';
        }
        if (def.timer > 0) progress += ` · ${Math.ceil(timerLeft)}s left`;
      }
      return {
        status,
        current: def ? def.id : null,
        name: def ? def.name : null,
        giver: def ? def.giver : null,
        brief: def ? def.brief : null,
        reward: def ? def.reward : 0,
        progress,
        timerLeft: Math.ceil(timerLeft),
        phase,
        cpIndex,
        completed: [...completed],
        flash: performance.now() < flashUntil ? flash : '',
      };
    },
    getMarker() {
      const t = currentTarget();
      return t ? { x: t.x, z: t.z } : null;
    },
  };
}
