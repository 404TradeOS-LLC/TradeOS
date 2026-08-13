const mockService = {
  createDivision: jest.fn(),
  createCategory: jest.fn(),
  createSubcategory: jest.fn(),
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

function authedRequest(options: { role?: string; body?: unknown } = {}) {
  return {
    body: options.body ?? {},
    params: {},
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
