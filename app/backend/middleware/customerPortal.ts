import { NextFunction, Request, Response } from "express";
import { basePrisma } from "../../db/client";
import { runWithPortalDatabaseSession } from "../../db/requestSession";
import { ApiError } from "./errorHandler";
import { CustomerPortalContext, CustomerPortalService, CUSTOMER_PORTAL_SESSION_HEADER } from "../../modules/customer-portal/service";

export interface CustomerPortalRequest extends Request {
  customerPortal?: CustomerPortalContext;
  orgId?: string;
}

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
      req.orgId = context.orgId;
      next();
    })
    .catch(next);
}

export function customerPortalDatabaseSession(req: CustomerPortalRequest, res: Response, next: NextFunction): void {
  if (!req.customerPortal) {
    next(new ApiError(500, "Customer portal database context is missing"));
    return;
  }

  void runWithPortalDatabaseSession(basePrisma, req.customerPortal, () => waitForResponse(res, next)).catch((error) => {
    if (!res.headersSent) next(error);
  });
}

function waitForResponse(res: Response, next: NextFunction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => settle(resolve);
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
