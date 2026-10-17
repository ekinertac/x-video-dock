/*
 * layout.js: pure geometry and formatting helpers for the video dock.
 *
 * Role: no DOM, no chrome.* APIs, so node:test can load it (see test/layout.test.js).
 * Loaded before content.js by manifest.json; content.js reads the globals below.
 * Constraint: classic script (content scripts cannot be ES modules), so the
 * functions are globals, with a CommonJS export guarded for the tests.
 */

/** A user-dragged dock width, kept between 320 px and the window minus 300 px (room for the nav). */
function clampDockWidth(w, winW) {
  return Math.min(Math.max(Math.round(w), 320), Math.max(winW - 300, 320));
}

/**
 * Rectangle of the dock, anchored to the right window edge. Without a user width it spans
 * from the right edge of X's timeline column to the window edge.
 */
function dockRect(colRight, winW, winH, userW) {
  // Narrow windows: cover the right end of the column instead of shrinking the video.
  const auto = Math.max(winW - Math.round(colRight), 420);
  const width = userW ? clampDockWidth(userW, winW) : auto;
  return { left: winW - width, top: 0, width: width, height: winH };
}

/** Largest size of a vw x vh video that fits inside boxW x boxH, keeping its shape. */
function fitContain(boxW, boxH, vw, vh) {
  if (!vw || !vh) return { w: boxW, h: boxH };
  const s = Math.min(boxW / vw, boxH / vh);
  return { w: Math.floor(vw * s), h: Math.floor(vh * s) };
}

/** 83 -> "1:23". Streams without a known length give NaN or Infinity. */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

if (typeof module !== "undefined") module.exports = { dockRect, clampDockWidth, fitContain, fmtTime };
