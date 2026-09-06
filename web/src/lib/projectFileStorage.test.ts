import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectFilePath, isGeneratedProjectFileStoragePath, isSafeProjectId } from "./projectFileStorage.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";

test("project storage paths require UUID project ids", () => {
  assert.equal(isSafeProjectId(PROJECT_ID), true);
  assert.equal(isSafeProjectId("../other-project"), false);
  assert.throws(() => buildProjectFilePath("../other-project", "scope.pdf"), /Invalid project id/);
});

test("project storage paths sanitize filenames and stay under the requested project", () => {
  const storagePath = buildProjectFilePath(PROJECT_ID, "../../proposal <final>.pdf");

  assert.ok(storagePath.startsWith(`${PROJECT_ID}/`));
  assert.doesNotMatch(storagePath, /\.\.\//);
  assert.equal(isGeneratedProjectFileStoragePath(PROJECT_ID, storagePath), true);
});

test("storage cleanup rejects paths for a different project", () => {
  const foreignPath = `${OTHER_PROJECT_ID}/33333333-3333-4333-8333-333333333333-scope.pdf`;

  assert.equal(isGeneratedProjectFileStoragePath(PROJECT_ID, foreignPath), false);
});

test("storage cleanup rejects ungenerated or malformed object names", () => {
  assert.equal(isGeneratedProjectFileStoragePath(PROJECT_ID, `${PROJECT_ID}/scope.pdf`), false);
  assert.equal(isGeneratedProjectFileStoragePath(PROJECT_ID, `${PROJECT_ID}/../scope.pdf`), false);
});
