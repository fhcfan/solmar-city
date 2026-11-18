// Solmar City's map: a road grid, blocks, buildings, districts, parks,
// palms, water, and the named places the missions send the player to.
// Everything is placed from one seeded RNG, so the city never changes
// between runs with the same seed.

import { CFG, DISTRICTS } from './config.js';
import { pick, range, rangeInt } from './random.js';

// Block columns and rows run 0..7 between the 9 roads.
const BLOCKS = CFG.roadCount - 1;

// Two blocks are parks instead of buildings.
const PARK_BLOCKS = [
  { i: 1, j: 3 },
  { i: 5, j: 5 },
];

function districtFor(i, j) {
  if (j >= 6) return 'harbor';
  if (i >= 7) return 'marina';
  if (i >= 3 && i <= 6 && j <= 3) return 'downtown';
  if (i >= 2 && i <= 5 && j >= 4 && j <= 5) return 'oldtown';
  return 'palms';
}

function isPark(i, j) {
  return PARK_BLOCKS.some((p) => p.i === i && p.j === j);
}

function roadCenter(index) {
  return CFG.roadFirst + index * CFG.roadPitch;
}

// The rectangle of block (i, j): the ground between four roads.
export function blockRect(i, j) {
  const half = CFG.roadWidth / 2;
  return {
    x: roadCenter(i) + half,
    y: roadCenter(j) + half,
    w: CFG.roadPitch - CFG.roadWidth,
    h: CFG.roadPitch - CFG.roadWidth,
  };
}

export function buildCity(rng) {
  const roadsV = [];
  const roadsH = [];
  for (let i = 0; i < CFG.roadCount; i += 1) {
    roadsV.push(roadCenter(i));
    roadsH.push(roadCenter(i));
  }

  const buildings = [];
  const parks = [];
  const palms = [];
  for (let j = 0; j < BLOCKS; j += 1) {
    for (let i = 0; i < BLOCKS; i += 1) {
      const rect = blockRect(i, j);
      const district = districtFor(i, j);
      if (isPark(i, j)) {
        parks.push({ ...rect, district });
        continue;
      }
      // One big building, or a 2x2 split of smaller ones.
      const cells = rng() < 0.45 ? [{ x: rect.x, y: rect.y, w: rect.w, h: rect.h }] : splitBlock(rect);
      for (const cell of cells) {
        const pad = 10;
        const w = Math.max(60, cell.w - pad * 2);
        const h = Math.max(60, cell.h - pad * 2);
        const x = cell.x + (cell.w - w) / 2;
        const y = cell.y + (cell.h - h) / 2;
        buildings.push({
          x,
          y,
          w,
          h,
          color: pick(rng, DISTRICTS[district].wall),
          height: district === 'downtown' ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 2),
          neon: district === 'downtown' && rng() < 0.5,
          neonColor: pick(rng, ['#ff5da2', '#37e0c8', '#ffd23f', '#7cc7ff']),
          district,
        });
      }
    }
  }

  // Palm trees along the sidewalks, clear of the roads.
  for (let n = 0; n < 90; n += 1) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? roadsV : roadsH);
    const along = range(rng, 120, CFG.worldSize - 120);
    const side = (rng() < 0.5 ? -1 : 1) * (CFG.roadWidth / 2 + 14);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    if (buildingAt({ buildings }, x, y, 20)) continue;
    palms.push({ x, y, lean: range(rng, -0.3, 0.3) });
  }

  // Named places the missions use. All are road-side points the player can reach.
  const landmarks = {
    garage: { x: roadCenter(6), y: roadCenter(1) + 60, label: "Vega's Garage" },
    pier: { x: roadCenter(8), y: roadCenter(2), label: 'Marina Pier' },
    cafe: { x: roadCenter(4) + 40, y: roadCenter(4), label: 'Old Town Café' },
    harbor: { x: roadCenter(3), y: roadCenter(7) + 40, label: 'Harbor Docks' },
    safehouse: { x: roadCenter(1), y: roadCenter(1), label: 'Hills Safehouse' },
    museum: { x: roadCenter(6), y: roadCenter(3) + 50, label: 'Solmar Museum' },
    boat: { x: roadCenter(2), y: roadCenter(8) - 10, label: 'Escape Boat' },
  };

  return { roadsV, roadsH, buildings, parks, palms, landmarks };
}

function splitBlock(rect) {
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  return [
    { x: rect.x, y: rect.y, w: halfW, h: halfH },
    { x: rect.x + halfW, y: rect.y, w: halfW, h: halfH },
    { x: rect.x, y: rect.y + halfH, w: halfW, h: halfH },
    { x: rect.x + halfW, y: rect.y + halfH, w: halfW, h: halfH },
  ];
}

// The building whose rectangle contains (x, y), or null. `pad` grows the test.
export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// True when a circle of radius r at (x, y) touches any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of a building it overlaps; returns the building or null.
export function resolveBuilding(city, body, r) {
  const b = hitsBuilding(city, body.x, body.y, r);
  if (!b) return null;
  const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
  let dx = body.x - cx;
  let dy = body.y - cy;
  let len = Math.hypot(dx, dy);
  if (len < 0.001) {
    // Centre is inside the building: push out along the shortest side.
    const left = body.x - b.x;
    const right = b.x + b.w - body.x;
    const top = body.y - b.y;
    const bottom = b.y + b.h - body.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) { dx = -1; dy = 0; len = 1; }
    else if (min === right) { dx = 1; dy = 0; len = 1; }
    else if (min === top) { dx = 0; dy = -1; len = 1; }
    else { dx = 0; dy = 1; len = 1; }
  }
  body.x = cx + (dx / len) * r;
  body.y = cy + (dy / len) * r;
  return b;
}

// A random point on a random road (used to spawn traffic and parked cars).
export function roadPoint(rng, city) {
  const vertical = rng() < 0.5;
  const road = pick(rng, vertical ? city.roadsV : city.roadsH);
  const along = range(rng, 150, CFG.worldSize - 150);
  return vertical ? { x: road, y: along, vertical: true } : { x: along, y: road, vertical: false };
}

// True on the water strips: the east marina edge and the south harbour edge.
export function inWater(x, y) {
  return x > CFG.worldSize - 110 || y > CFG.worldSize - 110;
}

// Clamp a point into the playable land (not into the water).
export function clampToLand(x, y) {
  const edge = CFG.worldSize - 118;
  return { x: Math.max(8, Math.min(edge, x)), y: Math.max(8, Math.min(edge, y)) };
}
