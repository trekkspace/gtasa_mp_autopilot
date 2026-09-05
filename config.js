// ---------------------------------------------------------------------------
// config.js - everything you'd want to change lives here
// ---------------------------------------------------------------------------

export const CONFIG = {
  // --- keys (virtual key codes) ---
  // All are ALT-modified. IsKeyPressed reads the raw keyboard, so without a
  // modifier every "x" you typed in SA-MP chat would toggle the panel.
  toggleKey: 0x58,          // ALT+X  show / hide the panel
  autoKey: 0x47,            // ALT+G  autopilot start / stop
  modifierKey: 0x12,        // 0x12 ALT, 0x11 CTRL, 0x10 SHIFT, 0 = none
  toggleCooldownFrames: 15, // ignore repeat toggles for this many frames

  // --- rendering ---
  // "imgui" = ImGuiRedux window (needs the plugin)
  // "text"  = the game's own text renderer, no plugin and no mouse needed
  // "auto"  = imgui if the plugin is loaded, else text
  mode: "imgui",
  windowTitle: "Player Info",
  startVisible: false,
  updateIntervalMs: 0,      // 0 = refresh readings every frame

  // Opening position and size of the imgui window, applied with
  // ImGuiCond_Once so dragging and resizing with the mouse sticks.
  positionWindow: true,
  windowW: 360.0,
  windowH: 420.0,

  // Releases the mouse to ImGui while the panel is open, so the window can be
  // dragged and buttons clicked. Hiding it (ALT+X) gives the mouse back to the
  // game, so close the panel before driving manually.
  showCursor: true,

  // --- text mode layout (640x448 virtual screen, like all SA text) ---
  x: 20.0,
  y: 140.0,
  lineHeight: 14.0,
  scaleX: 0.24,
  scaleY: 1.0,
  font: 2,
  color: [255, 255, 255, 255],
  maxLines: 16,

  // --- autopilot ---
  autoEnabled: true,

  // --- driving behaviour (all adjustable live on the Autopilot tab) ---
  // These map onto SA's driving styles:
  //   lights on  + traffic on   -> 0  stop for cars, obey lights
  //   lights off + traffic on   -> 4  stop for cars, ignore lights
  //   lights on  + traffic off  -> 2  avoid cars, obey lights
  //   lights off + traffic off  -> 3  plough through everything
  // The AI cannot see other SA-MP players under any of them.
  obeyTrafficLights: true,
  avoidTraffic: true,

  // Speed as a percentage of autoTopSpeed. 30 game units is roughly 108 km/h,
  // so 70% is about 75 km/h.
  autoTopSpeed: 30.0,
  speedPercent: 70,
  varySpeed: true,          // drift the speed a little so it isn't robotic
  speedVariancePct: 12,     // +/- this much around the chosen percentage

  speedChangeMs: 5000,      // how often to re-roll the cruising speed
  autoRefreshMs: 2000,      // re-issue the drive order this often
  autoArriveRadius: 25.0,   // how close to a wander target before picking another

  // Speed cap put back on the vehicle when the autopilot stops. The AI drives
  // to a cap; if it isn't restored you're left unable to drive your own car.
  // High enough to be effectively "no limit".
  restoreMaxSpeed: 200.0,

  // Stopping has to hand the vehicle back to you properly. Clearing the task
  // and restoring the speed cap is not enough on its own - the car stays
  // flagged as AI-driven and ignores your input, which is why getting out and
  // back in "fixed" it. Re-seating you reproduces that reset.
  // 0 in SA is the player-controlled vehicle status.
  playerVehicleStatus: 0,
  resetBySeating: true,     // set false if the re-seat causes SA-MP desync

  // --- extras ---
  // Hands control straight back the moment you touch a driving key, so you
  // never fight the AI for the wheel.
  disengageOnInput: true,

  autoHeadlights: true,     // lights on after dark
  nightFromHour: 20,
  nightUntilHour: 7,
  lightCheckMs: 4000,       // how often the time is checked and lights re-applied

  autoFlip: true,           // right the car if it ends up on its roof

  // Roaming prefers areas it hasn't been to yet, so it spreads out across the
  // map instead of circling one district.
  exploreNewAreas: true,
  exploreCellSize: 250.0,

  // Automatic stopping. 0 disables any of them.
  stopAfterMinutes: 0,
  stopAfterKm: 0,
  stopBelowVehicleHealth: 350,   // bail out before the car catches fire

  // Ignore position jumps larger than this when totalling distance, so
  // teleports and respawns don't inflate the trip.
  tripMaxStepMetres: 100.0,

  // Nitro is never triggered by this script: it fires on the player's fire
  // button, and player control is released while the autopilot drives.

  // --- free roam ---
  // Random road points this far away, one after another. Targets are snapped
  // to the nearest vehicle path node when the game exposes that command, which
  // is what stops it aiming through buildings.
  wanderMinDistance: 150.0,
  wanderMaxDistance: 400.0,
  naturalPauseChance: 0.15, // odds of pulling up briefly at the end of a leg
  naturalPauseMs: 2500,

  // --- blockage recovery ---
  // SA's AI stops dead when a car blocks it and never reverses. These make it
  // back out or shove through instead of sitting there forever.
  // Blockage is judged by whether the car has actually covered ground, not by
  // car.getSpeed() - if that command is unavailable it reads as 0 and every
  // check would report "blocked" even at full speed.
  blockedMoveDistance: 6.0, // metres of real progress needed to count as moving
  blockedMs: 4000,          // no progress for this long = blocked

  // Sitting at a red light is not being stuck. When the AI is obeying lights
  // it needs far more patience, or it reverses away from every junction.
  trafficLightGraceMs: 15000,

  // Recovery runs in three phases: wait (most blockages clear themselves),
  // then a gentle straight reverse, then a fresh target driven normally.
  // Nothing rotates the car - snapping its orientation is what used to flip
  // it onto its roof and wedge it into walls.
  recoveryWaitMs: 2500,     // do nothing at all for this long first
  reverseMs: 1200,          // then back off straight for this long
  reverseSpeed: 4.0,        // gently - high values shove the car into geometry

  // setForwardSpeed is used for reversing because it is known to work here.
  // The game's own temp action would be smoother, but its action id is not
  // something I can verify - if the id isn't really "reverse" the car sits
  // still and never backs out. Enable only if you want to experiment.
  preferTempAction: false,
  reverseTempAction: 2,


  // --- content ---
  units: "kmh",             // "kmh" or "mph"
  showTicker: true,         // tick counter; if it stops climbing, the loop stalled
  logKeep: 14,              // lines kept for the Log tab

  // Logs any frame slower than slowFrameMs, at most once a second.
  diagnoseSlowFrames: true,
  slowFrameMs: 100,
};

// 02E3 GET_CAR_SPEED returns metres/second.
export const MS_TO_KMH = 3.6;
export const MS_TO_MPH = 2.23694;