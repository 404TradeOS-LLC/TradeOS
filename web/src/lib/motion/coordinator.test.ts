import test from "node:test";
import assert from "node:assert/strict";
import { createMotionCoordinator, type MotionRequestKey } from "./coordinator.ts";

const key = (overrides: Partial<MotionRequestKey> = {}): MotionRequestKey => ({
  orgId: "org-1",
  entity: "estimate:est-1",
  requestId: "req-1",
  revision: 1,
  ...overrides,
});

test("starting a newer request aborts the previous signal for the same entity", () => {
  const coordinator = createMotionCoordinator();
  const first = coordinator.start(key());
  assert.equal(first.accepted, true);
  assert.equal(first.signal.aborted, false);
  const second = coordinator.start(key({ requestId: "req-2", revision: 2 }));
  assert.equal(second.accepted, true);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
});

test("starting an older revision is refused and keeps the newer request current", () => {
  const coordinator = createMotionCoordinator();
  coordinator.start(key({ revision: 3 }));
  const stale = coordinator.start(key({ requestId: "req-old", revision: 2 }));
  assert.equal(stale.accepted, false);
  assert.equal(stale.signal.aborted, true);
  assert.equal(coordinator.isLatest(key({ revision: 3 })), true);
  assert.equal(coordinator.isLatest(key({ revision: 2 })), false);
});

test("acceptEvent deduplicates repeats and rejects stale arrivals", () => {
  const coordinator = createMotionCoordinator();
  coordinator.start(key());
  assert.equal(coordinator.acceptEvent(key()), true);
  assert.equal(coordinator.acceptEvent(key()), false);
  coordinator.start(key({ requestId: "req-2", revision: 2 }));
  assert.equal(coordinator.acceptEvent(key()), false);
  assert.equal(coordinator.acceptEvent(key({ requestId: "req-2", revision: 2 })), true);
});

test("entities and organizations are independent", () => {
  const coordinator = createMotionCoordinator();
  const first = coordinator.start(key());
  const other = coordinator.start(key({ entity: "job:job-9" }));
  assert.equal(first.signal.aborted, false);
  assert.equal(other.accepted, true);
  const otherOrg = coordinator.start(key({ orgId: "org-2" }));
  assert.equal(first.signal.aborted, false);
  assert.equal(otherOrg.accepted, true);
});

test("cancel aborts the current request and clears latest", () => {
  const coordinator = createMotionCoordinator();
  const started = coordinator.start(key());
  coordinator.cancel("org-1", "estimate:est-1");
  assert.equal(started.signal.aborted, true);
  assert.equal(coordinator.isLatest(key()), false);
});
