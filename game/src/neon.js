// VICE BAY 3D — landmarks: a neon ferris wheel on the beach, a vertical
// "VICE BAY" neon sign on the bank tower, and an "Ocean Drive" billboard by
// the beach road. All textures are canvas-generated; no external assets.
// Written fresh for Stage 3 (visual target: the owner's reference board).
import * as THREE from '../vendor/three/three.module.min.js';

function neonTextTexture(lines, w, h, colour, font) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font;
  g.shadowColor = colour;
  g.shadowBlur = 22;
  g.fillStyle = colour;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  for (const { text, x, y } of lines) {
    g.strokeText(text, x, y);
    g.fillText(text, x, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createLandmarks(scene, city) {
  const group = new THREE.Group();
  scene.add(group);
  let wheel = null;
  let neonMat = null;

  // --- Ferris wheel on the beach (0, 198): dead south down the central
  // road, so the chase-cam sees it in the distance. ---
  {
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, metalness: 0.4 });
    const neon = new THREE.MeshStandardMaterial({
      color: 0xff4ad8, roughness: 0.4, emissive: 0xff4ad8, emissiveIntensity: 1.4,
    });
    const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
    // A-frame legs.
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 20, 0.7), dark);
      leg.position.set(sx * 5.5, 9, 198);
      leg.rotation.z = sx * 0.28;
      leg.castShadow = true;
      group.add(leg);
    }
    // Platform.
    const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 10), dark);
    platform.position.set(0, 0.5, 198);
    group.add(platform);
    // The wheel itself (rotates around Z, facing the city / the chase-cam).
    wheel = new THREE.Group();
    wheel.position.set(0, 17, 198);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.45, 8, 40), neon);
    rim.castShadow = true;
    wheel.add(rim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      // A diameter spoke through the hub (length 27.5 ≈ the wheel diameter).
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.35, 27.5, 0.35), dark);
      spoke.position.set(0, 0, 0);
      spoke.rotation.z = a;
      wheel.add(spoke);
      // Cabin at the rim.
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.0),
        new THREE.MeshStandardMaterial({ color: [0xffd60a, 0x7ec8ff, 0xff4ad8, 0x7ee787][i % 4], roughness: 0.5, emissive: 0x222222 }));
      cabin.position.set(Math.sin(a) * 14, Math.cos(a) * 14, 0);
      cabin.castShadow = true;
      wheel.add(cabin);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1.2, 12), white);
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    group.add(wheel);
  }

  // --- Vertical "VICE BAY" neon sign on the bank tower (28, 28, h=42). ---
  {
    const tex = neonTextTexture(
      'VICE BAY'.split('').map((ch, i) => ({ text: ch, x: 64, y: 28 + i * 56 })),
      128, 512, '#ff4ad8', '900 44px system-ui, sans-serif'
    );
    neonMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 18.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.9 })
    );
    back.position.set(28, 21, 41.25);
    group.add(back);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 18), neonMat);
    sign.position.set(28, 21, 41.45);
    group.add(sign);
  }

  // --- "Ocean Drive" billboard by the beach road (14, 170), facing south
  // so the chase-cam (looking south) reads it. ---
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 192;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 192);
    grad.addColorStop(0, '#5a2a4a');
    grad.addColorStop(0.55, '#c65a2e');
    grad.addColorStop(1, '#ffb060');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 192);
    // Sun + sea.
    g.fillStyle = '#ffe9a0';
    g.beginPath(); g.arc(400, 120, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b5f7a';
    g.fillRect(0, 140, 512, 52);
    // Text.
    g.textAlign = 'center';
    g.font = '900 64px system-ui, sans-serif';
    g.shadowColor = '#ff4ad8'; g.shadowBlur = 18;
    g.fillStyle = '#ffffff';
    g.fillText('OCEAN DRIVE', 256, 78);
    g.font = '700 30px system-ui, sans-serif';
    g.shadowBlur = 10;
    g.fillStyle = '#ffd60a';
    g.fillText('VICE BAY · SUNSET STRIP', 256, 122);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7, metalness: 0.4 });
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, 9, 0.6), dark);
      pole.position.set(14 + sx * 6, 4.5, 170);
      pole.castShadow = true;
      group.add(pole);
    }
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(16, 6, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 0.9 })
    );
    board.position.set(14, 11, 170);
    group.add(board);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(15.4, 5.6),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    face.position.set(14, 11, 170.22);
    face.rotation.y = 0; // faces +z (south, toward the beach / chase-cam)
    group.add(face);
  }

  let t = 0;
  function update(dt) {
    t += dt;
    if (wheel) wheel.rotation.z += dt * 0.06;
    if (neonMat) neonMat.opacity = 0.85 + 0.15 * Math.sin(t * 2);
  }

  return { update };
}
