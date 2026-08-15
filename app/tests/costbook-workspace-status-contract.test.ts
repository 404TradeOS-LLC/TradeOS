import { CostbookService } from "../modules/costbook/service";

describe("Costbook workspace area status contract", () => {
  it("distinguishes existing catalogs from foundation-only pricing surfaces", async () => {
    const repository = {
      getWorkspace: jest.fn().mockResolvedValue(null),
      getInventoryCounts: jest.fn().mockResolvedValue({
        categories: 0,
        costItems: 0,
        laborRates: 0,
        materials: 0,
        equipment: 0,
        assemblies: 0,
      }),
    };

    const summary = await new CostbookService(repository as never, {} as never).getWorkspace({
      userId: "user-1",
      orgId: "org-1",
      role: "owner",
    });

    expect(summary.areas).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "materials", status: "existing_catalog" }),
      expect.objectContaining({ id: "labor", status: "existing_catalog" }),
      expect.objectContaining({ id: "equipment", status: "existing_catalog" }),
      expect.objectContaining({ id: "assemblies", status: "existing_catalog" }),
      expect.objectContaining({ id: "pricing-rules", status: "foundation_only" }),
      expect.objectContaining({ id: "price-history", status: "foundation_only" }),
    ]));
  });
});
