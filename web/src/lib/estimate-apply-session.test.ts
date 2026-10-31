import assert from "node:assert/strict";
import test from "node:test";
import { createEstimateApplySession, snapshotEstimateApply } from "./estimate-apply-session.ts";

function fixture() {
  const events: string[] = [];
  return {
    events,
    attempt: {
      snapshot: snapshotEstimateApply("project-a", "estimate-a", { lineItems: [{ quantity: 2, description: "Reviewed work" }] }),
      isCurrent: () => true,
      send: async () => "acknowledged",
      onPending: () => { events.push("pending"); },
      onSuccess: (response: string) => { events.push(response); },
      onError: (error: unknown) => { events.push(String(error)); },
    },
  };
}

test("snapshot retains primitive request bytes after its editor objects change", () => {
  const payload = { lineItems: [{ quantity: 2, description: "Reviewed work" }] };
  const snapshot = snapshotEstimateApply("project-a", "estimate-a", payload);
  payload.lineItems[0].quantity = 99;
  assert.equal(snapshot.body, '{"lineItems":[{"quantity":2,"description":"Reviewed work"}]}');
  assert.equal(Object.isFrozen(snapshot), true);
});

test("in-flight Apply locks synchronously and rejects duplicate entry", async () => {
  const { attempt, events } = fixture();
  const session = createEstimateApplySession<string>();
  let acknowledge!: (response: string) => void;
  let writes = 0;
  attempt.send = () => { writes++; return new Promise((resolve) => { acknowledge = resolve; }); };
  const first = session.apply(attempt);
  assert.equal(session.isLocked, true);
  assert.equal(await session.apply(attempt), false);
  assert.equal(writes, 1);
  acknowledge("acknowledged");
  assert.equal(await first, true);
  assert.equal(session.isLocked, false);
  assert.deepEqual(events, ["pending", "acknowledged"]);
});

test("unconfirmed Apply retains the identical body even if retry supplies changed editor data", async () => {
  const { attempt, events } = fixture();
  const session = createEstimateApplySession<string>();
  const bodies: string[] = [];
  const original = attempt.snapshot.body;
  attempt.send = async (snapshot?: { body: string }) => { bodies.push(snapshot!.body); throw new Error("Response lost"); };
  assert.equal(await session.apply(attempt), false);
  assert.equal(session.isLocked, true);
  assert.equal(bodies.length, 1); // no automatic retry
  attempt.snapshot = snapshotEstimateApply("project-a", "estimate-a", { lineItems: [{ quantity: 99 }] });
  attempt.send = async (snapshot?: { body: string }) => { bodies.push(snapshot!.body); return "acknowledged"; };
  assert.equal(await session.apply(attempt), true);
  assert.deepEqual(bodies, [original, original]);
  assert.equal(session.isLocked, false);
  assert.deepEqual(events, ["pending", "Error: Response lost", "pending", "acknowledged"]);
});

test("a retained request cannot be retried into a different Project or Estimate", async () => {
  const { attempt } = fixture();
  const session = createEstimateApplySession<string>();
  attempt.send = async () => { throw new Error("Response lost"); };
  await session.apply(attempt);
  let writes = 0;
  attempt.send = async () => { writes++; return "acknowledged"; };
  for (const [projectId, estimateId] of [["project-b", "estimate-a"], ["project-a", "estimate-b"]]) {
    attempt.snapshot = snapshotEstimateApply(projectId, estimateId, {});
    assert.equal(await session.apply(attempt), false);
  }
  assert.equal(writes, 0);
});

test("an obsolete initial entry never starts a write or changes UI", async () => {
  const { attempt, events } = fixture();
  let writes = 0;
  attempt.isCurrent = () => false;
  attempt.send = async () => { writes++; return "acknowledged"; };
  assert.equal(await createEstimateApplySession<string>().apply(attempt), false);
  assert.equal(writes, 0);
  assert.deepEqual(events, []);
});

for (const rejected of [false, true]) {
  test(`leaving the record suppresses a late ${rejected ? "failure" : "acknowledgement"}`, async () => {
    const { attempt, events } = fixture();
    const session = createEstimateApplySession<string>();
    let current = true;
    let finish!: () => void;
    attempt.isCurrent = () => current;
    attempt.send = () => new Promise((resolve, reject) => { finish = () => rejected ? reject(new Error("Late denial")) : resolve("late acknowledgement"); });
    const result = session.apply(attempt);
    current = false;
    finish();
    assert.equal(await result, false);
    assert.deepEqual(events, ["pending"]);
  });
}

test("an acknowledged review permits a new reviewed payload instead of replaying the previous one", async () => {
  const { attempt } = fixture();
  const session = createEstimateApplySession<string>();
  const bodies: string[] = [];
  attempt.send = async (snapshot?: { body: string }) => { bodies.push(snapshot!.body); return "acknowledged"; };
  await session.apply(attempt);
  const next = snapshotEstimateApply("project-a", "estimate-a", { lineItems: [{ quantity: 3 }] });
  attempt.snapshot = next;
  await session.apply(attempt);
  assert.notEqual(bodies[0], bodies[1]);
  assert.equal(bodies[1], next.body);
});
