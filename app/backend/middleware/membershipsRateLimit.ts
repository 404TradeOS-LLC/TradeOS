import { rateLimit } from "express-rate-limit";
import type { MemoryStore } from "express-rate-limit";
import { Request, Response } from "express";
import type { AuthedRequest } from "./auth";

/**
 * Per-user rate limit for GET /api/v1/auth/memberships (CodeQL alert 43,
 * js/missing-rate-limiting).
 *
 * Why a dedicated limiter instead of the shared auth limit: the app shell
 * calls this endpoint on every page load, so the shared auth limit
 * (20 requests / 15 min, IP-scoped) would 429 normal navigation. The
 * budget here is deliberately generous (600 / 15 min per user) — a human
 * cannot load 600 pages in 15 minutes, but a tight loop hammering the
 * endpoint trips it. The key is the authenticated user id, not the IP:
 * the layout fetches server-side from shared Vercel egress IPs, so an
 * IP-scoped bucket would throttle all users together. There is deliberately
 * no req.ip fallback: express-rate-limit rejects key generators that
 * reference req.ip (IPv6 bypass risk), and unauthenticated requests never
 * reach this limiter anyway (requireAuth 401s first).
 *
 * Must run AFTER requireAuth in the route chain: the key comes from
 * req.auth.userId, which only exists once the bearer credential is verified.
 * Unauthenticated requests never reach it (requireAuth 401s first) and
 * never consume budget.
 *
 * Shape is deliberate: the production middleware is a direct top-level
 * rateLimit() call, exactly like authRateLimit and
 * platformProvisioningRateLimit. CodeQL's missing-rate-limiting query does
 * not see through a factory function, so building the production middleware
 * through createMembershipsRateLimit left the route flagged (proven by the
 * PR #1066 CodeQL check). The factory below exists only so tests can pass
 * a fresh store and a tight budget; production always uses the direct
 * export. The import shape is deliberate too: `rateLimit` is imported as a
 * NAMED export (the query models `moduleImport("express-rate-limit")` and
 * its `rateLimit` member). A default import combined with a named
 * `MemoryStore` import left the route flagged even as a direct call —
 * the second PR #1066 CodeQL run proved it — so do not switch this back
 * to a default import; `MemoryStore` is imported type-only for that reason.
 *
 * Per-instance budget (accepted limitation, same as authRateLimit and
 * platformProvisioningRateLimit): the default memory store keeps counts
 * per process, so on the serverless deployment the effective budget is
 * 600 per active instance, not 600 deployment-wide. That is acceptable
 * here — the limit exists to blunt a tight loop hammering one endpoint,
 * not to enforce an exact global quota — and no shared store (e.g. Redis)
 * is provisioned for this deployment. Do not add one in this lane.
 */
const windowMs = Number(process.env.MEMBERSHIPS_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const limit = Number(process.env.MEMBERSHIPS_RATE_LIMIT_MAX) || 600;

export const membershipsRateLimit = rateLimit({
  windowMs,
  limit,
  keyGenerator: (req: Request) => (req as AuthedRequest).auth?.userId ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many membership requests, try again later" },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many membership requests, try again later" });
  },
});

/** Test-only factory: same limiter shape, with an injectable store/budget. */
export function createMembershipsRateLimit(options: {
  windowMs?: number;
  limit?: number;
  store?: InstanceType<typeof MemoryStore>;
} = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? windowMs,
    limit: options.limit ?? limit,
    ...(options.store ? { store: options.store } : {}),
    keyGenerator: (req: Request) => (req as AuthedRequest).auth?.userId ?? "unknown",
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many membership requests, try again later" },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "Too many membership requests, try again later" });
    },
  });
}
