import test from "node:test";
import assert from "node:assert/strict";
import { mapLifecycleStates, markerGeometry } from "./lifecycle.ts";

const STAGES = ["lead", "estimate", "proposal", "job", "invoice", "paid"] as const;

test("blocked and changed stay explicit over completed and current", () => {
  const states = mapLifecycleStates(STAGES, {
    current: "job",
    completed: ["lead", "estimate", "proposal"],
    blocked: ["invoice"],
    changed: ["estimate"],
  });
  assert.equal(states.lead, "completed");
  assert.equal(states.estimate, "changed");
  assert.equal(states.proposal, "completed");
  assert.equal(states.job, "current");
  assert.equal(states.invoice, "blocked");
  assert.equal(states.paid, "upcoming");
});

test("nothing current and nothing completed leaves every stage upcoming", () => {
  const states = mapLifecycleStates(STAGES, { current: null, completed: [] });
  for (const stage of STAGES) assert.equal(states[stage], "upcoming");
});

test("estimate workflow stages map the same way", () => {
  const stages = ["scope", "items", "price", "review"] as const;
  const states = mapLifecycleStates(stages, { current: "price", completed: ["scope", "items"] });
  assert.deepEqual(states, {
    scope: "completed",
    items: "completed",
    price: "current",
    review: "upcoming",
  });
});

test("marker geometry is the segment box relative to the track", () => {
  assert.deepEqual(
    markerGeometry({ left: 120, width: 80 }, { left: 20, width: 400 }),
    { left: 100, width: 80 },
  );
});

test("unmeasured boxes keep the previous geometry instead of jumping to zero", () => {
  assert.equal(markerGeometry({ left: 0, width: 0 }, { left: 20, width: 400 }), null);
  assert.equal(markerGeometry({ left: 120, width: 80 }, { left: 20, width: 0 }), null);
});
