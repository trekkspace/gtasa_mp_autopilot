// ---------------------------------------------------------------------------
// config.js - everything you'd want to change lives here
// ---------------------------------------------------------------------------

export const CONFIG = {
  // --- keys (virtual key codes) ---
  toggleKey: 0x58,     // X
  // IsKeyPressed reads the raw keyboard, so it fires even while you're typing
  // in SA-MP chat - every "x" you type would toggle the panel. Requiring ALT
  // fixes that. Set to 0 for plain X, or use an F-key (F5 = 0x74) instead.
  modifierKey: 0x12,   // 0 = none. 0x12 ALT, 0x11 CTRL, 0x10 SHIFT

  // Frames to ignore further toggles after one fires. Stops a single press
  // registering twice.
  toggleCooldownFrames: 15,

  // --- rendering ---
  // "text"  = game's own text renderer. Exact positioning, no mouse needed.
  // "imgui" = ImGuiRedux window. Needs the plugin; positioning is unreliable.
  // "auto"  = imgui if the plugin is loaded, else text.
  // Your build exposes Begin/End/SetNextWindowPos/SetCursorVisible, so imgui
  // is the better path; text mode is the fallback if the plugin is missing.
  mode: "imgui",

  // --- how often the readings refresh, in milliseconds ---
  // 0 = every frame. 100 is smooth and cheaper. Drawing always happens
  // every frame regardless; this only throttles the data collection.
  updateIntervalMs: 0,

  // --- text mode layout (640x448 virtual screen, like all SA text) ---
  // Starting position. In imgui mode you can drag the window with the mouse;
  // put the position you settle on back here so it opens there next time.
  x: 20.0,
  y: 140.0,
  lineHeight: 14.0,
  scaleX: 0.24,
  scaleY: 1.0,
  font: 2,
  color: [255, 255, 255, 255],

  // --- autopilot (free roam) ---
  // ALT+G engages / disengages. No destination - the car just drives.
  autoEnabled: true,
  autoKey: 0x47,            // G
  markKey: 0x42,            // B - marks your position for "Marked point" mode

  // Driving style handed to the AI. San Andreas' values are:
  //   0  stop for cars            - obeys traffic lights
  //   1  slow down for cars       - obeys traffic lights
  //   2  avoid cars               - obeys traffic lights
  //   3  plough through           - ignores cars AND lights, drives at you
  //   4  stop for cars, ignore lights
  //
  // 4 is what you want for running reds while still not rear-ending traffic.
  // (An earlier version of this file described 4 as "plough through" - that
  // was wrong, 3 is the reckless one.)
  //
  // The AI cannot see other SA-MP players under any style and will drive
  // through them regardless.
  autoDrivingStyle: 4,
  // Cruising speed is re-rolled between these bounds every few seconds, so it
  // speeds up and slows down instead of holding one value forever.
  // Roughly: 12 = 45 km/h, 18 = 65 km/h, 28 = 100 km/h.
  autoSpeedMin: 11.0,
  autoSpeedMax: 27.0,
  speedChangeMs: 5000,      // how often to re-roll it

  // Nitro is never triggered by this script - it fires on the player's fire
  // button, and control is released while the autopilot drives, so nothing
  // here can set it off even on a nitro-fitted car.
  autoRefreshMs: 2000,      // re-issue the drive order this often

  // Used only if the game has no native wander task and we fall back to
  // rolling random waypoints.
  // Shorter hops track the road network better. Targets are snapped to the
  // nearest vehicle path node when the game exposes that command, which is
  // what stops it aiming through buildings.
  wanderMinDistance: 150.0,
  wanderMaxDistance: 400.0,
  autoArriveRadius: 25.0,   // how close counts as reaching a rolled point
  wanderStuckDistance: 4.0, // moved less than this between checks = stuck
  wanderStuckMs: 4000,      // ...for this long, then re-route

  // --- blockage recovery ---
  // SA's AI stops dead when a car blocks it and never reverses. These make it
  // back out and take a different route instead of sitting there.
  blockedSpeed: 1.0,        // below this speed counts as stopped
  blockedMs: 2500,          // stopped this long = blocked, start reversing
  reverseMs: 1400,          // how long a recovery move lasts
  reverseSpeed: 6.0,        // reverse speed in game units
  pushSpeed: 8.0,           // forward speed for the "push through" move
  recoveryPushChance: 0.25, // odds of shoving forward instead of reversing
  recoveryTurnRate: 1.2,    // degrees per frame of nose swing while reversing

  // --- natural driving ---
  // It occasionally pulls up for a moment, like a real driver would.
  naturalPauseChance: 0.15,    // odds of pausing when a leg finishes
  naturalPauseMs: 2500,        // how long those pauses last

  // --- content ---
  units: "kmh",        // "kmh" or "mph"
  startVisible: false,
  windowTitle: "Player Info",

  // Opening position and size of the imgui window. Both are applied with
  // ImGuiCond_Once, so dragging and resizing with the mouse sticks.
  positionWindow: true,
  windowW: 360.0,
  windowH: 420.0,

  // Releases the mouse cursor to ImGui while the panel is open, so the window
  // can be dragged and the buttons clicked. Hiding the panel (ALT+X) gives the
  // mouse back to the game, so close it before you drive.
  showCursor: true,




  maxLines: 16,

  // Adds a tick counter to the panel. If that number stops climbing, the
  // script loop has stalled; if it climbs but values don't change, the
  // readings are the problem. Handy while debugging, turn off after.
  showTicker: true,

  // How many recent log lines the Log tab keeps.
  logKeep: 14,

  // Logs any frame slower than slowFrameMs, split into collect vs render,
  // at most once a second. Turn off once the stalling is sorted.
  diagnoseSlowFrames: true,
  slowFrameMs: 100,
};

// 02E3 GET_CAR_SPEED returns metres/second.
export const MS_TO_KMH = 3.6;
export const MS_TO_MPH = 2.23694;