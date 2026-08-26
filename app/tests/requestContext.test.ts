import { requireOrgAccess, requireOrgAdmin, requireRoles } from "../backend/requestContext";

describe("requestContext org guards", () => {
  it("rejects cross-organization member management", () => {
    const req = {
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "owner",
      },
    };

    expect(() => requireOrgAccess(req as never, "org-2")).toThrow("Cross-organization access is not allowed");
  });

  it("allows access within the authenticated organization", () => {
    const req = {
      auth: {
        userId: "user-1",
        orgId: "org-1",
        role: "admin",
      },
    };

    expect(requireOrgAccess(req as never, "org-1")).toMatchObject({
      userId: "user-1",
      orgId: "org-1",
      role: "admin",
    });
  });

  it("allows dispatcher admin access and blocks technicians from admin-only routes", () => {
    const dispatcherReq = {
      auth: {
        userId: "user-2",
        orgId: "org-1",
        role: "dispatcher",
      },
    };
    const technicianReq = {
      auth: {
        userId: "user-3",
        orgId: "org-1",
        role: "technician",
      },
    };

    expect(requireOrgAdmin(dispatcherReq as never)).toMatchObject({ role: "dispatcher" });
    expect(() => requireOrgAdmin(technicianReq as never)).toThrow("Admin access required");
    expect(requireRoles(technicianReq as never, ["owner", "dispatcher", "technician"])).toMatchObject({ role: "technician" });
  });
});
