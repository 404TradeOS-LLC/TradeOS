const mockService = {
  getWorkspace: jest.fn(),
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
});
