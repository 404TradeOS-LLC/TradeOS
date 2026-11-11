import test from "node:test";
import assert from "node:assert/strict";
import { computePriceDelta, nextRecalculationSnapshot, toMinorUnits } from "./price-delta.ts";

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

test("nextRecalculationSnapshot snapshots the last server-confirmed total", () => {
  assert.deepEqual(
    nextRecalculationSnapshot({ currentTotalMinor: 469200, reason: "Line item updated", pending: null }),
    { previousTotalMinor: 469200, reason: "Line item updated" },
  );
  // After the refetch lands the total moved, so a later success snapshots
  // the new baseline.
  assert.deepEqual(
    nextRecalculationSnapshot({
      currentTotalMinor: 486000,
      reason: "Pricing mode applied",
      pending: { previousTotalMinor: 469200, reason: "Line item updated" },
    }),
    { previousTotalMinor: 486000, reason: "Pricing mode applied" },
  );
  assert.equal(
    nextRecalculationSnapshot({ currentTotalMinor: null, reason: "Line item updated", pending: null }),
    null,
  );
});

test("nextRecalculationSnapshot marks the baseline ambiguous when a second edit succeeds before the refetch", () => {
  // Two successes against the same pre-mutation total would both snapshot
  // that baseline; the pending delta is no longer tied to one edit, so the
  // baseline is marked ambiguous instead of cleared: clearing it to null
  // would let a third success re-snapshot the same baseline and
  // misattribute the combined change to that one edit. No per-edit delta
  // is shown until a clean single-edit snapshot exists.
  assert.deepEqual(
    nextRecalculationSnapshot({
      currentTotalMinor: 469200,
      reason: "Line item updated",
      pending: { previousTotalMinor: 469200, reason: "Line item removed" },
    }),
    { previousTotalMinor: 469200, reason: "Line item updated", ambiguous: true },
  );
});

test("nextRecalculationSnapshot preserves the ambiguous baseline for a third edit before the refetch", () => {
  // A third success against the same baseline must not re-snapshot it:
  // the combined change would then be attributed to the third edit alone.
  const ambiguous = { previousTotalMinor: 469200, reason: "Line item updated", ambiguous: true };
  assert.deepEqual(
    nextRecalculationSnapshot({
      currentTotalMinor: 469200,
      reason: "Line item added",
      pending: ambiguous,
    }),
    ambiguous,
  );
  // Once the refetch lands and the total moves, a later success snapshots
  // the new baseline normally.
  assert.deepEqual(
    nextRecalculationSnapshot({
      currentTotalMinor: 486000,
      reason: "Line item updated",
      pending: ambiguous,
    }),
    { previousTotalMinor: 486000, reason: "Line item updated" },
  );
});
