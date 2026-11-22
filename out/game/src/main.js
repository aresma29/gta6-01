// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between three screens:
// title, play and paused. Busted and wasted respawn the player at the
// hospital instead of ending the run.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP, KEYS } from './config.js';
import { createWorld, stepWorld, resetRun, saveState, loadState } from './world.js';
import {
  EVENT_PICKUP, EVENT_PUNCH, EVENT_HURT, EVENT_CRASH, EVENT_STEAL,
  EVENT_MISSION, EVENT_FAIL, EVENT_BUSTED, EVENT_WASTED, EVENT_MONEY,
} from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED } from './render.js';
import { initInput, isHeld, wasPressed, moveAxes, endFrame } from './input.js';
import { stageShot } from './shots.js';
import { sfx, setSiren, setEngine, setMuted, isMuted, unlockAudio } from './audio.js';
import { saveGame, loadGame, hasSave, readBest, saveBest } from './save.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

function playEvents(events) {
  if (events & EVENT_PICKUP) sfx.pickup();
  if (events & EVENT_PUNCH) sfx.punch();
  if (events & EVENT_HURT) sfx.hurt();
  if (events & EVENT_CRASH) sfx.crash();
  if (events & EVENT_STEAL) sfx.steal();
  if (events & EVENT_MISSION) sfx.mission();
  if (events & EVENT_FAIL) sfx.fail();
  if (events & EVENT_BUSTED) sfx.busted();
  if (events & EVENT_WASTED) sfx.fail();
  if (events & EVENT_MONEY) sfx.pickup();
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, readBest());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  initInput();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function startGame() {
    unlockAudio();
    resetRun(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Your first job is at the Garage.');
  }

  function quitToTitle() {
    if (world.player.money > best) {
      best = world.player.money;
      saveBest(best);
    }
    setSiren(false);
    setEngine(0);
    screen = SCREEN_TITLE;
    announce('Vice Bay. Press Enter to start.');
  }

  function doSave() {
    if (saveGame(saveState(world))) {
      announce('Saved.');
    }
  }

  function doLoad() {
    const data = loadGame();
    if (data && loadState(world, data)) {
      announce('Loaded.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Mute is global, on any screen.
    if (wasPressed(KEYS.mute)) {
      setMuted(!isMuted());
    }

    if (screen === SCREEN_TITLE) {
      if (wasPressed(KEYS.confirm) || wasPressed(KEYS.attack)) {
        startGame();
      }
      // A living backdrop: traffic and pedestrians keep moving.
      while (accumulator >= STEP) {
        stepWorld(world, STEP, { axes: { x: 0, y: 0 }, run: false, enter: false, attack: false });
        accumulator -= STEP;
      }
      renderer.draw(world, screen, best);
      endFrame();
      return;
    }

    if (screen === SCREEN_PAUSED) {
      if (wasPressed(KEYS.confirm) || wasPressed(KEYS.pause)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (wasPressed(['KeyR'])) {
        resetRun(world);
        screen = SCREEN_PLAY;
        announce('Playing. New run.');
      } else if (wasPressed(['KeyS'])) {
        doSave();
      } else if (wasPressed(['KeyL'])) {
        doLoad();
      } else if (wasPressed(['KeyQ'])) {
        quitToTitle();
      }
      renderer.draw(world, screen, best);
      endFrame();
      return;
    }

    // SCREEN_PLAY.
    if (wasPressed(KEYS.pause)) {
      if (world.player.money > best) {
        best = world.player.money;
        saveBest(best);
      }
      setSiren(false);
      setEngine(0);
      screen = SCREEN_PAUSED;
      announce('Paused.');
      renderer.draw(world, screen, best);
      endFrame();
      return;
    }

    const input = {
      axes: moveAxes(),
      run: isHeld(KEYS.run),
      enter: wasPressed(KEYS.enterCar),
      attack: wasPressed(KEYS.attack),
    };
    while (accumulator >= STEP) {
      const events = stepWorld(world, STEP, input);
      playEvents(events);
      // One-shot inputs are consumed by the first step of the frame.
      input.enter = false;
      input.attack = false;
      accumulator -= STEP;
    }
    // Siren while wanted; engine hum while driving.
    setSiren(world.wanted > 0);
    setEngine(world.player.inCar ? Math.abs(world.player.inCar.speed) : 0);
    if (world.player.money > best) {
      best = world.player.money;
    }
    renderer.draw(world, screen, best);
    endFrame();
  }

  // Leaving the tab pauses a running game rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vice Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
