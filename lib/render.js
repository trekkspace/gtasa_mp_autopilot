// ---------------------------------------------------------------------------
// render.js - drawing, in either ImGui or text mode
// ---------------------------------------------------------------------------

import { CONFIG } from "../config.js";
import { attempt } from "./utils.js";

export const HAS_IMGUI = typeof ImGui !== "undefined";

// Text mode is only safe if custom text entries can actually be registered.
// Text.Display given a key that was never inserted makes the GAME crash, not
// the script - attempt() cannot catch that. So we verify up front.
let textModeUsable = false;

export function initTextMode() {
  const ok =
    typeof FxtStore !== "undefined" &&
    typeof Text !== "undefined" &&
    attempt(() => FxtStore.insert("HUDCHK", "check")) &&
    attempt(() => FxtStore.delete("HUDCHK"));

  textModeUsable = ok;
  log("[hud] text mode " + (ok ? "usable" : "UNAVAILABLE - FxtStore/Text missing"));
  return ok;
}

export function resolveMode() {
  if (CONFIG.mode === "imgui") return "imgui";
  if (CONFIG.mode === "text") return "text";
  return HAS_IMGUI ? "imgui" : "text";
}

// --- text mode ---------------------------------------------------------------

// Only keys confirmed inserted are ever passed to Text.Display.
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
      // Only mark the key live if the insert genuinely succeeded.
      if (attempt(() => FxtStore.insert(key, lines[i]))) liveKeys[key] = lines[i];
    }

    if (liveKeys[key] === undefined) continue;   // never display an unknown key

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

function renderImGui(lines, x, y, reposition) {
  // Call shapes below are the ones this build actually accepts. CLEO Redux
  // validates argument counts against the command definition and logs
  // "Expected value, got 'undefined'" when one is short, so the arity here
  // is not guesswork - it is what the log stopped complaining about.
  //
  //   BeginFrame(id)                      - starts the frame
  //   SetNextWindowPos(x, y, cond, pivotX, pivotY)
  //       Dear ImGui's signature is (pos, cond, pivot), which flattens to
  //       five. Two and three both logged "Expected value, got 'undefined'".
  //       If five still warns, set CONFIG.positionWindow = false and just
  //       drag the window - the call is optional.
  //   Begin(title, a, b, c, d, e)         - 6 args; fewer fails silently
  //   Text(str)
  //   EndFrame()                          - closes the window AND the frame,
  //                                         so the script never calls End()
  ImGui.BeginFrame("SAMP_HUD");

  if (reposition && CONFIG.positionWindow) {
    attempt(() => ImGui.SetNextWindowPos(x, y, 1, 0.0, 0.0));
  }

  const f = CONFIG.beginFlags;
  if (ImGui.Begin(CONFIG.windowTitle, f[0], f[1], f[2], f[3], f[4])) {
    for (let i = 0; i < lines.length; i++) ImGui.Text(lines[i]);
  }

  ImGui.EndFrame();
}

// --- entry point -------------------------------------------------------------

export function render(mode, lines, x, y, reposition) {
  if (mode === "imgui") renderImGui(lines, x, y, reposition);
  else renderText(lines, x, y);
}