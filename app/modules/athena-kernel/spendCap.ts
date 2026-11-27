import { prisma } from "../../db/client";

// Daily Gemini spend cap for Athena drafts (founder-approved 2026-11-26).
//
// Why this exists: every real draft call spends Billy's Gemini API key
// (~$0.002/call on gemini-3.5-flash-lite). The provider already caps output
// tokens and tracks per-call cost, but nothing ever *stopped* calls when
// spend crossed a line - a runaway loop or a classifier bug (like the
// 2026-11-25 "schedule" over-match) would burn silently until someone
// noticed the cost alert. This cap is the circuit breaker.
//
// How it works:
// - The cap is per organization per UTC calendar day, default $1.00
//   (~500 drafts), overridable via ATHENA_DAILY_SPEND_CAP_USD. 0 blocks
//   all real drafts (kill switch); an unset/invalid/negative value falls
//   back to the default.
// - Spend is read from the Athena generation-run ledger
//   (athena_generation_runs): every successful model call persists a run
//   with estimatedUsd, unconditionally - unlike the telemetry cost rows,
//   which are only written when ATHENA_TELEMETRY_ENABLED and
//   ATHENA_COST_TRACKING_ENABLED are both on. A generation run exists
//   exactly when Gemini returned text, so the ledger is the money-spent
//   record. Fake-provider runs carry no estimatedUsd and never count.
// - The check runs in the kernel (service.ts produceDraftResponse) before
//   EVERY real provider attempt, including client-level retries: the
//   kernel never re-fires generateDraft inside one request, so each retry
//   is a fresh produceDraftResponse call and re-checks the cap. Concurrent
//   attempts can overshoot slightly (each sees the spend as of its own
//   read, ~$0.002 per in-flight call) - the cap is a budget guard, not a
//   real-time ledger.
// - The cap is per org because the spend ledger is org-scoped and the
//   kernel only ever queries through the RLS-scoped prisma proxy; summing
//   across orgs would need a service-role bypass the codebase deliberately
//   avoids. With one real org per environment the per-org cap is the
//   effective global cap.

export const ATHENA_DAILY_SPEND_CAP_ENV_VAR = "ATHENA_DAILY_SPEND_CAP_USD";
export const ATHENA_DEFAULT_DAILY_SPEND_CAP_USD = 1;

export function parseDailySpendCapUsd(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[ATHENA_DAILY_SPEND_CAP_ENV_VAR];
  if (raw === undefined || raw.trim() === "") return ATHENA_DEFAULT_DAILY_SPEND_CAP_USD;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return ATHENA_DEFAULT_DAILY_SPEND_CAP_USD;
  return parsed;
}

/** UTC calendar-day window containing `now` ([start, end)). */
export function getUtcDayWindow(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export interface AthenaDailySpendStatus {
  spentUsd: number;
  capUsd: number;
  reached: boolean;
  dayStartUtc: Date;
}

export async function getDailySpendStatus(input: { orgId: string; capUsd: number; now?: Date }): Promise<AthenaDailySpendStatus> {
  const { start, end } = getUtcDayWindow(input.now ?? new Date());
  const rows = await prisma.athenaGenerationRun.findMany({
    where: {
      orgId: input.orgId,
      status: "succeeded",
      createdAt: { gte: start, lt: end },
      estimatedUsd: { not: null },
    },
    select: { estimatedUsd: true },
  });
  let spentUsd = 0;
  for (const row of rows) {
    spentUsd += row.estimatedUsd?.toNumber() ?? 0;
  }
  return { spentUsd, capUsd: input.capUsd, reached: spentUsd >= input.capUsd, dayStartUtc: start };
}
