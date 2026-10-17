/* Tests for layout.js. Run: node --test */
const test = require("node:test");
const assert = require("node:assert");
const { dockRect, clampDockWidth, fitContain, fmtTime } = require("../layout.js");

test("dockRect auto: dock takes the space right of nav + 600 px column", () => {
  assert.deepStrictEqual(dockRect(1930, 1370), { left: 688, top: 0, width: 1242, height: 1370, mainW: 600 });
});

test("dockRect auto keeps a minimum dock width on narrow windows", () => {
  const r = dockRect(1100, 800);
  assert.strictEqual(r.width, 420);
  assert.strictEqual(r.left, 680);
  assert.strictEqual(r.mainW, 592); // the column shrinks instead of sitting under the dock
});

test("dockRect with a user width: the column fills the rest, no gap", () => {
  const r = dockRect(1930, 1370, 1100);
  assert.strictEqual(r.left, 830);
  assert.strictEqual(r.width, 1100);
  assert.strictEqual(r.mainW, 742); // 1930 - 88 - 1100
  assert.strictEqual(r.left, 88 + r.mainW); // dock starts exactly where the column ends
});

test("clampDockWidth keeps 320 px for the dock and 320 px for the column", () => {
  assert.strictEqual(clampDockWidth(100, 1930), 320);
  assert.strictEqual(clampDockWidth(1900, 1930), 1522);
  assert.strictEqual(clampDockWidth(800.4, 1930), 800);
  assert.strictEqual(clampDockWidth(500, 500), 320);
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
