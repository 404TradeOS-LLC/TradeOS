import express, { NextFunction, Request, Response } from "express";
import supertest from "supertest";

const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { requireProjectCustomerScope } from "../backend/middleware/projectCustomerScope";
import { projectCustomerScopeRouter } from "../backend/routes/projectCustomerScope.routes";

function request(body: Record<string, unknown> = {}) {
  return {
    body,
    orgId: "11111111-1111-4111-8111-111111111111",
    auth: {
      userId: "user-1",
      orgId: "11111111-1111-4111-8111-111111111111",
      role: "owner",
      canonicalRole: "owner",
    },
  } as unknown as Request;
}

function mountedApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, {
      orgId: "11111111-1111-4111-8111-111111111111",
      auth: {
        userId: "user-1",
        orgId: "11111111-1111-4111-8111-111111111111",
        role: "owner",
        canonicalRole: "owner",
      },
    });
    next();
  });
  app.use("/projects", projectCustomerScopeRouter);
  app.use("/projects", (_req, res) => res.status(204).end());
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const apiError = err as { statusCode?: number; message?: string };
    res.status(apiError.statusCode ?? 500).json({ message: apiError.message ?? "Internal server error" });
  });
  return app;
}

const response = {} as Response;

describe("requireProjectCustomerScope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows project writes with no customer relation without a customer lookup", async () => {
    const next = jest.fn() as unknown as NextFunction;

    await requireProjectCustomerScope(request({ name: "Kitchen" }), response, next);

    expect(mockPrisma.customer.findFirst).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows a customer from the authenticated organization", async () => {
    const customerId = "22222222-2222-4222-8222-222222222222";
    mockPrisma.customer.findFirst.mockResolvedValue({ id: customerId });
    const next = jest.fn() as unknown as NextFunction;

    await requireProjectCustomerScope(request({ customerId }), response, next);

    expect(mockPrisma.customer.findFirst).toHaveBeenCalledWith({
      where: {
        id: customerId,
        orgId: "11111111-1111-4111-8111-111111111111",
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects a customer that is absent from the authenticated organization", async () => {
    const customerId = "33333333-3333-4333-8333-333333333333";
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    const next = jest.fn() as unknown as NextFunction;

    await expect(requireProjectCustomerScope(request({ customerId }), response, next)).rejects.toMatchObject({
      statusCode: 404,
      message: `Customer ${customerId} not found`,
    });

    expect(next).not.toHaveBeenCalled();
  });
});

describe("projectCustomerScopeRouter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lets an allowed POST continue past the mounted scope router", async () => {
    const customerId = "22222222-2222-4222-8222-222222222222";
    mockPrisma.customer.findFirst.mockResolvedValue({ id: customerId });

    await supertest(mountedApp()).post("/projects").send({ customerId }).expect(204);
  });

  it("lets an allowed PATCH continue past the mounted scope router", async () => {
    const customerId = "22222222-2222-4222-8222-222222222222";
    mockPrisma.customer.findFirst.mockResolvedValue({ id: customerId });

    await supertest(mountedApp()).patch("/projects/44444444-4444-4444-8444-444444444444").send({ customerId }).expect(204);
  });

  it("forwards a rejected customer lookup into Express error handling", async () => {
    const customerId = "33333333-3333-4333-8333-333333333333";
    mockPrisma.customer.findFirst.mockResolvedValue(null);

    const res = await supertest(mountedApp()).post("/projects").send({ customerId }).expect(404);

    expect(res.body).toEqual({ message: `Customer ${customerId} not found` });
  });
});
