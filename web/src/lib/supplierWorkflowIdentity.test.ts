import assert from "node:assert/strict";
import test from "node:test";
import { resolveSupplierWorkflowIdentity } from "./supplierWorkflowIdentity.ts";
import type { OrganizationSettingsResponse } from "./settings";

const orgId = "00f00aaa-1234-4234-a123-123456789abc";
const userId = "11f00aaa-1234-4234-a123-123456789abc";

function settings(overrides: Partial<OrganizationSettingsResponse> = {}): OrganizationSettingsResponse {
  return {
    orgId, settings: {}, updatedAt: null, currentRole: "owner", canManageWorkspace: true,
    roleProfiles: [],
    teamMembers: [{
      membershipId: "22f00aaa-1234-4234-a123-123456789abc",
      userId, fullName: "Owner", email: "owner@example.test",
      role: "owner", status: "active", createdAt: "", updatedAt: "",
    }],
    ...overrides,
  };
}

test("copies org and application user ID, not membership ID", () => {
  assert.deepEqual(resolveSupplierWorkflowIdentity(settings(), " OWNER@example.test "), { orgId, userId });
});

test("refuses non-admin, inactive, mismatched, missing and ambiguous identities", () => {
  assert.equal(resolveSupplierWorkflowIdentity(settings(), "other@example.test"), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ canManageWorkspace: false }), "owner@example.test"), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ currentRole: "technician" }), "owner@example.test"), null);
  const inactive = { ...settings().teamMembers[0], status: "disabled" };
  assert.equal(resolveSupplierWorkflowIdentity(settings({ teamMembers: [inactive] }), "owner@example.test"), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ teamMembers: [settings().teamMembers[0], { ...settings().teamMembers[0] }] }), "owner@example.test"), null);
  assert.equal(resolveSupplierWorkflowIdentity(settings({ orgId: "not-a-uuid" }), "owner@example.test"), null);
});
