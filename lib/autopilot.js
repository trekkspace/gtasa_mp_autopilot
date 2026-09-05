// ---------------------------------------------------------------------------
// autopilot.js - free roam driving
// ---------------------------------------------------------------------------
//
// Hands the car to SA's traffic AI and keeps it wandering the road network.
// Targets are random points a few hundred metres away, snapped to the nearest
// vehicle path node so the AI always has somewhere drivable to aim at.
//
// Player control is released while engaged, otherwise your input fights the
// AI. Stopping cancels the AI's task AND restores the vehicle's speed cap -
// miss either and the car keeps driving, or you can't drive it afterwards.
//
// Nothing here triggers nitro: it fires on the player's fire button, and
// control is released the whole time the autopilot is driving.

import { CONFIG } from "../config.js";
import { safe, attempt } from "./utils.js";
import { logLine } from "./logbuf.js";
import * as trip from "./trip.js";

let engaged = false;

// probed command spellings, resolved once each
let controlMethod = null;
let nodeMethod = null;
let reverseMethod = null;
let clearMethod = null;
let statusMethod = null;
let lightsMethod = null;
let flipMethod = null;
let lastNightCheck = 0;
let lightsOn = false;
let stopReason = "";
let wanderMethod = null;

let rollTarget = null;
let lastCommand = 0;
let lastSpeedRoll = 0;
let legSpeed = 0;

let state = "driving";
let stateSince = 0;
let blockAnchor = null;

let statusText = "off";

const MAP_LIMIT = 2800;

export function isEngaged() { return engaged; }
export function getStatus() { return statusText; }
export function getLegSpeed() { return legSpeed; }
export function getStopReason() { return stopReason; }

function dist2d(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampMap(v) {
  return Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, v));
}

// --- driving style -----------------------------------------------------------

/**
 * SA's driving styles:
 *   0  stop for cars, obey lights
 *   1  slow down for cars, obey lights
 *   2  avoid cars, obey lights
 *   3  plough through - ignores cars AND lights
 *   4  stop for cars, ignore lights
 *
 * The panel exposes these as three behaviours; this maps between them.
 * Note the AI cannot see other SA-MP players under any style.
 */
export function styleFromOptions() {
  if (!CONFIG.obeyTrafficLights && !CONFIG.avoidTraffic) return 3;
  if (!CONFIG.obeyTrafficLights) return 4;
  return CONFIG.avoidTraffic ? 0 : 2;
}

/** Top speed scaled by the percentage set on the panel, with slight drift. */
function pickLegSpeed() {
  const target = CONFIG.autoTopSpeed * (CONFIG.speedPercent / 100);
  if (!CONFIG.varySpeed) {
    legSpeed = Math.max(3.0, target);
    return;
  }
  const v = CONFIG.speedVariancePct / 100;
  legSpeed = Math.max(3.0, target * (1 - v + Math.random() * 2 * v));
}

function applyStyle(car) {
  if (legSpeed === 0) pickLegSpeed();
  attempt(() => car.setDrivingStyle(styleFromOptions()));
  attempt(() => car.setMaxSpeed(legSpeed));
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

/**
 * Hands the vehicle back. Three separate things have to happen, and missing
 * any one of them leaves the car unusable:
 *
 *  1. cancel the AI's driving task, or it keeps executing the last order
 *  2. restore the speed cap, or the car is limited to whatever the AI used
 *  3. clear the vehicle's AI-driven status, or your input does nothing
 *
 * (3) is the one that made you get out and back in - re-entering a vehicle is
 * what resets that status. Re-seating you in the same seat does the same job
 * without you having to do it manually.
 */
function cancelDriving(char, car, pos) {
  // 1. cancel the task
  if (clearMethod === null) {
    if (attempt(() => char.clearTasks())) clearMethod = "char.clearTasks";
    else if (attempt(() => Task.ClearTasks(char))) clearMethod = "Task.ClearTasks";
    else if (attempt(() => native("CLEAR_CHAR_TASKS", char))) clearMethod = "native";
    else clearMethod = "none";
    logLine("[auto] task cancel via: " + clearMethod);
  } else if (clearMethod === "char.clearTasks") {
    attempt(() => char.clearTasks());
  } else if (clearMethod === "Task.ClearTasks") {
    attempt(() => Task.ClearTasks(char));
  } else if (clearMethod === "native") {
    attempt(() => native("CLEAR_CHAR_TASKS", char));
  }

  // 2. restore the speed cap and a sane driving style
  attempt(() => car.setMaxSpeed(CONFIG.restoreMaxSpeed));
  attempt(() => car.setDrivingStyle(0));

  // 3. return the vehicle to player control
  if (statusMethod === null) {
    if (attempt(() => car.setStatus(CONFIG.playerVehicleStatus))) statusMethod = "car.setStatus";
    else if (attempt(() => native("SET_CAR_STATUS", car, CONFIG.playerVehicleStatus))) statusMethod = "native";
    else statusMethod = "none";
    logLine("[auto] vehicle status reset via: " + statusMethod);
  } else if (statusMethod === "car.setStatus") {
    attempt(() => car.setStatus(CONFIG.playerVehicleStatus));
  } else if (statusMethod === "native") {
    attempt(() => native("SET_CAR_STATUS", car, CONFIG.playerVehicleStatus));
  }

  // Re-seating does what climbing out and back in does, and works even when
  // no status command is available.
  if (CONFIG.resetBySeating) {
    if (!attempt(() => char.warpIntoCar(car))) {
      attempt(() => native("WARP_CHAR_INTO_CAR", char, car));
    }
  }
}

function snapToRoad(x, y, z) {
  let r = null;
  if (nodeMethod === null) {
    if (attempt(() => { r = Path.GetClosestCarNode(x, y, z); })) nodeMethod = "Path.GetClosestCarNode";
    else if (attempt(() => { r = native("GET_CLOSEST_CAR_NODE", x, y, z); })) nodeMethod = "native";
    else nodeMethod = "none";
    logLine("[auto] road snapping via: " + nodeMethod);
  } else if (nodeMethod === "Path.GetClosestCarNode") {
    attempt(() => { r = Path.GetClosestCarNode(x, y, z); });
  } else if (nodeMethod === "native") {
    attempt(() => { r = native("GET_CLOSEST_CAR_NODE", x, y, z); });
  }
  if (r && typeof r.x === "number" && typeof r.y === "number") {
    return { x: r.x, y: r.y, z: typeof r.z === "number" ? r.z : z };
  }
  return null;
}

function tryNativeWander(char, car) {
  if (legSpeed === 0) pickLegSpeed();
  const style = styleFromOptions();

  if (wanderMethod === null) {
    if (attempt(() => Task.CarDriveWander(char, car, legSpeed, style))) wanderMethod = "Task.CarDriveWander";
    else if (attempt(() => char.taskCarDriveWander(car, legSpeed, style))) wanderMethod = "char.taskCarDriveWander";
    else if (attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, legSpeed, style))) wanderMethod = "native";
    else wanderMethod = "rolling";
    logLine("[auto] wander via: " + wanderMethod);
    return wanderMethod !== "rolling";
  }
  if (wanderMethod === "rolling") return false;
  if (wanderMethod === "Task.CarDriveWander") return attempt(() => Task.CarDriveWander(char, car, legSpeed, style));
  if (wanderMethod === "char.taskCarDriveWander") return attempt(() => char.taskCarDriveWander(car, legSpeed, style));
  return attempt(() => native("TASK_CAR_DRIVE_WANDER", char, car, legSpeed, style));
}

function rollNewTarget(pos) {
  for (let tries = 0; tries < 6; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const d = CONFIG.wanderMinDistance +
      Math.random() * (CONFIG.wanderMaxDistance - CONFIG.wanderMinDistance);
    const raw = {
      x: clampMap(pos.x + Math.cos(angle) * d),
      y: clampMap(pos.y + Math.sin(angle) * d),
      z: pos.z,
    };
    const snapped = snapToRoad(raw.x, raw.y, raw.z);
    const cand = snapped || (nodeMethod === "none" ? raw : null);
    if (!cand) continue;

    // Prefer somewhere we haven't been. Early tries insist on a new area;
    // later ones accept anything, so we never run out of options.
    if (CONFIG.exploreNewAreas && tries < 4 && trip.isVisited(cand.x, cand.y)) continue;

    rollTarget = cand;
    return;
  }
  rollTarget = { x: pos.x, y: pos.y, z: pos.z };
}

// --- extras ------------------------------------------------------------------

/** Reads the in-game hour. Several spellings tried, result logged once. */
let hourMethod = null;
function gameHour() {
  let h = null;
  const tries = [
    ["Clock.GetTimeOfDay", () => { const t = Clock.GetTimeOfDay(); return t && t.hours; }],
    ["Clock.TimeOfDay", () => Clock.TimeOfDay.hours],
    ["native", () => { const t = native("GET_TIME_OF_DAY"); return t && t.hours; }],
  ];

  if (hourMethod === null) {
    for (let i = 0; i < tries.length; i++) {
      let v = null;
      if (attempt(() => { v = tries[i][1](); }) && typeof v === "number") {
        hourMethod = i;
        logLine("[auto] game clock via: " + tries[i][0] + " (hour " + v + ")");
        return v;
      }
    }
    hourMethod = "none";
    logLine("[auto] game clock unavailable - headlights cannot follow the time");
    return null;
  }
  if (hourMethod === "none") return null;
  attempt(() => { h = tries[hourMethod][1](); });
  return typeof h === "number" ? h : null;
}

/** Headlights on after dark. */
function updateLights(car, now) {
  if (!CONFIG.autoHeadlights) return;
  if (now - lastNightCheck < CONFIG.lightCheckMs) return;
  lastNightCheck = now;

  const hour = gameHour();
  if (hour === null) return;

  const shouldBeOn = hour >= CONFIG.nightFromHour || hour < CONFIG.nightUntilHour;

  if (lightsMethod === null) {
    // ForceLights is the one that actually overrides the game: 2 = force on,
    // 1 = force off, 0 = normal behaviour.
    if (attempt(() => car.forceLights(shouldBeOn ? 2 : 0))) lightsMethod = "car.forceLights";
    else if (attempt(() => car.setLightsOn(shouldBeOn))) lightsMethod = "car.setLightsOn";
    else if (attempt(() => native("FORCE_CAR_LIGHTS", car, shouldBeOn ? 2 : 0))) lightsMethod = "native";
    else lightsMethod = "none";
    logLine("[auto] headlights via: " + lightsMethod + " (hour " + hour + ", on=" + shouldBeOn + ")");
    lightsOn = shouldBeOn;
    return;
  }
  if (lightsMethod === "none") return;

  // Re-applied on every check rather than only on change: the override can be
  // reset by the game or by re-entering the vehicle.
  if (lightsMethod === "car.forceLights") attempt(() => car.forceLights(shouldBeOn ? 2 : 0));
  else if (lightsMethod === "car.setLightsOn") attempt(() => car.setLightsOn(shouldBeOn));
  else attempt(() => native("FORCE_CAR_LIGHTS", car, shouldBeOn ? 2 : 0));

  if (shouldBeOn !== lightsOn) {
    lightsOn = shouldBeOn;
    logLine("[auto] headlights " + (shouldBeOn ? "on" : "off") + " (hour " + hour + ")");
  }
}

/** Rights the car if it has ended up on its roof. */
function fixIfFlipped(car) {
  if (!CONFIG.autoFlip) return false;

  let upside = false;
  if (flipMethod === null) {
    if (attempt(() => { upside = car.isUpsidedown(); })) flipMethod = "car.isUpsidedown";
    else if (attempt(() => { upside = car.isUpsideDown(); })) flipMethod = "car.isUpsideDown";
    else flipMethod = "none";
    logLine("[auto] flip check via: " + flipMethod);
  } else if (flipMethod === "car.isUpsidedown") {
    attempt(() => { upside = car.isUpsidedown(); });
  } else if (flipMethod === "car.isUpsideDown") {
    attempt(() => { upside = car.isUpsideDown(); });
  }
  if (!upside) return false;

  // Setting heading rebuilds the orientation matrix upright.
  const h = safe(() => car.getHeading(), 0);
  attempt(() => car.setHeading(h));
  logLine("[auto] car was flipped, righted it");
  return true;
}

/** True when any driving key is held - used to hand control straight back. */
export function manualInputDetected() {
  if (!CONFIG.disengageOnInput) return false;
  const keys = [0x57, 0x41, 0x53, 0x44, 0x26, 0x28, 0x25, 0x27];
  for (let i = 0; i < keys.length; i++) {
    if (safe(() => Pad.IsKeyPressed(keys[i]), false)) return true;
  }
  return false;
}

// --- blockage recovery -------------------------------------------------------

/**
 * Recovery in three phases, which is roughly what a real driver does:
 *
 *   wait     sit still for a moment. Most blockages clear themselves - a car
 *            crossing, a light changing - and doing nothing is the right move.
 *   reverse  back off gently, straight. No steering.
 *   reroute  pick a different target and let the AI drive there normally.
 *
 * The old version called setHeading every frame to swing the nose. That snaps
 * the car's orientation matrix rather than steering it, which is what threw it
 * onto its roof, drove it up walls and wedged it into geometry. Nothing here
 * touches the car's rotation any more - reversing is straight, and changing
 * direction is done by giving the AI somewhere else to go.
 */
function applyRecovery(car) {
  const speed = -CONFIG.reverseSpeed;

  if (reverseMethod === null) {
    // setForwardSpeed first: it is known to exist here (the log reported it
    // before) and it visibly moves the car. setTempAction is tried only when
    // asked for, because it takes an action id I cannot verify - if the id
    // isn't actually "reverse" the car just sits there doing nothing, which
    // is exactly what stopped reversing from working.
    if (CONFIG.preferTempAction &&
        attempt(() => car.setTempAction(CONFIG.reverseTempAction, CONFIG.reverseMs))) {
      reverseMethod = "car.setTempAction";
    } else if (attempt(() => car.setForwardSpeed(speed))) {
      reverseMethod = "car.setForwardSpeed";
    } else if (attempt(() => native("SET_CAR_FORWARD_SPEED", car, speed))) {
      reverseMethod = "native";
    } else {
      reverseMethod = "none";
    }
    logLine("[auto] reverse via: " + reverseMethod);
    return;
  }

  if (reverseMethod === "car.setForwardSpeed") {
    attempt(() => car.setForwardSpeed(speed));
  } else if (reverseMethod === "native") {
    attempt(() => native("SET_CAR_FORWARD_SPEED", car, speed));
  } else if (reverseMethod === "car.setTempAction") {
    // Re-issued each phase start rather than each frame.
  }
}

function startRecovery(car, now) {
  enterState("waiting", now);
  trip.countRecovery();
}

function enterState(next, now) {
  state = next;
  stateSince = now;
}

// --- engage / disengage ------------------------------------------------------

export function engage(player, char) {
  if (!safe(() => char.isInAnyCar(), false)) {
    statusText = "not in a vehicle";
    logLine("[auto] not in a vehicle");
    return false;
  }
  const car = safe(() => char.storeCarIsInNoSave(), null);
  if (!car) return false;

  engaged = true;
  rollTarget = null;
  lastCommand = 0;
  lastSpeedRoll = 0;
  state = "driving";
  stateSince = 0;
  blockAnchor = null;
  pickLegSpeed();

  setPlayerControl(player, false);
  attempt(() => car.setEngineOn(true));
  applyStyle(car);
  stopReason = "";
  trip.start(safe(() => Clock.GetGameTimer(), 0), safe(() => char.getCoordinates(), null));
  statusText = "roaming";
  logLine("[auto] engaged, style " + styleFromOptions() + ", " + CONFIG.speedPercent + "%");
  return true;
}

export function disengage(player, reason) {
  if (!engaged) return;
  engaged = false;

  const char = safe(() => player.getChar(), null);
  if (char) {
    const car = safe(() => char.storeCarIsInNoSave(), null);
    const pos = safe(() => char.getCoordinates(), null);
    if (car) cancelDriving(char, car, pos);
  }

  rollTarget = null;
  stopReason = reason || "manual";
  statusText = "off";
  trip.stop(safe(() => Clock.GetGameTimer(), 0));
  setPlayerControl(player, true);
  logLine("[auto] disengaged (" + stopReason + ")");
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

  const curSpeed = safe(() => car.getSpeed(), 0);
  trip.update(pos, curSpeed, now);
  updateLights(car, now);

  // --- hand control back the moment the player touches the controls ---
  if (manualInputDetected()) {
    disengage(player, "manual input");
    return null;
  }

  // --- auto-stop rules ---
  const st = trip.stats(now);
  if (CONFIG.stopAfterMinutes > 0 && st.minutes >= CONFIG.stopAfterMinutes) {
    disengage(player, "time limit reached");
    return null;
  }
  if (CONFIG.stopAfterKm > 0 && st.km >= CONFIG.stopAfterKm) {
    disengage(player, "distance limit reached");
    return null;
  }
  if (CONFIG.stopBelowVehicleHealth > 0) {
    const hp = safe(() => car.getHealth(), -1);
    if (hp >= 0 && hp < CONFIG.stopBelowVehicleHealth) {
      disengage(player, "vehicle damaged");
      return null;
    }
  }

  if (now - lastSpeedRoll > CONFIG.speedChangeMs) {
    pickLegSpeed();
    lastSpeedRoll = now;
    lastCommand = 0;
  }

  // --- recovery phases ---
  if (state === "waiting") {
    // Do nothing at all for a moment. Traffic and lights sort themselves out.
    if (now - stateSince > CONFIG.recoveryWaitMs) {
      if (fixIfFlipped(car)) {
        enterState("driving", now);
        blockAnchor = { x: pos.x, y: pos.y, t: now };
        return { status: "righting the car" };
      }
      enterState("reversing", now);
      applyRecovery(car);          // probe and apply immediately, don't wait a frame
      if (reverseMethod === "car.setTempAction") {
        attempt(() => car.setTempAction(CONFIG.reverseTempAction, CONFIG.reverseMs));
      }
      logLine("[auto] reversing out");
    } else {
      statusText = "waiting";
      return { status: "waiting" };
    }
  }

  if (state === "reversing") {
    if (now - stateSince > CONFIG.reverseMs) {
      // Reroute: a different target, driven normally by the AI.
      rollTarget = null;
      rollNewTarget(pos);
      applyStyle(car);
      attempt(() => car.driveTo(rollTarget.x, rollTarget.y, rollTarget.z));
      enterState("driving", now);
      lastCommand = now;
      blockAnchor = { x: pos.x, y: pos.y, t: now };
    } else {
      applyRecovery(car);
      statusText = "backing up";
      return { status: "backing up" };
    }
  }

  if (state === "paused") {
    if (now - stateSince > CONFIG.naturalPauseMs) {
      enterState("driving", now);
      lastCommand = 0;
      blockAnchor = { x: pos.x, y: pos.y, t: now };
    } else {
      statusText = "stopped";
      return { status: "stopped" };
    }
  }

  // --- blocked: judged by ground actually covered, not by getSpeed() ---
  if (!blockAnchor) blockAnchor = { x: pos.x, y: pos.y, t: now };

  if (dist2d(pos, blockAnchor) > CONFIG.blockedMoveDistance) {
    blockAnchor = { x: pos.x, y: pos.y, t: now };
  } else {
    // Sitting at a red light is not being stuck. When the AI is obeying
    // lights, give it far longer before deciding something is wrong -
    // otherwise it reverses away from every junction it stops at.
    const patience = CONFIG.obeyTrafficLights
      ? CONFIG.trafficLightGraceMs
      : CONFIG.blockedMs;

    if (now - blockAnchor.t > patience) {
      blockAnchor = { x: pos.x, y: pos.y, t: now };
      startRecovery(car, now);
      logLine("[auto] not moving for " + Math.round(patience / 1000) + "s, recovering");
      statusText = "waiting";
      return { status: "waiting" };
    }
  }

  // --- keep wandering ---
  if (now - lastCommand > CONFIG.autoRefreshMs) {
    applyStyle(car);
    if (!tryNativeWander(char, car)) {
      if (rollTarget && dist2d(pos, rollTarget) < CONFIG.autoArriveRadius) {
        rollTarget = null;
        pickLegSpeed();
        if (Math.random() < CONFIG.naturalPauseChance) {
          enterState("paused", now);
          trip.countStop();
          statusText = "stopped";
          return { status: "stopped" };
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