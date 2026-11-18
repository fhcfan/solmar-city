// Solmar City — every tuning number and colour in one place.
// The city is a fixed 3400x3400 world; the camera shows a 1280x800 window of it.
export const CFG = {
  worldSize: 3400,
  // Road grid: 9 vertical and 9 horizontal roads, 90 wide, on a 380 pitch.
  roadWidth: 90,
  roadPitch: 380,
  roadFirst: 95,
  roadCount: 9,
  // Player on foot.
  walkSpeed: 200,
  playerRadius: 13,
  // Driving.
  carAccel: 640,
  carBrake: 920,
  carReverseAccel: 340,
  carMaxSpeed: 560,
  carMaxReverse: 210,
  carTurn: 2.7,
  carRadius: 17,
  // Combat.
  playerMaxHealth: 100,
  punchDamage: 25,
  punchRange: 48,
  punchArc: 1.15,
  punchCooldown: 0.38,
  bulletDamage: 34,
  bulletSpeed: 820,
  shootCooldown: 0.22,
  // Wanted.
  maxWanted: 5,
  wantedCoolDelay: 8,
  wantedCoolStep: 5,
  // Traffic and crowds.
  trafficCount: 18,
  pedCount: 30,
  parkedCount: 14,
  // Camera and canvas.
  viewWidth: 1280,
  viewHeight: 800,
  // Palette: warm sun, sand, pastel walls, neon downtown.
  colors: {
    grass: '#8fae5e',
    sand: '#e8d5a4',
    sidewalk: '#d9c9a3',
    asphalt: '#4a4a52',
    asphaltLine: '#e8d44f',
    water: '#3f8fd2',
    beach: '#f0dcab',
    park: '#6f9e4f',
  },
};

// District wall colours, picked per building.
export const DISTRICTS = {
  palms: { name: 'Palms', wall: ['#f2c14e', '#e8927c', '#f7e3c3', '#a8c686'] },
  downtown: { name: 'Downtown', wall: ['#7fb3d5', '#c39bd3', '#f1948a', '#82c9b8'] },
  oldtown: { name: 'Old Town', wall: ['#e6b89c', '#d9a05b', '#c97b63', '#e8d8a8'] },
  marina: { name: 'Marina', wall: ['#a8d8e8', '#f7f3e8', '#8ecae6', '#ffb703'] },
  harbor: { name: 'Harbor', wall: ['#9a8c7a', '#b5a642', '#7d8c99', '#c08552'] },
};

// Mission reward ladder, in cash.
export const REWARDS = [400, 600, 900, 1200, 2500];

// Where the save lives (this browser only).
export const SAVE_KEY = 'solmar-city.save.v1';
