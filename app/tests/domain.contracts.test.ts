import { hasAnyPermission, hasPermission } from "../domain";

// This exact permission triple is what backend/requestContext.ts's
// requireOrgAdmin() checks (team.manage / company.manage / settings.manage),
// and it's now also the gate the Brand Studio asset-upload server action
// (web/src/app/actions/settings.ts) mirrors on the frontend before writing to
// Supabase Storage. No test exercised hasAnyPermission with this specific
// triple before this file existed.
const orgAdminPermissions = ["team.manage", "company.manage", "settings.manage"] as const;

describe("hasAnyPermission", () => {
  it("grants owner and admin the team.manage/company.manage/settings.manage triple", () => {
    expect(hasAnyPermission("owner", orgAdminPermissions)).toBe(true);
    expect(hasAnyPermission("admin", orgAdminPermissions)).toBe(true);
  });

  it("denies technician, the least-privileged canonical role, that same triple", () => {
    expect(hasAnyPermission("technician", orgAdminPermissions)).toBe(false);
  });

  it("grants legacy roles that map to one of the permissions (dispatcher, estimator)", () => {
    expect(hasAnyPermission("dispatcher", orgAdminPermissions)).toBe(true);
    expect(hasAnyPermission("estimator", orgAdminPermissions)).toBe(true);
  });

  it("denies the legacy viewer role, which has none of the three permissions", () => {
    expect(hasAnyPermission("viewer", orgAdminPermissions)).toBe(false);
  });

  it("falls back to technician-level access (denied) for an unrecognized role string", () => {
    expect(hasAnyPermission("not-a-real-role", orgAdminPermissions)).toBe(false);
  });

  it("returns true as soon as any single permission in the list is granted", () => {
    // technician only has crm.read/billing.read/notes.write/activity.read,
    // but settings.manage is not one of them -- mixing in a permission it
    // does have (crm.read) should still short-circuit to true.
    expect(hasAnyPermission("technician", ["settings.manage", "crm.read"])).toBe(true);
  });

  it("agrees with hasPermission for each permission in the triple, for every supported role", () => {
    const roles = ["owner", "admin", "dispatcher", "technician", "estimator", "viewer"] as const;
    for (const role of roles) {
      const expected = orgAdminPermissions.some((permission) => hasPermission(role, permission));
      expect(hasAnyPermission(role, orgAdminPermissions)).toBe(expected);
    }
  });
});

describe("Costbook permissions", () => {
  it("grants owner and admin full Costbook access", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(hasPermission(role, "costbook.read")).toBe(true);
      expect(hasPermission(role, "costbook.write")).toBe(true);
      expect(hasPermission(role, "costbook.manage")).toBe(true);
    }
  });

  it("grants dispatcher, technician, and legacy estimator read-only Costbook access", () => {
    for (const role of ["dispatcher", "technician", "estimator"] as const) {
      expect(hasPermission(role, "costbook.read")).toBe(true);
      expect(hasPermission(role, "costbook.write")).toBe(false);
      expect(hasPermission(role, "costbook.manage")).toBe(false);
    }
  });

  it("denies Costbook access to legacy viewers", () => {
    for (const role of ["viewer"] as const) {
      expect(hasPermission(role, "costbook.read")).toBe(false);
      expect(hasPermission(role, "costbook.write")).toBe(false);
      expect(hasPermission(role, "costbook.manage")).toBe(false);
    }
  });
});
