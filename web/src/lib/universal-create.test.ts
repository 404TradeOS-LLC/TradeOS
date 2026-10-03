import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectIntentDestination,
  buildUniversalCreateHref,
  extractProjectIdFromPath,
  resolveNewProjectCreateIntent,
  resolveProjectCreateIntent,
} from "./universal-create.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

test("extractProjectIdFromPath only accepts real project UUID paths", () => {
  assert.equal(extractProjectIdFromPath(`/projects/${PROJECT_ID}/estimates`), PROJECT_ID);
  assert.equal(extractProjectIdFromPath("/projects/new"), null);
  assert.equal(extractProjectIdFromPath("/customers/123"), null);
});

test("project create intents preserve the selected project", () => {
  assert.equal(buildProjectIntentDestination(PROJECT_ID, "job"), `/projects/${PROJECT_ID}/jobs/new`);
  assert.equal(buildProjectIntentDestination(PROJECT_ID, "invoice"), `/projects/${PROJECT_ID}/invoices/new`);
  assert.equal(buildProjectIntentDestination(PROJECT_ID, "change-order"), `/projects/${PROJECT_ID}?tab=change-orders`);
});

test("universal create falls back to project selection when context is absent", () => {
  assert.equal(buildUniversalCreateHref("job", "/dashboard"), "/projects?intent=job");
  assert.equal(buildUniversalCreateHref("invoice", "/dashboard"), "/projects?intent=invoice");
  assert.equal(buildUniversalCreateHref("change-order", "/dashboard"), "/projects?intent=change-order");
});

test("Athena create preserves current page and project context", () => {
  const href = buildUniversalCreateHref("athena", `/projects/${PROJECT_ID}`);
  assert.match(href, /^\/athena\?/);
  assert.match(href, /projectId=11111111-1111-4111-8111-111111111111/);
  assert.match(href, /page=%2Fprojects%2F11111111-1111-4111-8111-111111111111/);
});

test("new-project continuation preserves estimate and job intent only", () => {
  assert.equal(resolveNewProjectCreateIntent("estimate"), "estimate");
  assert.equal(resolveNewProjectCreateIntent("job"), "job");
  assert.equal(resolveNewProjectCreateIntent("invoice"), null);
  assert.equal(resolveNewProjectCreateIntent("change-order"), null);
  assert.equal(resolveNewProjectCreateIntent("unknown"), null);
});

test("unknown project intent is rejected", () => {
  assert.equal(resolveProjectCreateIntent("job"), "job");
  assert.equal(resolveProjectCreateIntent("delete"), null);
});
