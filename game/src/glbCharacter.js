// VICE BAY — visual prototype: rigged GLB characters (CC0, Quaternius).
// Loads a GLB, scales it to a target height with its feet at y=0, and
// drives its Idle / Walk / Run / Jump clips with an AnimationMixer.
// Returns null if the file cannot be loaded, so the caller keeps the
// procedural character as an offline-safe fallback.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

function findClip(clips, names) {
  for (const n of names) {
    const c = clips.find((a) => a.name.toLowerCase() === n.toLowerCase());
    if (c) return c;
  }
  return null;
}

/**
 * Load a rigged GLB character.
 * @param {string} url - local asset path (e.g. './assets/Casual_Male.glb')
 * @param {number} targetHeight - world height in metres (default 1.8)
 * @returns {Promise<object|null>} character object, or null on failure.
 *   { group, mixer, clips, height, nativeHeight, scale, currentAnim,
 *     mixerTime, setAnim(name), update(dt, speed, jumping) }
 */
export async function loadGLBCharacter(url, targetHeight = 1.8) {
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch (e) {
    console.warn('[glb] failed to load', url, e);
    return null;
  }
  const scene = gltf.scene;
  // Quaternius 'Skin' ships nearly black (baseColor 0.013), so the face
  // reads as black at dusk no matter the lights. Brighten it to a warm
  // skin tone. (CC0: recoloring at load is allowed; the file is untouched.)
  scene.traverse((o) => {
    const m = o.material;
    if (o.isMesh && m && m.name === 'Skin') m.color.setHex(0xd9a066);
  });
  // Measure in the bind pose, then scale + recenter so the feet sit at y=0
  // and the body is centred on x/z. (inner.position is in the outer
  // group's unscaled space, so it is multiplied by the scale factor.)
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = targetHeight / (size.y || targetHeight);
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(s);
  inner.position.set(
    (-s * (box.min.x + box.max.x)) / 2,
    -s * box.min.y,
    (-s * (box.min.z + box.max.z)) / 2
  );
  group.add(inner);
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });

  // Animation mixer + clips (Idle / Walk / Run / Jump; Punch if present).
  const mixer = new THREE.AnimationMixer(scene);
  const clips = gltf.animations || [];
  const actions = {};
  for (const [key, names] of [
    ['idle', ['idle']],
    ['walk', ['walk']],
    ['run', ['run']],
    ['jump', ['jump']],
    ['punch', ['punch']],
  ]) {
    const clip = findClip(clips, names);
    if (clip) {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat);
      actions[key] = a;
    }
  }
  let current = null;
  if (actions.idle) {
    actions.idle.play();
    current = 'idle';
  }
  function setAnim(name) {
    const next = actions[name];
    if (!next || current === name) return;
    const prev = current ? actions[current] : null;
    if (prev) prev.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    current = name;
  }
  function update(dt, speed, jumping) {
    const d = Math.min(Math.max(dt, 0), 0.05);
    let target = 'idle';
    if (jumping) target = 'jump';
    else if (speed > 5) target = 'run';
    else if (speed > 0.3) target = 'walk';
    setAnim(target);
    mixer.update(d);
  }
  return {
    group,
    mixer,
    clips: clips.map((c) => c.name),
    height: targetHeight,
    nativeHeight: size.y,
    scale: s,
    get currentAnim() {
      return current;
    },
    get mixerTime() {
      return mixer.time;
    },
    setAnim,
    update,
  };
}
