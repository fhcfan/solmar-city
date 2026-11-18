// Solmar City — entry point. Wires the world, input, sound and renderer
// together and runs the frame loop. Nothing here is game logic; that all
// lives in world.js. `?shot=chase|street|combat|mission` stages a fixed
// scene for screenshots instead of the title screen.

import { createGame } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const game = createGame();
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let shotFrames = 0;

if (shotName) stageShot(shotName, game);

// First gesture anywhere unlocks the synthesized audio.
window.addEventListener('pointerdown', () => audio.ensure());
window.addEventListener('keydown', () => audio.ensure());

// Handle title-screen choices here; the world owns every other screen.
function titleInput() {
  const actions = input.takeActions();
  const clicked = input.takeClick();
  if (actions & 32 || clicked) {
    if (game.hasSave) game.continueGame();
    else game.startNewGame();
  } else if (actions & 16) {
    game.startNewGame();
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (game.state.screen === 'title') titleInput();
  game.step(dt, input, audio);
  renderer.draw(game, game.state.screen);
  input.endFrame();
  if (shotName) {
    shotFrames += 1;
    if (shotFrames >= 8) window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// For play-testing and debugging from the console.
window.__solmar = { game, input, audio };
requestAnimationFrame(frame);
