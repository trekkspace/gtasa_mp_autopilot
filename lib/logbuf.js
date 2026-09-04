// ---------------------------------------------------------------------------
// logbuf.js - keeps the last few log lines so the panel can show them
// ---------------------------------------------------------------------------
//
// Everything still goes to cleo_redux.log as before; this just remembers the
// recent lines for the in-game Log section.

import { CONFIG } from "../config.js";

const lines = [];

export function logLine(msg) {
  try {
    log(msg);
  } catch (e) { /* log should always exist, but never die over it */ }

  lines.push(msg);
  const keep = CONFIG.logKeep || 8;
  while (lines.length > keep) lines.shift();
}

export function getLogLines() {
  return lines;
}