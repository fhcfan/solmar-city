// The screenshot scenes behind ?shot=chase|street|combat|mission.
// Each one stages a real moment of the game — the same rules, the same
// world, the same seed — so a screenshot is exactly what a player sees.
// The cover is the chase: a getaway with wanted stars, police, the minimap
// and a mission objective all on screen at once.

import { SCREEN_PLAY } from './render.js';

// Stage the named scene in the game and return the screen to draw.
export function stageShot(name, game) {
  const scene = name === 'street' || name === 'combat' || name === 'mission' ? name : 'chase';
  game.stageScene(scene);
  return { screen: SCREEN_PLAY };
}
