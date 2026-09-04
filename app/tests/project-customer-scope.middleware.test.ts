import { NextFunction, Request, Response } from "express";

const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));

import { requireProjectCustomerScope } from "../backend/middleware/projectCustomerScope";

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
