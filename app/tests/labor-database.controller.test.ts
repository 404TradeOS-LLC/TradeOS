const mockService = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  calculateLaborCost: jest.fn(),
};

jest.mock("../modules/labor-database/service", () => ({
  LaborDatabaseService: jest.fn().mockImplementation(() => mockService),
}));

import { laborDatabaseController } from "../backend/controllers/laborDatabase.controller";

function response() {
  return {
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  };
}

function authedRequest(options: { body?: unknown; role?: string } = {}) {
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

describe("laborDatabaseController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockService.create.mockResolvedValue({ id: "labor-rate-1" });
  });

  it("accepts valid two-decimal rates affected by floating-point representation", async () => {
    const res = response();

    await laborDatabaseController.create(
      authedRequest({
        body: {
          trade: "Helper",
          baseHourlyRate: 19.99,
        },
      }),
      res as never
    );

    expect(mockService.create).toHaveBeenCalledWith({
      trade: "Helper",
      baseHourlyRate: 19.99,
      orgId: "org-from-auth",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects rates with more than two decimal places", async () => {
    await expect(
      laborDatabaseController.create(
        authedRequest({
          body: {
            trade: "Helper",
            baseHourlyRate: 19.999,
          },
        }),
        response() as never
      )
    ).rejects.toThrow();

    expect(mockService.create).not.toHaveBeenCalled();
  });
});
