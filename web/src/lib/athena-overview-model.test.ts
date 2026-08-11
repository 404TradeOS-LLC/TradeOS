import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAthenaWindow,
  formatAthenaMs,
  formatAthenaPercent,
  formatAthenaUsd,
  hasAthenaActivity,
  resolveAthenaWindowPreset,
} from "./athena-overview-model.ts";

test("hasAthenaActivity is false only for a zero request count (the calm empty state)", () => {
  assert.equal(hasAthenaActivity({ requestCount: 0 }), false);
  assert.equal(hasAthenaActivity({ requestCount: 1 }), true);
  assert.equal(hasAthenaActivity({ requestCount: 42 }), true);
});

test("formatAthenaPercent renders a fraction as a one-decimal percentage, and null/NaN as an em dash", () => {
  assert.equal(formatAthenaPercent(0), "0.0%");
  assert.equal(formatAthenaPercent(0.5), "50.0%");
  assert.equal(formatAthenaPercent(1), "100.0%");
  assert.equal(formatAthenaPercent(null), "—");
  assert.equal(formatAthenaPercent(undefined), "—");
  assert.equal(formatAthenaPercent(Number.NaN), "—");
});

test("formatAthenaMs switches to seconds above 1000ms", () => {
  assert.equal(formatAthenaMs(250), "250 ms");
  assert.equal(formatAthenaMs(999), "999 ms");
  assert.equal(formatAthenaMs(1500), "1.50 s");
  assert.equal(formatAthenaMs(null), "—");
});

test("formatAthenaUsd shows extra precision for sub-dollar costs", () => {
  assert.equal(formatAthenaUsd(12.5), "$12.50");
  assert.equal(formatAthenaUsd(0), "$0.00");
  assert.equal(formatAthenaUsd(0.0034), "$0.0034");
  assert.equal(formatAthenaUsd(null), "—");
});

test("resolveAthenaWindowPreset only accepts the three known presets, defaulting to 24h", () => {
  assert.equal(resolveAthenaWindowPreset("7d"), "7d");
  assert.equal(resolveAthenaWindowPreset("30d"), "30d");
  assert.equal(resolveAthenaWindowPreset("24h"), "24h");
  assert.equal(resolveAthenaWindowPreset("1y"), "24h");
  assert.equal(resolveAthenaWindowPreset(undefined), "24h");
});

test("buildAthenaWindow computes `from` as exactly the preset duration before `to`", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  assert.deepEqual(buildAthenaWindow("24h", now), { from: "2026-08-09T12:00:00.000Z", to: "2026-08-10T12:00:00.000Z" });
  assert.deepEqual(buildAthenaWindow("7d", now), { from: "2026-08-03T12:00:00.000Z", to: "2026-08-10T12:00:00.000Z" });
  assert.deepEqual(buildAthenaWindow("30d", now), { from: "2026-07-11T12:00:00.000Z", to: "2026-08-10T12:00:00.000Z" });
});
