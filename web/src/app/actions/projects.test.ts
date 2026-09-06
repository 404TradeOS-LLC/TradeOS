import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readProjectsActionsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "projects.ts"), "utf8");
}

function readActionSource(action: string): string {
  const source = readProjectsActionsSource();
  const start = source.indexOf(`export async function ${action}`);
  assert.notEqual(start, -1, `expected ${action} to exist`);
  const next = source.indexOf("export async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

function readCreateSiteVisitActionSource(): string {
  return readActionSource("createSiteVisitAction");
}

test("storage-mutating project actions require a server-side session before side effects", () => {
  for (const action of ["createSiteVisitAction", "uploadProjectDocumentAction", "deleteProjectFileAction"]) {
    const actionSource = readActionSource(action);
    assert.match(actionSource, /const token = await getSessionToken\(\);/);
    assert.match(actionSource, /if \(!token\)/);
    assert.ok(actionSource.indexOf("if (!token)") < actionSource.indexOf("storage"), `${action} must guard before storage access`);
  }
});

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

test("document upload proves project visibility before creating a storage object", () => {
  const source = readActionSource("uploadProjectDocumentAction");
  const preflightIndex = source.indexOf("apiFetch<ProjectFile[]>");
  const uploadIndex = source.indexOf("supabase.storage.from(bucket).upload");

  assert.notEqual(preflightIndex, -1, "expected tenant-scoped project-file preflight");
  assert.notEqual(uploadIndex, -1, "expected storage upload");
  assert.ok(preflightIndex < uploadIndex, "tenant/project visibility must be proven before Storage upload");
});

test("document upload only removes storage after authoritative reconciliation confirms no metadata row", () => {
  const source = readActionSource("uploadProjectDocumentAction");
  const catchIndex = source.indexOf("} catch (err) {");
  const catchSource = source.slice(catchIndex);
  const reconcileIndex = catchSource.indexOf("apiFetch<ProjectFile[]>");
  const confirmationIndex = catchSource.indexOf("confirmedUnpersisted = !projectFiles.some");
  const cleanupIndex = catchSource.indexOf("supabase.storage.from(bucket).remove([storagePath])");

  assert.notEqual(reconcileIndex, -1, "expected authoritative metadata reconciliation");
  assert.notEqual(confirmationIndex, -1, "expected explicit non-persistence confirmation");
  assert.notEqual(cleanupIndex, -1, "expected confirmed-orphan cleanup");
  assert.ok(reconcileIndex < confirmationIndex && confirmationIndex < cleanupIndex);
  assert.match(catchSource, /catch \{[\s\S]*preserve the object rather than[\s\S]*\}/);
});

test("project-file deletion resolves backend-owned metadata before destructive storage cleanup", () => {
  const source = readActionSource("deleteProjectFileAction");
  const metadataLookupIndex = source.indexOf("apiFetch<ProjectFile[]>");
  const metadataDeleteIndex = source.indexOf("method: \"DELETE\"");
  const storageRemoveIndex = source.indexOf("supabase.storage.from(bucket).remove");

  assert.doesNotMatch(source, /formData\.get\("storagePath"\)/, "storage path must never come from the submitted form");
  assert.notEqual(metadataLookupIndex, -1, "expected backend-owned file lookup");
  assert.notEqual(metadataDeleteIndex, -1, "expected backend authorization/delete");
  assert.notEqual(storageRemoveIndex, -1, "expected post-delete storage cleanup");
  assert.ok(metadataLookupIndex < metadataDeleteIndex, "file ownership must be resolved before metadata delete");
  assert.ok(metadataDeleteIndex < storageRemoveIndex, "backend authorization/delete must happen before Storage deletion");
  assert.match(source, /isGeneratedProjectFileStoragePath\(projectId, projectFile\.storagePath\)/);
});
