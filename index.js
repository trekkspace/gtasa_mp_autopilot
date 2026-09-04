/// <reference path="../../.config/sa.d.ts" />
//
// samp-hud - live player info panel for GTA San Andreas / SA-MP
//
// Install: copy the whole samp-hud folder into GTA San Andreas/CLEO/
//          so you end up with CLEO/samp-hud/index.js
// Requires: cleo_redux.asi + CLEO 4.4 or CLEO 5
// Optional: CLEO_PLUGINS/ImGuiReduxWin32.cleo for the windowed mode
//
// Press X to toggle. Drag the window with the mouse to position it.
//
// ---------------------------------------------------------------------------

import { CONFIG } from "./config.js";
import { safe, makeKeyLatch } from "./lib/utils.js";
import { collectLines } from "./lib/info.js";
import * as auto from "./lib/autopilot.js";
import { render, clearText, initTextMode, resolveMode, HAS_IMGUI } from "./lib/render.js";

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

const autoFired = makeKeyLatch(CONFIG.autoKey);

const toggleFired = makeKeyLatch(CONFIG.toggleKey);

log("[hud] loaded, mode=" + mode + ", imgui=" + HAS_IMGUI);

while (true) {
  wait(0);
  ticks++;

  // --- toggle ---
  const modOk = CONFIG.modifierKey === 0 || safe(() => Pad.IsKeyPressed(CONFIG.modifierKey), false);
  const fired = toggleFired();   // always read, so the edge is consumed either way
  const sinceToggle = ticks - lastToggleTick;

  if (modOk && fired && sinceToggle > CONFIG.toggleCooldownFrames) {
    lastToggleTick = ticks;
    visible = !visible;
    if (!visible) {
      clearText();
    } else {
      lastUpdate = -99999;   // force an immediate refresh on open
    }
  }

  const now = safe(() => Clock.GetGameTimer(), ticks * 16);

  // --- autopilot: runs whether or not the panel is visible ---
  // ALT-modified so SA-MP chat can't trigger it.
  const altDown = safe(() => Pad.IsKeyPressed(0x12), false);

  if (CONFIG.autoEnabled) {
    if (altDown && autoFired()) {
      const c = player.getChar();
      if (auto.isEngaged()) auto.disengage(player, "toggled off");
      else auto.engage(player, c);
    }
    autoState = auto.isEngaged() ? auto.update(player, player.getChar(), now) : null;
  }

  if (!visible) continue;

  const frameStart = now;

  // --- ALT + arrows nudge the window ---
  if (CONFIG.nudgeWithArrows && altDown) {
    if (safe(() => Pad.IsKeyPressed(0x25), false)) { hudX -= CONFIG.moveStep; reposition = true; }
    if (safe(() => Pad.IsKeyPressed(0x27), false)) { hudX += CONFIG.moveStep; reposition = true; }
    if (safe(() => Pad.IsKeyPressed(0x26), false)) { hudY -= CONFIG.moveStep; reposition = true; }
    if (safe(() => Pad.IsKeyPressed(0x28), false)) { hudY += CONFIG.moveStep; reposition = true; }
    if (reposition) log("[hud] position " + Math.round(hudX) + ", " + Math.round(hudY));
  }

  // Refresh readings only when the player is actually in play. During spawns,
  // interior loads and cutscenes isPlaying goes false for a moment - we keep
  // drawing the last known values rather than letting the panel vanish.
  const playing = safe(() => player.isPlaying(), false);

  if (playing && (CONFIG.updateIntervalMs <= 0 || now - lastUpdate >= CONFIG.updateIntervalMs)) {
    cachedLines = collectLines(player);
    inVehicle = cachedLines.length > 0 && cachedLines[0].indexOf("vehicle") !== -1;

    if (autoState) {
      cachedLines.push("Autopilot: " + autoState.status + "  [" + autoState.method + "]");
    }
    if (CONFIG.showTicker) cachedLines.push("tick " + ticks);
    lastUpdate = now;
  }

  if (cachedLines.length === 0) continue;   // nothing to draw yet

  // --- draw every frame, always ---
  // Timed so a stall can be attributed to a phase instead of guessed at.
  // If "render" dominates, something else is holding the ImGui frame.
  const tRender = safe(() => Clock.GetGameTimer(), 0);
  let renderFailed = false;
  try {
    render(mode, cachedLines, hudX, hudY, reposition);
  } catch (e) {
    renderFailed = true;
  }
  const tEnd = safe(() => Clock.GetGameTimer(), 0);

  reposition = false;

  if (CONFIG.diagnoseSlowFrames) {
    const collectMs = tRender - frameStart;
    const renderMs = tEnd - tRender;
    const totalMs = tEnd - frameStart;
    if (totalMs > CONFIG.slowFrameMs && tEnd - lastSlowLog > 1000) {
      lastSlowLog = tEnd;
      log(
        "[hud] slow frame " + totalMs + "ms" +
        " (collect " + collectMs + ", render " + renderMs + ")" +
        (renderFailed ? " RENDER THREW" : "") +
        " inVehicle=" + inVehicle
      );
    }
  }
}