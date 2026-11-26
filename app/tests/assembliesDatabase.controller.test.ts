const mockService = {
  confirmRecipeUpgrade: jest.fn(),
  previewRecipeUpgrade: jest.fn(),
  installStarterCatalog: jest.fn(),
};

jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => mockService),
}));

import { assembliesDatabaseController } from "../backend/controllers/assembliesDatabase.controller";

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
      role: options.role ?? "owner",
    },
  } as never;
}

describe("assembliesDatabaseController recipe upgrades (#518)", () => {
  const assemblyId = "10000000-0000-4000-8000-000000000001";
  const reviewToken = "a".repeat(64);

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.confirmRecipeUpgrade.mockResolvedValue({ id: assemblyId });
    mockService.previewRecipeUpgrade.mockResolvedValue({ id: assemblyId });
  });

  it("accepts an empty componentMappings list when an upgrade preserves every mapping", async () => {
    const res = response();
    await assembliesDatabaseController.confirmRecipeUpgrade(
      authedRequest({ params: { id: assemblyId }, body: { reviewToken, componentMappings: [] } }),
      res as never,
    );
    expect(mockService.confirmRecipeUpgrade).toHaveBeenCalledWith(
      assemblyId,
      "org-from-auth",
      { reviewToken, componentMappings: [] },
    );
    expect(res.json).toHaveBeenCalledWith({ id: assemblyId });
  });

  it("still accepts replacement mappings for new or broken slots", async () => {
    const res = response();
    const mappings = [{ componentKey: "excavation", costItemId: "20000000-0000-4000-8000-000000000002" }];
    await assembliesDatabaseController.confirmRecipeUpgrade(
      authedRequest({ params: { id: assemblyId }, body: { reviewToken, componentMappings: mappings } }),
      res as never,
    );
    expect(mockService.confirmRecipeUpgrade).toHaveBeenCalledWith(
      assemblyId,
      "org-from-auth",
      { reviewToken, componentMappings: mappings },
    );
  });

  it("still caps replacement mappings at 50", async () => {
    const mappings = Array.from({ length: 51 }, (_, index) => ({
      componentKey: `slot-${index}`,
      costItemId: "20000000-0000-4000-8000-000000000002",
    }));
    await expect(assembliesDatabaseController.confirmRecipeUpgrade(
      authedRequest({ params: { id: assemblyId }, body: { reviewToken, componentMappings: mappings } }),
      response() as never,
    )).rejects.toThrow(/Too big/);
    expect(mockService.confirmRecipeUpgrade).not.toHaveBeenCalled();
  });

  it("keeps the one-mapping minimum on install", async () => {
    await expect(assembliesDatabaseController.installStarterCatalog(
      authedRequest({ body: { templateId: "site-excavation", componentMappings: [] } }),
      response() as never,
    )).rejects.toThrow(/Too small/);
    expect(mockService.installStarterCatalog).not.toHaveBeenCalled();
  });

  it("requires costbook.write to confirm an upgrade", async () => {
    await expect(assembliesDatabaseController.confirmRecipeUpgrade(
      authedRequest({ role: "technician", params: { id: assemblyId }, body: { reviewToken, componentMappings: [] } }),
      response() as never,
    )).rejects.toThrow(/You do not have permission to perform this action/);
    expect(mockService.confirmRecipeUpgrade).not.toHaveBeenCalled();
  });

  it("allows costbook.read to preview an upgrade", async () => {
    const res = response();
    await assembliesDatabaseController.previewRecipeUpgrade(
      authedRequest({ role: "technician", params: { id: assemblyId } }),
      res as never,
    );
    expect(mockService.previewRecipeUpgrade).toHaveBeenCalledWith(assemblyId, "org-from-auth");
    expect(res.json).toHaveBeenCalledWith({ id: assemblyId });
  });
});
