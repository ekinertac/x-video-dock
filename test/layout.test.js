/* Tests for layout.js. Run: node --test */
const test = require("node:test");
const assert = require("node:assert");
const { dockRect, clampDockWidth, fitContain, fmtTime } = require("../layout.js");

test("dockRect uses the user width, anchored to the right edge", () => {
  assert.deepStrictEqual(dockRect(1293, 1930, 1370, 900), { left: 1030, top: 0, width: 900, height: 1370 });
});

test("clampDockWidth keeps the dock between 320 px and window minus 300 px", () => {
  assert.strictEqual(clampDockWidth(100, 1930), 320);
  assert.strictEqual(clampDockWidth(1900, 1930), 1630);
  assert.strictEqual(clampDockWidth(800.4, 1930), 800);
  assert.strictEqual(clampDockWidth(500, 500), 320);
});

test("dockRect spans from the column edge to the window edge", () => {
  assert.deepStrictEqual(dockRect(1293, 1930, 1370), { left: 1293, top: 0, width: 637, height: 1370 });
});

test("dockRect keeps a minimum width on narrow windows", () => {
  const r = dockRect(1100, 1300, 800);
  assert.strictEqual(r.width, 420);
  assert.strictEqual(r.left, 880);
});

test("fitContain: vertical video is limited by height", () => {
  assert.deepStrictEqual(fitContain(637, 1250, 720, 1280), { w: 637, h: 1132 });
  assert.deepStrictEqual(fitContain(900, 1000, 720, 1280), { w: 562, h: 1000 });
});

test("fitContain: landscape video is limited by width", () => {
  assert.deepStrictEqual(fitContain(1000, 1300, 1398, 782), { w: 1000, h: 559 });
});

test("fitContain: unknown video size fills the box", () => {
  assert.deepStrictEqual(fitContain(500, 400, 0, 0), { w: 500, h: 400 });
});

test("fmtTime", () => {
  assert.strictEqual(fmtTime(83.9), "1:23");
  assert.strictEqual(fmtTime(5), "0:05");
  assert.strictEqual(fmtTime(NaN), "0:00");
  assert.strictEqual(fmtTime(Infinity), "0:00");
});
