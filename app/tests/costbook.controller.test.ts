const mockService = {
  getWorkspace: jest.fn(),
  listEquipment: jest.fn(),
  getEquipment: jest.fn(),
  createEquipment: jest.fn(),
  updateEquipment: jest.fn(),
  removeEquipment: jest.fn(),
  listLaborRates: jest.fn(),
  getLaborRate: jest.fn(),
  createLaborRate: jest.fn(),
  updateLaborRate: jest.fn(),
  deactivateLaborRate: jest.fn(),
  listMaterials: jest.fn(),
  getMaterial: jest.fn(),
  createMaterial: jest.fn(),
  updateMaterial: jest.fn(),
};

jest.mock("../modules/costbook", () => ({
  CostbookService: jest.fn().mockImplementation(() => mockService),
}));

import { costbookController } from "../backend/controllers/costbook.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function authedRequest(options: { role?: string; body?: unknown; params?: Record<string, string> } = {}) {
  return {
    body: options.body ?? {},
    params: options.params ?? {},
    orgId: "org-from-auth",
    auth: {
      userId: "user-1",
      orgId: "org-from-auth",
      role: options.role ?? "admin",
    },
  } as never;
}

describe("costbookController materials endpoints", () => {
  const materialId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.listEquipment.mockResolvedValue([]);
    mockService.getEquipment.mockResolvedValue({ id: materialId });
    mockService.createEquipment.mockResolvedValue({ id: materialId });
    mockService.updateEquipment.mockResolvedValue({ id: materialId });
    mockService.removeEquipment.mockResolvedValue(undefined);
    mockService.listLaborRates.mockResolvedValue([]);
    mockService.getLaborRate.mockResolvedValue({ id: materialId });
    mockService.createLaborRate.mockResolvedValue({ id: materialId });
    mockService.updateLaborRate.mockResolvedValue({ id: materialId });
    mockService.deactivateLaborRate.mockResolvedValue(undefined);
    mockService.listMaterials.mockResolvedValue([]);
    mockService.getMaterial.mockResolvedValue({ id: materialId });
    mockService.createMaterial.mockResolvedValue({ id: materialId });
    mockService.updateMaterial.mockResolvedValue({ id: materialId });
  });

  it("allows read-only Costbook roles to list materials", async () => {
    const res = response();

    await costbookController.listMaterials(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listMaterials).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("denies Costbook materials reads to viewer/no-access roles", async () => {
    await expect(costbookController.listMaterials(authedRequest({ role: "viewer" }), response() as never)).rejects.toThrow(
      "You do not have permission"
    );

    expect(mockService.listMaterials).not.toHaveBeenCalled();
  });

  it("denies material writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createMaterial(
        authedRequest({
          role: "dispatcher",
          body: { name: "Concrete", unitOfMeasure: "CY", unitCost: 150 },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createMaterial).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied org IDs and unknown material fields", async () => {
    await expect(
      costbookController.createMaterial(
        authedRequest({
          body: {
            orgId: "attacker-org",
            name: "Concrete",
            unitOfMeasure: "CY",
            unitCost: 150,
            sellPrice: 250,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createMaterial).not.toHaveBeenCalled();
  });

  it("passes validated create input and authenticated actor to the service", async () => {
    const res = response();

    await costbookController.createMaterial(
      authedRequest({
        body: {
          sku: " CONC-4000 ",
          name: " Ready Mix Concrete ",
          unitOfMeasure: " CY ",
          unitCost: "150.25",
          wasteFactorPct: "5",
          supplierId: null,
        },
      }),
      res as never
    );

    expect(mockService.createMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      {
        sku: "CONC-4000",
        name: "Ready Mix Concrete",
        unitOfMeasure: "CY",
        unitCost: 150.25,
        wasteFactorPct: 5,
        supplierId: null,
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([null, "", "   "])("rejects blank unitCost values instead of coercing %j to zero", async (unitCost) => {
    await expect(
      costbookController.createMaterial(
        authedRequest({
          body: {
            name: "Concrete",
            unitOfMeasure: "CY",
            unitCost,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createMaterial).not.toHaveBeenCalled();
  });

  it("rejects unitCost values outside the material database precision", async () => {
    await expect(
      costbookController.createMaterial(
        authedRequest({
          body: {
            name: "Concrete",
            unitOfMeasure: "CY",
            unitCost: 100_000_000,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createMaterial).not.toHaveBeenCalled();
  });

  it("requires a valid material id for detail and update routes", async () => {
    await expect(
      costbookController.getMaterial(authedRequest({ params: { id: "not-a-uuid" } }), response() as never)
    ).rejects.toThrow();
    await expect(
      costbookController.updateMaterial(
        authedRequest({ params: { id: "not-a-uuid" }, body: { name: "Concrete" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.getMaterial).not.toHaveBeenCalled();
    expect(mockService.updateMaterial).not.toHaveBeenCalled();
  });

  it("passes validated patch input to the service", async () => {
    const res = response();

    await costbookController.updateMaterial(
      authedRequest({
        params: { id: materialId },
        body: { unitCost: "165" },
      }),
      res as never
    );

    expect(mockService.updateMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      materialId,
      { unitCost: 165 }
    );
    expect(res.json).toHaveBeenCalledWith({ id: materialId });
  });

  it("allows read-only Costbook roles to list equipment", async () => {
    const res = response();

    await costbookController.listEquipment(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listEquipment).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("denies equipment writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createEquipment(
        authedRequest({
          role: "dispatcher",
          body: { name: "Scissor Lift", ownershipCostPerHour: 28.5, operatingCostPerHour: 11.25 },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createEquipment).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])("rejects blank ownershipCostPerHour values instead of coercing %j", async (ownershipCostPerHour) => {
    await expect(
      costbookController.createEquipment(
        authedRequest({
          body: {
            name: "Scissor Lift",
            ownershipCostPerHour,
            operatingCostPerHour: 11.25,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createEquipment).not.toHaveBeenCalled();
  });

  it("rejects equipment values with more than two decimal places", async () => {
    await expect(
      costbookController.createEquipment(
        authedRequest({
          body: {
            name: "Scissor Lift",
            ownershipCostPerHour: 28.555,
            operatingCostPerHour: 11.25,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createEquipment).not.toHaveBeenCalled();
  });

  it("passes validated equipment create input to the service", async () => {
    const res = response();

    await costbookController.createEquipment(
      authedRequest({
        body: {
          name: " Scissor Lift ",
          ownershipCostPerHour: "28.50",
          operatingCostPerHour: "11.25",
          dailyRate: "325.00",
        },
      }),
      res as never
    );

    expect(mockService.createEquipment).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      {
        name: "Scissor Lift",
        ownershipCostPerHour: 28.5,
        operatingCostPerHour: 11.25,
        dailyRate: 325,
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("requires Costbook manage permission to delete equipment", async () => {
    await expect(
      costbookController.removeEquipment(
        authedRequest({ role: "technician", params: { id: materialId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.removeEquipment).not.toHaveBeenCalled();
  });

  it("allows read-only Costbook roles to list labor rates", async () => {
    const res = response();

    await costbookController.listLaborRates(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listLaborRates).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }));
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("denies labor-rate writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createLaborRate(
        authedRequest({
          role: "dispatcher",
          body: { role: "Lead Carpenter", hourlyCost: 45, billRate: 85 },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createLaborRate).not.toHaveBeenCalled();
  });

  it.each([null, "", "   "])("rejects blank hourlyCost values instead of coercing %j", async (hourlyCost) => {
    await expect(
      costbookController.createLaborRate(
        authedRequest({
          body: {
            role: "Lead Carpenter",
            hourlyCost,
            billRate: 85,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createLaborRate).not.toHaveBeenCalled();
  });

  it("rejects labor-rate costs outside the database precision", async () => {
    await expect(
      costbookController.createLaborRate(
        authedRequest({
          body: {
            role: "Lead Carpenter",
            hourlyCost: 100_000_000,
            billRate: 85,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createLaborRate).not.toHaveBeenCalled();
  });

  it("rejects labor-rate values with more than two decimal places", async () => {
    await expect(
      costbookController.createLaborRate(
        authedRequest({
          body: {
            role: "Lead Carpenter",
            hourlyCost: 45.257,
            billRate: 88.5,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createLaborRate).not.toHaveBeenCalled();
  });

  it("passes validated labor-rate create input to the service", async () => {
    const res = response();

    await costbookController.createLaborRate(
      authedRequest({
        body: {
          role: " Lead Carpenter ",
          description: " Finish trim labor ",
          hourlyCost: "45.25",
          billRate: "88.50",
        },
      }),
      res as never
    );

    expect(mockService.createLaborRate).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      {
        role: "Lead Carpenter",
        description: "Finish trim labor",
        hourlyCost: 45.25,
        billRate: 88.5,
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("accepts valid two-decimal labor-rate values affected by floating-point representation", async () => {
    const res = response();

    await costbookController.createLaborRate(
      authedRequest({
        body: {
          role: "Helper",
          hourlyCost: 19.99,
          billRate: 0.29,
        },
      }),
      res as never
    );

    expect(mockService.createLaborRate).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      {
        role: "Helper",
        hourlyCost: 19.99,
        billRate: 0.29,
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("passes validated labor-rate patch input to the service", async () => {
    const res = response();

    await costbookController.updateLaborRate(
      authedRequest({
        params: { id: materialId },
        body: { billRate: "92" },
      }),
      res as never
    );

    expect(mockService.updateLaborRate).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      materialId,
      { billRate: 92 }
    );
    expect(res.json).toHaveBeenCalledWith({ id: materialId });
  });

  it("requires Costbook manage permission to deactivate a labor rate", async () => {
    await expect(
      costbookController.removeLaborRate(
        authedRequest({ role: "technician", params: { id: materialId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.deactivateLaborRate).not.toHaveBeenCalled();
  });
});
