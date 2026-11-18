// The people of Solmar City: pedestrians who stroll the sidewalks and flee
// from gunfire, and Coral Kings rivals who fight the player on foot.
// Both are simple steering agents: walk, turn when blocked, run when scared.

import { CFG } from './config.js';
import { hitsBuilding, roadPoint } from './city.js';
import { pick, range } from './random.js';

const PED_COLORS = ['#e8e4da', '#d94f3d', '#3d7dd9', '#e8b93e', '#7a4fd0', '#3fae6a', '#22242a', '#e07b39'];
const RIVAL_COLOR = '#ff7a1a';

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 35, 70),
    state: 'walk', // 'walk' | 'flee' | 'down'
    turnTimer: range(rng, 1, 4),
    downTimer: 0,
    color: pick(rng, PED_COLORS),
    bob: range(rng, 0, Math.PI * 2),
  };
}

export function spawnPeds(city, rng, count, awayFrom) {
  const peds = [];
  for (let n = 0; n < count; n += 1) {
    for (let tries = 0; tries < 20; tries += 1) {
      const p = roadPoint(rng, city);
      // Stand on the sidewalk, just off the road.
      const x = p.vertical ? p.x + (rng() < 0.5 ? -1 : 1) * (CFG.roadWidth / 2 + 12) : p.x;
      const y = p.vertical ? p.y : p.y + (rng() < 0.5 ? -1 : 1) * (CFG.roadWidth / 2 + 12);
      if (hitsBuilding(city, x, y, 12)) continue;
      if (awayFrom && Math.hypot(x - awayFrom.x, y - awayFrom.y) < 200) continue;
      peds.push(makePed(x, y, rng));
      break;
    }
  }
  return peds;
}

// A loud noise (a gunshot) scares every pedestrian nearby into running away.
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (ped.state !== 'walk') continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.state = 'flee';
      ped.angle = Math.atan2(dy, dx);
      ped.speed = 150;
      ped.turnTimer = 1.2;
    }
  }
}

export function updatePeds(peds, dt, city, rng, playerCar) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // Get back up somewhere else, out of the way.
        const p = roadPoint(rng, city);
        ped.x = p.x;
        ped.y = p.y;
        ped.state = 'walk';
        ped.speed = range(rng, 35, 70);
      }
      continue;
    }
    ped.turnTimer -= dt;
    if (ped.turnTimer <= 0) {
      ped.turnTimer = range(rng, 1.5, 4);
      ped.angle += range(rng, -1.2, 1.2);
      if (ped.state === 'flee') {
        ped.state = 'walk';
        ped.speed = range(rng, 35, 70);
      }
    }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (hitsBuilding(city, nx, ny, 10)) {
      ped.angle += Math.PI / 2;
      continue;
    }
    // A moving car on the road pushes a pedestrian down instead of through them.
    if (playerCar && playerCar.speed > 120) {
      const dx = ped.x - playerCar.x;
      const dy = ped.y - playerCar.y;
      if (dx * dx + dy * dy < 28 * 28) {
        ped.state = 'down';
        ped.downTimer = 6;
        continue;
      }
    }
    ped.x = Math.max(10, Math.min(CFG.worldSize - 120, nx));
    ped.y = Math.max(10, Math.min(CFG.worldSize - 120, ny));
    ped.bob += dt * 8;
  }
}

// A Coral Kings rival: chases the player on foot and throws punches.
export function makeRival(x, y) {
  return {
    x, y,
    angle: 0,
    health: 60,
    speed: 155,
    attackCd: 0,
    hurtTimer: 0,
    state: 'chase', // 'chase' | 'down'
    color: RIVAL_COLOR,
    bob: 0,
  };
}

export function updateRivals(rivals, dt, player, city, onPunch) {
  for (const rival of rivals) {
    if (rival.state === 'down') continue;
    if (rival.hurtTimer > 0) rival.hurtTimer -= dt;
    if (rival.attackCd > 0) rival.attackCd -= dt;
    const dx = player.x - rival.x;
    const dy = player.y - rival.y;
    const dist = Math.hypot(dx, dy);
    rival.angle = Math.atan2(dy, dx);
    if (dist > 34) {
      const nx = rival.x + Math.cos(rival.angle) * rival.speed * dt;
      const ny = rival.y + Math.sin(rival.angle) * rival.speed * dt;
      if (!hitsBuilding(city, nx, ny, 12)) {
        rival.x = nx;
        rival.y = ny;
      }
    } else if (rival.attackCd <= 0) {
      rival.attackCd = 1.1;
      onPunch(rival);
    }
    rival.bob += dt * 9;
  }
}
