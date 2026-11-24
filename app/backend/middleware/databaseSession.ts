import { NextFunction, Response } from "express";
import { basePrisma } from "../../db/client";
import { runWithDatabaseSession } from "../../db/requestSession";
import { AuthedRequest } from "./auth";
import { ApiError } from "./errorHandler";

export function databaseSession(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    next(new ApiError(500, "Authenticated database session context is missing"));
    return;
  }

  void runWithDatabaseSession(basePrisma, req.auth, () => waitForResponse(res, next)).catch((error) => {
    if (!res.headersSent && !res.destroyed) next(error);
  });
}

function waitForResponse(res: Response, next: NextFunction): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (res.statusCode >= 400) {
        settle(() => reject(new Error("Request returned an error response; rolling back database transaction")));
        return;
      }
      settle(resolve);
    };
    const close = () => {
      if (res.writableFinished) {
        finish();
        return;
      }
      settle(() => reject(new Error("Request closed before response completed; rolling back database transaction")));
    };
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
    res.once("close", close);
    res.once("error", fail);

    try {
      next();
    } catch (error) {
      settle(() => reject(error));
    }
  });
}
