import test from "node:test";
import assert from "node:assert/strict";
import {
  MOTION_DURATIONS_MS,
  MOTION_EASINGS,
  MOTION_DISPLACEMENT_PX,
  MOTION_STAGGER_CAP_MS,
  MOTION_STAGGER_MS,
  figmaSecondsToMs,
  msToFigmaSeconds,
  staggerDelayMs,
} from "./tokens.ts";

test("motion durations match the spec token table exactly", () => {
  assert.equal(MOTION_DURATIONS_MS.micro, 120);
  assert.equal(MOTION_DURATIONS_MS.state, 240);
  assert.equal(MOTION_DURATIONS_MS.resolve, 320);
  assert.equal(MOTION_DURATIONS_MS.connect, 280);
  assert.equal(MOTION_DURATIONS_MS.recalculate, 220);
  assert.equal(MOTION_DURATIONS_MS.advance, 280);
  assert.equal(MOTION_DURATIONS_MS.complete, 240);
  assert.equal(MOTION_DURATIONS_MS.signature, 640);
  assert.equal(MOTION_DURATIONS_MS.reduced, 100);
});

test("motion easings are cubic-bezier only: no spring, bounce, or overshoot", () => {
  assert.equal(MOTION_EASINGS.settle, "cubic-bezier(0.16, 1, 0.3, 1)");
  assert.equal(MOTION_EASINGS.transit, "cubic-bezier(0.4, 0, 0.2, 1)");
  assert.equal(MOTION_EASINGS.exit, "cubic-bezier(0.4, 0, 1, 1)");
  for (const easing of Object.values(MOTION_EASINGS)) {
    assert.match(easing, /^cubic-bezier\(/);
  }
});

test("stagger is 35ms per item and capped at 105ms", () => {
  assert.equal(MOTION_STAGGER_MS, 35);
  assert.equal(MOTION_STAGGER_CAP_MS, 105);
  assert.equal(staggerDelayMs(0), 0);
  assert.equal(staggerDelayMs(1), 35);
  assert.equal(staggerDelayMs(2), 70);
  assert.equal(staggerDelayMs(3), 105);
  assert.equal(staggerDelayMs(10), 105);
  assert.equal(staggerDelayMs(-1), 0);
});

test("content displacement is capped at 4px", () => {
  assert.equal(MOTION_DISPLACEMENT_PX, 4);
});

test("Figma seconds convert as engineering milliseconds / 1000", () => {
  assert.equal(figmaSecondsToMs(0.64), 640);
  assert.equal(figmaSecondsToMs(0.32), 320);
  assert.equal(msToFigmaSeconds(640), 0.64);
  assert.equal(msToFigmaSeconds(280), 0.28);
});
