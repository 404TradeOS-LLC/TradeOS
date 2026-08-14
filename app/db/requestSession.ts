import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { AuthContext } from "../backend/auth/context";
import { getRolePermissions, normalizeRole, SupportedRole } from "../domain";

const requestDatabase = new AsyncLocalStorage<Prisma.TransactionClient>();

export function getRequestDatabaseClient(): Prisma.TransactionClient | undefined {
  return requestDatabase.getStore();
}

export function runInDatabaseTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const activeTransaction = getRequestDatabaseClient();
  return activeTransaction ? operation(activeTransaction) : client.$transaction((transaction) => requestDatabase.run(transaction, () => operation(transaction)));
}

export async function runWithDatabaseSession<T>(
  client: PrismaClient,
  auth: AuthContext,
  operation: () => Promise<T>,
  sessionSource = "http"
): Promise<T> {
  const timeout = parseTransactionTimeout(process.env.RLS_TRANSACTION_TIMEOUT_MS);

  return client.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${auth.userId}, true),
          set_config('app.org_id', ${auth.orgId}, true),
          set_config('app.role', ${auth.role}, true),
          set_config('app.session_source', ${sessionSource}, true)
      `);

      return requestDatabase.run(transaction, operation);
    },
    { timeout }
  );
}

export interface BackgroundDatabaseSessionInput {
  jobName: string;
  orgId: string;
  userId: string;
}

export async function runWithBackgroundDatabaseSession<T>(
  client: PrismaClient,
  input: BackgroundDatabaseSessionInput,
  operation: () => Promise<T>
): Promise<T> {
  if (!/^[a-z0-9][a-z0-9:_-]{1,63}$/i.test(input.jobName)) {
    throw new Error("Background job name must be 2-64 letters, numbers, colons, underscores, or hyphens");
  }

  const auth = await client.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`
      select
        set_config('app.user_id', ${input.userId}, true),
        set_config('app.org_id', ${input.orgId}, true),
        set_config('app.session_source', ${`job:${input.jobName}:bootstrap`}, true)
    `);

    const user = await transaction.appUser.findFirst({
      where: { id: input.userId, isActive: true },
    });
    const membership = await transaction.organizationMembership.findFirst({
      where: { orgId: input.orgId, userId: input.userId, status: "active" },
    });
    if (!user || !membership) {
      throw new Error("Background job identity must have an active organization membership");
    }

    return {
      userId: user.id,
      orgId: membership.orgId,
      role: membership.role as SupportedRole,
      canonicalRole: normalizeRole(membership.role),
      permissions: getRolePermissions(membership.role),
      email: user.email,
    };
  });

  return runWithDatabaseSession(client, auth, operation, `job:${input.jobName}`);
}

function parseTransactionTimeout(value: string | undefined): number {
  if (!value) return 60_000;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}
