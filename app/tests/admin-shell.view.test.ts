import { renderAdminPricingShell } from "../backend/views/adminShell.view";

describe("admin pricing shell", () => {
  it("renders pricing history and membership activity in the shared admin shell", () => {
    const html = renderAdminPricingShell({
      input: { orgId: "org-1", staleSinceDays: 30 },
      auth: { orgId: "org-1", role: "admin", email: "admin@example.com" },
      summary: { staleMaterialsCount: 4, staleMaterials: [] },
      priceHistory: [{
        id: "audit-1",
        orgId: "org-1",
        materialId: "material-1",
        materialName: "Ready Mix Concrete",
        oldUnitCost: 150,
        newUnitCost: 165,
        source: "manual",
        actorUserId: "admin-1",
        actorRole: "admin",
        createdAt: new Date("2026-06-24T12:00:00.000Z"),
      }],
      membershipActivity: [{
        id: "member-audit-1",
        orgId: "org-1",
        membershipId: "membership-1",
        userId: "user-1",
        action: "updated",
        actorUserId: "admin-1",
        actorRole: "admin",
        beforeState: null,
        afterState: null,
        createdAt: new Date("2026-06-24T12:00:00.000Z"),
      }],
    });

    expect(html).toContain("Pricing &amp; Audit");
    expect(html).toContain("Ready Mix Concrete");
    expect(html).toContain("$150.00");
    expect(html).toContain("$165.00");
    expect(html).toContain("Recent membership activity");
    expect(html).toContain("Stale materials");
  });
});
