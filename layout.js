/*
 * layout.js: pure geometry and formatting helpers for the video dock.
 *
 * Role: no DOM, no chrome.* APIs, so node:test can load it (see test/layout.test.js).
 * Loaded before content.js by manifest.json; content.js reads the globals below.
 * Constraint: classic script (content scripts cannot be ES modules), so the
 * functions are globals, with a CommonJS export guarded for the tests.
 */

/** Rectangle of the dock: from the right edge of X's timeline column to the window edge. */
function dockRect(colRight, winW, winH, minW) {
  minW = minW || 420;
  // Narrow windows: cover the right end of the column instead of shrinking the video.
  const width = Math.max(winW - Math.round(colRight), minW);
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

if (typeof module !== "undefined") module.exports = { dockRect, fitContain, fmtTime };
