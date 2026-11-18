// Keyboard and mouse input for Solmar City.
// Held keys give a movement axis; one-shot presses (interact, punch, pause,
// mute, restart) are queued as flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice.

export const ACT_INTERACT = 1;
export const ACT_PUNCH = 2;
export const ACT_PAUSE = 4;
export const ACT_MUTE = 8;
export const ACT_RESTART = 16;
export const ACT_CONFIRM = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF', 'KeyJ']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR', 'KeyN']);
const CONFIRM = new Set(['Space', 'Enter']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (INTERACT.has(event.code)) actions |= ACT_INTERACT;
    else if (PUNCH.has(event.code)) actions |= ACT_PUNCH;
    else if (PAUSE.has(event.code)) actions |= ACT_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACT_MUTE;
    else if (RESTART.has(event.code)) actions |= ACT_RESTART;
    else if (CONFIRM.has(event.code)) actions |= ACT_CONFIRM;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 800;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.down = true;
    mouse.clicked = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 1280;
    mouse.y = ((event.clientY - rect.top) / rect.height) * 800;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  function axis(keysNegative, keysPositive) {
    let value = 0;
    for (const code of keysNegative) if (held.has(code)) value -= 1;
    for (const code of keysPositive) if (held.has(code)) value += 1;
    return value;
  }

  return {
    mouse,
    // -1/0/1 movement axes from WASD or the arrow keys.
    moveX() {
      return axis(LEFT, RIGHT);
    },
    moveY() {
      return axis(UP, DOWN);
    },
    // One-shot action flags since the last take, cleared by taking them.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // One-shot mouse click since the last take.
    takeClick() {
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return clicked;
    },
    // Called once per frame: nothing queued survives into the next frame.
    endFrame() {
      mouse.clicked = false;
    },
  };
}
