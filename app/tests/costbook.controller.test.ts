const mockService = {
  getWorkspace: jest.fn(),
  listLaborRates: jest.fn(),
  listLaborRatesPage: jest.fn(),
  getLaborRate: jest.fn(),
  createLaborRate: jest.fn(),
  updateLaborRate: jest.fn(),
  deactivateLaborRate: jest.fn(),
  listMaterials: jest.fn(),
  listMaterialsPage: jest.fn(),
  getMaterial: jest.fn(),
  createMaterial: jest.fn(),
  updateMaterial: jest.fn(),
  listDivisions: jest.fn(),
  listDivisionsPage: jest.fn(),
  getDivision: jest.fn(),
  createDivision: jest.fn(),
  updateDivision: jest.fn(),
  deactivateDivision: jest.fn(),
  listCategories: jest.fn(),
  listCategoriesPage: jest.fn(),
  getCategory: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deactivateCategory: jest.fn(),
  listSubcategories: jest.fn(),
  listSubcategoriesPage: jest.fn(),
  getSubcategory: jest.fn(),
  createSubcategory: jest.fn(),
  updateSubcategory: jest.fn(),
  deactivateSubcategory: jest.fn(),
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

describe("costbookController materials endpoints", () => {
  const materialId = "10000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.listLaborRates.mockResolvedValue([]);
    mockService.listLaborRatesPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    mockService.getLaborRate.mockResolvedValue({ id: materialId });
    mockService.createLaborRate.mockResolvedValue({ id: materialId });
    mockService.updateLaborRate.mockResolvedValue({ id: materialId });
    mockService.deactivateLaborRate.mockResolvedValue(undefined);
    mockService.listMaterials.mockResolvedValue([]);
    mockService.listMaterialsPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    mockService.getMaterial.mockResolvedValue({ id: materialId });
    mockService.createMaterial.mockResolvedValue({ id: materialId });
    mockService.updateMaterial.mockResolvedValue({ id: materialId });
    mockService.listDivisions.mockResolvedValue([]);
    mockService.listDivisionsPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    mockService.getDivision.mockResolvedValue({ id: materialId });
    mockService.createDivision.mockResolvedValue({ id: materialId });
    mockService.updateDivision.mockResolvedValue({ id: materialId });
    mockService.deactivateDivision.mockResolvedValue(undefined);
    mockService.listCategories.mockResolvedValue([]);
    mockService.listCategoriesPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    mockService.getCategory.mockResolvedValue({ id: materialId });
    mockService.createCategory.mockResolvedValue({ id: materialId });
    mockService.updateCategory.mockResolvedValue({ id: materialId });
    mockService.deactivateCategory.mockResolvedValue(undefined);
    mockService.listSubcategories.mockResolvedValue([]);
    mockService.listSubcategoriesPage.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    mockService.getSubcategory.mockResolvedValue({ id: materialId });
    mockService.createSubcategory.mockResolvedValue({ id: materialId });
    mockService.updateSubcategory.mockResolvedValue({ id: materialId });
    mockService.deactivateSubcategory.mockResolvedValue(undefined);
  });

  it("allows read-only Costbook roles to list materials", async () => {
    const res = response();

    await costbookController.listMaterials(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listMaterialsPage).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }), expect.objectContaining({ limit: 25 }));
    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0, nextCursor: null });
  });

  it("denies Costbook materials reads to viewer/no-access roles", async () => {
    await expect(costbookController.listMaterials(authedRequest({ role: "viewer" }), response() as never)).rejects.toThrow(
      "You do not have permission"
    );

    expect(mockService.listMaterialsPage).not.toHaveBeenCalled();
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

  it("allows read-only Costbook roles to list labor rates", async () => {
    const res = response();

    await costbookController.listLaborRates(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listLaborRatesPage).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }), expect.objectContaining({ limit: 25 }));
    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0, nextCursor: null });
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

  it("allows read-only Costbook roles to list divisions", async () => {
    const res = response();

    await costbookController.listDivisions(authedRequest({ role: "technician" }), res as never);

    expect(mockService.listDivisionsPage).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-from-auth", role: "technician" }), expect.objectContaining({ limit: 25 }));
    expect(res.json).toHaveBeenCalledWith({ items: [], total: 0, nextCursor: null });
  });

  it("denies division writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createDivision(
        authedRequest({ role: "dispatcher", body: { code: "ELEC", name: "Electrical" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createDivision).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied fields not on the division schema", async () => {
    await expect(
      costbookController.createDivision(
        authedRequest({ body: { code: "ELEC", name: "Electrical", orgId: "attacker-org" } }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.createDivision).not.toHaveBeenCalled();
  });

  it("passes validated division create input to the service", async () => {
    const res = response();

    await costbookController.createDivision(
      authedRequest({ body: { code: " ELEC ", name: " Electrical " } }),
      res as never
    );

    expect(mockService.createDivision).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "admin" }),
      { code: "ELEC", name: "Electrical" }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("requires Costbook manage permission to deactivate a division", async () => {
    await expect(
      costbookController.removeDivision(
        authedRequest({ role: "technician", params: { id: materialId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.deactivateDivision).not.toHaveBeenCalled();
  });

  it("passes a divisionId filter through to the category list service call", async () => {
    const res = response();
    const divisionId = "20000000-0000-0000-0000-000000000001";

    await costbookController.listCategories(
      authedRequest({ role: "technician", query: { divisionId } }),
      res as never
    );

    expect(mockService.listCategoriesPage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "technician" }),
      expect.objectContaining({ filters: expect.objectContaining({ divisionId }) })
    );
  });

  it("denies category writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createCategory(
        authedRequest({
          role: "dispatcher",
          body: { divisionId: "20000000-0000-0000-0000-000000000001", code: "WIRE", name: "Wiring" },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createCategory).not.toHaveBeenCalled();
  });

  it("requires Costbook manage permission to deactivate a category", async () => {
    await expect(
      costbookController.removeCategory(
        authedRequest({ role: "technician", params: { id: materialId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.deactivateCategory).not.toHaveBeenCalled();
  });

  it("passes a categoryId filter through to the subcategory list service call", async () => {
    const res = response();
    const categoryId = "30000000-0000-0000-0000-000000000001";

    await costbookController.listSubcategories(
      authedRequest({ role: "technician", query: { categoryId } }),
      res as never
    );

    expect(mockService.listSubcategoriesPage).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-from-auth", role: "technician" }),
      expect.objectContaining({ filters: expect.objectContaining({ categoryId }) })
    );
  });

  it("denies subcategory writes to read-only Costbook roles", async () => {
    await expect(
      costbookController.createSubcategory(
        authedRequest({
          role: "dispatcher",
          body: { categoryId: "30000000-0000-0000-0000-000000000001", code: "ROMEX", name: "Romex" },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createSubcategory).not.toHaveBeenCalled();
  });

  it("requires Costbook manage permission to deactivate a subcategory", async () => {
    await expect(
      costbookController.removeSubcategory(
        authedRequest({ role: "technician", params: { id: materialId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.deactivateSubcategory).not.toHaveBeenCalled();
  });
});
