const mockService = {
  createDivision: jest.fn(),
  createCategory: jest.fn(),
  createSubcategory: jest.fn(),
  search: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockService),
}));

import { costDatabaseController } from "../backend/controllers/costDatabase.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function authedRequest(options: { role?: string; body?: unknown; params?: Record<string, string>; query?: Record<string, unknown> } = {}) {
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

// Migration 20260812120000_add_costbook_hierarchy_foundation tightened
// divisions/categories/subcategories write RLS to the Costbook manage
// boundary (owner/admin only). These legacy create routes previously had no
// app-level permission check and relied entirely on RLS, so a role that lost
// database write access here must now get a clean 403 instead of a raw RLS
// failure.
describe("costDatabaseController legacy hierarchy create routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService.createDivision.mockResolvedValue({ id: "division-1" });
    mockService.createCategory.mockResolvedValue({ id: "category-1" });
    mockService.createSubcategory.mockResolvedValue({ id: "subcategory-1" });
  });

  it("denies legacy division creation to roles without costbook.write", async () => {
    await expect(
      costDatabaseController.createDivision(
        authedRequest({ role: "estimator", body: { code: "ELEC", name: "Electrical" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createDivision).not.toHaveBeenCalled();
  });

  it("allows legacy division creation for owner/admin", async () => {
    const res = response();

    await costDatabaseController.createDivision(
      authedRequest({ body: { code: "ELEC", name: "Electrical" } }),
      res as never
    );

    expect(mockService.createDivision).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("denies legacy category creation to roles without costbook.write", async () => {
    await expect(
      costDatabaseController.createCategory(
        authedRequest({ role: "technician", body: { divisionId: "20000000-0000-0000-0000-000000000001", code: "WIRE", name: "Wiring" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createCategory).not.toHaveBeenCalled();
  });

  it("denies legacy subcategory creation to roles without costbook.write", async () => {
    await expect(
      costDatabaseController.createSubcategory(
        authedRequest({ role: "dispatcher", body: { categoryId: "30000000-0000-0000-0000-000000000001", code: "ROMEX", name: "Romex" } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.createSubcategory).not.toHaveBeenCalled();
  });
});

describe("costDatabaseController CostItem permissions", () => {
  const itemId = "40000000-0000-4000-8000-000000000001";
  const subcategoryId = "50000000-0000-4000-8000-000000000001";

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.search.mockResolvedValue([]);
    mockService.getById.mockResolvedValue({ id: itemId });
    mockService.create.mockResolvedValue({ id: itemId });
    mockService.update.mockResolvedValue({ id: itemId });
    mockService.delete.mockResolvedValue(undefined);
  });

  it("allows a read-only Costbook actor to search CostItems", async () => {
    const res = response();

    await costDatabaseController.search(
      authedRequest({ role: "technician", query: { q: "wire" } }),
      res as never
    );

    expect(mockService.search).toHaveBeenCalledWith("wire", "org-from-auth");
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("denies CostItem create to a read-only Costbook actor", async () => {
    await expect(
      costDatabaseController.create(
        authedRequest({
          role: "technician",
          body: { subcategoryId, code: "CI-1", name: "Cost Item", unitOfMeasure: "EA" },
        }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("allows owner/admin CostItem create and injects the authenticated organization", async () => {
    const res = response();

    await costDatabaseController.create(
      authedRequest({ body: { subcategoryId, code: "CI-1", name: "Cost Item", unitOfMeasure: "EA" } }),
      res as never
    );

    expect(mockService.create).toHaveBeenCalledWith({
      subcategoryId,
      code: "CI-1",
      name: "Cost Item",
      unitOfMeasure: "EA",
      orgId: "org-from-auth",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects caller-controlled organization ids from CostItem create", async () => {
    await expect(
      costDatabaseController.create(
        authedRequest({
          body: { subcategoryId, code: "CI-1", name: "Cost Item", unitOfMeasure: "EA", orgId: "other-org" },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.create).not.toHaveBeenCalled();
  });

  it("requires costbook.manage when a CostItem PATCH changes isActive", async () => {
    await expect(
      costDatabaseController.update(
        authedRequest({ role: "estimator", params: { id: itemId }, body: { isActive: false } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.update).not.toHaveBeenCalled();
  });

  it("allows an ordinary CostItem edit with costbook.write", async () => {
    const res = response();

    await costDatabaseController.update(
      authedRequest({ params: { id: itemId }, body: { name: "Updated Cost Item" } }),
      res as never
    );

    expect(mockService.update).toHaveBeenCalledWith(itemId, { name: "Updated Cost Item" }, "org-from-auth");
  });

  it("requires costbook.manage for CostItem deactivation", async () => {
    await expect(
      costDatabaseController.remove(
        authedRequest({ role: "technician", params: { id: itemId } }),
        response() as never
      )
    ).rejects.toThrow("You do not have permission");

    expect(mockService.delete).not.toHaveBeenCalled();
  });
});
