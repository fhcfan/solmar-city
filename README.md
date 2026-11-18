# Solmar City

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/fhcfan/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/fhcfan/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in **Solmar**, a fictional sun-soaked coastal city. Rook, a newcomer with empty pockets, is hired by Marisol Vega — the fixer who runs the town from a garage office — to take the city back from the Coral Kings crew, one job at a time.

Everything in it is original: the city, the characters, the story, the art and the music. No assets, names or code from any commercial game.

## What is in the world

- **A city to explore** — nine roads by nine roads of downtown, old town, marina, harbor and palm-lined streets, with parks, beaches and traffic that keeps flowing.
- **Walk or drive** — steal any car on the street (press E) and drive it; traffic cars, parked cars and police cars all share the same roads.
- **Wanted level** — steal a car, hit a pedestrian or fire a gun and the Solmar PD responds, from one patrol car at one star up to a full chase at five. Lay low and the heat cools off.
- **Five story jobs** — from stealing your first wheels to lifting the Sun Crown from the Solmar Museum, with a live objective, a target beacon and a minimap that always points the way.
- **Combat** — fists up close (F), a pistol at range (mouse click) once Vega trusts you with one.
- **A living street** — pedestrians stroll, scatter when shots are fired, and cross your path; rival crew members fight back at the docks.
- **HUD and minimap** — cash, health, wanted stars, the current job and a live map of the whole city.
- **Save, pause and mute** — progress saves to the browser as you play; P pauses, M mutes.
- **Sound, all synthesized** — a laid-back Am–F–C–G loop, engine hum, police sirens and effects, built with the Web Audio API. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive a car |
| E | Enter or steal a car, pick up cash |
| F | Punch |
| Mouse click | Shoot (once you have the pistol) |
| P / Esc | Pause |
| M | Mute |
| R | Restart the story |
| Enter / click | Start, continue a saved game |

## Run it

No build step, no libraries, no network requests. Serve the `game/` folder and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from any static file server.

## How it is built

Plain JavaScript ES modules under `game/src/`, one responsibility per file: `config.js` (tuning), `city.js` (map), `vehicles.js` (cars and police), `crowd.js` (pedestrians and rivals), `combat.js` (fists and bullets), `missions.js` (story), `hud.js` (HUD and minimap), `render.js` (drawing and screens), `world.js` (rules and state), `audio.js` (synthesized sound), `input.js` (keyboard and mouse), `shots.js` (screenshot scenes).

---

Built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — [make.fun](https://make.fun/?ref=0rkx5qm4)
