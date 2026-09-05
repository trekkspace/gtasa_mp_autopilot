# freeroam-mod

A live info panel and driving autopilot for **GTA: San Andreas**, written in
JavaScript for [CLEO Redux](https://re.cleo.li/). Built for SA-MP, works in
single player too.

Press `ALT+X` for a panel showing whether you're on foot or driving, which
vehicle, where you are, and how fast you're going. Press `ALT+G` in a car and
the game's own traffic AI takes over and drives.

---

## Requirements

| | |
|---|---|
| **GTA: San Andreas** | v1.0 (the CLEO-compatible executable) |
| **CLEO** | 4.4 or CLEO 5 — CLEO Redux needs this underneath on SA classic |
| **CLEO Redux** | `cleo_redux.asi` |
| **ImGuiRedux** *(optional)* | `ImGuiReduxWin32.cleo` in `CLEO/CLEO_PLUGINS/` |

Without ImGuiRedux the panel falls back to drawing with the game's own text
renderer. You lose the window, buttons and tabs, but the live readouts still
work and need no plugin at all — set `mode: "text"` in `config.js`.

## Installation

Copy the whole folder into your `CLEO` directory:

```
GTA San Andreas/
└── CLEO/
    └── freeroam-mod/
        ├── index.js
        ├── config.js
        ├── data/
        │   ├── vehicles.js
        │   └── zones.js
        └── lib/
            ├── autopilot.js
            ├── info.js
            ├── logbuf.js
            ├── render.js
            ├── trip.js
            └── utils.js
```

The `data/` and `lib/` subfolders matter — `index.js` imports from them by
relative path, so a flat folder won't load.

CLEO Redux watches the script folder and reloads on save, so you can edit
`config.js` and see the result without restarting the game.

> If SA is installed under `Program Files (x86)`, your editor may need to run
> as administrator to save changes.

## Controls

All keys are ALT-modified. `Pad.IsKeyPressed` reads the raw keyboard, so
without a modifier every "x" you typed in SA-MP chat would toggle the panel.

| Key | Action |
|---|---|
| `ALT+X` | show / hide the panel |
| `ALT+G` | autopilot start / stop |
| *any driving key* | stops the autopilot and hands the car straight back |

The window can be dragged and resized with the mouse while the panel is open,
and its close button hides it just like `ALT+X`.

## The panel

### Info

On foot or in a vehicle; vehicle name and model ID (all 212 of them) with its
class; speed; vehicle health; map area; X/Y/Z; compass heading; health and
armour; wanted level.

### Autopilot

Free roam driving — the car wanders the road network indefinitely.

**Driving**
- *Stop at traffic lights* and *Avoid other traffic* map onto SA's four driving
  styles: both on = obey everything (0), lights off = run reds but don't hit
  traffic (4), traffic off = weave through but stop at reds (2), both off =
  plough through (3).
- *Speed %* — a percentage of `autoTopSpeed` (30 units ≈ 108 km/h). The panel
  shows the resulting km/h.
- *Vary speed naturally* — drifts ±12% every few seconds so it isn't robotic.

**Behaviour**
- *Seek out new areas* — the map is diced into 250 m cells and roaming prefers
  ones you haven't visited, so it spreads out instead of circling one district.
- *Headlights after dark* — on 20:00–07:00 game time.
- *Right the car if flipped*.
- *Stop when I touch the controls*.

**Stop automatically** — after N minutes, after N km, or below a vehicle health
threshold (defaults to 350, so it bails out before the car catches fire).

**This trip** — distance, time, average and top speed, areas seen, recoveries
and stops, with a reset button.

### Log

The last 14 log lines, mirroring `cleo_redux.log`. Worth checking on first run:
the script probes for game commands and reports which ones it found.

## How the autopilot drives

It hands the vehicle to San Andreas' traffic AI and feeds it a target every
couple of seconds — a random point a few hundred metres away, snapped to the
nearest vehicle path node so the AI always has somewhere drivable to aim at.

When the car stops making progress, recovery runs in three phases: **wait**
(most blockages clear themselves), then a gentle straight **reverse**, then a
fresh target **driven normally**. Nothing rotates the car directly — snapping a
vehicle's orientation is what throws it onto its roof and wedges it into walls.

Blockage is judged by ground actually covered, not by `getSpeed()`, which isn't
reliable on every build. Sitting at a red light gets 15 seconds of patience
before anything is treated as a problem.

Stopping does four things, and missing any one leaves the car unusable: cancel
the AI's task, restore the vehicle's speed cap, reset its control status, and
re-seat you. That last pair is what climbing out and back in used to do.

## Configuration

Everything lives in `config.js` — keys, colours, panel position and size, all
the driving parameters, and the diagnostics. Each setting is commented with
what it does and why it's set the way it is.

## Known limitations

- **The AI cannot see other SA-MP players.** It knows about NPC traffic only,
  and will drive through other players regardless of the settings.
- **No route planning.** Free roam only. SA has a path-node graph but no
  command that returns a route through it, and reading that graph would mean
  hardcoded memory offsets.
- **No map waypoint support**, for the same reason — SA has no scripting
  command for it.
- Several game commands are undocumented in this environment, so the script
  probes for them at runtime and logs which spelling worked. If a `[auto] ...
  via:` line reports `none`, that feature is unavailable on your build and is
  skipped rather than breaking anything.

## A note on servers

Many SA-MP servers prohibit CLEO outright, and AFK driving specifically, even
where the server runs no anticheat. Check the rules of wherever you play before
using the autopilot.

## Licence

Do what you like with it.