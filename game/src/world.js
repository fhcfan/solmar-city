// Solmar City's rules and state: the player, the cars, the crowds, the
// cops, the missions, the wanted level and the save file. No drawing and
// no browser calls here except localStorage — the renderer paints what
// this builds, and main.js feeds it input and sound.

import { CFG, SAVE_KEY } from './config.js';
import { mulberry32 } from './random.js';
import { buildCity, hitsBuilding, resolveBuilding, roadPoint, clampToLand } from './city.js';
import {
  makeCar, spawnParkedCars, spawnTrafficCar, drivePlayerCar,
  updateTrafficCar, updatePoliceCar,
} from './vehicles.js';
import { spawnPeds, scarePeds, updatePeds, makeRival, updateRivals } from './crowd.js';
import { makeBullet, punchArc, updateBullets } from './combat.js';
import {
  createMissionManager, currentMission, currentStep,
  missionTarget as missionTargetOf,
  advanceStep, beginStep, MISSIONS,
} from './missions.js';

const STEP = 1 / 60;

function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: CFG.playerMaxHealth,
    pistol: false,
    punchCd: 0,
    shootCd: 0,
    invuln: 0,
    punchFlash: 0,
    wantedGainCd: 0,
  };
}

export function createGame() {
  const game = {
    city: null,
    state: null,
    camera: { x: 0, y: 0 },
    mission: createMissionManager(),
    hasSave: false,
    rng: null,
  };

  function freshState() {
    return {
      screen: 'title',
      time: 0,
      player: makePlayer(0, 0),
      parked: [],
      traffic: [],
      police: [],
      peds: [],
      rivals: [],
      bullets: [],
      particles: [],
      pickups: [],
      cash: 0,
      wanted: 0,
      wantedTimer: 0,
      cooling: false,
      banner: '',
      bannerUntil: 0,
      shake: 0,
      saveTimer: 0,
      titleDrift: 0,
    };
  }

  game.state = freshState();

  function showBanner(text, seconds = 4) {
    game.state.banner = text;
    game.state.bannerUntil = game.state.time + seconds;
  }

  // ---- save / load -------------------------------------------------------
  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveGame() {
    const s = game.state;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: s.cash,
        missionIndex: game.mission.index,
        health: s.health,
        pistol: s.player.pistol,
        px: s.player.x,
        py: s.player.y,
        wanted: s.wanted,
      }));
      game.hasSave = true;
    } catch {
      // Storage can be off: the game simply does not persist.
    }
  }

  function applySave(save) {
    const s = game.state;
    s.cash = save.cash || 0;
    s.health = save.health || CFG.playerMaxHealth;
    s.player.pistol = !!save.pistol;
    s.player.x = save.px || game.city.landmarks.safehouse.x;
    s.player.y = save.py || game.city.landmarks.safehouse.y;
    s.wanted = save.wanted || 0;
    game.mission.index = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
    game.mission.step = 0;
    game.mission.defeated = 0;
    game.mission.started = false;
  }

  // ---- setup ---------------------------------------------------------------
  function reset(seed) {
    game.rng = mulberry32(seed);
    game.city = buildCity(game.rng);
    game.mission = createMissionManager();
    game.state = freshState();
    const s = game.state;
    const home = game.city.landmarks.safehouse;
    s.player = makePlayer(home.x, home.y + 40);
    s.parked = spawnParkedCars(game.city, game.rng, CFG.parkedCount);
    for (let i = 0; i < CFG.trafficCount; i += 1) {
      const car = spawnTrafficCar(game.city, game.rng, s.player);
      if (car) s.traffic.push(car);
    }
    s.peds = spawnPeds(game.city, game.rng, CFG.pedCount, s.player);
    game.camera.x = Math.max(0, s.player.x - CFG.viewWidth / 2);
    game.camera.y = Math.max(0, s.player.y - CFG.viewHeight / 2);
    game.hasSave = readSave() !== null;
  }

  function startNewGame() {
    reset((Math.random() * 4294967296) >>> 0);
    game.state.screen = 'play';
    const mission = currentMission(game.mission);
    showBanner(mission ? mission.title : '', 5);
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    game.hasSave = false;
    saveGame();
  }

  function continueGame() {
    const save = readSave();
    reset((Math.random() * 4294967296) >>> 0);
    if (save) applySave(save);
    game.state.screen = 'play';
    showBanner('Back in Solmar — the jobs are waiting.', 4);
  }

  // ---- wanted ---------------------------------------------------------------
  function setWanted(level, silent) {
    const s = game.state;
    const next = Math.max(0, Math.min(CFG.maxWanted, level));
    if (next > s.wanted && !silent) {
      showBanner(`WANTED LEVEL ${next}`, 2.5);
      if (game.audio) game.audio.wanted();
    }
    s.wanted = next;
    s.wantedTimer = 0;
    s.cooling = false;
  }

  function addWanted(amount) {
    setWanted(game.state.wanted + amount, false);
  }

  // ---- rivals ----------------------------------------------------------------
  function spawnRivals() {
    const s = game.state;
    const spot = game.city.landmarks.harbor;
    s.rivals = [];
    const offsets = [[-70, -40], [60, -70], [80, 50], [-50, 80]];
    for (const [dx, dy] of offsets) {
      s.rivals.push(makeRival(spot.x + dx, spot.y + dy));
    }
  }

  // ---- helpers ----------------------------------------------------------------
  function addParticles(x, y, color, count, speed = 160) {
    const s = game.state;
    for (let i = 0; i < count; i += 1) {
      const angle = game.rng() * Math.PI * 2;
      const v = speed * (0.4 + game.rng() * 0.6);
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 0.5 + game.rng() * 0.4,
        maxLife: 0.9,
        color,
        size: 2 + game.rng() * 3,
      });
    }
  }

  function damagePlayer(amount, fromX, fromY) {
    const s = game.state;
    const p = s.player;
    if (p.invuln > 0 || s.screen !== 'play') return;
    p.health -= amount;
    p.invuln = 0.7;
    s.shake = Math.max(s.shake, 10);
    addParticles(p.x, p.y, '#ff5a4e', 10);
    if (fromX !== undefined) {
      const dx = p.x - fromX;
      const dy = p.y - fromY;
      const len = Math.hypot(dx, dy) || 1;
      p.x += (dx / len) * 18;
      p.y += (dy / len) * 18;
      const clamped = clampToLand(p.x, p.y);
      p.x = clamped.x;
      p.y = clamped.y;
    }
    if (p.health <= 0) {
      p.health = 0;
      s.screen = 'over';
      saveGame();
    }
  }

  function nearestCar(x, y, maxDist) {
    const s = game.state;
    let best = null;
    let bestDist = maxDist;
    for (const car of [...s.parked, ...s.traffic]) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function stealCar(car) {
    const s = game.state;
    const p = s.player;
    if (car.kind === 'traffic') {
      s.traffic = s.traffic.filter((c) => c !== car);
    } else {
      s.parked = s.parked.filter((c) => c !== car);
    }
    car.kind = 'player';
    p.car = car;
    p.onFoot = false;
    p.angle = car.angle;
    addWanted(1);
    showBanner('Car stolen! The cops are coming.', 3);
    s.statsStolen = (s.statsStolen || 0) + 1;
    return car;
  }

  function exitCar() {
    const s = game.state;
    const p = s.player;
    if (!p.car) return;
    const car = p.car;
    car.speed = 0;
    // Step out to the car's left side.
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 30;
    p.y = car.y + Math.sin(side) * 30;
    const clamped = clampToLand(p.x, p.y);
    p.x = clamped.x;
    p.y = clamped.y;
    if (hitsBuilding(game.city, p.x, p.y, CFG.playerRadius)) {
      p.x = car.x - Math.cos(side) * 30;
      p.y = car.y - Math.sin(side) * 30;
    }
    p.car = null;
    p.onFoot = true;
    p.angle = car.angle;
  }

  // ---- missions ---------------------------------------------------------------
  function missionTarget() {
    return missionTargetOf(game.mission, game.city.landmarks);
  }

  function onStepComplete() {
    const s = game.state;
    const mission = currentMission(game.mission);
    const result = advanceStep(game.mission);
    if (result === 'complete' && mission) {
      s.cash += mission.reward;
      showBanner(`JOB DONE — +$${mission.reward}`, 4);
      if (game.audio) game.audio.complete();
      if (mission.id === 'harbor-heat') {
        s.player.pistol = true;
        s.pickups.push({ x: s.player.x + 30, y: s.player.y, kind: 'pistol', amount: 0 });
        showBanner(`JOB DONE — +$${mission.reward} · Pistol unlocked!`, 4);
      }
      if (game.mission.done) {
        s.screen = 'complete';
      }
      saveGame();
    }
    const next = currentStep(game.mission);
    if (next) beginStep(game.mission, api);
    return result;
  }

  function updateMissions(dt) {
    const s = game.state;
    const mgr = game.mission;
    const step = currentStep(mgr);
    if (!step) return;
    if (!mgr.started) beginStep(mgr, api);
    if (step.type === 'steal') {
      if (!s.player.onFoot) onStepComplete();
      return;
    }
    if (step.type === 'escape') {
      mgr.timer -= dt;
      if (mgr.timer <= 0) {
        mgr.timer = step.seconds;
        showBanner('Too slow — the heat closed in. Try again!', 3);
        setWanted(3, true);
      }
    }
    if (step.type === 'reach') {
      const target = missionTarget();
      if (target) {
        const d = Math.hypot(target.x - s.player.x, target.y - s.player.y);
        if (d < 80) {
          if (mgr.index === 1 && mgr.step === 0) {
            // Picking up the package draws attention.
            addWanted(1);
            showBanner('Package grabbed — someone called the cops!', 3);
          }
          if (mgr.index === 4 && mgr.step === 0) {
            addWanted(3);
            showBanner('The Sun Crown is yours — RUN!', 3);
          }
          onStepComplete();
        }
      }
    }
    if (step.type === 'defeat') {
      if (mgr.defeated >= step.count) onStepComplete();
    }
  }

  // ---- screenshot scenes ------------------------------------------------------
  function stageScene(name) {
    reset(7);
    const s = game.state;
    const city = game.city;
    s.screen = 'play';
    const roadY = city.roadsH[3];
    const roadX = city.roadsV[4];
    if (name === 'chase') {
      // Getaway: Rook driving east, two cop cars on his tail, wanted 3.
      game.mission.index = 3;
      game.mission.step = 0;
      game.mission.timer = 62;
      game.mission.started = true;
      s.cash = 2350;
      const car = makeCar('player', 1250, roadY, 0, '#d94f3d', 'sport');
      car.speed = 470;
      s.player.car = car;
      s.player.onFoot = false;
      s.player.x = car.x;
      s.player.y = car.y;
      s.player.angle = 0;
      s.wanted = 3;
      const cop1 = makeCar('police', 1060, roadY - 14, 0, '#22242a', 'sedan');
      cop1.speed = 430;
      const cop2 = makeCar('police', 990, roadY + 22, 0, '#22242a', 'sedan');
      cop2.speed = 420;
      s.police = [cop1, cop2];
      for (let i = 0; i < 4; i += 1) {
        const t = spawnTrafficCar(city, game.rng, s.player);
        if (t) s.traffic.push(t);
      }
      showBanner('The cops are on you — drive!', 6);
    } else if (name === 'street') {
      // On foot downtown, traffic and pedestrians, first job waiting.
      s.player.x = roadX;
      s.player.y = city.roadsH[2] + 30;
      s.player.angle = Math.PI / 2;
      s.cash = 150;
      const near = makeCar('parked', roadX + 120, city.roadsH[2] + 62, 0, '#3d7dd9', 'sedan');
      s.parked.push(near);
      for (let i = 0; i < 5; i += 1) {
        const t = spawnTrafficCar(city, game.rng, s.player);
        if (t) s.traffic.push(t);
      }
      showBanner('Any car will do — just take one.', 6);
    } else if (name === 'combat') {
      // Harbor fight: three rivals closing in, pistol drawn.
      game.mission.index = 2;
      game.mission.step = 1;
      game.mission.defeated = 1;
      game.mission.started = true;
      const spot = city.landmarks.harbor;
      s.player.x = spot.x;
      s.player.y = spot.y - 60;
      s.player.angle = Math.PI / 2;
      s.player.health = 78;
      s.player.pistol = true;
      s.cash = 1450;
      s.wanted = 1;
      s.rivals = [makeRival(spot.x - 70, spot.y + 10), makeRival(spot.x + 60, spot.y + 30), makeRival(spot.x + 10, spot.y + 90)];
      const cop = makeCar('police', spot.x - 260, city.roadsH[7], 0, '#22242a', 'sedan');
      cop.speed = 300;
      s.police = [cop];
      s.pickups.push({ x: spot.x + 120, y: spot.y + 60, kind: 'cash', amount: 50 });
      showBanner('Harbor Heat — take them down!', 6);
    } else {
      // 'mission': driving the delivery to the café, cops behind.
      game.mission.index = 1;
      game.mission.step = 1;
      game.mission.started = true;
      s.cash = 900;
      s.wanted = 2;
      const car = makeCar('player', city.roadsV[6], city.roadsH[4] + 10, -Math.PI / 2, '#e8b93e', 'taxi');
      car.speed = 380;
      s.player.car = car;
      s.player.onFoot = false;
      s.player.x = car.x;
      s.player.y = car.y;
      s.player.angle = -Math.PI / 2;
      const cop = makeCar('police', city.roadsV[6] - 30, city.roadsH[4] + 190, -Math.PI / 2, '#22242a', 'sedan');
      cop.speed = 400;
      s.police = [cop];
      showBanner('The package is hot — don\'t stop!', 6);
    }
    // Let the scene settle for a few steps so cars and people are in place.
    for (let i = 0; i < 12; i += 1) stepAmbient(STEP);
    game.camera.x = Math.max(0, Math.min(CFG.worldSize - CFG.viewWidth, s.player.x - CFG.viewWidth / 2));
    game.camera.y = Math.max(0, Math.min(CFG.worldSize - CFG.viewHeight, s.player.y - CFG.viewHeight / 2));
  }

  function stepAmbient(dt) {
    const s = game.state;
    s.time += dt;
    for (const car of s.traffic) updateTrafficCar(car, dt, game.city, game.rng, [...s.traffic, ...s.police]);
    updatePeds(s.peds, dt, game.city, game.rng, null);
  }

  // ---- main step ----------------------------------------------------------------
  function step(dt, input, audio) {
    const s = game.state;
    const p = s.player;
    if (audio) game.audio = audio;
    s.time += dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.punchFlash > 0) p.punchFlash -= dt;
    if (p.wantedGainCd > 0) p.wantedGainCd -= dt;
    if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 26);

    const actions = input ? input.takeActions() : 0;
    if (actions & 8) audio.toggleMute(); // ACT_MUTE

    if (s.screen === 'title') {
      // Slow drift over the city behind the title panel.
      s.titleDrift += dt;
      game.camera.x = 900 + Math.cos(s.titleDrift * 0.11) * 500;
      game.camera.y = 900 + Math.sin(s.titleDrift * 0.09) * 420;
      stepAmbient(dt);
      return;
    }
    if (s.screen === 'paused') {
      if (actions & 16) startNewGame(); // ACT_RESTART
      else if (actions & (4 | 32)) {
        s.screen = 'play';
        saveGame();
      }
      return;
    }
    if (s.screen === 'over' || s.screen === 'complete') {
      if (actions & 16) startNewGame(); // ACT_RESTART
      return;
    }

    // --- playing ---
    if (actions & 4) {
      s.screen = 'paused';
      saveGame();
      return;
    }

    // Interact: enter or leave a car, pick up a dropped item.
    if (actions & 1) {
      if (!p.onFoot) {
        exitCar();
      } else {
        const car = nearestCar(p.x, p.y, 62);
        if (car) {
          stealCar(car);
          audio.pickup();
        } else {
          for (let i = s.pickups.length - 1; i >= 0; i -= 1) {
            const pickup = s.pickups[i];
            if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 46) {
              if (pickup.kind === 'cash') s.cash += pickup.amount;
              else if (pickup.kind === 'pistol') p.pistol = true;
              s.pickups.splice(i, 1);
              audio.pickup();
              addParticles(pickup.x, pickup.y, '#ffd23f', 8);
              break;
            }
          }
        }
      }
    }

    // Punch on foot.
    if ((actions & 2) && p.onFoot && p.punchCd <= 0) {
      p.punchCd = CFG.punchCooldown;
      p.punchFlash = 0.16;
      audio.punch();
      const hurt = punchArc(p, s.rivals, CFG.punchDamage);
      for (const rival of hurt) {
        addParticles(rival.x, rival.y, '#ff7a1a', 8);
        if (rival.state === 'down') {
          game.mission.defeated += 1;
          s.cash += 50;
          s.pickups.push({ x: rival.x, y: rival.y, kind: 'cash', amount: 50 });
        }
      }
    }

    // Shoot with the mouse, if armed and on foot.
    if (p.pistol && p.onFoot && input && input.takeClick() && p.shootCd <= 0) {
      p.shootCd = CFG.shootCooldown;
      const worldX = input.mouse.x + game.camera.x;
      const worldY = input.mouse.y + game.camera.y;
      const angle = Math.atan2(worldY - p.y, worldX - p.x);
      p.angle = angle;
      s.bullets.push(makeBullet(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, angle, 'player'));
      audio.shot();
      scarePeds(s.peds, p.x, p.y, 420);
      if (p.wantedGainCd <= 0) {
        addWanted(1);
        p.wantedGainCd = 4;
      }
      s.shake = Math.max(s.shake, 3);
    }

    // Move the player.
    if (p.onFoot) {
      const mx = input ? input.moveX() : 0;
      const my = input ? input.moveY() : 0;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1;
        const nx = p.x + (mx / len) * CFG.walkSpeed * dt;
        const ny = p.y + (my / len) * CFG.walkSpeed * dt;
        p.angle = Math.atan2(my, mx);
        if (!hitsBuilding(game.city, nx, p.y, CFG.playerRadius)) p.x = nx;
        if (!hitsBuilding(game.city, p.x, ny, CFG.playerRadius)) p.y = ny;
        const clamped = clampToLand(p.x, p.y);
        p.x = clamped.x;
        p.y = clamped.y;
      }
    } else if (p.car) {
      const result = drivePlayerCar(p.car, input, dt, game.city, [...s.traffic, ...s.police, ...s.parked]);
      if (result.hitBuilding) {
        audio.crash();
        s.shake = Math.max(s.shake, 5);
        addParticles(p.car.x, p.car.y, '#c9c9c9', 6);
      }
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      // Running over a pedestrian is a crime.
      for (const ped of s.peds) {
        if (ped.state !== 'walk') continue;
        const dx = ped.x - p.car.x;
        const dy = ped.y - p.car.y;
        if (dx * dx + dy * dy < 30 * 30 && Math.abs(p.car.speed) > 140) {
          ped.state = 'down';
          ped.downTimer = 6;
          addWanted(1);
          audio.crash();
          s.shake = Math.max(s.shake, 8);
        }
      }
    }

    // Camera follows the player.
    const tx = Math.max(0, Math.min(CFG.worldSize - CFG.viewWidth, p.x - CFG.viewWidth / 2));
    const ty = Math.max(0, Math.min(CFG.worldSize - CFG.viewHeight, p.y - CFG.viewHeight / 2));
    const k = 1 - Math.exp(-7 * dt);
    game.camera.x += (tx - game.camera.x) * k;
    game.camera.y += (ty - game.camera.y) * k;

    // Traffic keeps flowing; respawn what wanders too far away.
    for (const car of s.traffic) updateTrafficCar(car, dt, game.city, game.rng, [...s.traffic, ...s.police, ...(p.car ? [p.car] : [])]);
    s.traffic = s.traffic.filter((car) => Math.hypot(car.x - p.x, car.y - p.y) < 2400);
    while (s.traffic.length < CFG.trafficCount) {
      const car = spawnTrafficCar(game.city, game.rng, p);
      if (!car) break;
      s.traffic.push(car);
    }

    // Pedestrians.
    updatePeds(s.peds, dt, game.city, game.rng, p.car && !p.onFoot ? p.car : null);

    // Police: wanted level decides how many hunt the player.
    const wantPolice = Math.min(s.wanted, 3);
    while (s.police.length < wantPolice) {
      const spot = roadPoint(game.rng, game.city);
      const dx = spot.x - p.x;
      const dy = spot.y - p.y;
      if (Math.hypot(dx, dy) < 420) continue;
      const car = makeCar('police', spot.x, spot.y, 0, '#22242a', 'sedan');
      car.speed = 300;
      s.police.push(car);
      break;
    }
    if (s.wanted === 0) s.police = [];
    for (const car of s.police) updatePoliceCar(car, dt, p, game.city, [...s.traffic, ...(p.car ? [p.car] : [])]);
    // Police ramming hurts.
    for (const car of s.police) {
      const dx = car.x - p.x;
      const dy = car.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (p.onFoot && dist < 30 && Math.abs(car.speed) > 60) {
        damagePlayer(12, car.x, car.y);
        audio.crash();
      } else if (!p.onFoot && dist < 40 && Math.abs(car.speed) > 60) {
        damagePlayer(6, car.x, car.y);
        audio.crash();
        car.speed *= 0.4;
      }
    }
    s.police = s.police.filter((car) => Math.hypot(car.x - p.x, car.y - p.y) < 2600);

    // Rivals fight on foot.
    updateRivals(s.rivals, dt, p, game.city, (rival) => {
      if (p.onFoot) {
        damagePlayer(10, rival.x, rival.y);
        audio.hurt();
      }
    });

    // Bullets.
    updateBullets(s.bullets, dt, game.city, p, s.rivals, s.police,
      (bullet) => {
        damagePlayer(14, bullet.x - bullet.vx * 0.05, bullet.y - bullet.vy * 0.05);
        audio.hurt();
      },
      (bullet, target) => {
        addParticles(target.x, target.y, '#ffd23f', 6);
        if (target.kind === 'police') {
          addWanted(1);
          target.speed *= 0.5;
        } else {
          target.health -= CFG.bulletDamage;
          if (target.health <= 0 && target.state !== 'down') {
            target.state = 'down';
            game.mission.defeated += 1;
            s.cash += 50;
            s.pickups.push({ x: target.x, y: target.y, kind: 'cash', amount: 50 });
          }
        }
      });

    // Particles fade.
    for (let i = s.particles.length - 1; i >= 0; i -= 1) {
      const pt = s.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) s.particles.splice(i, 1);
    }

    // Wanted cools off when no cop can see the player.
    if (s.wanted > 0) {
      const near = s.police.some((car) => Math.hypot(car.x - p.x, car.y - p.y) < 700);
      if (near) {
        s.wantedTimer = 0;
        s.cooling = false;
      } else {
        s.wantedTimer += dt;
        s.cooling = s.wantedTimer > 1;
        if (s.wantedTimer > CFG.wantedCoolDelay + CFG.wantedCoolStep) {
          s.wantedTimer = CFG.wantedCoolDelay;
          setWanted(s.wanted - 1, true);
        }
      }
    }

    // Slow health regen when the heat is off.
    if (s.wanted === 0 && p.health > 0 && p.health < CFG.playerMaxHealth) {
      p.health = Math.min(CFG.playerMaxHealth, p.health + 2 * dt);
    }

    // Missions.
    updateMissions(dt);

    // Engine and siren follow the action.
    if (audio) {
      const driving = !p.onFoot && p.car !== null;
      audio.engine(driving ? Math.abs(p.car.speed) / CFG.carMaxSpeed : 0, driving);
      audio.siren(s.police.length > 0 && s.wanted > 0);
    }

    // Autosave.
    s.saveTimer += dt;
    if (s.saveTimer > 15) {
      s.saveTimer = 0;
      saveGame();
    }
  }

  const api = {
    get state() { return game.state; },
    get city() { return game.city; },
    get camera() { return game.camera; },
    get mission() { return game.mission; },
    get hasSave() { return game.hasSave; },
    missionTarget,
    reset,
    startNewGame,
    continueGame,
    setWanted,
    addWanted,
    spawnRivals,
    stageScene,
    step,
    saveGame,
  };

  reset(20261118);
  return api;
}
