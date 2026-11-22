// VICE BAY — tuning numbers, palette and keys in one place.
// The world is a 3200x2400 coastal city; the camera shows a 1280x720
// logical viewport that follows the player, scaled to the window.
// The simulation runs on a fixed step (1/60 s) whatever the display rate.

export const STEP = 1 / 60;

export const WORLD = {
  width: 3200,
  height: 2400,
  // Road centre lines (the city grid). Roads are 120 wide.
  roadsX: [400, 1000, 1600, 2200, 2800],
  roadsY: [300, 800, 1300, 1800, 2200],
  roadWidth: 120,
  // Water: harbour on the west edge, sea along the south edge.
  harbourX: 260,
  seaY: 2280,
};

export const VIEW = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 220,
  runSpeed: 380,
  accel: 2400,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  punchCooldown: 0.35,
};

export const CAR = {
  length: 64,
  width: 30,
  // On-foot player top speed is 380; a car tops out well above it.
  topSpeed: 560,
  accel: 420,
  brake: 700,
  reverseTop: 200,
  steer: 2.6,
  // How close the player must be to enter a car.
  enterRange: 56,
};

export const TRAFFIC = { count: 18, speed: 200, minGap: 110 };

export const PED = { count: 26, speed: 70 };

export const POLICE = {
  topSpeed: 590,
  accel: 480,
  steer: 3.0,
  // Wanted stars 1..5; that many police cars chase at most.
  maxCars: 5,
  // Seconds without a crime and without a police car in sight before
  // the wanted level drops by one star.
  decaySeconds: 12,
  sightRange: 520,
  // Touching the player on foot at wanted >= 1 busts them (after a grab).
  grabSeconds: 1.2,
  // Ramming damage a police car deals to the player's car per hit.
  ramDamage: 8,
};

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  punchCop: 2,
  killEnemy: 0,
  max: 5,
};

export const ENEMY = {
  count: 6,
  radius: 14,
  health: 50,
  speed: 150,
  damage: 8,
  attackRange: 40,
  attackCooldown: 0.9,
  chaseRange: 320,
  dropMoney: 60,
};

export const MISSIONS = [
  {
    id: 'wheels',
    name: 'First Wheels',
    giver: 'Rico',
    text: 'Steal any car and drive it to the garage on Palm Row.',
    target: { x: 1600, y: 800 },
    targetLabel: 'Garage',
    reward: 200,
    needCar: true,
  },
  {
    id: 'package',
    name: 'Package Run',
    giver: 'Rico',
    text: 'Pick up the package at the Market, then deliver it to the Beach before the timer runs out.',
    pickup: { x: 2200, y: 1300 },
    pickupLabel: 'Market',
    target: { x: 1600, y: 2200 },
    targetLabel: 'Beach',
    reward: 300,
    timeLimit: 75,
  },
  {
    id: 'getaway',
    name: 'Getaway Driver',
    giver: 'Rico',
    text: 'The heat is on. Lose your 2-star wanted level and reach the Safehouse.',
    target: { x: 1000, y: 300 },
    targetLabel: 'Safehouse',
    reward: 400,
    wantedOnStart: 2,
  },
  {
    id: 'turf',
    name: 'Rival Turf',
    giver: 'Rico',
    text: 'Clear the rival crew out of Downtown Plaza. Defeat 3 rivals.',
    target: { x: 1600, y: 1300 },
    targetLabel: 'Plaza',
    reward: 500,
    defeatCount: 3,
  },
  {
    id: 'score',
    name: 'The Big Score',
    giver: 'Rico',
    text: 'Steal the armoured van from the Bank and bring it to the Harbour. Expect the whole force.',
    target: { x: 400, y: 1300 },
    targetLabel: 'Harbour',
    reward: 1000,
    vanAt: { x: 1600, y: 1800 },
    vanLabel: 'Bank',
    wantedOnStart: 2,
  },
];

export const PALETTE = {
  grass: '#3f7d44',
  grassDark: '#356b39',
  road: '#33373d',
  roadLine: '#d8c94a',
  sidewalk: '#8d8f94',
  water: '#2e6f9e',
  waterDeep: '#245a82',
  sand: '#d9c27a',
  building: '#7a6a58',
  building2: '#5d6b7a',
  building3: '#8a5f4d',
  building4: '#6b7a5d',
  roof: '#4a4038',
  window: '#ffe9a8',
  windowDark: '#2b3542',
  park: '#2f6b34',
  tree: '#2c5e2f',
  player: '#ffcf3f',
  playerOutline: '#7a5b00',
  ped: '#e8e8e8',
  enemy: '#c0392b',
  police: '#1f2a37',
  policeLightR: '#ff3b30',
  policeLightB: '#2f7bff',
  carColours: ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#f1c40f', '#16a085'],
  van: '#b0b6bd',
  hud: '#10141a',
  hudText: '#f2f4f6',
  hudMuted: '#9aa3ad',
  star: '#ffd23f',
  money: '#7dff8a',
  health: '#3ddc5f',
  healthLow: '#ff4d4d',
  marker: '#ff5fa2',
  markerRing: '#ffffff',
  title: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'vice-bay.save.v1';
export const BEST_KEY = 'vice-bay.best.v1';

/** Key bindings (KeyboardEvent.code values). */
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  attack: ['Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  confirm: ['Enter'],
};
