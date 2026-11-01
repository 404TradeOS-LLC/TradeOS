import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// No jest/vitest/RTL harness exists for `web/`'s App Router pages (see
// page-header-consistency.test.ts for the established precedent), so these pin
// the *shape* of the project-edit wiring rather than rendering it. A staging
// acceptance test (2026-10-31) proved the project overview exposed no way to
// edit a project: the existing EditProjectForm was imported nowhere, so the
// update path (PATCH /api/v1/projects/:id via updateProjectAction) was
// unreachable from the UI. These tests fail if a future edit orphans the form
// again or drops the edit affordance from either project view.

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(HERE, relativePath), "utf8");
}

test("project edit page renders the existing EditProjectForm behind the shared PageHeader", () => {
  const source = readSource("edit/page.tsx");
  assert.match(source, /import\s*\{\s*EditProjectForm\s*\}\s*from\s*["']\.\.\/edit-form["']/, "must import EditProjectForm");
  assert.match(source, /<EditProjectForm\s+project=\{project\}\s*\/>/, "must render EditProjectForm for the loaded project");
  assert.match(
    source,
    /import\s*\{\s*PageHeader\s*\}\s*from\s*["']@\/components\/shared\/page-header["']/,
    "must use the shared PageHeader"
  );
  assert.match(source, /breadcrumbs=\{\[/, "PageHeader must carry breadcrumbs back to the project");
  assert.match(source, /href:\s*`\/projects\/\$\{project\.id\}`/, "breadcrumbs must link back to the project page");
});

test("lead overview exposes an Edit project link gated on canEditProject", () => {
  const source = readSource("../../../../components/projects/lead-overview.tsx");
  assert.match(source, /canEditProject:\s*boolean/, "LeadOverview must accept a canEditProject prop");
  assert.match(source, /\{canEditProject\s*\?/, "the edit link must be gated on canEditProject");
  assert.match(source, /href=\{`\/projects\/\$\{project\.id\}\/edit`\}/, "must link to the project edit page");
  assert.match(source, /Edit project/, "must label the link Edit project");
});

test("project detail page wires canEditProject into both views", () => {
  const source = readSource("page.tsx");
  assert.match(source, /canEditProject=\{canEditProject\}/, "must pass canEditProject to LeadOverview");
  assert.match(
    source,
    /href:\s*`\/projects\/\$\{project\.id\}\/edit`,\s*label:\s*"Edit project"/,
    "must add an Edit project action to the workspace header"
  );
});

test("EditProjectForm covers the core editable project fields", () => {
  const source = readSource("edit-form.tsx");
  for (const field of ["projectId", "name", "jobType", "siteAddress", "simpleScope"]) {
    assert.match(source, new RegExp(`name="${field}"`), `EditProjectForm must submit a ${field} field`);
  }
  assert.match(source, /updateProjectAction/, "EditProjectForm must submit through updateProjectAction");
});
