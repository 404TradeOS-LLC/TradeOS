import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { IncrementResponse, Options, Store } from "express-rate-limit";
import { basePrisma } from "../../db/client";

export type SupplierCronRateLimitNamespace = "authorized" | "unauthorized";

/**
 * A shared rate-limit store for horizontally scaled Vercel functions.
 *
 * No IP or bearer token is stored in PostgreSQL: only a SHA-256 digest of
 * the namespace and key. The private SQL wrapper atomically increments counts
 * and resets expired windows across every function instance. Database errors
 * reject the request (express-rate-limit's default fail-closed behavior).
 */
export class SharedSupplierCronRateLimitStore implements Store {
  private windowMs = 15 * 60_000;

  constructor(private readonly namespace: SupplierCronRateLimitNamespace) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const keyHash = createHash("sha256")
      .update(`supplier-sync-cron:${this.namespace}:${key}`)
      .digest("hex");
    const rows = await basePrisma.$queryRaw<Array<{
      total_hits: number;
      window_resets_at: Date;
    }>>(Prisma.sql`
      select total_hits, window_resets_at
      from tradeos_private.consume_supplier_cron_rate_limit(
        ${keyHash},
        ${this.windowMs}::integer
      )
    `);
    if (rows.length !== 1) {
      throw new Error("Shared supplier cron rate limiter returned no budget");
    }
    return {
      totalHits: Number(rows[0].total_hits),
      resetTime: new Date(rows[0].window_resets_at),
    };
  }
}
