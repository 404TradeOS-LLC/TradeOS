const mockService = {
  updateDivision: jest.fn(),
  updateCategory: jest.fn(),
  updateSubcategory: jest.fn(),
};

const mockAuth = {
  userId: "user-1",
  orgId: "org-1",
  role: "future-writer",
};

let mockManageAllowed = true;
const mockRequirePermissions = jest.fn((_req: unknown, permissions: string[]) => {
  if (permissions.includes("costbook.manage") && !mockManageAllowed) {
    throw new Error("You do not have permission");
  }
  return mockAuth;
});

jest.mock("../modules/costbook", () => ({
  CostbookService: jest.fn().mockImplementation(() => mockService),
}));

jest.mock("../backend/requestContext", () => ({
  requireAuthContext: jest.fn(() => mockAuth),
  requirePermissions: mockRequirePermissions,
}));

import { costbookController } from "../backend/controllers/costbook.controller";

const entityId = "10000000-0000-0000-0000-000000000001";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function request(body: unknown) {
  return {
    body,
    params: { id: entityId },
    query: {},
    orgId: mockAuth.orgId,
    auth: mockAuth,
  } as never;
}

const cases = [
  ["division", costbookController.updateDivision, mockService.updateDivision],
  ["category", costbookController.updateCategory, mockService.updateCategory],
  ["subcategory", costbookController.updateSubcategory, mockService.updateSubcategory],
] as const;

describe("Costbook hierarchy activation permission boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockManageAllowed = true;
    mockService.updateDivision.mockResolvedValue({ id: entityId });
    mockService.updateCategory.mockResolvedValue({ id: entityId });
    mockService.updateSubcategory.mockResolvedValue({ id: entityId });
  });

  it.each(cases)("keeps ordinary %s PATCH fields under costbook.write", async (_label, handler, serviceMethod) => {
    const res = response();

    await handler(request({ name: "Updated name" }), res as never);

    expect(mockRequirePermissions).toHaveBeenCalledTimes(1);
    expect(mockRequirePermissions).toHaveBeenCalledWith(expect.anything(), ["costbook.write"]);
    expect(serviceMethod).toHaveBeenCalledWith(mockAuth, entityId, { name: "Updated name" });
  });

  it.each(cases)("requires costbook.manage when %s PATCH changes isActive", async (_label, handler, serviceMethod) => {
    mockManageAllowed = false;

    await expect(handler(request({ isActive: false }), response() as never)).rejects.toThrow("You do not have permission");

    expect(mockRequirePermissions).toHaveBeenNthCalledWith(1, expect.anything(), ["costbook.write"]);
    expect(mockRequirePermissions).toHaveBeenNthCalledWith(2, expect.anything(), ["costbook.manage"]);
    expect(serviceMethod).not.toHaveBeenCalled();
  });

  it.each(cases)("allows a manager to change %s isActive through PATCH", async (_label, handler, serviceMethod) => {
    const res = response();

    await handler(request({ isActive: true }), res as never);

    expect(mockRequirePermissions).toHaveBeenNthCalledWith(1, expect.anything(), ["costbook.write"]);
    expect(mockRequirePermissions).toHaveBeenNthCalledWith(2, expect.anything(), ["costbook.manage"]);
    expect(serviceMethod).toHaveBeenCalledWith(mockAuth, entityId, { isActive: true });
  });
});
