import { NextFunction, Request, Response } from "express";
import { verifyAnyAuthToken } from "../auth/jwt";
import { ApiError } from "./errorHandler";
import { AuthContext } from "../auth/context";
import { resolveAuthContext } from "../auth/session";
import { logError } from "../logging";

// Verifies identity and resolves the active database-backed organization
// membership before request-scoped RLS session variables are established.
export interface AuthedRequest extends Request {
  orgId?: string;
  auth?: AuthContext;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const bearer = req.header("authorization");
  const token = bearer?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (token) {
    void verifyAnyAuthToken(token)
      .then((claims) => resolveAuthContext(claims))
      .then((auth) => {
        req.auth = auth;
        req.orgId = auth.orgId;
      })
      .then(() => next())
      .catch((error) => {
        // No trustworthy organization exists for malformed/invalid tokens;
        // emit only a fixed reason code and never log the bearer or error.
        // Session resolution records tenant-scoped failures when a verified
        // user and membership are available.
        logError("auth.authentication_failed", {
          reasonCode: error instanceof ApiError && error.statusCode === 403 ? "organization_membership_denied" : "invalid_bearer_token",
        });
        next(error);
      });
    return;
  }

  logError("auth.authentication_failed", { reasonCode: "missing_bearer_token" });
  throw new ApiError(401, "Missing bearer token");
}
