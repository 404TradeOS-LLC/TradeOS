import { Prisma } from "@prisma/client";
import { basePrisma } from "../../db/client";
import { AuthContext } from "./context";
import { AuthClaims } from "./jwt";
import { ApiError } from "../middleware/errorHandler";
import { getRolePermissions, normalizeRole, SupportedRole } from "../../domain";
import { getDatabaseTransactionMaxWait } from "../../db/requestSession";
import { buildAthenaSecurityAuditEvent } from "../../modules/athena-audit/securityEvents";
import { createPrismaAthenaAuditStore } from "../../modules/athena-audit/store";

type KnownMembership = { orgId: string; role: string };

async function recordAuthenticationFailure(
  transaction: Prisma.TransactionClient,
  userId: string,
  membership: KnownMembership | null,
  reasonCode: "inactive_identity" | "organization_membership_denied"
): Promise<void> {
  if (!membership) return;
  try {
    await transaction.$queryRaw(Prisma.sql`
      select
        set_config('app.user_id', ${userId}, true),
        set_config('app.org_id', ${membership.orgId}, true),
        set_config('app.role', ${membership.role}, true)
    `);
    await createPrismaAthenaAuditStore(transaction).record(
      buildAthenaSecurityAuditEvent({
        eventType: "authentication_failed",
        organization: membership.orgId,
        actor: { userId, role: membership.role },
        outcome: "denied",
        metadata: { eventSource: "auth_session", reasonCode },
      })
    );
  } catch {
    // Authentication remains fail-closed even if best-effort audit storage is
    // unavailable.
  }
}

export async function resolveAuthContext(claims: AuthClaims): Promise<AuthContext> {
  const auth = await basePrisma.$transaction(async (transaction) => {
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
      if (user) {
        await transaction.$queryRaw(Prisma.sql`select set_config('app.login_lookup', 'true', true)`);
        const membership = claims.orgId
          ? await transaction.organizationMembership.findFirst({
              where: { userId: user.id, orgId: claims.orgId },
              orderBy: { createdAt: "asc" },
              select: { orgId: true, role: true },
            })
          : null;
        await recordAuthenticationFailure(transaction, user.id, membership, "inactive_identity");
        await transaction.authRefreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date(), lastUsedAt: new Date() },
        });
      }
      return null;
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
      const knownMembership = await transaction.organizationMembership.findFirst({
        where: { userId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
        select: { orgId: true, role: true },
      });
      await recordAuthenticationFailure(transaction, user.id, knownMembership, "organization_membership_denied");
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

  if (!auth) throw new ApiError(403, "Authenticated user is not provisioned in this organization");
  return auth;
}
