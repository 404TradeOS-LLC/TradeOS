const mockCreate = jest.fn();
jest.mock("../db/client", () => ({
  prisma: { material: { create: mockCreate } },
  basePrisma: {},
}));

import { MaterialDatabaseService } from "../modules/material-database/service";

describe("MaterialDatabaseService bulk import classification", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reports malformed UNSPSC per row, skips its write, and keeps good rows tenant-scoped", async () => {
    const service = new MaterialDatabaseService();
    const create = jest.spyOn(service, "create").mockResolvedValue({} as never);
    const valid = { name: "Architectural shingles", unitOfMeasure: "BUNDLE", unitCost: 35, unspsc: "30151508" };
    const invalid = { name: "Unknown", unitOfMeasure: "EA", unitCost: 4, unspsc: "123" };

    const result = await service.bulkImport("org-a", [
      invalid,
      { ...valid, orgId: "org-other" } as never,
    ]);

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      { row: 0, message: "unspsc must be an 8-digit commodity code" },
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({ ...valid, orgId: "org-a" });
  });
});
