import rateLimit, { MemoryStore } from "express-rate-limit";
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
 */
export function createMembershipsRateLimit(options: {
  windowMs?: number;
  limit?: number;
  store?: InstanceType<typeof MemoryStore>;
} = {}) {
  const windowMs =
    options.windowMs ?? (Number(process.env.MEMBERSHIPS_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000);
  const limit =
    options.limit ?? (Number(process.env.MEMBERSHIPS_RATE_LIMIT_MAX) || 600);
  return rateLimit({
    windowMs,
    limit,
    ...(options.store ? { store: options.store } : {}),
    keyGenerator: (req: Request) =>
      (req as AuthedRequest).auth?.userId ?? "unknown",
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many membership requests, try again later" },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "Too many membership requests, try again later" });
    },
  });
}

export const membershipsRateLimit = createMembershipsRateLimit();
