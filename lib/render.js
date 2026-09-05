// ---------------------------------------------------------------------------
// render.js - drawing
// ---------------------------------------------------------------------------
//
// ImGui usage follows the ImGuiRedux example script:
//
//   ImGui.BeginFrame("UNIQUE_ID")
//   ImGui.SetCursorVisible(open)              <- without this the mouse never
//                                                reaches the window
//   if (open) {
//     ImGui.SetNextWindowSize(w, h, 2)        <- 2 = ImGuiCond_Once
//     open = ImGui.Begin(title, open, 0,0,0,0) <- returns the new open state,
//                                                 NOT "should I draw"
//     ...widgets...
//     ImGui.End()                             <- always, paired with Begin
//   }
//   ImGui.EndFrame()
//
// Widgets take explicit sizes: Button(label, w, h), and GetScalingSize(id, n, 0)
// gives a width that fits n buttons per row.

import { CONFIG } from "../config.js";
import { attempt } from "./utils.js";
import { logLine, getLogLines } from "./logbuf.js";

export const HAS_IMGUI = typeof ImGui !== "undefined";

let textModeUsable = false;

export function initTextMode() {
  const ok =
    typeof FxtStore !== "undefined" &&
    typeof Text !== "undefined" &&
    attempt(() => FxtStore.insert("HUDCHK", "check")) &&
    attempt(() => FxtStore.delete("HUDCHK"));
  textModeUsable = ok;
  logLine("[hud] text mode " + (ok ? "usable" : "UNAVAILABLE"));
  return ok;
}

export function resolveMode() {
  if (CONFIG.mode === "imgui") return "imgui";
  if (CONFIG.mode === "text") return "text";
  return HAS_IMGUI ? "imgui" : "text";
}

// --- text mode ---------------------------------------------------------------

const liveKeys = {};

function renderText(lines, x, y) {
  if (!textModeUsable) return;
  const count = Math.min(lines.length, CONFIG.maxLines);
  const c = CONFIG.color;
  for (let i = 0; i < count; i++) {
    const key = "HUDL" + i;
    if (liveKeys[key] !== lines[i]) {
      if (liveKeys[key] !== undefined) attempt(() => FxtStore.delete(key));
      delete liveKeys[key];
      if (attempt(() => FxtStore.insert(key, lines[i]))) liveKeys[key] = lines[i];
    }
    if (liveKeys[key] === undefined) continue;
    attempt(() => Text.SetFont(CONFIG.font));
    attempt(() => Text.SetScale(CONFIG.scaleX, CONFIG.scaleY));
    attempt(() => Text.SetColor(c[0], c[1], c[2], c[3]));
    attempt(() => Text.SetProportional(true));
    attempt(() => Text.SetRightJustify(false));
    attempt(() => Text.Display(x, y + i * CONFIG.lineHeight, key));
  }
  for (let i = count; i < CONFIG.maxLines; i++) {
    const key = "HUDL" + i;
    if (liveKeys[key] !== undefined) {
      attempt(() => FxtStore.delete(key));
      delete liveKeys[key];
    }
  }
}

export function clearText() {
  for (const key in liveKeys) {
    attempt(() => FxtStore.delete(key));
    delete liveKeys[key];
  }
}

// --- imgui mode --------------------------------------------------------------

let sizeApplied = false;

function buttonSize(id, perRow) {
  let s = null;
  attempt(() => { s = ImGui.GetScalingSize(id, perRow, 0); });
  if (s && typeof s.x === "number") return s;
  return { x: 100.0, y: 26.0 };
}

function tabInfo(lines) {
  ImGui.Spacing();
  for (let i = 0; i < lines.length; i++) ImGui.Text(lines[i]);
}

function tabAutopilot(ui, actions) {
  ImGui.Spacing();
  ImGui.Text("Status: " + ui.status);
  if (ui.stopReason && !ui.engaged) ImGui.TextDisabled("last stop: " + ui.stopReason);
  ImGui.Spacing();

  const b1 = buttonSize("APB1", 1);
  if (ui.engaged) {
    if (ImGui.ButtonColored("Stop", 0.75, 0.15, 0.15, 1.0, b1.x, b1.y * 2)) actions.toggleAuto = true;
  } else if (ImGui.ButtonColored("Start free roam", 0.15, 0.6, 0.2, 1.0, b1.x, b1.y * 2)) {
    actions.toggleAuto = true;
  }

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();
  ImGui.Text("Driving");
  ImGui.Spacing();

  const lights = ImGui.Checkbox("Stop at traffic lights", ui.obeyLights ? 1 : 0);
  if (!!lights !== !!ui.obeyLights) actions.setLights = !!lights;

  const traffic = ImGui.Checkbox("Avoid other traffic", ui.avoidTraffic ? 1 : 0);
  if (!!traffic !== !!ui.avoidTraffic) actions.setTraffic = !!traffic;

  ImGui.Spacing();
  const pct = ImGui.SliderInt("Speed %", ui.speedPercent, 10, 100);
  if (pct !== ui.speedPercent) actions.setSpeed = pct;

  const vary = ImGui.Checkbox("Vary speed naturally", ui.varySpeed ? 1 : 0);
  if (!!vary !== !!ui.varySpeed) actions.setVary = !!vary;

  ImGui.TextDisabled("  ~" + Math.round(ui.speedKmh) + " km/h   style " + ui.style);

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();
  ImGui.Text("Behaviour");
  ImGui.Spacing();

  const explore = ImGui.Checkbox("Seek out new areas", ui.explore ? 1 : 0);
  if (!!explore !== !!ui.explore) actions.setExplore = !!explore;

  const heads = ImGui.Checkbox("Headlights after dark", ui.headlights ? 1 : 0);
  if (!!heads !== !!ui.headlights) actions.setHeadlights = !!heads;

  const flip = ImGui.Checkbox("Right the car if flipped", ui.autoFlip ? 1 : 0);
  if (!!flip !== !!ui.autoFlip) actions.setFlip = !!flip;

  const handback = ImGui.Checkbox("Stop when I touch the controls", ui.disengageOnInput ? 1 : 0);
  if (!!handback !== !!ui.disengageOnInput) actions.setHandback = !!handback;

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();
  ImGui.Text("Stop automatically");
  ImGui.Spacing();

  const mins = ImGui.SliderInt("After minutes (0=off)", ui.stopAfterMinutes, 0, 60);
  if (mins !== ui.stopAfterMinutes) actions.setStopMinutes = mins;

  const km = ImGui.SliderInt("After km (0=off)", ui.stopAfterKm, 0, 50);
  if (km !== ui.stopAfterKm) actions.setStopKm = km;

  const hp = ImGui.SliderInt("Below vehicle HP (0=off)", ui.stopBelowHealth, 0, 900);
  if (hp !== ui.stopBelowHealth) actions.setStopHealth = hp;

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();
  ImGui.Text("This trip");
  ImGui.Spacing();
  ImGui.Text("  " + ui.trip.km.toFixed(2) + " km in " + ui.trip.minutes.toFixed(1) + " min");
  ImGui.Text("  avg " + Math.round(ui.trip.avgKmh) + " km/h, top " + Math.round(ui.trip.topSpeedKmh) + " km/h");
  ImGui.Text("  " + ui.trip.areas + " areas seen, " + ui.trip.recoveries + " recoveries, " + ui.trip.stops + " stops");

  ImGui.Spacing();
  const b2 = buttonSize("TRB", 2);
  if (ImGui.Button("Reset trip", b2.x, b2.y)) actions.resetTrip = true;

  ImGui.Spacing();
  ImGui.TextDisabled("ALT+G start/stop    ALT+X hide panel");
}

function tabLog() {
  ImGui.Spacing();
  const l = getLogLines();
  if (l.length === 0) {
    ImGui.TextDisabled("(nothing yet)");
    return;
  }
  for (let i = 0; i < l.length; i++) ImGui.TextWrapped(l[i]);
}

/**
 * Returns { actions, open } - open is false once the user clicks the window's
 * close button, which the caller uses to hide the panel.
 */
function renderImGui(lines, x, y, reposition, ui, open) {
  const actions = {};
  let stillOpen = open;

  ImGui.BeginFrame("SAMP_HUD");

  // Everything between BeginFrame and EndFrame is wrapped so that a throwing
  // widget can never leave the frame open. An unclosed frame corrupts ImGui's
  // state and the whole panel goes unresponsive until it is reinitialised -
  // which is why reopening it "fixed" it.
  try {
    // Re-asserted every frame: SA-MP takes the cursor back when it wants it,
    // and this claims it again rather than losing input permanently.
    attempt(() => ImGui.SetCursorVisible(CONFIG.showCursor && open ? 1 : 0));

    if (open) {
      if (!sizeApplied) {
        attempt(() => ImGui.SetNextWindowSize(CONFIG.windowW, CONFIG.windowH, 2));
        sizeApplied = true;
      }
      if (reposition && CONFIG.positionWindow) {
        if (!attempt(() => ImGui.SetNextWindowPos(x, y, 2))) {
          attempt(() => ImGui.SetNextWindowPos(x, y, 2, 0.0, 0.0));
        }
      }

      let begun = false;
      try {
        const res = ImGui.Begin(CONFIG.windowTitle, open ? 1 : 0, 0, 0, 0, 0);
        begun = true;
        stillOpen = !!res;

        let childOpen = false;
        try {
          ImGui.BeginChild("SAMP_HUD_BODY");
          childOpen = true;

          const tab = ImGui.Tabs("SAMP_HUD_TABS", "Info,Autopilot,Log");
          if (tab === 0) tabInfo(lines);
          else if (tab === 1) tabAutopilot(ui, actions);
          else tabLog();
        } finally {
          if (childOpen) attempt(() => ImGui.EndChild());
        }
      } finally {
        // Begin must always be paired with End, including when a widget threw.
        if (begun) attempt(() => ImGui.End());
      }
    }
  } finally {
    ImGui.EndFrame();
  }

  actions.closed = !stillOpen;
  return actions;
}

// --- entry point -------------------------------------------------------------

export function render(mode, lines, x, y, reposition, ui, open) {
  if (mode === "imgui") return renderImGui(lines, x, y, reposition, ui, open);
  renderText(lines, x, y);
  return {};
}