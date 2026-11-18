// Cars of Solmar City: the player's driveable car, parked cars to steal,
// traffic that follows the road grid, and police cars that chase.
// All driving is top-down arcade physics: accelerate, steer, slide.

import { CFG } from './config.js';
import { hitsBuilding, resolveBuilding, roadPoint, clampToLand } from './city.js';
import { pick, range } from './random.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b93e', '#7a4fd0', '#3fae6a', '#e8e4da', '#22242a', '#e07b39'];
export const CAR_MODELS = ['sedan', 'hatch', 'sport', 'taxi', 'van', 'truck'];

export function makeCar(kind, x, y, angle, color, model) {
  return {
    kind, // 'player' | 'parked' | 'traffic' | 'police'
    x, y, angle,
    speed: 0,
    color,
    model: model || 'sedan',
    // Traffic state: which road it follows and which way along it.
    vertical: true,
    roadIndex: 0,
    dir: 1,
    wait: 0,
    // Police state.
    stuck: 0,
  };
}

// A parked car sits in a lane on the road, ready to be stolen. The offset
// stays inside the road (half-width 45, car radius 17), so driving straight
// off never scrapes a building face.
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  for (let n = 0; n < count; n += 1) {
    const p = roadPoint(rng, city);
    const side = rng() < 0.5 ? -1 : 1;
    const off = 22;
    const x = p.vertical ? p.x + side * off : p.x;
    const y = p.vertical ? p.y : p.y + side * off;
    const angle = p.vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    if (hitsBuilding(city, x, y, CFG.carRadius + 6)) continue;
    cars.push(makeCar('parked', x, y, angle, pick(rng, CAR_COLORS), pick(rng, CAR_MODELS)));
  }
  return cars;
}

// Spawn one traffic car on a random road, away from the given point.
export function spawnTrafficCar(city, rng, awayFrom) {
  for (let tries = 0; tries < 20; tries += 1) {
    const p = roadPoint(rng, city);
    const dist = Math.hypot(p.x - awayFrom.x, p.y - awayFrom.y);
    if (dist < 500) continue;
    const vertical = p.vertical;
    const roadIndex = (vertical ? city.roadsV : city.roadsH).indexOf(vertical ? p.x : p.y);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = (rng() < 0.5 ? -1 : 1) * 20;
    const car = makeCar('traffic', p.x + (vertical ? lane : 0), p.y + (vertical ? 0 : lane),
      vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      pick(rng, CAR_COLORS), pick(rng, CAR_MODELS));
    car.vertical = vertical;
    car.roadIndex = roadIndex;
    car.dir = dir;
    car.speed = range(rng, 120, 210);
    return car;
  }
  return null;
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function turnToward(car, targetAngle, rate, dt) {
  let diff = targetAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  car.angle += step;
}

function moveCar(car, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Circle-vs-circle push for two cars; returns true when they touched.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = CFG.carRadius * 2;
  if (dist >= min || dist < 0.001) return false;
  const push = (min - dist) / 2;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const swap = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = swap * 0.4;
  return true;
}

// Player driving: W/S accelerate and brake, A/D steer. Returns events.
export function drivePlayerCar(car, input, dt, city, others) {
  const up = input.moveY();
  const steer = input.moveX();
  // Forward is the car's nose direction: W accelerates, S brakes/reverses.
  const throttle = up < 0 ? 1 : 0;
  const brake = up > 0 ? 1 : 0;
  if (throttle > 0) car.speed += CFG.carAccel * dt;
  else if (brake > 0) {
    if (car.speed > 10) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carReverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 240 * dt);
  }
  car.speed = Math.max(-CFG.carMaxReverse, Math.min(CFG.carMaxSpeed, car.speed));
  // Steering only bites while moving, and reverses when backing up.
  const dirSign = car.speed >= 0 ? 1 : -1;
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * CFG.carTurn * grip * dirSign * dt;
  moveCar(car, dt);
  // The map ends at the land: driving into the edge stops the car, so the
  // player can never drive off-screen past the camera's reach.
  const edge = clampToLand(car.x, car.y);
  if (edge.x !== car.x || edge.y !== car.y) {
    car.x = edge.x;
    car.y = edge.y;
    car.speed = 0;
  }
  const hit = resolveBuilding(city, car, CFG.carRadius);
  if (hit) {
    car.speed *= 0.4;
  }
  for (const other of others) {
    if (other !== car && collideCars(car, other)) {
      car.speed *= 0.6;
    }
  }
  return { hitBuilding: !!hit };
}

// Traffic: follow the road grid, turn at intersections sometimes, queue
// behind the car ahead, and never drive through buildings.
export function updateTrafficCar(car, dt, city, rng, allCars) {
  // Is there a car ahead on the same road, close enough to queue behind?
  let blocked = false;
  for (const other of allCars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = car.vertical ? dy * car.dir : dx * car.dir;
    const side = car.vertical ? Math.abs(dx) : Math.abs(dy);
    if (ahead > 0 && ahead < 70 && side < 40) { blocked = true; break; }
  }
  const wantSpeed = blocked ? 0 : 170;
  car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 2);
  const targetAngle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  turnToward(car, targetAngle, 6, dt);
  moveCar(car, dt);
  // At an intersection, sometimes turn onto the crossing road.
  const along = car.vertical ? car.y : car.x;
  const crossing = (car.vertical ? city.roadsH : city.roadsV).find((r) => Math.abs(r - along) < 14);
  if (crossing !== undefined && rng() < 0.004) {
    const newIndex = (car.vertical ? city.roadsV : city.roadsH).indexOf(car.vertical ? car.x : car.y);
    // Snap onto the crossing road instead of turning mid-block.
    if (car.vertical) {
      car.vertical = false;
      car.roadIndex = city.roadsH.indexOf(crossing);
      car.dir = rng() < 0.5 ? 1 : -1;
      car.y = crossing;
    } else {
      car.vertical = true;
      car.roadIndex = city.roadsV.indexOf(crossing);
      car.dir = rng() < 0.5 ? 1 : -1;
      car.x = crossing;
    }
    void newIndex;
  }
  // Loop around the city edge instead of driving into the water.
  if (car.x < 60 || car.x > CFG.worldSize - 130 || car.y < 60 || car.y > CFG.worldSize - 130) {
    car.dir *= -1;
    car.x = Math.max(80, Math.min(CFG.worldSize - 150, car.x));
    car.y = Math.max(80, Math.min(CFG.worldSize - 150, car.y));
  }
}

// Police pursuit: steer at the player, ram on contact, give up slowly if stuck.
export function updatePoliceCar(car, dt, player, city, allCars) {
  const targetAngle = angleTo(car, player);
  const dist = Math.hypot(player.x - car.x, player.y - car.y);
  const wantSpeed = dist > 900 ? CFG.carMaxSpeed : 430;
  car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.5);
  turnToward(car, targetAngle, 3.4, dt);
  moveCar(car, dt);
  const edge = clampToLand(car.x, car.y);
  if (edge.x !== car.x || edge.y !== car.y) {
    car.x = edge.x;
    car.y = edge.y;
    car.speed *= 0.5;
  }
  const before = { x: car.x, y: car.y };
  if (resolveBuilding(city, car, CFG.carRadius)) {
    car.speed *= 0.5;
    car.stuck += dt;
    if (car.stuck > 1.2) {
      // Back out and try another angle.
      car.angle += Math.PI * 0.7;
      car.speed = -120;
      car.stuck = 0;
    }
  } else {
    car.stuck = Math.max(0, car.stuck - dt);
  }
  for (const other of allCars) {
    if (other !== car && other.kind !== 'police') collideCars(car, other);
  }
  void before;
}
