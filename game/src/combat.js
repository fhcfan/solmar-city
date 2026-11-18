// Combat in Solmar City: fists up close, a pistol at range, and the
// bullets that fly between. All damage flows through here so the world
// can react with shake, sound and wanted heat in one place.

import { CFG } from './config.js';
import { hitsBuilding } from './city.js';

export function makeBullet(x, y, angle, from) {
  return {
    x, y,
    vx: Math.cos(angle) * CFG.bulletSpeed,
    vy: Math.sin(angle) * CFG.bulletSpeed,
    from, // 'player' | 'rival'
    life: 1.2,
  };
}

// A punch hits everything in a short arc in front of the attacker.
// `targets` are {x, y, health} bodies; returns the ones it hurt.
export function punchArc(attacker, targets, damage) {
  const hurt = [];
  for (const target of targets) {
    if (target.state === 'down') continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CFG.punchRange + 14) continue;
    let diff = Math.atan2(dy, dx) - attacker.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CFG.punchArc) continue;
    target.health -= damage;
    // Knockback away from the punch.
    target.x += Math.cos(Math.atan2(dy, dx)) * 26;
    target.y += Math.sin(Math.atan2(dy, dx)) * 26;
    if (target.hurtTimer !== undefined) target.hurtTimer = 0.25;
    if (target.health <= 0) target.state = 'down';
    hurt.push(target);
  }
  return hurt;
}

// Move bullets, spark them off buildings, and report what they hit.
// `hitPlayer` and `hitRival` are called with the bullet and the body hit.
export function updateBullets(bullets, dt, city, player, rivals, policeCars, hitPlayer, hitRival) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || hitsBuilding(city, b.x, b.y, 2)) {
      bullets.splice(i, 1);
      continue;
    }
    if (b.from === 'player') {
      let consumed = false;
      for (const rival of rivals) {
        if (rival.state === 'down') continue;
        const dx = rival.x - b.x;
        const dy = rival.y - b.y;
        if (dx * dx + dy * dy < 20 * 20) {
          hitRival(b, rival);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        bullets.splice(i, 1);
        continue;
      }
      for (const car of policeCars) {
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        if (dx * dx + dy * dy < 24 * 24) {
          hitRival(b, car);
          consumed = true;
          break;
        }
      }
      if (consumed) bullets.splice(i, 1);
    } else if (player.onFoot) {
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      if (dx * dx + dy * dy < 16 * 16) {
        hitPlayer(b);
        bullets.splice(i, 1);
      }
    }
  }
}
