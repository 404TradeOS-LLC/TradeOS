import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { AuthContext } from "../backend/auth/context";
import type { CustomerPortalContext } from "../modules/customer-portal/service";
import { getRolePermissions, normalizeRole, SupportedRole } from "../domain";

const requestDatabase = new AsyncLocalStorage<Prisma.TransactionClient>();
const sessionActor = new AsyncLocalStorage<AuthContext>();

/** Only actors established by a validated request or background session are exposed. */
export function getCurrentDatabaseSessionActor(): AuthContext | undefined {
  return sessionActor.getStore();
}

export function getRequestDatabaseClient(): Prisma.TransactionClient | undefined {
  return requestDatabase.getStore();
}

/**
 * Establishes the validated session actor for the current async context
 * WITHOUT opening a database transaction. Fluid PR-4: the Athena chat route
 * runs outside the request-scoped RLS transaction, so the controller sets
 * the actor here once per request; each bounded persist below then opens its
 * own short RLS session from this actor (see runInDatabaseTransaction). The
 * actor is never taken from request input — only from requireAuth-validated
 * req.auth.
 */
export function runWithSessionActor<T>(actor: AuthContext, operation: () => Promise<T>): Promise<T> {
  return sessionActor.run(actor, operation);
}

export function runInDatabaseTransaction<T>(
  client: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  sessionSource = "http"
): Promise<T> {
  const activeTransaction = getRequestDatabaseClient();
  if (activeTransaction) return operation(activeTransaction);
  const actor = getCurrentDatabaseSessionActor();
  if (!actor) {
    return client.$transaction((transaction) => requestDatabase.run(transaction, () => operation(transaction)));
  }
  // Short RLS session for one bounded persist: the same session variables
  // runWithDatabaseSession sets, scoped to this transaction only
  // (set_config is_local=true). The provider wait never happens inside one
  // of these — Fluid PR-4 moves the Gemini call outside every transaction,
  // so a slow model call can no longer hold a pool connection or reach
  // RLS_TRANSACTION_TIMEOUT_MS.
  return client.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${actor.userId}, true),
          set_config('app.org_id', ${actor.orgId}, true),
          set_config('app.role', ${actor.role}, true),
          set_config('app.session_source', ${sessionSource}, true)
      `);

      return requestDatabase.run(transaction, () => operation(transaction));
    },
    { maxWait: getDatabaseTransactionMaxWait(), timeout: getDatabaseTransactionTimeout() }
  );
}

export async function runWithDatabaseSession<T>(
  client: PrismaClient,
  auth: AuthContext,
  operation: () => Promise<T>,
  sessionSource = "http"
): Promise<T> {
  const maxWait = getDatabaseTransactionMaxWait();
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

      return requestDatabase.run(transaction, () => sessionActor.run(auth, operation));
    },
    { maxWait, timeout }
  );
}

export async function runWithPortalDatabaseSession<T>(
  client: PrismaClient,
  portal: CustomerPortalContext,
  operation: () => Promise<T>,
  sessionSource = "customer_portal",
  portalSessionHash = ""
): Promise<T> {
  const maxWait = getDatabaseTransactionMaxWait();
  const timeout = parseTransactionTimeout(process.env.RLS_TRANSACTION_TIMEOUT_MS);

  return client.$transaction(
    async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${portal.customerId}, true),
          set_config('app.org_id', ${portal.orgId}, true),
          set_config('app.role', 'portal_customer', true),
          set_config('app.portal_customer_id', ${portal.customerId}, true),
          set_config('app.portal_session_id', ${portal.sessionId}, true),
          set_config('app.portal_session_hash', ${portalSessionHash}, true),
          set_config('app.session_source', ${sessionSource}, true)
      `);

      return requestDatabase.run(transaction, operation);
    },
    { maxWait, timeout }
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
  operation: (auth: AuthContext) => Promise<T>
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

  return runWithDatabaseSession(client, auth, () => operation(auth), `job:${input.jobName}`);
}

export function getDatabaseTransactionMaxWait(): number {
  return parseTransactionDuration(process.env.RLS_TRANSACTION_MAX_WAIT_MS, 15_000);
}

export function getDatabaseTransactionTimeout(): number {
  return parseTransactionTimeout(process.env.RLS_TRANSACTION_TIMEOUT_MS);
}

function parseTransactionTimeout(value: string | undefined): number {
  return parseTransactionDuration(value, 60_000);
}

function parseTransactionDuration(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
