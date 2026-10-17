/*
 * layout.js: pure geometry and formatting helpers for the video dock.
 *
 * Role: no DOM, no chrome.* APIs, so node:test can load it (see test/layout.test.js).
 * Loaded before content.js by manifest.json; content.js reads the globals below.
 * Constraint: classic script (content scripts cannot be ES modules), so the
 * functions are globals, with a CommonJS export guarded for the tests.
 * Related: styles.css forces the nav to NAV_W (88 px) while the dock is open; keep in sync.
 */

const NAV_W = 88; // icon rail width while docked, same value as in styles.css
const COL_W = 600; // X's normal timeline column width
const MIN_MAIN = 320; // narrowest timeline column the user can squeeze
const MIN_DOCK = 320;

/** A user-dragged dock width, kept between 320 px and what leaves the timeline 320 px. */
function clampDockWidth(w, winW) {
  return Math.min(Math.max(Math.round(w), MIN_DOCK), Math.max(winW - NAV_W - MIN_MAIN, MIN_DOCK));
}

/**
 * Where the dock and the timeline go. The dock is anchored to the right window edge. Without
 * a user width it takes the space right of a normal 600 px column; with one, the timeline
 * column takes whatever the nav and the dock leave, so no gap opens between them.
 * Returns the dock rectangle plus mainW, the width to give the timeline column.
 */
function dockRect(winW, winH, userW) {
  const width = userW ? clampDockWidth(userW, winW) : Math.max(winW - NAV_W - COL_W, 420);
  return { left: winW - width, top: 0, width: width, height: winH, mainW: Math.max(winW - NAV_W - width, MIN_MAIN) };
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

if (typeof module !== "undefined") module.exports = { dockRect, clampDockWidth, fitContain, fmtTime, NAV_W };
