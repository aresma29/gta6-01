// Drawing only: the world's state and the current screen in, pixels out.
// The camera shows a 1280x720 logical viewport of the 3200x2400 city,
// scaled to fit the window. The static city (grass, water, roads,
// buildings, parks, trees, labels) is pre-rendered once to an offscreen
// canvas and blitted each frame; only the moving things (cars, people,
// markers, HUD) are drawn per frame, so the frame stays cheap.

import { WORLD, VIEW, PALETTE, FONT, PLAYER, MISSIONS, ENEMY } from './config.js';
import { LANDMARKS } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  // The pre-rendered static city, rebuilt when the world's seed changes.
  let staticLayer = null;
  let staticSeed = -1;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, colour, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = colour;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** Render the unchanging city once, in world coordinates. */
  function buildStatic(city, seed) {
    const layer = document.createElement('canvas');
    layer.width = WORLD.width;
    layer.height = WORLD.height;
    const g = layer.getContext('2d');
    // Ground.
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, WORLD.width, WORLD.height);
    // Harbour water (west) and the sea (south).
    g.fillStyle = PALETTE.water;
    g.fillRect(0, 0, WORLD.harbourX, WORLD.height);
    g.fillRect(0, WORLD.seaY, WORLD.width, WORLD.height - WORLD.seaY);
    // Beach sand between the city and the sea.
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, 2200, WORLD.width, WORLD.seaY - 2200);
    // Roads: asphalt bands with a dashed centre line.
    g.fillStyle = PALETTE.road;
    for (let i = 0; i < WORLD.roadsX.length; i += 1) {
      const x = WORLD.roadsX[i] - WORLD.roadWidth / 2;
      g.fillRect(x, 0, WORLD.roadWidth, WORLD.height);
    }
    for (let i = 0; i < WORLD.roadsY.length; i += 1) {
      const y = WORLD.roadsY[i] - WORLD.roadWidth / 2;
      g.fillRect(0, y, WORLD.width, WORLD.roadWidth);
    }
    g.fillStyle = PALETTE.roadLine;
    for (let i = 0; i < WORLD.roadsX.length; i += 1) {
      const x = WORLD.roadsX[i];
      for (let y = 0; y < WORLD.height; y += 48) {
        g.fillRect(x - 2, y, 4, 22);
      }
    }
    for (let i = 0; i < WORLD.roadsY.length; i += 1) {
      const y = WORLD.roadsY[i];
      for (let x = 0; x < WORLD.width; x += 48) {
        g.fillRect(x, y - 2, 22, 4);
      }
    }
    // Parks.
    for (let i = 0; i < city.parks.length; i += 1) {
      const pk = city.parks[i];
      g.fillStyle = PALETTE.park;
      g.fillRect(pk.x, pk.y, pk.w, pk.h);
    }
    // Buildings: coloured block, darker roof edge, lit windows.
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      g.fillStyle = b.colour;
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = PALETTE.roof;
      g.fillRect(b.x, b.y, b.w, 8);
      g.fillRect(b.x, b.y, 8, b.h);
      g.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.min(b.floors, Math.floor(b.h / 34)));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((b.seed + cx * 7 + cy * 13) % 3 === 0) continue;
          g.fillRect(b.x + 14 + cx * 34, b.y + 18 + cy * 34, 14, 12);
        }
      }
    }
    // Trees.
    g.fillStyle = PALETTE.tree;
    for (let i = 0; i < city.trees.length; i += 1) {
      const t = city.trees[i];
      g.beginPath();
      g.arc(t.x, t.y, 12, 0, TAU);
      g.fill();
    }
    // Landmark labels.
    g.textBaseline = 'alphabetic';
    g.font = `17px ${FONT}`;
    const names = Object.keys(LANDMARKS);
    for (let i = 0; i < names.length; i += 1) {
      const lm = LANDMARKS[names[i]];
      g.fillStyle = PALETTE.hudText;
      g.textAlign = 'center';
      g.fillText(lm.label, lm.x, lm.y - 14);
      g.fillStyle = PALETTE.marker;
      g.beginPath();
      g.arc(lm.x, lm.y, 5, 0, TAU);
      g.fill();
    }
    staticLayer = layer;
    staticSeed = seed;
  }

  function inView(cam, x, y, margin) {
    return (
      x > cam.x - margin && x < cam.x + VIEW.width + margin &&
      y > cam.y - margin && y < cam.y + VIEW.height + margin
    );
  }

  /** Blit the visible slice of the pre-rendered city (camera transform on). */
  function drawCity(world) {
    if (!staticLayer || staticSeed !== world.seed) {
      buildStatic(world.city, world.seed);
    }
    const cam = world.camera;
    // Source = the camera's rectangle of the static layer; destination = the
    // same rectangle in world coordinates, which the camera transform puts
    // on screen. Only the visible pixels are sampled.
    ctx.drawImage(
      staticLayer, cam.x, cam.y, VIEW.width, VIEW.height,
      cam.x, cam.y, VIEW.width, VIEW.height,
    );
  }

  function drawCarShape(car, isPlayerCar) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = car.kind === 'van' ? 84 : 64;
    const wid = car.kind === 'van' ? 36 : 30;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    // Body.
    ctx.fillStyle = car.colour;
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    // Windshield + rear window.
    ctx.fillStyle = PALETTE.windowDark;
    ctx.fillRect(len / 2 - 16, -wid / 2 + 4, 10, wid - 8);
    ctx.fillRect(-len / 2 + 6, -wid / 2 + 4, 8, wid - 8);
    // Wheels.
    ctx.fillStyle = '#141414';
    ctx.fillRect(-len / 2 + 8, -wid / 2 - 4, 12, 6);
    ctx.fillRect(-len / 2 + 8, wid / 2 - 2, 12, 6);
    ctx.fillRect(len / 2 - 20, -wid / 2 - 4, 12, 6);
    ctx.fillRect(len / 2 - 20, wid / 2 - 2, 12, 6);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(len / 2 - 2, -wid / 2 + 5, 3, 6);
    ctx.fillRect(len / 2 - 2, wid / 2 - 11, 3, 6);
    if (car.kind === 'police') {
      // Light bar, flashing red/blue with time.
      const flash = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = flash ? PALETTE.policeLightR : PALETTE.policeLightB;
      ctx.fillRect(-6, -wid / 2 + 3, 12, wid - 6);
      ctx.fillStyle = '#ffffff';
      text('PD', 0, 5, 13, '#ffffff', 'center', 'middle');
    }
    if (car.kind === 'van') {
      ctx.fillStyle = '#ffffff';
      text('$', 0, 5, 18, '#ffffff', 'center', 'middle');
    }
    if (isPlayerCar) {
      // A ring so the player's car reads at a glance.
      ctx.strokeStyle = PALETTE.star;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, len / 2 + 8, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, colour, radius, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down > 0) {
      // Lying flat.
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius + 6, radius - 4, 0, 0, TAU);
      ctx.fill();
    } else {
      ctx.rotate(angle);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(radius * 0.45, 0, radius * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawVisionCone(car) {
    const range = 300;
    const spread = 0.42;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, range);
    grad.addColorStop(0, 'rgba(255,220,90,0.30)');
    grad.addColorStop(1, 'rgba(255,220,90,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, range, -spread, spread);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEntities(world) {
    const cam = world.camera;
    const p = world.player;
    // Police vision cones first (under the cars).
    for (let i = 0; i < world.cars.length; i += 1) {
      const c = world.cars[i];
      if (c.kind !== 'police') continue;
      if (!inView(cam, c.x, c.y, 320)) continue;
      drawVisionCone(c);
    }
    // Pickups.
    for (let i = 0; i < world.pickups.length; i += 1) {
      const pk = world.pickups[i];
      if (!inView(cam, pk.x, pk.y, 30)) continue;
      if (pk.kind === 'health') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(pk.x - 12, pk.y - 12, 24, 24);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(pk.x - 3, pk.y - 9, 6, 18);
        ctx.fillRect(pk.x - 9, pk.y - 3, 18, 6);
      } else {
        ctx.fillStyle = PALETTE.money;
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 12, 0, TAU);
        ctx.fill();
        text('$', pk.x, pk.y + 5, 16, '#0b3d12', 'center');
      }
    }
    // Mission marker (pulsing diamond + a vertical beam).
    const m = world.mission;
    if (m) {
      const target = m.stage === 'pickup' ? m.pickup : m.target;
      if (target && inView(cam, target.x, target.y, 120)) {
        const pulse = 1 + Math.sin(world.time * 4) * 0.15;
        ctx.save();
        ctx.translate(target.x, target.y);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(13, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-13, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TAU);
        ctx.fill();
        ctx.restore();
        // A faint beam so the marker reads from a distance.
        ctx.fillStyle = 'rgba(255,95,162,0.12)';
        ctx.fillRect(target.x - 4, target.y - 260, 8, 260);
      }
    }
    // Cars.
    for (let i = 0; i < world.cars.length; i += 1) {
      const c = world.cars[i];
      if (!inView(cam, c.x, c.y, 80)) continue;
      drawCarShape(c, c === p.inCar);
    }
    // Pedestrians.
    for (let i = 0; i < world.peds.length; i += 1) {
      const ped = world.peds[i];
      if (!inView(cam, ped.x, ped.y, 30)) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.colour, 9, ped.down);
    }
    // Rivals.
    for (let i = 0; i < world.enemies.length; i += 1) {
      const e = world.enemies[i];
      if (!inView(cam, e.x, e.y, 30)) continue;
      drawPerson(e.x, e.y, e.angle, PALETTE.enemy, 13, e.down);
      // Health bar over a hurt rival.
      if (e.health < ENEMY.health && e.down <= 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
        ctx.fillStyle = PALETTE.healthLow;
        ctx.fillRect(e.x - 16, e.y - 26, 32 * (e.health / ENEMY.health), 5);
      }
    }
    // The player on foot (hidden while driving — the car is the player).
    if (!p.inCar) {
      const blink = p.hurtCooldown > 0 && Math.floor(p.hurtCooldown * 10) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.angle, PALETTE.player, PLAYER.radius, 0);
      // Facing tick.
      ctx.strokeStyle = PALETTE.playerOutline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
      ctx.stroke();
    }
  }

  function drawMinimap(world) {
    const mw = 210;
    const mh = 158;
    const mx = VIEW.width - mw - 16;
    const my = 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(mx, my, WORLD.harbourX * sx, mh);
    ctx.fillRect(mx, my + WORLD.seaY * sy, mw, mh - WORLD.seaY * sy);
    ctx.fillStyle = PALETTE.road;
    for (let i = 0; i < WORLD.roadsX.length; i += 1) {
      ctx.fillRect(mx + WORLD.roadsX[i] * sx - 2, my, 4, mh);
    }
    for (let i = 0; i < WORLD.roadsY.length; i += 1) {
      ctx.fillRect(mx, my + WORLD.roadsY[i] * sy, mw, 4);
    }
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mx + world.camera.x * sx, my + world.camera.y * sy,
      VIEW.width * sx, VIEW.height * sy,
    );
    // Mission target.
    const m = world.mission;
    if (m) {
      const target = m.stage === 'pickup' ? m.pickup : m.target;
      if (target) {
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, TAU);
        ctx.fill();
      }
    }
    // Police.
    for (let i = 0; i < world.cars.length; i += 1) {
      const c = world.cars[i];
      if (c.kind !== 'police') continue;
      ctx.fillStyle = PALETTE.policeLightB;
      ctx.beginPath();
      ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, TAU);
      ctx.fill();
    }
    // Player.
    ctx.fillStyle = PALETTE.star;
    ctx.beginPath();
    ctx.arc(mx + world.player.x * sx, my + world.player.y * sy, 4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawHud(world) {
    const p = world.player;
    // Top-left panel: health, money, wanted stars.
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect(12, 12, 250, 86);
    text('HEALTH', 24, 32, 14, PALETTE.hudMuted, 'left');
    const hw = 150;
    ctx.fillStyle = '#000000';
    ctx.fillRect(88, 20, hw, 14);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(88, 20, hw * (p.health / 100), 14);
    text(`$${p.money}`, 24, 62, 22, PALETTE.money, 'left');
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? '★' : '☆';
    text(stars, 24, 90, 22, PALETTE.star, 'left');
    // Car health while driving.
    if (p.inCar) {
      text(`CAR ${Math.max(0, Math.round(p.inCar.health))}`, 150, 62, 16, PALETTE.hudText, 'left');
      const kmh = Math.abs(Math.round(p.inCar.speed * 0.36));
      text(`${kmh} km/h`, 24, 118, 16, PALETTE.hudText, 'left');
    }
    drawMinimap(world);
    // Mission objective (bottom-left).
    const m = world.mission;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    if (m) {
      const label = `${m.name} — ${m.text}`;
      const timer = m.timeLeft > 0 ? `  [${Math.ceil(m.timeLeft)}s]` : '';
      const defeat = m.stage === 'defeat' ? `  (${world.defeated}/${m.defeatCount})` : '';
      ctx.fillRect(12, VIEW.height - 64, 640, 52);
      text(`${m.giver}: ${label}${timer}${defeat}`, 24, VIEW.height - 32, 17, PALETTE.hudText, 'left');
    } else if (world.allDone) {
      ctx.fillRect(12, VIEW.height - 64, 640, 52);
      text('KING OF VICE BAY — all jobs done. Free roam!', 24, VIEW.height - 32, 17, PALETTE.star, 'left');
    }
    // Controls hint (bottom-right, small).
    text('WASD move/drive · Shift run · E enter car · Space punch · P pause · M mute', VIEW.width - 16, VIEW.height - 16, 13, PALETTE.hudMuted, 'right');
    // Message banner (a few seconds after an event).
    if (world.missionMsg && world.time - world.missionMsgAt < 5) {
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      const w = 720;
      ctx.fillRect((VIEW.width - w) / 2, 108, w, 40);
      text(world.missionMsg, VIEW.width / 2, 136, 19, PALETTE.star, 'center');
    }
    // Off-screen mission arrow: point at the target from the screen edge.
    if (m) {
      const target = m.stage === 'pickup' ? m.pickup : m.target;
      if (target) {
        const sx = target.x - world.camera.x;
        const sy = target.y - world.camera.y;
        if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
          const cx = VIEW.width / 2;
          const cy = VIEW.height / 2;
          const ang = Math.atan2(sy - cy, sx - cx);
          const ax = cx + Math.cos(ang) * 300;
          const ay = cy + Math.sin(ang) * 200;
          ctx.save();
          ctx.translate(ax, ay);
          ctx.rotate(ang);
          ctx.fillStyle = PALETTE.marker;
          ctx.beginPath();
          ctx.moveTo(16, 0);
          ctx.lineTo(-10, -11);
          ctx.lineTo(-10, 11);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          const dist = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
          text(`${dist}m`, ax, ay - 18, 14, PALETTE.marker, 'center');
        }
      }
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineH = 30;
    const height = 150 + lines.length * lineH + 70;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(10,14,20,0.92)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || PALETTE.star;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 46, accent || PALETTE.title, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 128 + i * lineH, 19, PALETTE.hudText, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.star, 'center');
  }

  function drawTitleText(world, best) {
    text('VICE BAY', VIEW.width / 2, 190, 84, PALETTE.title, 'center');
    text('An open-world crime story — a city that never sleeps', VIEW.width / 2, 232, 22, PALETTE.hudText, 'center');
    const lines = [
      'Explore the city. Steal cars. Outrun the force. Finish all 5 jobs.',
      'WASD / arrows — move & drive      Shift — run',
      'E — enter / exit a car      Space — punch      P — pause      M — mute',
      best > 0 ? `Best haul so far: $${best}` : 'Your first job is waiting at the Garage.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, 300 + i * 32, 20, PALETTE.hudText, 'center');
    }
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) text('Press Enter to start', VIEW.width / 2, 470, 26, PALETTE.star, 'center');
    text('An original game. No real city, no real gang — all fiction.', VIEW.width / 2, VIEW.height - 24, 14, PALETTE.hudMuted, 'center');
  }

  function drawPaused() {
    drawPanel('Paused', [
      'The city waits for you.',
      'Enter — resume      R — restart the run',
      'S — save      L — load      M — mute',
      'Q — quit to the title screen',
    ], 'Press Enter to resume', PALETTE.hudText);
  }

  /**
   * Paint one frame. The world (city + entities) is drawn under the camera
   * transform; the HUD, panels and title text are drawn in screen space.
   */
  function draw(world, screen, best) {
    const cam = world.camera;
    // Backdrop.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // World under the camera: world (wx, wy) -> screen (view + (w - cam) * scale).
    ctx.setTransform(
      view.scale, 0, 0, view.scale,
      view.x - cam.x * view.scale, view.y - cam.y * view.scale,
    );
    drawCity(world);
    drawEntities(world);
    // Screen space from here on.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(8,10,16,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawTitleText(world, best);
      return;
    }
    drawHud(world);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,10,16,0.45)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPaused();
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
