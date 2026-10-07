import { timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import {
  parseSupplierPriceSyncJobSpecs,
  runSupplierPriceSyncJobs,
} from "../../modules/supplier-integration/scheduler";

/**
 * Vercel Cron entrypoint for scheduled supplier price syncs.
 *
 * TradeOS deliberately does not start its in-process node-cron scheduler
 * inside the Vercel serverless deployment, so SUPPLIER_PRICE_SYNC_JOBS alone
 * never schedules anything there. Vercel Cron calls
 * GET /api/cron/supplier-price-sync on the vercel.json schedule instead, and
 * this handler runs the same runSupplierPriceSyncJobs() path the one-shot
 * CLI script uses.
 *
 * Authentication: Vercel automatically attaches
 * `Authorization: Bearer <CRON_SECRET>` to cron invocations when the
 * CRON_SECRET env var is set on the project. This endpoint accepts nothing
 * else — no JWT, no session — and fails closed (500) when CRON_SECRET itself
 * is unset, because then the endpoint cannot be secured.
 */
function bearerMatches(header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(header, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const cronController = {
  async runSupplierPriceSync(req: Request, res: Response): Promise<void> {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      res.status(500).json({ error: "cron_not_configured" });
      return;
    }
    if (!bearerMatches(req.headers.authorization, cronSecret)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const specs = parseSupplierPriceSyncJobSpecs(process.env.SUPPLIER_PRICE_SYNC_JOBS);
    const outcomes = await runSupplierPriceSyncJobs(specs);
    res.status(200).json({ outcomes });
  },
};
