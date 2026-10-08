import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { getCurrentDatabaseSessionActor, runWithDatabaseSession } from "../../db/requestSession";

export interface SupplierRefreshTokenStore {
  load(orgId: string, supplierId: string): Promise<string | null>;
  persist(orgId: string, supplierId: string, refreshToken: string): Promise<void>;
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
    const actor = getCurrentDatabaseSessionActor();
    if (!actor || actor.orgId !== orgId || !["owner", "admin"].includes(actor.role)) {
      throw new Error("ABC Supply rotation requires an active owner/admin tenant session");
    }

    // An ABC refresh token becomes invalid as soon as the provider rotates it.
    // This write needs its own COMMIT: a later pricing/proposal failure must
    // never roll the new token back together with the outer sync transaction.
    await runWithDatabaseSession(basePrisma, actor, async () => {
      await prisma.$executeRaw(Prisma.sql`
        select tradeos_private.put_abc_supply_refresh_token(
          ${orgId}::uuid,
          ${supplierId}::uuid,
          ${refreshToken}
        )
      `);
    }, "supplier_refresh_token_rotation");
  },
};
