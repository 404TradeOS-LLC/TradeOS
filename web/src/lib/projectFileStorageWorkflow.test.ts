import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanupUploadedProjectFileAfterMetadataFailure,
  deleteAuthorizedProjectFileStorage,
} from "./projectFileStorage.ts";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const FILE_ID = "22222222-2222-4222-8222-222222222222";
const OBJECT_ID = "33333333-3333-4333-8333-333333333333";
const STORAGE_PATH = `${PROJECT_ID}/${OBJECT_ID}-scope.pdf`;

test("confirmed metadata persistence preserves an uploaded storage object", async () => {
  let removed = false;
  const result = await cleanupUploadedProjectFileAfterMetadataFailure({
    projectId: PROJECT_ID,
    storagePath: STORAGE_PATH,
    listProjectFiles: async () => [{ id: FILE_ID, storagePath: STORAGE_PATH }],
    removeStorage: async () => {
      removed = true;
    },
  });

  assert.deepEqual(result, { removed: false, reason: "persisted" });
  assert.equal(removed, false);
});

test("ambiguous reconciliation failure preserves an uploaded storage object", async () => {
  let removed = false;
  const result = await cleanupUploadedProjectFileAfterMetadataFailure({
    projectId: PROJECT_ID,
    storagePath: STORAGE_PATH,
    listProjectFiles: async () => {
      throw new Error("upstream response lost");
    },
    removeStorage: async () => {
      removed = true;
    },
  });

  assert.deepEqual(result, { removed: false, reason: "ambiguous" });
  assert.equal(removed, false);
});

test("an immediate empty metadata list remains ambiguous while create may still commit", async () => {
  const calls: string[] = [];
  const result = await cleanupUploadedProjectFileAfterMetadataFailure({
    projectId: PROJECT_ID,
    storagePath: STORAGE_PATH,
    listProjectFiles: async () => {
      calls.push("list");
      return [];
    },
    removeStorage: async (storagePath) => {
      calls.push(`remove:${storagePath}`);
    },
  });

  assert.deepEqual(result, { removed: false, reason: "ambiguous" });
  assert.deepEqual(calls, ["list"]);
});

test("missing authoritative file metadata blocks delete and storage side effects", async () => {
  const calls: string[] = [];
  await assert.rejects(
    deleteAuthorizedProjectFileStorage({
      projectId: PROJECT_ID,
      fileId: FILE_ID,
      listProjectFiles: async () => {
        calls.push("list");
        return [];
      },
      deleteMetadata: async () => {
        calls.push("delete");
      },
      removeStorage: async () => {
        calls.push("remove");
      },
    }),
    /Project file not found/
  );
  assert.deepEqual(calls, ["list"]);
});

test("unauthorized backend deletion blocks storage removal", async () => {
  const calls: string[] = [];
  await assert.rejects(
    deleteAuthorizedProjectFileStorage({
      projectId: PROJECT_ID,
      fileId: FILE_ID,
      listProjectFiles: async () => {
        calls.push("list");
        return [{ id: FILE_ID, storagePath: STORAGE_PATH }];
      },
      deleteMetadata: async () => {
        calls.push("delete");
        throw new Error("forbidden");
      },
      removeStorage: async () => {
        calls.push("remove");
      },
    }),
    /forbidden/
  );
  assert.deepEqual(calls, ["list", "delete"]);
});

test("successful deletion authorizes metadata before storage cleanup", async () => {
  const calls: string[] = [];
  const result = await deleteAuthorizedProjectFileStorage({
    projectId: PROJECT_ID,
    fileId: FILE_ID,
    listProjectFiles: async () => {
      calls.push("list");
      return [{ id: FILE_ID, storagePath: STORAGE_PATH }];
    },
    deleteMetadata: async () => {
      calls.push("delete");
    },
    removeStorage: async (storagePath) => {
      calls.push(`remove:${storagePath}`);
    },
  });

  assert.deepEqual(result, { removed: true, reason: "removed" });
  assert.deepEqual(calls, ["list", "delete", `remove:${STORAGE_PATH}`]);
});

test("cleanup failure is surfaced to the caller instead of reporting storage removal", async () => {
  const result = await deleteAuthorizedProjectFileStorage({
    projectId: PROJECT_ID,
    fileId: FILE_ID,
    listProjectFiles: async () => [{ id: FILE_ID, storagePath: STORAGE_PATH }],
    deleteMetadata: async () => {},
    removeStorage: async () => {
      throw new Error("storage unavailable");
    },
  });

  assert.deepEqual(result, { removed: false, reason: "cleanup-failed" });
});

test("unexpected storage path is never removed after authorized metadata deletion", async () => {
  const calls: string[] = [];
  const result = await deleteAuthorizedProjectFileStorage({
    projectId: PROJECT_ID,
    fileId: FILE_ID,
    listProjectFiles: async () => [{ id: FILE_ID, storagePath: "other/project.pdf" }],
    deleteMetadata: async () => {
      calls.push("delete");
    },
    removeStorage: async () => {
      calls.push("remove");
    },
  });

  assert.deepEqual(result, { removed: false, reason: "unexpected-path" });
  assert.deepEqual(calls, ["delete"]);
});
