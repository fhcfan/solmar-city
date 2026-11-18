// The HUD of Solmar City: cash, health, wanted stars, the current job,
// and a live minimap of the whole city in the corner.
// Everything is drawn on the same canvas as the world, in screen space.

import { CFG } from './config.js';
import { currentMission, missionTitle, stepLabel } from './missions.js';

const MAP_SIZE = 190;
const MAP_MARGIN = 16;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.62) {
  ctx.fillStyle = `rgba(12, 14, 22, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawHud(ctx, world) {
  const s = world.state;
  const mission = currentMission(world.mission);

  // Top-left: cash and health.
  const hp = Math.max(0, Math.round(s.player.health));
  panel(ctx, 14, 14, 250, s.player.pistol ? 92 : 64);
  text(ctx, `$${s.cash.toLocaleString('en-US')}`, 28, 42, 26, '#ffd23f', 'left', '800');
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.roundRect(28, 52, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = s.player.health > 30 ? '#58d68d' : '#e74c3c';
  ctx.beginPath();
  ctx.roundRect(28, 52, Math.max(0, 150 * (s.player.health / 100)), 10, 5);
  ctx.fill();
  text(ctx, `HP ${hp}`, 186, 62, 13, '#ffffff', 'left', '700');
  if (s.player.pistol) text(ctx, 'PISTOL', 28, 96, 13, '#9fd8ff', 'left', '800');

  // Top-right: wanted stars.
  if (s.wanted > 0) {
    const w = 30 + s.wanted * 30;
    panel(ctx, CFG.viewWidth - 14 - w, 14, w, 44);
    for (let i = 0; i < s.wanted; i += 1) {
      text(ctx, '★', CFG.viewWidth - 30 - i * 30, 46, 26, '#ffd23f', 'right', '800');
    }
    if (s.cooling) text(ctx, 'LAY LOW…', CFG.viewWidth - 30, 92, 13, '#9fd8ff', 'right', '700');
  }

  // Top-centre: current job and objective.
  if (mission) {
    const title = missionTitle(world.mission);
    const label = stepLabel(world.mission);
    const target = world.missionTarget();
    ctx.font = `700 15px ${FONT}`;
    const titleW = ctx.measureText(title).width;
    ctx.font = `600 14px ${FONT}`;
    const labelW = ctx.measureText(label).width;
    const w = Math.max(titleW, labelW) + 36;
    panel(ctx, (CFG.viewWidth - w) / 2, 14, w, target ? 84 : 62);
    text(ctx, title, CFG.viewWidth / 2, 38, 15, '#ffffff', 'center', '700');
    text(ctx, label, CFG.viewWidth / 2, 60, 14, '#ffd23f', 'center', '600');
    if (target) {
      const dist = Math.round(Math.hypot(target.x - s.player.x, target.y - s.player.y));
      text(ctx, `${target.label} — ${dist}m`, CFG.viewWidth / 2, 80, 12, '#cfd6de', 'center', '600');
    }
  } else {
    panel(ctx, (CFG.viewWidth - 320) / 2, 14, 320, 40);
    text(ctx, 'All jobs done — Solmar is yours', CFG.viewWidth / 2, 40, 15, '#ffd23f', 'center', '700');
  }

  // Bottom-left: controls.
  panel(ctx, 14, CFG.viewHeight - 52, 430, 38, 0.45);
  text(ctx, 'WASD move/drive · E enter car · F punch · Click shoot · P pause · M mute', 28, CFG.viewHeight - 28, 13, '#e8ecf1', 'left', '600');

  // Banner message (mission complete, warnings).
  if (s.banner && s.bannerUntil > s.time) {
    const alpha = Math.min(1, (s.bannerUntil - s.time) / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 26px ${FONT}`;
    const w = ctx.measureText(s.banner).width + 48;
    panel(ctx, (CFG.viewWidth - w) / 2, 130, w, 52, 0.75);
    text(ctx, s.banner, CFG.viewWidth / 2, 165, 26, '#ffd23f', 'center', '800');
    ctx.restore();
  }

  drawMinimap(ctx, world);
}

function drawMinimap(ctx, world) {
  const s = world.state;
  const city = world.city;
  const x0 = CFG.viewWidth - MAP_MARGIN - MAP_SIZE;
  const y0 = CFG.viewHeight - MAP_MARGIN - MAP_SIZE;
  const scale = MAP_SIZE / CFG.worldSize;
  panel(ctx, x0 - 6, y0 - 6, MAP_SIZE + 12, MAP_SIZE + 12, 0.62);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_SIZE, MAP_SIZE);
  ctx.clip();
  // Ground and water.
  ctx.fillStyle = '#5d7a44';
  ctx.fillRect(x0, y0, MAP_SIZE, MAP_SIZE);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(x0 + (CFG.worldSize - 110) * scale, y0, 110 * scale, MAP_SIZE);
  ctx.fillRect(x0, y0 + (CFG.worldSize - 110) * scale, MAP_SIZE, 110 * scale);
  // Roads.
  ctx.strokeStyle = '#3a3a42';
  ctx.lineWidth = 3;
  for (const rx of city.roadsV) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + MAP_SIZE);
    ctx.stroke();
  }
  for (const ry of city.roadsH) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + MAP_SIZE, y0 + ry * scale);
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = 'rgba(230, 220, 200, 0.75)';
  for (const b of city.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  // Parked and traffic cars.
  ctx.fillStyle = '#d8d8d8';
  for (const car of [...s.parked, ...s.traffic]) {
    ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
  }
  // Rivals.
  ctx.fillStyle = '#ff7a1a';
  for (const rival of s.rivals) {
    if (rival.state === 'down') continue;
    ctx.beginPath();
    ctx.arc(x0 + rival.x * scale, y0 + rival.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff3b30';
  for (const car of s.police) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target, pulsing.
  const target = world.missionTarget();
  if (target) {
    const pulse = 4 + Math.sin(s.time * 5) * 2;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player, on top of everything.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + s.player.x * scale, y0 + s.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x0 + s.player.x * scale, y0 + s.player.y * scale, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  text(ctx, 'SOLMAR', x0 + MAP_SIZE / 2, y0 - 10, 11, 'rgba(255,255,255,0.85)', 'center', '800');
}
