// ---------------------------------------------------------------------------
// utils.js - small shared helpers
// ---------------------------------------------------------------------------

/**
 * Runs a getter and swallows any error, returning `fallback` instead.
 * Keeps one missing or failing command from killing the whole loop.
 */
export function safe(fn, fallback) {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

/** Runs fn and reports whether it completed without throwing. */
export function attempt(fn) {
  try {
    fn();
    return true;
  } catch (e) {
    return false;
  }
}

export function round(n, places) {
  const f = Math.pow(10, places || 0);
  return Math.round(n * f) / f;
}

/** Edge detector: fires true only on the frame a key goes down. */
export function makeKeyLatch(keyCode) {
  let wasDown = false;
  return function () {
    const down = safe(() => Pad.IsKeyPressed(keyCode), false);
    const fired = down && !wasDown;
    wasDown = down;
    return fired;
  };
}
