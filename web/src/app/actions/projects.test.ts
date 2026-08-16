import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readProjectsActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "projects.ts"), "utf8");
}

function readCreateSiteVisitActionSource(): string {
  const source = readProjectsActionsSource();
  const start = source.indexOf("export async function createSiteVisitAction");
  const end = source.indexOf("export async function uploadProjectDocumentAction");
  assert.notEqual(start, -1, "expected createSiteVisitAction to exist");
  assert.notEqual(end, -1, "expected uploadProjectDocumentAction to follow createSiteVisitAction");
  return source.slice(start, end);
}

test("site-photo intake tracks persisted metadata ids so partial writes can be compensated", () => {
  const source = readCreateSiteVisitActionSource();

  assert.match(source, /const persistedPhotoFiles: Array<\{ id: string; path: string \}> = \[\]/);
  assert.match(source, /apiFetch<ProjectFile>\(`\/api\/v1\/projects\/\$\{projectId\}\/files`/);
  assert.match(source, /persistedPhotoFiles\.push\(\{ id: persistedFile\.id, path: entry\.path \}\)/);
});

test("site-photo intake deletes persisted metadata before removing its storage object", () => {
  const source = readCreateSiteVisitActionSource();
  const catchIndex = source.indexOf("} catch (err) {");
  assert.notEqual(catchIndex, -1, "expected a failure compensation block");

  const catchSource = source.slice(catchIndex);
  const metadataDeleteIndex = catchSource.indexOf("method: \"DELETE\"");
  const storageRemoveIndex = catchSource.indexOf("supabase.storage.from(bucket).remove");

  assert.notEqual(metadataDeleteIndex, -1, "expected metadata compensation delete");
  assert.notEqual(storageRemoveIndex, -1, "expected storage cleanup");
  assert.ok(metadataDeleteIndex < storageRemoveIndex, "metadata must be compensated before its storage object is removed");
});

test("site-photo intake preserves storage when metadata compensation fails", () => {
  const source = readCreateSiteVisitActionSource();
  assert.match(source, /storagePathsToRemove\.delete\(persistedFile\.path\)/);
});

test("cleanup failures cannot replace the original intake error", () => {
  const source = readCreateSiteVisitActionSource();
  const catchIndex = source.indexOf("} catch (err) {");
  const catchSource = source.slice(catchIndex);

  assert.match(catchSource, /try \{[\s\S]*supabase\.storage\.from\(bucket\)\.remove\(\[\.\.\.storagePathsToRemove\]\)[\s\S]*\} catch \{/);
  assert.match(catchSource, /return \{ error: err instanceof ApiClientError \? err\.message : \"Something went wrong\.\" \}/);
});
