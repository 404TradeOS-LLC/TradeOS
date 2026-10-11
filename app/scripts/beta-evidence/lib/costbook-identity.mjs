import assert from "node:assert/strict";

// Validate the server-authenticated workspace identity without visiting the
// Settings read path, which may write legacy branding defaults. The read-only
// Costbook workspace DTO is scoped to the request's authenticated tenant.
export function assertCostbookEvidenceIdentity(workspace, expectedOrgId, expectedWrite) {
  assert.match(expectedOrgId ?? "", /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i, "Canonical smoke organization UUID required");
  assert.ok(["true", "false"].includes(expectedWrite), "Expected Costbook write permission must be explicitly true or false");
  assert.ok(workspace && typeof workspace === "object" && !Array.isArray(workspace), "Costbook workspace response is missing");
  assert.equal(workspace.organizationId, expectedOrgId, "Smoke identity belongs to a different organization");
  assert.equal(workspace.permissions?.canRead, true, "Smoke identity lacks Costbook read permission");
  assert.equal(workspace.permissions?.canWrite, expectedWrite === "true", "Smoke identity has the wrong Costbook write role");
  if (expectedWrite === "true") {
    assert.equal(workspace.permissions?.canManage, true, "Owner/admin smoke identity must have Costbook manage permission");
  } else {
    assert.equal(workspace.permissions?.canManage, false, "Read-only smoke identity must not have Costbook manage permission");
  }
}
