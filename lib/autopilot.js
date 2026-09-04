// ---------------------------------------------------------------------------
// autopilot.js - free roam driving, no destination
// ---------------------------------------------------------------------------
//
// Two strategies, tried in order:
//
//   1. The game's own "drive wander" task, if this build exposes it. The AI
//      picks its own route through the road network indefinitely.
//   2. Rolling waypoints - pick a random point a few hundred metres away and
//      DriveTo it; on arrival, roll another. The AI still uses roads to get
//      there, so the result looks the same. This works wherever DriveTo does.
//
// Which one is in use is logged once as "[auto] wander via: ...".
//
// Player control is released while engaged, otherwise your input fights the
// AI. ALT+G gives it back. Note the AI cannot see other SA-MP players and
// will drive through them.

import { CONFIG } from "../config.js";
import { safe, attempt, round } from "./utils.js";

let engaged = false;
let controlMethod = null;
let wanderMethod = null;

let rollTarget = null;      // current random point, strategy 2 only
let nodeMethod = null;      // road-node snapping, probed once
let lastCommand = 0;
let lastProgress = 0;
let lastPos = null;

// simple state machine: driving -> reversing -> driving, with occasional pauses
let state = "driving";
let stateSince = 0;
let legSpeed = 0;
let blockedSince = 0;
let reverseMethod = null;
let recoveryMode = "back";   // "back" | "left" | "right" | "push"
let lastSpeedRoll = 0;

const MAP_LIMIT = 2800;

export function isEngaged() { return engaged; }

function setPlayerControl(player, on) {
  if (controlMethod === null) {
    if (attempt(() => player.setControl(on))) controlMethod = "player.setControl";
    else if (attempt(() => player.canMove(on))) controlMethod = "player.canMove";
    else if (attempt(() => native("SET_PLAYER_CONTROL", 0, on))) controlMethod = "native";
    else controlMethod = "none";
    log("[auto] player control via: " + controlMethod);
    return;
  }
  if (controlMethod === "player.setControl") attempt(() => player.setControl(on));
  else if (controlMethod === "player.canMove") attempt(() => player.canMove(on));
  else if (controlMethod === "native") attempt(() => native("SET_PLAYER_CONTROL", 0, on));
}

function clamp(v) {
  return Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, v));
}

/**
 * Snaps a point to the nearest vehicle path node. Without this, a random
 * target lands inside a building or in the sea and the AI drives into walls
 * trying to reach it. Returns null if this build has no such command.
 */
function snapToRoad(x, y, z) {
  let r = null;

  if (nodeMethod === null) {
    if (attempt(() => { r = Path.GetClosestCarNode(x, y, z); })) nodeMethod = "Path.GetClosestCarNode";
    else if (attempt(() => { r = native("GET_CLOSEST_CAR_NODE", x, y, z); })) nodeMethod = "native";
    else if (attempt(() => { r = native("GET_CLOSEST_CAR_NODE_WITH_HEADING", x, y, z); })) nodeMethod = "native_heading";
    else nodeMethod = "none";
    log("[auto] road snapping via: " + nodeMethod);
  } else if (nodeMethod === "Path.GetClosestCarNode") {
    attempt(() => { r = Path.GetClosestCarNode(x, y, z); });
  } else if (nodeMethod === "native") {
    attempt(() => { r = native("GET_CLOSEST_CAR_NODE", x, y, z); });
  } else if (nodeMethod === "native_heading") {
    attempt(() => { r = native("GET_CLOSEST_CAR_NODE_WITH_HEADING", x, y, z); });
  }

  if (r && typeof r.x === "number" && typeof r.y === "number") {
    return { x: r.x, y: r.y, z: typeof r.z === "number" ? r.z : z };
  }
  return null;
}

function rollNewTarget(pos) {
  // Try a few candidates and keep the first that snaps onto the road network.
  for (let tries = 0; tries < 6; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = CONFIG.wanderMinDistance +
      Math.random() * (CONFIG.wanderMaxDistance - CONFIG.wanderMinDistance);
    const raw = {
      x: clamp(pos.x + Math.cos(angle) * dist),
      y: clamp(pos.y + Math.sin(angle) * dist),
      z: pos.z,
    };

    const snapped = snapToRoad(raw.x, raw.y, raw.z);
    if (snapped) {
      rollTarget = snapped;
      log("[auto] heading for road node " + round(snapped.x, 0) + ", " + round(snapped.y, 0));
      return;
    }
    if (nodeMethod === "none") {
      // No snapping available - fall back to the raw point and keep the hop
      // short, so there is less chance of aiming through a building.
      rollTarget = raw;
      log("[auto] heading " + round(raw.x, 0) + ", " + round(raw.y, 0) + " (unsnapped)");
      return;
    }
  }
  rollTarget = { x: pos.x, y: pos.y, z: pos.z };
}

/** Probes for a native wander task once. Returns true if one exists. */
function tryNativeWander(char, car) {
  if (legSpeed === 0) pickLegSpeed();
  const speed = legSpeed;
  const style = CONFIG.autoDrivingStyle;

  if (wanderMethod === null) {
    if (attempt(() => Task.CarDriveWander(char, car, speed, style))) wanderMethod = "Task.CarDriveWander";
    else if (attempt(() => char.taskCarDriveWander(car, speed, style))) wanderMethod = "char.taskCarDriveWander";
    else if (attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, speed, style))) wanderMethod = "native";
    else wanderMethod = "rolling";
    log("[auto] wander via: " + wanderMethod);
    return wanderMethod !== "rolling";
  }

  if (wanderMethod === "rolling") return false;
  if (wanderMethod === "Task.CarDriveWander") return attempt(() => Task.CarDriveWander(char, car, speed, style));
  if (wanderMethod === "char.taskCarDriveWander") return attempt(() => char.taskCarDriveWander(car, speed, style));
  return attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, speed, style));
}

function issueRollingDrive(car, pos) {
  if (!rollTarget) rollNewTarget(pos);
  attempt(() => car.driveTo(rollTarget.x, rollTarget.y, rollTarget.z));
}

/** Rolls a fresh cruising speed somewhere between the configured bounds. */
function pickLegSpeed() {
  const lo = CONFIG.autoSpeedMin;
  const hi = CONFIG.autoSpeedMax;
  legSpeed = Math.max(4.0, lo + Math.random() * (hi - lo));
}

function applyStyle(car) {
  if (legSpeed === 0) pickLegSpeed();
  attempt(() => car.setDrivingStyle(CONFIG.autoDrivingStyle));
  attempt(() => car.setMaxSpeed(legSpeed));
}

/**
 * SA's driving AI has no reversing behaviour - when something blocks it, it
 * stops and waits forever. This breaks the deadlock manually. Rather than
 * always backing straight up, it picks one of four moves:
 *
 *   back   reverse straight
 *   left   reverse while swinging the nose right (car goes back-left)
 *   right  reverse while swinging the nose left
 *   push   shove forward instead - for when something barely clips you
 *
 * Steering is done by nudging the car's heading each frame, since the AI
 * won't steer for us while we're overriding its speed.
 */
function pickRecoveryMode() {
  const r = Math.random();
  if (r < CONFIG.recoveryPushChance) return "push";
  const rest = (r - CONFIG.recoveryPushChance) / (1 - CONFIG.recoveryPushChance);
  if (rest < 0.4) return "left";
  if (rest < 0.8) return "right";
  return "back";
}

function applyRecovery(car) {
  const speed = recoveryMode === "push" ? CONFIG.pushSpeed : -CONFIG.reverseSpeed;

  if (reverseMethod === null) {
    if (attempt(() => car.setForwardSpeed(speed))) reverseMethod = "car.setForwardSpeed";
    else if (attempt(() => native("SET_CAR_FORWARD_SPEED", car, speed))) reverseMethod = "native";
    else reverseMethod = "none";
    log("[auto] recovery drive via: " + reverseMethod);
  } else if (reverseMethod === "car.setForwardSpeed") {
    attempt(() => car.setForwardSpeed(speed));
  } else if (reverseMethod === "native") {
    attempt(() => native("SET_CAR_FORWARD_SPEED", car, speed));
  }

  // Swing the nose so we don't just retrace the way we came.
  if (recoveryMode === "left" || recoveryMode === "right") {
    const h = safe(() => car.getHeading(), null);
    if (h !== null) {
      const delta = recoveryMode === "left" ? CONFIG.recoveryTurnRate : -CONFIG.recoveryTurnRate;
      attempt(() => car.setHeading((h + delta + 360) % 360));
    }
  }
}

function enterState(next, now) {
  state = next;
  stateSince = now;
}

export function engage(player, char) {
  if (!safe(() => char.isInAnyCar(), false)) {
    log("[auto] not in a vehicle");
    return false;
  }
  const car = safe(() => char.storeCarIsInNoSave(), null);
  if (!car) return false;

  engaged = true;
  rollTarget = null;
  lastCommand = 0;
  lastProgress = 0;
  lastPos = null;
  state = "driving";
  stateSince = 0;
  blockedSince = 0;
  lastSpeedRoll = 0;
  pickLegSpeed();

  setPlayerControl(player, false);
  attempt(() => car.setEngineOn(true));
  applyStyle(car);
  log("[auto] free roam engaged");
  return true;
}

export function disengage(player, reason) {
  if (!engaged) return;
  engaged = false;
  rollTarget = null;
  setPlayerControl(player, true);
  log("[auto] disengaged (" + (reason || "manual") + ")");
}

export function update(player, char, now) {
  if (!engaged) return null;

  if (!safe(() => char.isInAnyCar(), false)) {
    disengage(player, "left vehicle");
    return null;
  }
  const car = safe(() => char.storeCarIsInNoSave(), null);
  if (!car) {
    disengage(player, "no vehicle handle");
    return null;
  }
  const pos = safe(() => char.getCoordinates(), null);
  if (!pos) return null;

  const speed = safe(() => car.getSpeed(), 0);

  // Drift the cruising speed every few seconds so it isn't robotically flat.
  if (now - lastSpeedRoll > CONFIG.speedChangeMs) {
    pickLegSpeed();
    lastSpeedRoll = now;
    lastCommand = 0;          // push the new cap through on the next tick
  }

  // --- reversing out of a blockage ---
  if (state === "reversing") {
    if (now - stateSince > CONFIG.reverseMs) {
      enterState("driving", now);
      rollTarget = null;      // pick a fresh route after backing up
      lastCommand = 0;
      lastProgress = now;
      pickLegSpeed();
    } else {
      applyRecovery(car);
      return { status: recoveryMode, method: wanderMethod || "?" };
    }
  }

  // --- brief natural pause ---
  if (state === "paused") {
    if (now - stateSince > CONFIG.naturalPauseMs) {
      enterState("driving", now);
      lastCommand = 0;
      lastProgress = now;
    } else {
      return { status: "paused", method: wanderMethod || "?" };
    }
  }

  // --- blocked detection: stopped while supposedly driving ---
  if (speed < CONFIG.blockedSpeed) {
    if (blockedSince === 0) blockedSince = now;
    if (now - blockedSince > CONFIG.blockedMs) {
      blockedSince = 0;
      recoveryMode = pickRecoveryMode();
      enterState("reversing", now);
      log("[auto] blocked, recovery: " + recoveryMode);
      return { status: recoveryMode, method: wanderMethod || "?" };
    }
  } else {
    blockedSince = 0;
  }

  // Stuck detector: barely moved for a while despite not being fully stopped.
  if (lastPos) {
    const moved = Math.sqrt(
      (pos.x - lastPos.x) * (pos.x - lastPos.x) +
      (pos.y - lastPos.y) * (pos.y - lastPos.y)
    );
    if (moved > CONFIG.wanderStuckDistance) lastProgress = now;
  } else {
    lastProgress = now;
  }
  lastPos = { x: pos.x, y: pos.y, z: pos.z };

  const stuck = now - lastProgress > CONFIG.wanderStuckMs;
  if (stuck) {
    rollTarget = null;
    lastProgress = now;
    lastCommand = 0;
    log("[auto] stuck, re-routing");
  }

  // Re-issue on a timer - the AI drops its task when it stops or arrives.
  if (now - lastCommand > CONFIG.autoRefreshMs) {
    applyStyle(car);
    if (!tryNativeWander(char, car)) {
      if (rollTarget) {
        const dx = pos.x - rollTarget.x;
        const dy = pos.y - rollTarget.y;
        if (Math.sqrt(dx * dx + dy * dy) < CONFIG.autoArriveRadius) {
          rollTarget = null;
          pickLegSpeed();                       // new leg, new cruising speed
          if (Math.random() < CONFIG.naturalPauseChance) {
            enterState("paused", now);          // pull up for a moment
            log("[auto] pausing");
            return { status: "paused", method: wanderMethod || "?" };
          }
        }
      }
      issueRollingDrive(car, pos);
    }
    lastCommand = now;
  }

  return {
    status: stuck ? "re-routing" : "roaming",
    method: wanderMethod || "?",
  };
}