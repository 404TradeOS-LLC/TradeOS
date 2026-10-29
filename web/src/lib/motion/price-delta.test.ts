import test from "node:test";
import assert from "node:assert/strict";
import { computePriceDelta, toMinorUnits } from "./price-delta.ts";

test("increase: spec plywood example $42.18 -> $46.92 is +$4.74", () => {
  const delta = computePriceDelta({ previousMinor: 4218, currentMinor: 4692, currency: "USD" });
  assert.equal(delta.direction, "increase");
  assert.equal(delta.deltaMinor, 474);
  assert.equal(delta.previousFormatted, "$42.18");
  assert.equal(delta.currentFormatted, "$46.92");
  assert.equal(delta.deltaFormatted, "+$4.74");
});

test("spec what-changed example $4,860 -> $6,530 is +$1,670", () => {
  const delta = computePriceDelta({ previousMinor: 486000, currentMinor: 653000, currency: "USD" });
  assert.equal(delta.direction, "increase");
  assert.equal(delta.deltaMinor, 167000);
  assert.equal(delta.deltaFormatted, "+$1,670.00");
});

test("decrease formats with a minus and unchanged reports no change", () => {
  const down = computePriceDelta({ previousMinor: 10000, currentMinor: 9000, currency: "USD" });
  assert.equal(down.direction, "decrease");
  assert.equal(down.deltaFormatted, "-$10.00");
  const same = computePriceDelta({ previousMinor: 5000, currentMinor: 5000, currency: "USD" });
  assert.equal(same.direction, "unchanged");
  assert.equal(same.deltaMinor, 0);
  assert.equal(same.deltaFormatted, "$0.00");
});

test("non-integer minor units throw instead of rendering a rounded price", () => {
  assert.throws(
    () => computePriceDelta({ previousMinor: 42.18, currentMinor: 4692, currency: "USD" }),
    /integer minor units/,
  );
  assert.throws(
    () => computePriceDelta({ previousMinor: 4218, currentMinor: Number.NaN, currency: "USD" }),
    /finite/,
  );
});

test("toMinorUnits converts major units and absorbs representation error", () => {
  assert.equal(toMinorUnits(42.18), 4218);
  assert.equal(toMinorUnits(1234.56), 123456);
  assert.equal(toMinorUnits(0), 0);
  assert.equal(toMinorUnits(-10.5), -1050);
  assert.equal(toMinorUnits(Number.NaN), null);
  assert.equal(toMinorUnits(Number.POSITIVE_INFINITY), null);
});
