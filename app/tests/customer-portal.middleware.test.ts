import { Response } from "express";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { CustomerPortalService } from "../modules/customer-portal/service";
import { CustomerPortalRequest, customerPortalDatabaseSession, requireCustomerPortalSession } from "../backend/middleware/customerPortal";
import * as requestSession from "../db/requestSession";
import { basePrisma } from "../db/client";

const bearerToken = `portal-session-${"a".repeat(43)}`;
const context = { sessionId: "session-a", accessTokenId: "access-a", orgId: "org-a", customerId: "customer-a" };

describe("customer portal request middleware", () => {
  afterEach(() => jest.restoreAllMocks());

  it("retains only the validated session digest for the scoped database transaction", async () => {
    jest.spyOn(CustomerPortalService.prototype, "resolveSession").mockResolvedValue(context);
    const request = { header: jest.fn().mockReturnValue(bearerToken) } as unknown as CustomerPortalRequest;
    const next = jest.fn();

    requireCustomerPortalSession(request, {} as Response, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(request.customerPortal).toEqual(context);
    expect(request).not.toHaveProperty("customerPortalSessionHash");
    expect(next).toHaveBeenCalledWith();

    const runWithPortalDatabaseSession = jest.spyOn(requestSession, "runWithPortalDatabaseSession").mockResolvedValue(undefined);
    const response = new EventEmitter() as EventEmitter & Response;
    Object.defineProperty(response, "headersSent", { value: false });
    customerPortalDatabaseSession(request, response, jest.fn());
    expect(runWithPortalDatabaseSession).toHaveBeenCalledWith(
      basePrisma,
      context,
      expect.any(Function),
      "customer_portal",
      createHash("sha256").update(bearerToken, "utf8").digest("hex"),
    );
  });

  it("does not attach a digest when session validation fails", async () => {
    const failure = new Error("invalid portal session");
    jest.spyOn(CustomerPortalService.prototype, "resolveSession").mockRejectedValue(failure);
    const request = { header: jest.fn().mockReturnValue(bearerToken) } as unknown as CustomerPortalRequest;
    const next = jest.fn();

    requireCustomerPortalSession(request, {} as Response, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(request).not.toHaveProperty("customerPortalSessionHash");
    expect(next).toHaveBeenCalledWith(failure);
  });
});
