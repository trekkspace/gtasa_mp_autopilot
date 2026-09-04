// ---------------------------------------------------------------------------
// autopilot.js - AI driving with three modes
// ---------------------------------------------------------------------------
//
//   roam      free roam, no destination (native wander task if the build has
//             one, otherwise rolling road-snapped waypoints)
//   waypoint  drive to the map waypoint, if a waypoint-reading command exists
//             in this setup (see waypoint.js - probed, never memory-read)
//   point     drive to a point you marked with ALT+B or the Mark button
//
// waypoint/point modes disengage on arrival; roam goes forever.
//
// Every game command spelling is probed once and logged, because none of this
// plugin surface is documented - watch for the "[auto] ... via:" lines.

import { CONFIG } from "../config.js";
import { safe, attempt, round } from "./utils.js";
import { logLine } from "./logbuf.js";
import { getWaypoint } from "./waypoint.js";

let engaged = false;
let mode = "roam";

// probed command spellings, resolved once each
let controlMethod = null;
let wanderMethod = null;
let nodeMethod = null;
let reverseMethod = null;

let rollTarget = null;       // roam mode's current random road point
let markedPoint = null;      // set by ALT+B / Mark button

let lastCommand = 0;
let lastProgress = 0;
let lastPos = null;
let lastSpeedRoll = 0;
let legSpeed = 0;

// state machine: driving -> reversing -> driving, with occasional pauses
let state = "driving";
let stateSince = 0;
let blockedSince = 0;
let recoveryMode = "back";

let statusText = "off";

const MAP_LIMIT = 2800;

// --- public surface ----------------------------------------------------------

export function isEngaged() { return engaged; }
export function getMode() { return mode; }
export function getStatus() { return statusText; }
export function getMarkedPoint() { return markedPoint; }

export function setMode(m) {
  if (m !== "roam" && m !== "waypoint" && m !== "point") return;
  mode = m;
  rollTarget = null;
  lastCommand = 0;
  logLine("[auto] mode: " + m);
}

export function markPoint(pos) {
  if (!pos) return;
  markedPoint = { x: pos.x, y: pos.y, z: pos.z };
  logLine("[auto] point marked: " + round(pos.x, 0) + ", " + round(pos.y, 0));
}

// --- probed command wrappers -------------------------------------------------

function setPlayerControl(player, on) {
  if (controlMethod === null) {
    if (attempt(() => player.setControl(on))) controlMethod = "player.setControl";
    else if (attempt(() => player.canMove(on))) controlMethod = "player.canMove";
    else if (attempt(() => native("SET_PLAYER_CONTROL", 0, on))) controlMethod = "native";
    else controlMethod = "none";
    logLine("[auto] player control via: " + controlMethod);
    return;
  }
  if (controlMethod === "player.setControl") attempt(() => player.setControl(on));
  else if (controlMethod === "player.canMove") attempt(() => player.canMove(on));
  else if (controlMethod === "native") attempt(() => native("SET_PLAYER_CONTROL", 0, on));
}

function snapToRoad(x, y, z) {
  let r = null;
  if (nodeMethod === null) {
    if (attempt(() => { r = Path.GetClosestCarNode(x, y, z); })) nodeMethod = "Path.GetClosestCarNode";
    else if (attempt(() => { r = native("GET_CLOSEST_CAR_NODE", x, y, z); })) nodeMethod = "native";
    else if (attempt(() => { r = native("GET_CLOSEST_CAR_NODE_WITH_HEADING", x, y, z); })) nodeMethod = "native_heading";
    else nodeMethod = "none";
    logLine("[auto] road snapping via: " + nodeMethod);
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

function tryNativeWander(char, car) {
  if (legSpeed === 0) pickLegSpeed();
  const speed = legSpeed;
  const style = CONFIG.autoDrivingStyle;

  if (wanderMethod === null) {
    if (attempt(() => Task.CarDriveWander(char, car, speed, style))) wanderMethod = "Task.CarDriveWander";
    else if (attempt(() => char.taskCarDriveWander(car, speed, style))) wanderMethod = "char.taskCarDriveWander";
    else if (attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, speed, style))) wanderMethod = "native";
    else wanderMethod = "rolling";
    logLine("[auto] wander via: " + wanderMethod);
    return wanderMethod !== "rolling";
  }
  if (wanderMethod === "rolling") return false;
  if (wanderMethod === "Task.CarDriveWander") return attempt(() => Task.CarDriveWander(char, car, speed, style));
  if (wanderMethod === "char.taskCarDriveWander") return attempt(() => char.taskCarDriveWander(car, speed, style));
  return attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, speed, style));
}

// --- driving internals -------------------------------------------------------

function clamp(v) {
  return Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, v));
}

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

function rollNewTarget(pos) {
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
      return;
    }
    if (nodeMethod === "none") {
      rollTarget = raw;
      return;
    }
  }
  rollTarget = { x: pos.x, y: pos.y, z: pos.z };
}

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

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
    logLine("[auto] recovery drive via: " + reverseMethod);
  } else if (reverseMethod === "car.setForwardSpeed") {
    attempt(() => car.setForwardSpeed(speed));
  } else if (reverseMethod === "native") {
    attempt(() => native("SET_CAR_FORWARD_SPEED", car, speed));
  }

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

// --- engage / disengage ------------------------------------------------------

export function engage(player, char) {
  if (!safe(() => char.isInAnyCar(), false)) {
    logLine("[auto] not in a vehicle");
    return false;
  }
  const car = safe(() => char.storeCarIsInNoSave(), null);
  if (!car) return false;

  engaged = true;
  rollTarget = null;
  lastCommand = 0;
  lastProgress = 0;
  lastPos = null;
  lastSpeedRoll = 0;
  state = "driving";
  stateSince = 0;
  blockedSince = 0;
  pickLegSpeed();

  setPlayerControl(player, false);
  attempt(() => car.setEngineOn(true));
  applyStyle(car);
  statusText = "engaged (" + mode + ")";
  logLine("[auto] engaged, mode " + mode);
  return true;
}

export function disengage(player, reason) {
  if (!engaged) return;
  engaged = false;
  rollTarget = null;
  statusText = "off";
  setPlayerControl(player, true);
  logLine("[auto] disengaged (" + (reason || "manual") + ")");
}

// --- per-frame update --------------------------------------------------------

export function update(player, char, now) {
  if (!engaged) {
    statusText = "off";
    return null;
  }

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

  // drift the cruising speed every few seconds
  if (now - lastSpeedRoll > CONFIG.speedChangeMs) {
    pickLegSpeed();
    lastSpeedRoll = now;
    lastCommand = 0;
  }

  // --- recovery / pause states ---
  if (state === "reversing") {
    if (now - stateSince > CONFIG.reverseMs) {
      enterState("driving", now);
      rollTarget = null;
      lastCommand = 0;
      lastProgress = now;
    } else {
      applyRecovery(car);
      statusText = recoveryMode;
      return { status: recoveryMode };
    }
  }

  if (state === "paused") {
    if (now - stateSince > CONFIG.naturalPauseMs) {
      enterState("driving", now);
      lastCommand = 0;
      lastProgress = now;
    } else {
      statusText = "paused";
      return { status: "paused" };
    }
  }

  // --- blocked: stopped while supposedly driving ---
  if (speed < CONFIG.blockedSpeed) {
    if (blockedSince === 0) blockedSince = now;
    if (now - blockedSince > CONFIG.blockedMs) {
      blockedSince = 0;
      recoveryMode = pickRecoveryMode();
      enterState("reversing", now);
      logLine("[auto] blocked, recovery: " + recoveryMode);
      statusText = recoveryMode;
      return { status: recoveryMode };
    }
  } else {
    blockedSince = 0;
  }

  // --- stuck: barely moving for a while ---
  if (lastPos) {
    if (dist2d(pos, lastPos) > CONFIG.wanderStuckDistance) lastProgress = now;
  } else {
    lastProgress = now;
  }
  lastPos = { x: pos.x, y: pos.y, z: pos.z };

  if (now - lastProgress > CONFIG.wanderStuckMs) {
    rollTarget = null;
    lastProgress = now;
    lastCommand = 0;
    logLine("[auto] stuck, re-routing");
  }

  // --- destination handling by mode ---
  let target = null;
  let targetLabel = "";

  if (mode === "waypoint") {
    const wp = getWaypoint();
    if (!wp) {
      statusText = "no waypoint set";
      return { status: statusText };
    }
    target = snapToRoad(wp.x, wp.y, wp.z) || wp;
    targetLabel = "waypoint";
  } else if (mode === "point") {
    if (!markedPoint) {
      statusText = "no point marked (ALT+B)";
      return { status: statusText };
    }
    target = snapToRoad(markedPoint.x, markedPoint.y, markedPoint.z) || markedPoint;
    targetLabel = "marked point";
  }

  if (target) {
    const d = dist2d(pos, target);
    if (d < CONFIG.autoArriveRadius) {
      disengage(player, "arrived at " + targetLabel);
      statusText = "arrived";
      return { status: "arrived" };
    }
    if (now - lastCommand > CONFIG.autoRefreshMs) {
      applyStyle(car);
      attempt(() => car.driveTo(target.x, target.y, target.z));
      lastCommand = now;
    }
    statusText = "to " + targetLabel + " " + Math.round(d) + "m";
    return { status: statusText };
  }

  // --- roam ---
  if (now - lastCommand > CONFIG.autoRefreshMs) {
    applyStyle(car);
    if (!tryNativeWander(char, car)) {
      if (rollTarget && dist2d(pos, rollTarget) < CONFIG.autoArriveRadius) {
        rollTarget = null;
        pickLegSpeed();
        if (Math.random() < CONFIG.naturalPauseChance) {
          enterState("paused", now);
          statusText = "paused";
          return { status: "paused" };
        }
      }
      if (!rollTarget) rollNewTarget(pos);
      attempt(() => car.driveTo(rollTarget.x, rollTarget.y, rollTarget.z));
    }
    lastCommand = now;
  }

  statusText = "roaming";
  return { status: "roaming" };
}