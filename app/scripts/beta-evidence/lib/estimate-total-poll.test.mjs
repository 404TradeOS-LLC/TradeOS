import test from "node:test";
import assert from "node:assert/strict";
import { waitForEstimateTotal } from "./estimate-total-poll.mjs";

// Minimal page stand-in: evaluate returns the next scripted detail (or
// null for a failed fetch); waitForTimeout just counts sleeps.
function fakePage(totals) {
  const state = { calls: 0, sleeps: 0 };
  return {
    state,
    evaluate: async () => {
      const value = totals[Math.min(state.calls, totals.length - 1)];
      state.calls += 1;
      return value;
    },
    waitForTimeout: async () => {
      state.sleeps += 1;
    },
  };
}

test("returns immediately when the total already matches", async () => {
  const page = fakePage([{ totalPrice: 5920.89 }]);
  const detail = await waitForEstimateTotal(page, "e1", 5920.89);
  assert.equal(detail.totalPrice, 5920.89);
  assert.equal(page.state.calls, 1);
  assert.equal(page.state.sleeps, 0);
});

test("polls through stale totals until the expected total lands", async () => {
  const page = fakePage([{ totalPrice: 5100 }, { totalPrice: 5100 }, { totalPrice: 5920.89 }]);
  const detail = await waitForEstimateTotal(page, "e1", 5920.89);
  assert.equal(detail.totalPrice, 5920.89);
  assert.equal(page.state.calls, 3);
});

test("tolerates failed fetches instead of throwing", async () => {
  const page = fakePage([null, { totalPrice: 5920.89 }]);
  const detail = await waitForEstimateTotal(page, "e1", 5920.89);
  assert.equal(detail.totalPrice, 5920.89);
});

test("returns the last-seen detail when the timeout expires", async () => {
  const page = fakePage([{ totalPrice: 5100 }]);
  const detail = await waitForEstimateTotal(page, "e1", 5920.89, { timeoutMs: 50, intervalMs: 1 });
  assert.equal(detail.totalPrice, 5100);
  assert.ok(page.state.calls >= 1);
});
