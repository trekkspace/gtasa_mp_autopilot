// ---------------------------------------------------------------------------
// trip.js - trip statistics and exploration tracking
// ---------------------------------------------------------------------------
//
// Distance is accumulated from position deltas rather than from speed, since
// car.getSpeed() isn't reliable everywhere - the same reason blockage
// detection stopped trusting it.

import { CONFIG } from "../config.js";

let active = false;
let startedAt = 0;
let elapsedMs = 0;
let metres = 0;
let topSpeed = 0;
let recoveries = 0;
let stops = 0;
let lastPos = null;

// Grid of places we've been, so roaming can prefer somewhere new.
let visited = {};
let cellsSeen = 0;

function cellKey(x, y) {
  const s = CONFIG.exploreCellSize;
  return Math.floor(x / s) + ":" + Math.floor(y / s);
}

export function start(now, pos) {
  active = true;
  startedAt = now;
  lastPos = pos ? { x: pos.x, y: pos.y } : null;
}

export function stop(now) {
  if (active && startedAt) elapsedMs += now - startedAt;
  active = false;
  startedAt = 0;
  lastPos = null;
}

export function reset() {
  active = false;
  startedAt = 0;
  elapsedMs = 0;
  metres = 0;
  topSpeed = 0;
  recoveries = 0;
  stops = 0;
  lastPos = null;
  visited = {};
  cellsSeen = 0;
}

export function countRecovery() { recoveries++; }
export function countStop() { stops++; }

/** Call every frame while engaged. */
export function update(pos, speed, now) {
  if (!pos) return;

  const key = cellKey(pos.x, pos.y);
  if (!visited[key]) {
    visited[key] = now;
    cellsSeen++;
  } else {
    visited[key] = now;
  }

  if (lastPos) {
    const dx = pos.x - lastPos.x;
    const dy = pos.y - lastPos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    // Ignore teleports and warps, which would otherwise inflate the total.
    if (d < CONFIG.tripMaxStepMetres) metres += d;
  }
  lastPos = { x: pos.x, y: pos.y };

  if (speed > topSpeed) topSpeed = speed;
}

export function isVisited(x, y) {
  return !!visited[cellKey(x, y)];
}

export function stats(now) {
  const ms = elapsedMs + (active && startedAt ? now - startedAt : 0);
  return {
    minutes: ms / 60000,
    km: metres / 1000,
    topSpeedKmh: topSpeed * 3.6,
    avgKmh: ms > 1000 ? (metres / 1000) / (ms / 3600000) : 0,
    recoveries: recoveries,
    stops: stops,
    areas: cellsSeen,
  };
}