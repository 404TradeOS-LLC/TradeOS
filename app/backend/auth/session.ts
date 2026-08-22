import { Prisma } from "@prisma/client";
import { basePrisma } from "../../db/client";
import { AuthContext } from "./context";
import { AuthClaims } from "./jwt";
import { ApiError } from "../middleware/errorHandler";
import { getRolePermissions, normalizeRole, SupportedRole } from "../../domain";
import { getDatabaseTransactionMaxWait } from "../../db/requestSession";

export async function resolveAuthContext(claims: AuthClaims): Promise<AuthContext> {
  return basePrisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`select set_config('app.auth_subject', ${claims.sub}, true)`);

    // Explicit select, not a bare findUnique: Prisma's default is to select
    // every scalar column, which would include password_hash (added by a
    // later migration than production currently has applied). Every
    // authenticated request runs this query, so a bare select fails closed
    // for the entire API the moment the AppUser model gains any column not
    // yet present in the deployed schema. List only the fields this function
    // actually reads below (id, isActive, email) -- all present since the
    // very first migration.
    const user = await transaction.appUser.findUnique({
      where: { authSubject: claims.sub },
      select: { id: true, isActive: true, email: true },
    });
    if (!user || !user.isActive) {
      throw new ApiError(403, "Authenticated user is not provisioned in this organization");
    }

    await transaction.$queryRaw(Prisma.sql`
      select
        set_config('app.user_id', ${user.id}, true),
        set_config('app.login_lookup', 'true', true)
    `);

    const membership = await transaction.organizationMembership.findFirst({
      where: {
        userId: user.id,
        status: "active",
        ...(claims.orgId ? { orgId: claims.orgId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      throw new ApiError(403, "Authenticated user does not belong to the requested organization");
    }

    await transaction.$queryRaw(Prisma.sql`select set_config('app.org_id', ${membership.orgId}, true)`);

    return {
      userId: user.id,
      orgId: membership.orgId,
      role: membership.role as SupportedRole,
      canonicalRole: normalizeRole(membership.role),
      permissions: getRolePermissions(membership.role),
      email: user.email,
    };
  }, { maxWait: getDatabaseTransactionMaxWait() });
}
