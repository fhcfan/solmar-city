// Missions and the story of Solmar City.
// Rook, a newcomer with empty pockets, is hired by Marisol Vega, a fixer,
// to take the city back from the Coral Kings crew, one job at a time.
// Each mission is a list of steps; a step completes when its condition is
// met, and the manager tells the world what the current target is.

import { REWARDS } from './config.js';

export const STORY_INTRO =
  'Rook came to Solmar with empty pockets. Marisol Vega, the fixer who runs this town from a garage office, has five jobs for him — and the Coral Kings are watching every one.';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Marisol Vega: "No wheels, no work. Take any car on the street — just don\'t get caught — and bring it to my garage."',
    reward: REWARDS[0],
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { type: 'reach', place: 'garage', label: 'Drive it to Vega\'s Garage' },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Marisol Vega: "A package is waiting at the Marina Pier. Grab it and bring it to the Old Town Café. Someone always talks — expect heat."',
    reward: REWARDS[1],
    steps: [
      { type: 'reach', place: 'pier', label: 'Reach the package at Marina Pier' },
      { type: 'reach', place: 'cafe', label: 'Deliver the package to the Old Town Café' },
    ],
  },
  {
    id: 'harbor-heat',
    title: 'Harbor Heat',
    giver: 'Marisol Vega: "The Coral Kings are muscling my dock workers. Go to the Harbor Docks and send their crew packing. Fists work. A pistol works better."',
    reward: REWARDS[2],
    steps: [
      { type: 'reach', place: 'harbor', label: 'Get to the Harbor Docks' },
      { type: 'defeat', count: 4, label: 'Defeat the Coral Kings crew (0/4)' },
    ],
  },
  {
    id: 'getaway-driver',
    title: 'Getaway Driver',
    giver: 'Marisol Vega: "The Kings tipped off the cops — you\'re hot. Lose them and reach the Hills Safehouse before the heat closes in."',
    reward: REWARDS[3],
    steps: [
      { type: 'escape', place: 'safehouse', seconds: 90, label: 'Reach the Hills Safehouse in time' },
    ],
  },
  {
    id: 'the-solmar-job',
    title: 'The Solmar Job',
    giver: 'Marisol Vega: "The Sun Crown sits in the Solmar Museum tonight. Take it, and take this city with it. Then get to the escape boat at the docks."',
    reward: REWARDS[4],
    steps: [
      { type: 'reach', place: 'museum', label: 'Reach the Solmar Museum' },
      { type: 'reach', place: 'boat', label: 'Escape to the boat at the docks' },
    ],
  },
];

export function createMissionManager() {
  return {
    index: 0,
    step: 0,
    defeated: 0,
    timer: 0,
    started: false,
    done: false,
  };
}

export function currentMission(mgr) {
  if (mgr.index >= MISSIONS.length) return null;
  return MISSIONS[mgr.index];
}

export function currentStep(mgr) {
  const mission = currentMission(mgr);
  if (!mission) return null;
  return mission.steps[mgr.step] || null;
}

// The step's label, with live counts (defeated rivals, seconds left).
export function stepLabel(mgr) {
  const step = currentStep(mgr);
  if (!step) return '';
  if (step.type === 'defeat') return `Defeat the Coral Kings crew (${mgr.defeated}/${step.count})`;
  if (step.type === 'escape') return `${step.label} — ${Math.max(0, Math.ceil(mgr.timer))}s left`;
  return step.label;
}

// The world position the player should head for right now, or null.
export function missionTarget(mgr, landmarks) {
  const step = currentStep(mgr);
  if (!step || !step.place) return null;
  const place = landmarks[step.place];
  return place ? { x: place.x, y: place.y, label: place.label } : null;
}

export function missionTitle(mgr) {
  const mission = currentMission(mgr);
  if (!mission) return 'Story complete';
  return `Job ${mgr.index + 1}/5 — ${mission.title}`;
}

// Advance one step. Returns 'complete' when the whole mission is done.
export function advanceStep(mgr) {
  const mission = currentMission(mgr);
  if (!mission) return null;
  mgr.step += 1;
  mgr.defeated = 0;
  if (mgr.step >= mission.steps.length) {
    mgr.index += 1;
    mgr.step = 0;
    mgr.defeated = 0;
    mgr.started = false;
    if (mgr.index >= MISSIONS.length) mgr.done = true;
    return 'complete';
  }
  return 'step';
}

// Called when a mission begins (timers, heat) so steps can set themselves up.
export function beginStep(mgr, world) {
  const step = currentStep(mgr);
  if (!step) return;
  if (step.type === 'escape') {
    mgr.timer = step.seconds;
    world.setWanted(3, true);
  }
  if (mgr.index === 2 && step.type === 'defeat') {
    world.spawnRivals();
  }
  mgr.started = true;
}
