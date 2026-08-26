const mockPrisma = {
  material: {
    findMany: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { AdminDashboardService } from "../modules/admin-dashboard/service";

describe("AdminDashboardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("summarizes stale material pricing for review", async () => {
    const staleDate = new Date("2026-01-01T00:00:00.000Z");
    mockPrisma.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "Gravel", lastPriceUpdate: staleDate },
      { id: "mat-2", name: "Sand", lastPriceUpdate: null },
    ]);

    const service = new AdminDashboardService();
    const summary = await service.getPricingUpdateSummary("org-1", 30);

    expect(summary.staleMaterialsCount).toBe(2);
    expect(summary.staleMaterials).toEqual([
      { id: "mat-1", name: "Gravel", lastPriceUpdate: staleDate },
      { id: "mat-2", name: "Sand", lastPriceUpdate: null },
    ]);
  });
});

