// Drawing only: the city, its people and cars, the HUD, and the screens.
// The 1280x800 window shows a slice of the 3400x3400 city through a camera
// that follows the player. Flat shapes, warm sun colours, long soft shadows.

import { CFG } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align = 'center', weight = '600') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CFG.viewWidth;
  canvas.height = CFG.viewHeight;

  function panel(x, y, w, h, alpha = 0.78) {
    ctx.fillStyle = `rgba(12, 14, 22, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
  }

  function drawGround(game, cam) {
    const { city } = game;
    const vw = CFG.viewWidth;
    const vh = CFG.viewHeight;
    // Sand base.
    ctx.fillStyle = CFG.colors.sand;
    ctx.fillRect(0, 0, vw, vh);
    // Parks.
    ctx.fillStyle = CFG.colors.park;
    for (const park of city.parks) {
      if (!inView(park.x, park.y, park.w, park.h, cam)) continue;
      ctx.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
    }
    // Water strips: marina east, harbour south.
    ctx.fillStyle = CFG.colors.water;
    ctx.fillRect(CFG.worldSize - 110 - cam.x, 0, 110, vh);
    ctx.fillRect(0, CFG.worldSize - 110 - cam.y, vw, 110);
    ctx.fillStyle = CFG.colors.beach;
    ctx.fillRect(CFG.worldSize - 128 - cam.x, 0, 18, vh);
    ctx.fillRect(0, CFG.worldSize - 128 - cam.y, vw, 18);
    // Roads.
    ctx.fillStyle = CFG.colors.asphalt;
    for (const rx of city.roadsV) {
      if (rx + CFG.roadWidth / 2 < cam.x || rx - CFG.roadWidth / 2 > cam.x + vw) continue;
      ctx.fillRect(rx - CFG.roadWidth / 2 - cam.x, 0, CFG.roadWidth, vh);
    }
    for (const ry of city.roadsH) {
      if (ry + CFG.roadWidth / 2 < cam.y || ry - CFG.roadWidth / 2 > cam.y + vh) continue;
      ctx.fillRect(0, ry - CFG.roadWidth / 2 - cam.y, vw, CFG.roadWidth);
    }
    // Centre dashes.
    ctx.strokeStyle = CFG.colors.asphaltLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const rx of city.roadsV) {
      if (rx + CFG.roadWidth / 2 < cam.x || rx - CFG.roadWidth / 2 > cam.x + vw) continue;
      ctx.moveTo(rx - cam.x, -cam.y);
      ctx.lineTo(rx - cam.x, CFG.worldSize - cam.y);
    }
    for (const ry of city.roadsH) {
      if (ry + CFG.roadWidth / 2 < cam.y || ry - CFG.roadWidth / 2 > cam.y + vh) continue;
      ctx.moveTo(-cam.x, ry - cam.y);
      ctx.lineTo(CFG.worldSize - cam.x, ry - cam.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Sidewalk edges around each block.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < 8; j += 1) {
      for (let i = 0; i < 8; i += 1) {
        const x = city.roadsV[i] + CFG.roadWidth / 2;
        const y = city.roadsH[j] + CFG.roadWidth / 2;
        const w = CFG.roadPitch - CFG.roadWidth;
        if (x + w < cam.x || x > cam.x + vw || y + w < cam.y || y > cam.y + vh) continue;
        ctx.rect(x - cam.x, y - cam.y, w, w);
      }
    }
    ctx.stroke();
  }

  function inView(x, y, w, h, cam) {
    return x + w > cam.x && x < cam.x + CFG.viewWidth && y + h > cam.y && y < cam.y + CFG.viewHeight;
  }

  function drawBuildings(game, cam) {
    const { city } = game;
    for (const b of city.buildings) {
      if (!inView(b.x, b.y, b.w, b.h, cam)) continue;
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      // Long soft shadow to the south-east.
      ctx.fillStyle = 'rgba(30, 20, 10, 0.22)';
      ctx.fillRect(x + 9, y + 11, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, b.w - 2, b.h - 2);
      // Roof detail: a darker inset and a small unit box.
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x + 8, y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + b.w * 0.2, y + b.h * 0.2, 14, 10);
      if (b.neon) {
        ctx.strokeStyle = b.neonColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 4);
        ctx.lineTo(x + b.w - 6, y + 4);
        ctx.stroke();
      }
    }
    // Palm trees.
    for (const palm of city.palms) {
      if (palm.x < cam.x || palm.x > cam.x + CFG.viewWidth || palm.y < cam.y || palm.y > cam.y + CFG.viewHeight) continue;
      const x = palm.x - cam.x;
      const y = palm.y - cam.y;
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + palm.lean * 14, y - 18);
      ctx.stroke();
      ctx.fillStyle = '#3e8e4f';
      for (let f = 0; f < 5; f += 1) {
        const a = (f / 5) * Math.PI * 2 + palm.lean;
        ctx.beginPath();
        ctx.ellipse(x + palm.lean * 14 + Math.cos(a) * 11, y - 18 + Math.sin(a) * 7, 12, 5, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCarShape(car, cam, highlight) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.roundRect(-22 + 3, -11 + 4, 46, 24, 8);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-23, -12, 46, 24, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Windshield and rear window.
    ctx.fillStyle = 'rgba(180, 220, 245, 0.9)';
    ctx.fillRect(6, -9, 9, 18);
    ctx.fillRect(-16, -9, 7, 18);
    // Roof.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-8, -9, 13, 18);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(21, -9, 3, 5);
    ctx.fillRect(21, 4, 3, 5);
    if (car.kind === 'police') {
      // Light bar: red on one side, blue on the other.
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-4, -12, 8, 5);
      ctx.fillStyle = '#2f7bff';
      ctx.fillRect(-4, 7, 8, 5);
    }
    if (highlight) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-26, -15, 52, 30, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPersonShape(p, cam, color, radius = 11) {
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const bob = Math.sin(p.bob || 0) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, radius, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + bob, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(x + Math.cos(p.angle) * 4, y + Math.sin(p.angle) * 4 + bob, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y + bob, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawWorld(game) {
    const s = game.state;
    const cam = game.camera;
    drawGround(game, cam);
    drawBuildings(game, cam);
    // Mission target beacon.
    const target = game.missionTarget();
    if (target && s.screen === SCREEN_PLAY) {
      const x = target.x - cam.x;
      const y = target.y - cam.y;
      const pulse = 0.5 + Math.sin(s.time * 4) * 0.2;
      ctx.fillStyle = `rgba(255, 210, 63, ${0.14 + pulse * 0.1})`;
      ctx.fillRect(x - 26, y - 60, 52, 120);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x + 18, y);
      ctx.lineTo(x, y + 26);
      ctx.lineTo(x - 18, y);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parked cars, traffic, police.
    for (const car of s.parked) drawCarShape(car, cam, false);
    for (const car of s.traffic) drawCarShape(car, cam, false);
    for (const car of s.police) drawCarShape(car, cam, false);
    // Pickups.
    for (const pickup of s.pickups) {
      const x = pickup.x - cam.x;
      const y = pickup.y - cam.y;
      const bob = Math.sin(s.time * 4 + pickup.x) * 3;
      ctx.fillStyle = pickup.kind === 'pistol' ? '#9fd8ff' : '#ffd23f';
      ctx.beginPath();
      ctx.arc(x, y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, pickup.kind === 'pistol' ? 'P' : '$', x, y + bob + 4, 12, '#111', 'center', '800');
    }
    // Pedestrians and rivals.
    for (const ped of s.peds) {
      if (ped.state === 'down') continue;
      drawPersonShape(ped, cam, ped.color, 10);
    }
    for (const rival of s.rivals) {
      if (rival.state === 'down') continue;
      drawPersonShape(rival, cam, rival.color, 12);
      // Health bar.
      const x = rival.x - cam.x;
      const y = rival.y - cam.y - 24;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 16, y, 32, 5);
      ctx.fillStyle = '#ff7a1a';
      ctx.fillRect(x - 16, y, 32 * Math.max(0, rival.health / 60), 5);
    }
    // Player.
    const player = s.player;
    if (player.onFoot) {
      const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
      if (!blink) drawPersonShape(player, cam, '#2fa8a0', CFG.playerRadius);
      // Punch arc flash.
      if (player.punchFlash > 0) {
        ctx.strokeStyle = `rgba(255, 210, 63, ${player.punchFlash})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x - cam.x, player.y - cam.y, CFG.punchRange, player.angle - CFG.punchArc, player.angle + CFG.punchArc);
        ctx.stroke();
      }
    } else if (player.car) {
      drawCarShape(player.car, cam, true);
    }
    // Bullets.
    ctx.strokeStyle = '#fff2a8';
    ctx.lineWidth = 3;
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - cam.x, b.y - cam.y);
      ctx.lineTo(b.x - cam.x - b.vx * 0.02, b.y - cam.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const p of s.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Off-screen objective arrow.
    if (target && s.screen === SCREEN_PLAY) {
      const sx = target.x - cam.x;
      const sy = target.y - cam.y;
      if (sx < 0 || sx > CFG.viewWidth || sy < 0 || sy > CFG.viewHeight) {
        const cx = CFG.viewWidth / 2;
        const cy = CFG.viewHeight / 2;
        const angle = Math.atan2(sy - cy, sx - cx);
        const ex = cx + Math.cos(angle) * 480;
        const ey = cy + Math.sin(angle) * 300;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawPanelScreen(title, lines, prompt, accent = '#ffd23f') {
    panel((CFG.viewWidth - 640) / 2, 150, 640, 150 + lines.length * 34 + 84);
    text(ctx, title, CFG.viewWidth / 2, 232, 52, '#ffffff', 'center', '800');
    for (let i = 0; i < lines.length; i += 1) {
      text(ctx, lines[i], CFG.viewWidth / 2, 292 + i * 34, 19, '#dfe5ec', 'center', '600');
    }
    text(ctx, prompt, CFG.viewWidth / 2, 292 + lines.length * 34 + 44, 22, accent, 'center', '700');
  }

  function draw(game, screen) {
    const s = game.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, CFG.viewWidth, CFG.viewHeight);
    // Screen shake.
    const shake = s.shake || 0;
    const ox = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const oy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);
    drawWorld(game);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(ctx, game);
    }
    if (screen === SCREEN_TITLE) {
      drawPanelScreen('SOLMAR CITY', [
        'A sun-soaked open world. Steal cars, dodge the cops, run five jobs',
        'for Marisol Vega — and take the city back from the Coral Kings.',
        '',
        'WASD move and drive · E enter a car · F punch · Mouse click shoots',
        'P pause · M mute · Your progress saves as you play.',
      ], game.hasSave ? 'Press Enter to continue, or N for a new game' : 'Press Enter or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanelScreen('Paused', ['The city waits for no one — except right now.'], 'Press P to resume · M mute · R restart the story');
    } else if (screen === SCREEN_OVER) {
      drawPanelScreen('Busted', [
        `The Solmar PD caught up with you. Cash kept: $${s.cash.toLocaleString('en-US')}.`,
        `Jobs finished: ${game.mission.index} of 5.`,
      ], 'Press R to try again');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanelScreen('Solmar Is Yours', [
        'The Sun Crown is yours. The Coral Kings are finished.',
        `Final take: $${s.cash.toLocaleString('en-US')}. Marisol Vega is proud of you.`,
      ], 'Press R to play the story again');
    }
  }

  return { draw };
}
