import { Request } from "express";
import { AuthContext } from "./auth/context";
import { ApiError } from "./middleware/errorHandler";
import { DomainPermission, hasAnyPermission } from "../domain";

type OrgScopedRequest = Request & {
  orgId?: string;
  auth?: AuthContext;
};

export function requireOrgId(req: Request): string {
  const orgId = (req as OrgScopedRequest).orgId;
  if (!orgId) {
    throw new ApiError(401, "Organization context is required");
  }
  return orgId;
}

export function requireOrgAdmin(req: Request): AuthContext {
  const auth = requireAuthContext(req);
  if (!hasAnyPermission(auth.role, ["team.manage", "company.manage", "settings.manage"])) {
    throw new ApiError(403, "Admin access required");
  }
  return auth;
}

export function requirePermissions(req: Request, permissions: readonly DomainPermission[]): AuthContext {
  const auth = requireAuthContext(req);
  if (!hasAnyPermission(auth.role, permissions)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  return auth;
}

export function requireRoles(req: Request, allowedRoles: string[]): AuthContext {
  const auth = requireAuthContext(req);
  if (!allowedRoles.includes(auth.role)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  return auth;
}

export function requireAuthContext(req: Request): AuthContext {
  const auth = (req as OrgScopedRequest).auth;
  if (!auth) {
    throw new ApiError(401, "Organization context is required");
  }
  return auth;
}

export function requireOrgAccess(req: Request, orgId: string): AuthContext {
  const auth = requireOrgAdmin(req);
  if (auth.orgId !== orgId) {
    throw new ApiError(403, "Cross-organization access is not allowed");
  }
  return auth;
}

export function parsePositiveNumber(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, "Expected a positive number");
  }
  return parsed;
}
