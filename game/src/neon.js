// VICE BAY — Stage 3: neon landmarks (ferris wheel, VICE BAY sign,
// Ocean Drive billboard). Written fresh for the rebuild. All textures are
// canvas-generated; no line is copied from any earlier build.
import * as THREE from 'three';

/** Canvas texture with glowing vertical text. */
function neonTextTexture(lines, color, bg) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const step = 512 / (lines.length + 1);
  lines.forEach((ch, i) => {
    g.fillText(ch, 64, step * (i + 1));
  });
  // Second pass for a harder glow core.
  g.shadowBlur = 6;
  g.fillStyle = '#ffffff';
  lines.forEach((ch, i) => {
    g.fillText(ch, 64, step * (i + 1));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas texture for the Ocean Drive billboard (sunset + sun + sea). */
function billboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ff5fd0');
  grad.addColorStop(0.45, '#ff8a3d');
  grad.addColorStop(0.7, '#ffd76a');
  grad.addColorStop(1, '#0e6f80');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // Sun.
  g.fillStyle = '#fff3b0';
  g.beginPath();
  g.arc(256, 150, 42, 0, Math.PI * 2);
  g.fill();
  // Sea band.
  g.fillStyle = '#0e6f80';
  g.fillRect(0, 190, 512, 66);
  // Text.
  g.fillStyle = '#ffffff';
  g.shadowColor = '#ff5fd0';
  g.shadowBlur = 14;
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('OCEAN DRIVE', 256, 78);
  g.font = 'bold 26px Arial, sans-serif';
  g.fillText('VICE BAY · SUNSET STRIP', 256, 118);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createNeon(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- Ferris wheel on the beach (0, 198). ---
  const wheel = new THREE.Group();
  wheel.position.set(0, 15, 198);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xff5fd0,
    emissive: 0xff2ea6,
    emissiveIntensity: 1.8,
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.45, 8, 40), rimMat);
  wheel.add(rim);
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0x555555, emissiveIntensity: 0.4 });
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 25.5, 0.5), spokeMat);
    spoke.rotation.z = (i * Math.PI) / 4;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xaa7711, emissiveIntensity: 0.8 })
  );
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  // 8 cabins around the rim, coloured.
  const cabinColors = [0xff5f5f, 0xffd76a, 0x7dff8a, 0x5fb8ff, 0xc07dff, 0xff9a4d, 0x5ff2d6, 0xff7fb8];
  const cabins = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshStandardMaterial({
        color: cabinColors[i],
        emissive: cabinColors[i],
        emissiveIntensity: 0.9,
      })
    );
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    wheel.add(cab);
    cabins.push(cab);
  }
  group.add(wheel);
  // Support legs (A-frame) so the wheel stands on the sand.
  const legMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4 });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 16, 0.9), legMat);
    leg.position.set(sx * 5.5, 7.5, 198);
    leg.rotation.z = -sx * 0.36;
    group.add(leg);
  }
  // A warm point light at the wheel so the neon reads at dusk.
  const wheelLight = new THREE.PointLight(0xff5fd0, 60, 60, 1.6);
  wheelLight.position.set(0, 16, 202);
  group.add(wheelLight);

  // --- Vertical VICE BAY neon sign on the BANK tower south face (32, -32). ---
  // The sign spans y 11–25 so it overlaps the tower face across a range of
  // building heights; it faces south (+z) toward the plaza road.
  const signTex = neonTextTexture(['V', 'I', 'C', 'E', ' ', 'B', 'A', 'Y'], '#ff5fd0', '#1a0a2e');
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 14),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: false })
  );
  sign.position.set(32, 18, -19.2);
  group.add(sign);
  const signLight = new THREE.PointLight(0xff5fd0, 40, 45, 1.6);
  signLight.position.set(32, 18, -15);
  group.add(signLight);

  // --- Ocean Drive billboard by the beach road, facing south (chase-cam). ---
  const bbTex = billboardTexture();
  const billboard = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshBasicMaterial({ map: bbTex })
  );
  billboard.position.set(-24, 8, 188);
  group.add(billboard);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.3 });
  for (const px of [-29, -19]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), postMat);
    post.position.set(px, 2.5, 188);
    group.add(post);
  }

  let time = 0;
  /** Rotate the wheel + pulse the neon. dt clamped to [0, 0.05]. */
  function update(dt) {
    const d = Math.max(0, Math.min(dt, 0.05));
    time += d;
    wheel.rotation.z += d * 0.12;
    // Keep the cabins upright as the wheel turns.
    for (let i = 0; i < cabins.length; i++) {
      cabins[i].rotation.z = -wheel.rotation.z;
    }
    const pulse = 1.6 + Math.sin(time * 2.2) * 0.35;
    rimMat.emissiveIntensity = pulse;
    wheelLight.intensity = 55 + Math.sin(time * 2.2) * 12;
  }

  return {
    update,
    wheel,
    sign,
    billboard,
    get wheelPosition() {
      return { x: 0, z: 198 };
    },
  };
}
