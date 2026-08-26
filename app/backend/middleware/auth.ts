import { NextFunction, Request, Response } from "express";
import { verifyAnyAuthToken } from "../auth/jwt";
import { ApiError } from "./errorHandler";
import { AuthContext } from "../auth/context";
import { resolveAuthContext } from "../auth/session";

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
      .catch(next);
    return;
  }

  throw new ApiError(401, "Missing bearer token");
}
