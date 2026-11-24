import { createHash } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import type { MemoryStore } from "express-rate-limit";
import { Request, Response } from "express";

/**
 * Per-user rate limit for GET /api/v1/auth/memberships (CodeQL alert 43,
 * js/missing-rate-limiting).
 *
 * Why a dedicated limiter instead of the shared auth limit: the app shell
 * calls this endpoint on every page load, so the shared auth limit
 * (20 requests / 15 min, IP-scoped) would 429 normal navigation. The
 * budget here is deliberately generous (600 / 15 min per user) — a human
 * cannot load 600 pages in 15 minutes, but a tight loop hammering the
 * endpoint trips it.
 *
 * ORDERING IS LOAD-BEARING — the limiter MUST run BEFORE requireAuth in the
 * route chain. CodeQL's missing-rate-limiting query flags the authorization
 * performed inside requireAuth itself (all three alert references point
 * into app/backend/middleware/auth.ts), and a middleware only "guards" the
 * route when it precedes the expensive handler. A limiter placed after
 * requireAuth leaves the JWT verification itself unguarded, and the query
 * keeps flagging the route — proven twice by the PR #1066 CodeQL check
 * (once with a factory-built limiter, once with a direct call after
 * requireAuth). The other auth routes are not flagged precisely because
 * their limiter runs before requireAuth.
 *
 * KEYING — the limiter cannot key on the verified user id, because that
 * only exists after requireAuth runs. It keys on a SHA-256 hash of the
 * whole Authorization header value (the same header requireAuth reads),
 * so each credential presentation gets its own 600-request budget and no
 * verified identity is needed. The raw header never enters the store —
 * only its hash — and no regex is used to parse it (a Bearer-extraction
 * regex tripped CodeQL js/polynomial-redos on this file). Requests with
 * no header share one "unknown" bucket; they would 401 at requireAuth
 * anyway, so throttling them together is harmless. A caller rotating
 * fresh (invalid) credentials gets a fresh bucket per credential, so this
 * blunts a tight loop, not a distributed credential-rotation attack —
 * the same limit as any pre-authentication keying.
 *
 * IP-scoped keying is deliberately NOT used: the layout fetches server-side
 * from shared Vercel egress IPs, so an IP bucket would throttle all users
 * together. There is deliberately no req.ip fallback: express-rate-limit
 * rejects key generators that reference req.ip (IPv6 bypass risk).
 *
 * Shape is deliberate: the production middleware is a direct top-level
 * rateLimit() call, exactly like authRateLimit and
 * platformProvisioningRateLimit, and `rateLimit` is imported as a NAMED
 * export (the query models `moduleImport("express-rate-limit")` and its
 * `rateLimit` member). The factory below exists only so tests can pass a
 * fresh store and a tight budget; production always uses the direct
 * export. `MemoryStore` is imported type-only.
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

/** Bucket key: SHA-256 of the Authorization header value, or "unknown". */
function membershipsKey(req: Request): string {
  // No regex here: the whole header is hashed as-is, so no pattern can
  // backtrack on a hostile value (a /^Bearer\s+(.+)$/i extraction tripped
  // CodeQL js/polynomial-redos on this file). The key is only a bucket
  // label, not an authentication decision — requireAuth still parses and
  // verifies the credential. Same header value => same bucket; a missing
  // header => the shared "unknown" bucket.
  const bearer = req.header("authorization");
  if (!bearer) return "unknown";
  return createHash("sha256").update(bearer).digest("hex");
}

export const membershipsRateLimit = rateLimit({
  windowMs,
  limit,
  keyGenerator: membershipsKey,
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
    keyGenerator: membershipsKey,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many membership requests, try again later" },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: "Too many membership requests, try again later" });
    },
  });
}
