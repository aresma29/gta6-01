// VICE BAY 3D — vehicle damage FX: smoke pouring from a damaged car's hood
// and a dent patch on the hood when the condition drops. The condition value
// itself lives on the car (vehicles.js); this module only renders the
// visible damage. Written fresh for Stage 3.
import * as THREE from '../vendor/three/three.module.min.js';

function makeSmokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.85)');
  grad.addColorStop(0.6, 'rgba(160,160,160,0.4)');
  grad.addColorStop(1, 'rgba(140,140,140,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createDamageFX(scene) {
  const tex = makeSmokeTexture();
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false,
    }));
    s.visible = false;
    scene.add(s);
    puffs.push({ sprite: s, life: 0, maxLife: 1.4, vy: 1.2, grow: 1.4 });
  }
  let emitT = 0;

  function dent(car) {
    if (car._dented) return;
    car._dented = true;
    const dent = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.06, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })
    );
    dent.position.set(0.1, 0.35 + car.spec.bodyH + 0.03, car.L * 0.28);
    dent.rotation.z = 0.06;
    dent.rotation.y = -0.05;
    car.group.add(dent);
  }

  function update(dt, vehicles) {
    const car = vehicles.playerCar;
    // Age active puffs.
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sprite.visible = false; p.sprite.material.opacity = 0; continue; }
      const k = 1 - p.life / p.maxLife;
      p.sprite.position.y += p.vy * dt;
      const s = 0.8 + k * p.grow;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = 0.35 * (1 - k);
    }
    if (!car) return;
    if (car.condition < 60) dent(car);
    if (car.condition < 45) {
      emitT -= dt;
      if (emitT <= 0) {
        emitT = car.condition < 25 ? 0.08 : 0.14;
        const p = puffs.find((q) => q.life <= 0);
        if (p) {
          const hx = car.x + Math.sin(car.heading) * 1.6;
          const hz = car.z + Math.cos(car.heading) * 1.6;
          p.sprite.position.set(hx, 1.1, hz);
          p.sprite.scale.set(0.8, 0.8, 1);
          p.sprite.material.opacity = 0.35;
          p.sprite.visible = true;
          p.life = p.maxLife;
          p.vy = 1.2;
          p.grow = car.condition < 25 ? 2.2 : 1.4;
        }
      }
    }
  }

  function activePuffs() {
    let n = 0;
    for (const p of puffs) if (p.life > 0) n++;
    return n;
  }

  return { update, activePuffs };
}
