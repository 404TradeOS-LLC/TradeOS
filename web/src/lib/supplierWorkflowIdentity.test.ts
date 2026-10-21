import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupplierWorkflowIdentity } from "./supplierWorkflowIdentity.ts";
import type { OrganizationSettingsResponse } from "./settings";

const orgId = "00f00aaa-1234-4234-a123-123456789abc";
const userId = "11f00aaa-1234-4234-a123-123456789abc";
const otherId = "33f00aaa-1234-4234-a123-123456789abc";

function settings(overrides: Partial<OrganizationSettingsResponse> = {}): OrganizationSettingsResponse {
  return {
    orgId, currentUserId: userId, settings: {}, updatedAt: null,
    currentRole: "owner", canManageWorkspace: true,
    roleProfiles: [],
    teamMembers: [{
      membershipId: "22f00aaa-1234-4234-a123-123456789abc",
      userId, fullName: "Owner", email: "owner@example.test",
      role: "owner", status: "active", createdAt: "", updatedAt: "",
    }],
    ...overrides,
  };
}

test("copies the backend-authenticated AppUser ID, not the membership ID", () => {
  assert.deepEqual(resolveSupplierWorkflowIdentity(settings()), { orgId, userId });
});

test("works even when the user's stored email changed", () => {
  const member = { ...settings().teamMembers[0], email: "old-address@example.test" };
  assert.deepEqual(resolveSupplierWorkflowIdentity(settings({ teamMembers: [member] })), { orgId, userId });
});

test("refuses absent/mismatched identities, non-admin roles, and inactive memberships", () => {
  assert.equal(resolveSupplierWorkflowIdentity(settings({ currentUserId: undefined })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ currentUserId: otherId })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ currentUserId: "invalid" })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ orgId: "not-a-uuid" })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ canManageWorkspace: false })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ currentRole: "technician" })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ teamMembers: [{ ...settings().teamMembers[0], role: "technician" }] })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ teamMembers: [{ ...settings().teamMembers[0], status: "disabled" }] })), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ teamMembers: [settings().teamMembers[0], { ...settings().teamMembers[0] }] })), null);
});
