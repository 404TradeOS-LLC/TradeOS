import assert from "node:assert/strict";
import test from "node:test";
import { runFirstEstimateWorkflow, type FirstEstimateDependencies } from "./first-estimate-workflow.ts";

const projectId = "11111111-1111-4111-8111-111111111111";
const estimateId = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const calls: string[] = [];
  const form = new FormData();
  form.set("name", "Garage floor");
  form.set("simpleScope", "Remove worn coating and paint the garage floor.");
  const dependencies: FirstEstimateDependencies = {
    getSessionToken: async () => "session",
    canCreate: async () => true,
    createProject: async (_token, input) => { calls.push("project"); assert.equal(input.simpleScope, form.get("simpleScope")); return { id: projectId }; },
    getProject: async () => { calls.push("authorize-project"); return { id: projectId, estimates: [] }; },
    createEstimate: async () => { calls.push("estimate"); return { id: estimateId }; },
  };
  return { calls, form, dependencies };
}

test("creates a real project and draft destination", async () => {
  const { calls, form, dependencies } = fixture();
  const result = await runFirstEstimateWorkflow(undefined, form, dependencies);
  assert.deepEqual(calls, ["project", "estimate"]);
  assert.deepEqual(result, { projectId, destination: `/projects/${projectId}/estimates/${estimateId}` });
});

test("failed estimate resumes the saved workspace without repeating either POST", async () => {
  const { calls, form, dependencies } = fixture();
  dependencies.createEstimate = async () => { calls.push("estimate-failed"); throw new Error("offline"); };
  const failed = await runFirstEstimateWorkflow(undefined, form, dependencies);
  assert.equal(failed.projectId, projectId);
  assert.match(failed.error!, /project is saved/i);
  dependencies.createEstimate = async () => { calls.push("estimate-retry"); return { id: estimateId }; };
  const retried = await runFirstEstimateWorkflow(failed, form, dependencies);
  assert.equal(retried.destination, `/projects/${projectId}`);
  assert.deepEqual(calls, ["project", "estimate-failed", "authorize-project"]);
});

test("lost estimate response resumes persisted draft without duplicate estimate", async () => {
  const { calls, form, dependencies } = fixture();
  dependencies.getProject = async () => { calls.push("authorize-project"); return { id: projectId, estimates: [{ id: estimateId, status: "draft" }] }; };
  const result = await runFirstEstimateWorkflow({ projectId, error: "Previous request failed" }, form, dependencies);
  assert.equal(result.destination, `/projects/${projectId}/estimates/${estimateId}`);
  assert.deepEqual(calls, ["authorize-project"]);
});

test("foreign or deleted project fails closed and retains recovery reference", async () => {
  const { calls, form, dependencies } = fixture();
  dependencies.getProject = async () => { calls.push("denied"); throw new Error("404"); };
  const result = await runFirstEstimateWorkflow({ projectId }, form, dependencies);
  assert.equal(result.projectId, projectId);
  assert.equal(result.destination, undefined);
  assert.deepEqual(calls, ["denied"]);
});

test("missing authentication performs no reads or writes", async () => {
  const { calls, form, dependencies } = fixture();
  dependencies.getSessionToken = async () => null;
  const result = await runFirstEstimateWorkflow({ projectId }, form, dependencies);
  assert.match(result.error!, /sign in/i);
  assert.equal(result.projectId, projectId);
  assert.deepEqual(calls, []);
});

test("denied role or unavailable capability performs no creation or project reads", async () => {
  for (const fails of [false, true]) {
    const { calls, form, dependencies } = fixture();
    dependencies.canCreate = async () => { if (fails) throw new Error("unavailable"); return false; };
    const result = await runFirstEstimateWorkflow(undefined, form, dependencies);
    assert.ok(result.error);
    assert.deepEqual(calls, []);
  }
});

test("server validates scope and name before any creation", async () => {
  for (const field of ["name", "simpleScope"]) {
    const { calls, form, dependencies } = fixture();
    form.set(field, " ");
    const result = await runFirstEstimateWorkflow(undefined, form, dependencies);
    assert.ok(result.error);
    assert.deepEqual(calls, []);
  }
});

test("invalid recovery reference never silently starts a new project", async () => {
  const { calls, form, dependencies } = fixture();
  const result = await runFirstEstimateWorkflow({ projectId: "../foreign" }, form, dependencies);
  assert.ok(result.error);
  assert.deepEqual(calls, []);
});

test("completed project opens its workspace instead of creating a new revision", async () => {
  const { calls, form, dependencies } = fixture();
  dependencies.getProject = async () => ({ id: projectId, estimates: [{ id: estimateId, status: "ready" }] });
  const result = await runFirstEstimateWorkflow({ projectId }, form, dependencies);
  assert.equal(result.destination, `/projects/${projectId}`);
  assert.deepEqual(calls, []);
});
