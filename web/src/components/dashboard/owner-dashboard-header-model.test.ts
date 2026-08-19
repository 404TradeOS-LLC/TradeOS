import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewQueueMetrics, greetingForHour } from "./owner-dashboard-header-model.ts";

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
