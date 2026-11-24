import { NextFunction, Request, Response } from "express";
import { basePrisma } from "../../db/client";
import { runWithPortalDatabaseSession } from "../../db/requestSession";
import { ApiError } from "./errorHandler";
import {
  CustomerPortalContext,
  CustomerPortalService,
  CUSTOMER_PORTAL_SESSION_HEADER,
  hashPortalSecret,
} from "../../modules/customer-portal/service";

export interface CustomerPortalRequest extends Request {
  customerPortal?: CustomerPortalContext;
  orgId?: string;
}

const portalSessionHashes = new WeakMap<CustomerPortalRequest, string>();
const portalService = new CustomerPortalService();

export function requireCustomerPortalSession(req: CustomerPortalRequest, _res: Response, next: NextFunction): void {
  const token = req.header(CUSTOMER_PORTAL_SESSION_HEADER);
  if (!token) {
    next(new ApiError(401, "Customer portal session is required"));
    return;
  }

  void portalService
    .resolveSession(token)
    .then((context) => {
      req.customerPortal = context;
      portalSessionHashes.set(req, hashPortalSecret(token));
      req.orgId = context.orgId;
      next();
    })
    .catch(next);
}

export function customerPortalDatabaseSession(req: CustomerPortalRequest, res: Response, next: NextFunction): void {
  const portalSessionHash = portalSessionHashes.get(req);
  if (!req.customerPortal || !portalSessionHash) {
    next(new ApiError(500, "Customer portal database context is missing"));
    return;
  }

  void runWithPortalDatabaseSession(
    basePrisma,
    req.customerPortal,
    () => waitForResponse(res, next),
    "customer_portal",
    portalSessionHash,
  ).catch((error) => {
    if (!res.headersSent) next(error);
  });
}

function waitForResponse(res: Response, next: NextFunction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    // DES-10-F7 (review repair): an error response must roll the portal
    // transaction back, not commit it. The whole portal request runs in
    // one transaction; if a handler writes (proposal response, delivery
    // event) and a later step fails, committing would leave the proposal
    // answered without its audit row while the client sees an error — and
    // a retry would then 409 on the already-recorded response.
    const finish = () =>
      settle(
        res.statusCode >= 400
          ? () => reject(new Error(`Customer portal response failed with status ${res.statusCode}; rolling back portal transaction`))
          : resolve,
      );
    const fail = (error: Error) => settle(() => reject(error));
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      res.off("finish", finish);
      res.off("close", finish);
      res.off("error", fail);
      complete();
    };

    res.once("finish", finish);
    res.once("close", finish);
    res.once("error", fail);

    try {
      next();
    } catch (error) {
      settle(() => reject(error));
    }
  });
}
