/// <reference path="../../.config/sa.d.ts" />
//
// samp-hud - live player info panel + autopilot for GTA San Andreas / SA-MP
//
// Install: this folder goes in GTA San Andreas/CLEO/ so index.js sits at
//          CLEO/<folder>/index.js, with lib/ and data/ beside it.
//
// Keys (all ALT-modified so SA-MP chat can't trigger them):
//   ALT+X       show / hide the panel
//   ALT+G       autopilot start / stop
//   Drag / resize the window with the mouse; its X button hides it too.
//
// The panel has Info / Autopilot / Log tabs. The autopilot free roams, with
// traffic-light, traffic-avoidance and speed settings adjustable live.
//
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { safe, makeKeyLatch } from "./lib/utils.js";
import { logLine } from "./lib/logbuf.js";
import { collectLines } from "./lib/info.js";
import { render, clearText, initTextMode, resolveMode, HAS_IMGUI } from "./lib/render.js";
import * as auto from "./lib/autopilot.js";
import * as trip from "./lib/trip.js";

const mode = resolveMode();
if (mode === "text") initTextMode();
const player = new Player(0);

let visible = CONFIG.startVisible;
let reposition = true;   // applied once, then the window stays where you drag it

let hudX = CONFIG.x;
let hudY = CONFIG.y;

let cachedLines = [];
let lastUpdate = -99999;
let ticks = 0;
let lastToggleTick = -999;
let lastSlowLog = 0;
let inVehicle = false;
let autoState = null;

const toggleFired = makeKeyLatch(CONFIG.toggleKey);
const autoFired = makeKeyLatch(CONFIG.autoKey);

logLine("[hud] loaded, mode=" + mode + ", imgui=" + HAS_IMGUI);

while (true) {
  wait(0);
  ticks++;

  const altDown = safe(() => Pad.IsKeyPressed(0x12), false);

  // --- panel toggle ---
  const modOk = CONFIG.modifierKey === 0 || safe(() => Pad.IsKeyPressed(CONFIG.modifierKey), false);
  const fired = toggleFired();   // always read, so the edge is consumed either way
  if (modOk && fired && ticks - lastToggleTick > CONFIG.toggleCooldownFrames) {
    lastToggleTick = ticks;
    visible = !visible;
    if (!visible) clearText();
    else lastUpdate = -99999;
  }

  const now = safe(() => Clock.GetGameTimer(), ticks * 16);

  // --- autopilot: runs whether or not the panel is visible ---
  if (CONFIG.autoEnabled) {
    if (altDown && autoFired()) {
      if (auto.isEngaged()) auto.disengage(player, "toggled off");
      else auto.engage(player, player.getChar());
    }
    autoState = auto.update(player, player.getChar(), now);
  }

  if (!visible) continue;

  const frameStart = now;

  // --- refresh readings; hold last values during spawns/cutscenes ---
  const playing = safe(() => player.isPlaying(), false);
  if (playing && (CONFIG.updateIntervalMs <= 0 || now - lastUpdate >= CONFIG.updateIntervalMs)) {
    cachedLines = collectLines(player);
    inVehicle = cachedLines.length > 0 && cachedLines[0].indexOf("vehicle") !== -1;
    if (CONFIG.showTicker) cachedLines.push("tick " + ticks);
    lastUpdate = now;
  }

  if (cachedLines.length === 0) continue;

  // --- draw, and act on any button the user clicked ---
  const ui = {
    engaged: auto.isEngaged(),
    status: auto.getStatus(),
    stopReason: auto.getStopReason(),
    obeyLights: CONFIG.obeyTrafficLights,
    avoidTraffic: CONFIG.avoidTraffic,
    speedPercent: CONFIG.speedPercent,
    varySpeed: CONFIG.varySpeed,
    style: auto.styleFromOptions(),
    speedKmh: CONFIG.autoTopSpeed * (CONFIG.speedPercent / 100) * 3.6,
    explore: CONFIG.exploreNewAreas,
    headlights: CONFIG.autoHeadlights,
    autoFlip: CONFIG.autoFlip,
    disengageOnInput: CONFIG.disengageOnInput,
    stopAfterMinutes: CONFIG.stopAfterMinutes,
    stopAfterKm: CONFIG.stopAfterKm,
    stopBelowHealth: CONFIG.stopBelowVehicleHealth,
    trip: trip.stats(now),
  };

  let actions = {};
  let renderFailed = false;
  const tRender = safe(() => Clock.GetGameTimer(), 0);
  try {
    actions = render(mode, cachedLines, hudX, hudY, reposition, ui, visible) || {};
  } catch (e) {
    renderFailed = true;
  }
  const tEnd = safe(() => Clock.GetGameTimer(), 0);
  reposition = false;

  if (actions.setLights !== undefined) CONFIG.obeyTrafficLights = actions.setLights;
  if (actions.setTraffic !== undefined) CONFIG.avoidTraffic = actions.setTraffic;
  if (actions.setSpeed !== undefined) CONFIG.speedPercent = actions.setSpeed;
  if (actions.setVary !== undefined) CONFIG.varySpeed = actions.setVary;
  if (actions.setExplore !== undefined) CONFIG.exploreNewAreas = actions.setExplore;
  if (actions.setHeadlights !== undefined) CONFIG.autoHeadlights = actions.setHeadlights;
  if (actions.setFlip !== undefined) CONFIG.autoFlip = actions.setFlip;
  if (actions.setHandback !== undefined) CONFIG.disengageOnInput = actions.setHandback;
  if (actions.setStopMinutes !== undefined) CONFIG.stopAfterMinutes = actions.setStopMinutes;
  if (actions.setStopKm !== undefined) CONFIG.stopAfterKm = actions.setStopKm;
  if (actions.setStopHealth !== undefined) CONFIG.stopBelowVehicleHealth = actions.setStopHealth;
  if (actions.resetTrip) trip.reset();
  if (actions.toggleAuto) {
    if (auto.isEngaged()) auto.disengage(player, "button");
    else auto.engage(player, player.getChar());
  }

  // The window's own close button hides the panel and returns the mouse.
  if (actions.closed) {
    visible = false;
    lastToggleTick = ticks;
    clearText();
  }

  // --- slow frame diagnosis ---
  if (CONFIG.diagnoseSlowFrames) {
    const totalMs = tEnd - frameStart;
    if (totalMs > CONFIG.slowFrameMs && tEnd - lastSlowLog > 1000) {
      lastSlowLog = tEnd;
      logLine(
        "[hud] slow frame " + totalMs + "ms (render " + (tEnd - tRender) + ")" +
        (renderFailed ? " RENDER THREW" : "") + " inVehicle=" + inVehicle
      );
    }
  }
}