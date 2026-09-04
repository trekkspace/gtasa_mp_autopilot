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
  ImGui.Text("Mode:   " + ui.autoMode);
  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();

  const b2 = buttonSize("APB2", 2);

  if (ui.engaged) {
    if (ImGui.ButtonColored("Stop autopilot", 0.75, 0.15, 0.15, 1.0, b2.x, b2.y * 2)) {
      actions.toggleAuto = true;
    }
  } else if (ImGui.ButtonColored("Start autopilot", 0.15, 0.6, 0.2, 1.0, b2.x, b2.y * 2)) {
    actions.toggleAuto = true;
  }
  ImGui.SameLine();
  if (ImGui.Button("Mark point", b2.x, b2.y * 2)) actions.markPoint = true;

  ImGui.Spacing();
  ImGui.Text("Destination");
  ImGui.Spacing();

  // RadioButton(label, current, thisValue) returns the new current value.
  const cur = ui.autoMode === "roam" ? 1 : ui.autoMode === "waypoint" ? 2 : 3;
  let sel = cur;
  sel = ImGui.RadioButton("Free roam", sel, 1);
  ImGui.SameLine();
  sel = ImGui.RadioButton("Waypoint", sel, 2);
  ImGui.SameLine();
  sel = ImGui.RadioButton("Marked point", sel, 3);

  if (sel !== cur) {
    actions.setMode = sel === 1 ? "roam" : sel === 2 ? "waypoint" : "point";
  }

  ImGui.Spacing();
  ImGui.Separator();
  ImGui.Spacing();
  ImGui.TextDisabled("ALT+G start/stop   ALT+B mark   ALT+X hide");
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

  // Hands the mouse to ImGui while the panel is up. This is what lets the
  // window be dragged and resized; the game takes the mouse back when it's
  // hidden.
  attempt(() => ImGui.SetCursorVisible(CONFIG.showCursor && open ? 1 : 0));

  if (open) {
    if (!sizeApplied) {
      // 2 = ImGuiCond_Once, so it only applies on first show and never
      // fights you resizing afterwards.
      attempt(() => ImGui.SetNextWindowSize(CONFIG.windowW, CONFIG.windowH, 2));
      sizeApplied = true;
    }
    if (reposition && CONFIG.positionWindow) {
      if (!attempt(() => ImGui.SetNextWindowPos(x, y, 2))) {
        attempt(() => ImGui.SetNextWindowPos(x, y, 2, 0.0, 0.0));
      }
    }

    const r = ImGui.Begin(CONFIG.windowTitle, open ? 1 : 0, 0, 0, 0, 0);
    stillOpen = !!r;

    ImGui.BeginChild("SAMP_HUD_BODY");

    const tab = ImGui.Tabs("SAMP_HUD_TABS", "Info,Autopilot,Log");
    if (tab === 0) tabInfo(lines);
    else if (tab === 1) tabAutopilot(ui, actions);
    else tabLog();

    ImGui.EndChild();
    ImGui.End();
  }

  ImGui.EndFrame();

  actions.closed = !stillOpen;
  return actions;
}

// --- entry point -------------------------------------------------------------

export function render(mode, lines, x, y, reposition, ui, open) {
  if (mode === "imgui") return renderImGui(lines, x, y, reposition, ui, open);
  renderText(lines, x, y);
  return {};
}