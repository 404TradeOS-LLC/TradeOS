import { PrismaClient } from "@prisma/client";
import { getRequestDatabaseClient } from "./requestSession";
import { resolveRuntimeDatabaseUrl } from "./runtimeDatabaseUrl";

// Singleton Prisma client. Reused across modules/services to avoid exhausting
// database connections, especially under ts-node-dev/nodemon hot reloads.
const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  abcTokenRotationPrisma?: PrismaClient;
};

const runtimeDatabaseUrl = resolveRuntimeDatabaseUrl(process.env.DATABASE_URL);

export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient(
    runtimeDatabaseUrl ? { datasources: { db: { url: runtimeDatabaseUrl } } } : undefined,
  );

/**
 * A separate, lazy, bounded Prisma pool exclusively for ABC provider-driven
 * refresh-token rotation. A request can hold basePrisma's sole Vercel pool
 * connection; the rotated credential must COMMIT in another transaction.
 * Uses the same restricted DATABASE_URL and transaction-pooler configuration.
 */
export function getSupplierTokenRotationClient(): PrismaClient {
  if (!globalForPrisma.abcTokenRotationPrisma) {
    globalForPrisma.abcTokenRotationPrisma = new PrismaClient(
      runtimeDatabaseUrl ? { datasources: { db: { url: runtimeDatabaseUrl } } } : undefined,
    );
  }
  return globalForPrisma.abcTokenRotationPrisma;
}

// Existing services import this object once. The proxy transparently routes
// model calls through the request transaction when RLS context is active.
export const prisma = new Proxy(basePrisma, {
  get(target, property, receiver) {
    const client = getRequestDatabaseClient() ?? target;
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}
