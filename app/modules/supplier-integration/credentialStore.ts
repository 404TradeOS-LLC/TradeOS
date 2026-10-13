import { Prisma } from "@prisma/client";
import { getSupplierTokenRotationClient, prisma } from "../../db/client";
import { getCurrentDatabaseSessionActor, getRequestDatabaseClient, runWithDatabaseSession } from "../../db/requestSession";

export interface SupplierRefreshTokenStore {
  load(orgId: string, supplierId: string): Promise<string | null>;
  persist(orgId: string, supplierId: string, refreshToken: string): Promise<void>;
  /** Authorization callback only: reuse its already validated, tenant-scoped transaction. */
  persistInCurrentSession(orgId: string, supplierId: string, refreshToken: string): Promise<void>;
}

function requireAuthorizedActor(orgId: string) {
  const actor = getCurrentDatabaseSessionActor();
  if (!actor || actor.orgId !== orgId || !["owner", "admin"].includes(actor.role)) {
    throw new Error("ABC Supply rotation requires an active owner/admin tenant session");
  }
  return actor;
}

async function writeRefreshToken(orgId: string, supplierId: string, refreshToken: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    select tradeos_private.put_abc_supply_refresh_token(
      ${orgId}::uuid,
      ${supplierId}::uuid,
      ${refreshToken}
    )
  `);
}

/**
 * Durable ABC refresh-token store backed by the private SQL wrappers created
 * by the supplier-credential Vault migration. The wrappers enforce the active
 * tenant/user/role session and keep direct Vault privileges away from the app
 * role.
 */
export const abcSupplyRefreshTokenStore: SupplierRefreshTokenStore = {
  async load(orgId, supplierId) {
    const rows = await prisma.$queryRaw<Array<{ refresh_token: string | null }>>(Prisma.sql`
      select tradeos_private.get_abc_supply_refresh_token(
        ${orgId}::uuid,
        ${supplierId}::uuid
      ) as refresh_token
    `);
    return rows[0]?.refresh_token?.trim() || null;
  },

  async persist(orgId, supplierId, refreshToken) {
    const actor = requireAuthorizedActor(orgId);

    // ABC invalidates the prior token when it rotates. Use a separate bounded
    // pool so a caller holding basePrisma's sole connection cannot block this
    // independent commit; retain the same RLS-scoped Vault SQL wrapper.
    await runWithDatabaseSession(getSupplierTokenRotationClient(), actor, () =>
      writeRefreshToken(orgId, supplierId, refreshToken), "supplier_refresh_token_rotation");
  },

  async persistInCurrentSession(orgId, supplierId, refreshToken) {
    requireAuthorizedActor(orgId);
    // Authorization-code exchange is completed before this call. The callback
    // already holds a tenant-scoped background transaction; opening a second
    // transaction deadlocks when the Prisma pool has a single connection.
    // This write commits with the callback session, not with pricing sync.
    if (!getRequestDatabaseClient()) {
      throw new Error("ABC OAuth token persistence requires an active database transaction");
    }
    await writeRefreshToken(orgId, supplierId, refreshToken);
  },
};
