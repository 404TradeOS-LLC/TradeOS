import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectFileAccessUrl } from "./project-file-access.ts";

test("storage-backed project files use the authenticated same-origin proxy", () => {
  const accessUrl = buildProjectFileAccessUrl("project/one", {
    id: "file two",
    fileUrl: "https://storage.example/storage/v1/object/authenticated/project-files/private.pdf",
    storagePath: "projects/project-one/private.pdf",
  });

  assert.equal(accessUrl, "/api/project-files/project%2Fone/file%20two");
  assert.doesNotMatch(accessUrl, /storage\.example|authenticated\/project-files/);
});

test("legacy files without managed storage metadata preserve their saved URL", () => {
  const fileUrl = "https://legacy.example/customer-document.pdf";
  assert.equal(
    buildProjectFileAccessUrl("project-one", {
      id: "legacy-file",
      fileUrl,
      storagePath: null,
    }),
    fileUrl
  );
});
