import { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logInfo } from "../logging";

export function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (!raw || raw.trim().length === 0) return false;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;

  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 0) return numeric;

  return raw.trim();
}

export function assignRequestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logInfo("request.completed", {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      ip: req.ip,
    });
  });

  next();
}

// The production frontend, plus any Vercel Preview deployment of the
// "tradeos-costbook-web" project (URLs like
// https://tradeos-costbook-web-<hash>.vercel.app or
// https://tradeos-costbook-web-git-<branch>-<scope>.vercel.app) and local
// development. Auth here is bearer-token-only (no cookies), so a wide-open
// policy isn't a credential-hijack risk the way it would be with cookie
// auth, but an explicit allowlist is still tighter than reflecting any
// origin. CORS_ADDITIONAL_ORIGINS (comma-separated) extends this list
// without code changes, e.g. for a staging domain.
const DEFAULT_ALLOWED_ORIGINS = ["https://app.404tradeos.com"];
const VERCEL_PREVIEW_ORIGIN_PATTERN = /^https:\/\/tradeos-costbook-web-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/;
const LOCALHOST_ORIGIN_PATTERN = /^http:\/\/localhost(?::\d+)?$/;

export function isAllowedCorsOrigin(origin: string | undefined, additionalOrigins?: string): boolean {
  // Requests with no Origin header (server-to-server calls, curl, same-origin
  // navigation) aren't subject to CORS at all — nothing to allow or deny.
  if (!origin) return true;
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) return true;
  if (VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)) return true;
  if (LOCALHOST_ORIGIN_PATTERN.test(origin)) return true;

  const extras = (additionalOrigins ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return extras.includes(origin);
}

export function buildCorsOriginHandler(
  additionalOrigins: string | undefined = process.env.CORS_ADDITIONAL_ORIGINS,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  return (origin, callback) => {
    if (isAllowedCorsOrigin(origin, additionalOrigins)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  };
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  if (process.env.ENABLE_STRICT_TRANSPORT_SECURITY === "true") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}
