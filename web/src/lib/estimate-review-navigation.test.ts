import assert from "node:assert/strict";
import test from "node:test";
import { createEstimateReviewNavigator, savedScopeForEstimateReview } from "./estimate-review-navigation.ts";

function fixture() {
  const events: string[] = [];
  return {
    events,
    request: {
      scope: "  Current deck scope  ",
      persistedScope: "Earlier deck scope",
      isDraft: true,
      saveScope: async (scope: string) => { events.push(`save:${scope}`); },
      navigate: () => { events.push("navigate"); },
      onPendingChange: (value: boolean) => { events.push(`pending:${value}`); },
      isCurrent: () => true,
    },
  };
}

test("dirty scope is acknowledged before navigation, with one in-flight entry", async () => {
  const { events, request } = fixture();
  let acknowledge!: () => void;
  request.saveScope = (scope) => {
    events.push(`save:${scope}`);
    return new Promise<void>((resolve) => { acknowledge = resolve; });
  };
  const open = createEstimateReviewNavigator();
  const first = open(request);
  assert.deepEqual(events, ["pending:true", "save:Current deck scope"]);
  assert.equal(await open(request), false);
  assert.deepEqual(events, ["pending:true", "save:Current deck scope"]);
  acknowledge();
  assert.equal(await first, true);
  assert.deepEqual(events, ["pending:true", "save:Current deck scope", "navigate", "pending:false"]);
});

test("failed scope save never navigates and permits an explicit later retry", async () => {
  const { events, request } = fixture();
  const originalScope = request.scope;
  request.saveScope = async () => { throw new Error("Save denied"); };
  const open = createEstimateReviewNavigator();
  assert.equal(await open(request), false);
  assert.deepEqual(events, ["pending:true", "pending:false"]);
  assert.equal(request.scope, originalScope);
  request.saveScope = async (scope) => { events.push(`save:${scope}`); };
  assert.equal(await open(request), true);
  assert.deepEqual(events.slice(2), ["pending:true", "save:Current deck scope", "navigate", "pending:false"]);
});

test("unchanged normalized scope opens review without a Project write", async () => {
  const { events, request } = fixture();
  request.persistedScope = "Current deck scope";
  assert.equal(await createEstimateReviewNavigator()(request), true);
  assert.deepEqual(events, ["pending:true", "navigate", "pending:false"]);
});

test("finalized estimate navigation does not write Project scope", async () => {
  const { events, request } = fixture();
  request.isDraft = false;
  assert.equal(await createEstimateReviewNavigator()(request), true);
  assert.deepEqual(events, ["pending:true", "navigate", "pending:false"]);
});

test("an obsolete entry does not save or navigate", async () => {
  const { events, request } = fixture();
  request.isCurrent = () => false;
  assert.equal(await createEstimateReviewNavigator()(request), false);
  assert.deepEqual(events, []);
});

test("leaving the record while saving suppresses late navigation", async () => {
  const { events, request } = fixture();
  let current = true;
  request.isCurrent = () => current;
  request.saveScope = async (scope) => { events.push(`save:${scope}`); current = false; };
  assert.equal(await createEstimateReviewNavigator()(request), false);
  assert.deepEqual(events, ["pending:true", "save:Current deck scope", "pending:false"]);
});

const project = {
  id: "project-a",
  simpleScope: "Saved Project scope",
  estimates: [{ id: "estimate-a", projectId: "project-a" }],
};

test("full review receives saved scope only from the matching Project/Estimate pair", () => {
  assert.equal(savedScopeForEstimateReview(project, "project-a", "estimate-a"), "Saved Project scope");
});

test("a genuinely empty saved scope stays empty without inventing a fixture", () => {
  assert.equal(savedScopeForEstimateReview({ ...project, simpleScope: null }, "project-a", "estimate-a"), "");
});

test("a different Project, unknown Estimate or mismatched Estimate parent fails closed", () => {
  assert.equal(savedScopeForEstimateReview(project, "project-b", "estimate-a"), null);
  assert.equal(savedScopeForEstimateReview(project, "project-a", "estimate-b"), null);
  assert.equal(savedScopeForEstimateReview({ ...project, estimates: [{ id: "estimate-a", projectId: "project-b" }] }, "project-a", "estimate-a"), null);
});
