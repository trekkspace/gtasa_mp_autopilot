// ---------------------------------------------------------------------------
// waypoint.js - tries to read the map waypoint / checkpoint position
// ---------------------------------------------------------------------------
//
// Base San Andreas has no scripting command for the map waypoint - it's a menu
// feature, not a script one. CLEO scripts normally dig it out of the radar
// blip array at a hardcoded address, which I'm deliberately NOT doing here: a
// wrong command name throws harmlessly and gets caught, but a wrong memory
// address crashes the game outright.
//
// So this probes for a command instead. Some plugins (CLEO+, and some SA-MP
// specific ones) add one. If your setup has any of these, waypoint mode works.
// If not, the log says so once and you use marked points instead.
//
// If you find the right command name in the Sanny Builder library, add it to
// CANDIDATES and it'll be picked up automatically.

import { attempt } from "./utils.js";
import { logLine } from "./logbuf.js";

let method = null;   // resolved once
let warned = false;

const CANDIDATES = [
  { name: "Radar.GetTargetBlipCoords", fn: () => Radar.GetTargetBlipCoords() },
  { name: "Radar.GetWaypointCoords", fn: () => Radar.GetWaypointCoords() },
  { name: "GET_TARGET_BLIP_COORDS", fn: () => native("GET_TARGET_BLIP_COORDS") },
  { name: "GET_WAYPOINT_COORDS", fn: () => native("GET_WAYPOINT_COORDS") },
  { name: "GET_TARGET_COORDS", fn: () => native("GET_TARGET_COORDS") },
];

function looksLikeCoords(r) {
  return r && typeof r.x === "number" && typeof r.y === "number" &&
    !(r.x === 0 && r.y === 0);
}

/** Returns {x,y,z} of the current waypoint, or null if unavailable. */
export function getWaypoint() {
  if (method === "none") return null;

  if (method === null) {
    for (let i = 0; i < CANDIDATES.length; i++) {
      let r = null;
      if (attempt(() => { r = CANDIDATES[i].fn(); }) && looksLikeCoords(r)) {
        method = i;
        logLine("[wp] waypoint available via: " + CANDIDATES[i].name);
        return { x: r.x, y: r.y, z: typeof r.z === "number" ? r.z : 0 };
      }
    }
    // Nothing worked. It may just be that no waypoint is set right now, so
    // don't latch to "none" until we've been asked a few times.
    if (!warned) {
      warned = true;
      logLine("[wp] no waypoint command found yet - set a waypoint on the map and retry");
      return null;
    }
    method = "none";
    logLine("[wp] no waypoint command available in this setup - use marked points");
    return null;
  }

  let r = null;
  if (attempt(() => { r = CANDIDATES[method].fn(); }) && looksLikeCoords(r)) {
    return { x: r.x, y: r.y, z: typeof r.z === "number" ? r.z : 0 };
  }
  return null;   // command exists but no waypoint set right now
}

export function isAvailable() {
  return method !== null && method !== "none";
}