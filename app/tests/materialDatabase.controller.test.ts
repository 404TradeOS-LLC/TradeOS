const mockService = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  calculateMaterialCost: jest.fn(),
  bulkImport: jest.fn(),
  findStalePrices: jest.fn(),
};

jest.mock("../modules/material-database/service", () => ({
  MaterialDatabaseService: jest.fn().mockImplementation(() => mockService),
}));

import { materialDatabaseController } from "../backend/controllers/materialDatabase.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function authedRequest(options: { role?: string; body?: unknown; params?: Record<string, string>; query?: Record<string, string> } = {}) {
  return {
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    orgId: "org-from-auth",
    auth: {
      userId: "user-1",
      orgId: "org-from-auth",
      role: options.role ?? "admin",
    },
  } as never;
}

describe("materialDatabaseController Costbook permission boundary", () => {
  const materialId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.list.mockResolvedValue([]);
    mockService.getById.mockResolvedValue({ id: materialId });
    mockService.create.mockResolvedValue({ id: materialId });
    mockService.update.mockResolvedValue({ id: materialId });
    mockService.delete.mockResolvedValue(undefined);
    mockService.calculateMaterialCost.mockResolvedValue({ baseCost: 10, adjustedCost: 11 });
    mockService.bulkImport.mockResolvedValue({ created: 1, errors: [] });
    mockService.findStalePrices.mockResolvedValue([]);
  });

  it("denies legacy material reads to viewer/no-Costbook roles", async () => {
    await expect(materialDatabaseController.list(authedRequest({ role: "viewer" }), response() as never)).rejects.toThrow(
      "You do not have permission"
    );
    await expect(
      materialDatabaseController.getById(authedRequest({ role: "viewer", params: { id: materialId } }), response() as never)
    ).rejects.toThrow("You do not have permission");
    await expect(
      materialDatabaseController.stale(authedRequest({ role: "viewer", query: { days: "30" } }), response() as never)
    ).rejects.toThrow("You do not have permission");
    await expect(
      materialDatabaseController.calculate(
        authedRequest({ role: "viewer", body: { materialId, quantity: 2 } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.list).not.toHaveBeenCalled();
    expect(mockService.getById).not.toHaveBeenCalled();
    expect(mockService.findStalePrices).not.toHaveBeenCalled();
    expect(mockService.calculateMaterialCost).not.toHaveBeenCalled();
  });

  it("allows read-only Costbook roles to use legacy material read endpoints", async () => {
    const res = response();

    await materialDatabaseController.list(authedRequest({ role: "technician" }), res as never);
    await materialDatabaseController.getById(authedRequest({ role: "dispatcher", params: { id: materialId } }), res as never);
    await materialDatabaseController.stale(authedRequest({ role: "estimator", query: { days: "45" } }), res as never);
    await materialDatabaseController.calculate(
      authedRequest({ role: "technician", body: { materialId, quantity: "2" } }),
      res as never
    );

    expect(mockService.list).toHaveBeenCalledWith("org-from-auth");
    expect(mockService.getById).toHaveBeenCalledWith(materialId, "org-from-auth");
    expect(mockService.findStalePrices).toHaveBeenCalledWith(45, "org-from-auth");
    expect(mockService.calculateMaterialCost).toHaveBeenCalledWith({ materialId, quantity: 2 }, "org-from-auth");
  });

  it("denies legacy material writes to read-only Costbook roles", async () => {
    await expect(
      materialDatabaseController.create(
        authedRequest({ role: "dispatcher", body: { name: "Concrete", unitOfMeasure: "CY", unitCost: 150 } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");
    await expect(
      materialDatabaseController.update(
        authedRequest({ role: "technician", params: { id: materialId }, body: { name: "Concrete" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");
    await expect(
      materialDatabaseController.remove(authedRequest({ role: "estimator", params: { id: materialId } }), response() as never)
    ).rejects.toThrow("You do not have permission");
    await expect(
      materialDatabaseController.bulkImport(authedRequest({ role: "technician", body: { rows: [] } }), response() as never)
    ).rejects.toThrow("You do not have permission");

    expect(mockService.create).not.toHaveBeenCalled();
    expect(mockService.update).not.toHaveBeenCalled();
    expect(mockService.delete).not.toHaveBeenCalled();
    expect(mockService.bulkImport).not.toHaveBeenCalled();
  });

  it("allows Costbook writers to use legacy material write endpoints", async () => {
    const res = response();

    await materialDatabaseController.create(
      authedRequest({ role: "admin", body: { name: "Concrete", unitOfMeasure: "CY", unitCost: 150 } }),
      res as never
    );
    await materialDatabaseController.update(
      authedRequest({ role: "owner", params: { id: materialId }, body: { name: "Concrete Mix" } }),
      res as never
    );
    await materialDatabaseController.remove(authedRequest({ role: "admin", params: { id: materialId } }), res as never);
    await materialDatabaseController.bulkImport(authedRequest({ role: "owner", body: { rows: [{ name: "Stone" }] } }), res as never);

    expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth" }));
    expect(mockService.update).toHaveBeenCalledWith(
      materialId,
      { name: "Concrete Mix" },
      "org-from-auth",
      expect.objectContaining({ source: "manual" })
    );
    expect(mockService.delete).toHaveBeenCalledWith(materialId, "org-from-auth");
    expect(mockService.bulkImport).toHaveBeenCalledWith("org-from-auth", [{ name: "Stone" }]);
  });
});
