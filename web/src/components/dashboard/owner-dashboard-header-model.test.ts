import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewQueueMetrics,
  createGreetingSubscription,
  getNextGreetingBoundary,
  greetingForHour,
} from "./owner-dashboard-header-model.ts";

test("greetingForHour returns the right greeting for each part of the day", () => {
  assert.equal(greetingForHour(0), "Good night");
  assert.equal(greetingForHour(4), "Good night");
  assert.equal(greetingForHour(5), "Good morning");
  assert.equal(greetingForHour(11), "Good morning");
  assert.equal(greetingForHour(12), "Good afternoon");
  assert.equal(greetingForHour(17), "Good afternoon");
  assert.equal(greetingForHour(18), "Good evening");
  assert.equal(greetingForHour(23), "Good evening");
});

test("buildReviewQueueMetrics returns an empty list when there is no queue data", () => {
  assert.deepEqual(buildReviewQueueMetrics(undefined), []);
});

test("buildReviewQueueMetrics drops zero-count queues", () => {
  const metrics = buildReviewQueueMetrics({ estimates: 0, proposals: 0, invoices: 0, starts: 0 });
  assert.deepEqual(metrics, []);
});

test("buildReviewQueueMetrics singularizes a count of exactly one", () => {
  const metrics = buildReviewQueueMetrics({ estimates: 1, proposals: 0, invoices: 0, starts: 0 });
  assert.deepEqual(metrics, [{ key: "estimates", value: 1, label: "estimate" }]);
});

test("buildReviewQueueMetrics pluralizes counts above one and preserves queue order", () => {
  const metrics = buildReviewQueueMetrics({ estimates: 3, proposals: 1, invoices: 2, starts: 5 });
  assert.deepEqual(metrics, [
    { key: "estimates", value: 3, label: "estimates" },
    { key: "proposals", value: 1, label: "proposal" },
    { key: "invoices", value: 2, label: "invoices" },
    { key: "starts", value: 5, label: "ready to start" },
  ]);
});

test("getNextGreetingBoundary finds the next same-day boundary when one remains", () => {
  assert.deepEqual(getNextGreetingBoundary(new Date(2026, 7, 19, 6, 30, 0)), new Date(2026, 7, 19, 12, 0, 0));
  assert.deepEqual(getNextGreetingBoundary(new Date(2026, 7, 19, 0, 0, 0)), new Date(2026, 7, 19, 5, 0, 0));
  assert.deepEqual(getNextGreetingBoundary(new Date(2026, 7, 19, 13, 59, 59)), new Date(2026, 7, 19, 18, 0, 0));
});

test("getNextGreetingBoundary rolls over to midnight the next day once past the last same-day boundary", () => {
  assert.deepEqual(getNextGreetingBoundary(new Date(2026, 7, 19, 18, 0, 0)), new Date(2026, 7, 20, 0, 0, 0));
  assert.deepEqual(getNextGreetingBoundary(new Date(2026, 7, 19, 23, 59, 59)), new Date(2026, 7, 20, 0, 0, 0));
});

test("createGreetingSubscription notifies at each greeting boundary and stops after unsubscribe", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: new Date(2026, 7, 19, 11, 59, 0).getTime() });

  let calls = 0;
  const unsubscribe = createGreetingSubscription(() => {
    calls++;
  });

  assert.equal(calls, 0, "no notification before the next boundary is reached");

  t.mock.timers.tick(60_000);
  assert.equal(calls, 1, "notifies exactly at the 12:00 morning->afternoon boundary");

  t.mock.timers.tick(6 * 60 * 60 * 1000);
  assert.equal(calls, 2, "reschedules and notifies again at the following 18:00 boundary");

  unsubscribe();
  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(calls, 2, "no further notifications once unsubscribed");
});

test("createGreetingSubscription does not re-arm when unsubscribe happens during a boundary callback", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: new Date(2026, 7, 19, 11, 59, 0).getTime() });

  let calls = 0;
  let unsubscribe = () => {};
  unsubscribe = createGreetingSubscription(() => {
    calls++;
    unsubscribe();
  });

  t.mock.timers.tick(60_000);
  assert.equal(calls, 1, "the boundary callback runs once before unsubscribing itself");

  t.mock.timers.tick(24 * 60 * 60 * 1000);
  assert.equal(calls, 1, "cleanup during the callback prevents any replacement timer from being scheduled");
});
