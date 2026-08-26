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
