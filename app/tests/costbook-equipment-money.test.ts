const findMany = jest.fn();

jest.mock("../db/client", () => ({
  prisma: {
    equipment: {
      findMany,
    },
  },
  basePrisma: {},
}));

import { CostbookService } from "../modules/costbook";

describe("Costbook equipment money mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds ownership and operating costs without binary floating-point drift", async () => {
    const now = new Date("2026-08-12T00:00:00.000Z");
    findMany.mockResolvedValue([
      {
        id: "equipment-precision",
        orgId: "org-tenant-a",
        name: "Precision Test Equipment",
        ownershipCostPerHour: 0.1,
        operatingCostPerHour: 0.2,
        dailyRate: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const rows = await new CostbookService().listEquipment({
      userId: "user-1",
      orgId: "org-tenant-a",
      role: "technician",
    });

    expect(findMany).toHaveBeenCalledWith({
      where: { orgId: "org-tenant-a" },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hourlyCost).toBe(0.3);
  });
});
