import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { canUpdateTodayTask, updateTodayTaskStatus } from "./today-task-actions.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const target = { projectId: "project-1", taskId: "task-1", status: "blocked" as const, updatedAt: "2026-10-26T12:00:00.000Z" };

test("task controls follow established write permissions rather than presentation", () => {
  for (const role of ["owner", "admin", "dispatcher", "estimator"]) assert.equal(canUpdateTodayTask(role), true);
  for (const role of ["technician", "viewer", "unknown"]) assert.equal(canUpdateTodayTask(role), false);
});
test("status save uses the authenticated proxy and accepts only the confirmed source record", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ id: target.taskId, projectId: target.projectId, status: "completed" });
  };
  const result = await updateTodayTaskStatus(target, "completed");
  assert.equal(result.status, "completed");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/proxy/projects/project-1/tasks/task-1/status");
  assert.equal(calls[0].init?.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { status: "completed", expectedUpdatedAt: target.updatedAt });
});
test("failed authorization, conflicts and outages are not successful resolutions or retried writes", async () => {
  for (const status of [403, 409, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: "Save rejected" }, { status }); };
    await assert.rejects(updateTodayTaskStatus(target, "completed"), /Save rejected/);
    assert.equal(calls, 1);
  }
});
test("wrong or unconfirmed server records cannot produce success", async () => {
  for (const body of [null, {}, { id: "other", projectId: target.projectId, status: "completed" }, { id: target.taskId, projectId: "other", status: "completed" }, { id: target.taskId, projectId: target.projectId, status: "blocked" }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(updateTodayTaskStatus(target, "completed"), /could not be confirmed/i);
  }
});
test("invalid status is rejected before any write and route IDs stay encoded", async () => {
  let calls = 0;
  globalThis.fetch = async url => { calls++; assert.equal(String(url), "/api/proxy/projects/project%2F1/tasks/task%3F1/status"); return Response.json({ id: "task?1", projectId: "project/1", status: "todo" }); };
  await assert.rejects(updateTodayTaskStatus(target, "approved" as never), /Unsupported task status/);
  assert.equal(calls, 0);
  await updateTodayTaskStatus({ ...target, projectId: "project/1", taskId: "task?1" }, "todo");
  assert.equal(calls, 1);
});


test("missing or invalid task revisions cannot silently downgrade to an unguarded write", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  for (const updatedAt of [undefined, "", "invalid"]) {
    await assert.rejects(updateTodayTaskStatus({ ...target, updatedAt: updatedAt as string }, "completed"), /revision is unavailable/);
  }
  assert.equal(calls, 0);
});


test("personal field saves use the narrow Job endpoint and verify the linked Job", async () => {
  const field = { ...target, access: "assigned-field" as const, jobId: "job-a" };
  assert.equal(canUpdateTodayTask("technician", field), true);
  assert.equal(canUpdateTodayTask("viewer", field), false);
  let requests = 0;
  globalThis.fetch = async (url, init) => {
    requests++; assert.equal(String(url), "/api/proxy/jobs/job-a/tasks/task-1/status");
    assert.deepEqual(JSON.parse(String(init?.body)), { status: "completed", expectedUpdatedAt: target.updatedAt });
    return Response.json({ id: target.taskId, projectId: target.projectId, jobId: "job-a", status: "completed" });
  };
  await updateTodayTaskStatus(field, "completed"); assert.equal(requests, 1);
  globalThis.fetch = async () => Response.json({ id: target.taskId, projectId: target.projectId, jobId: "other", status: "completed" });
  await assert.rejects(updateTodayTaskStatus(field, "completed"), /could not be confirmed/);
});
