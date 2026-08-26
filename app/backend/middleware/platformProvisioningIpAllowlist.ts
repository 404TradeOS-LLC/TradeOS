import { NextFunction, Request, Response } from "express";
import { ApiError } from "./errorHandler";

// Optional defense-in-depth on top of infrastructure-level network controls
// (security groups, ALB rules, etc.) — this app has no reliable way to see
// the real client IP unless it sits behind a proxy that sets `trust proxy`
// correctly, so this is a second layer, not the primary control. If the
// allowlist env var is unset, this middleware is a no-op: the README already
// documents that provisioning must be kept behind network controls in
// production, and we don't want local/dev/test setups to silently break
// because no allowlist was configured.
function parseAllowlist(raw: string | undefined): string[] | null {
  if (!raw || raw.trim().length === 0) return null;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeIp(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

export function requirePlatformProvisioningAllowedIp(req: Request, _res: Response, next: NextFunction): void {
  const allowlist = parseAllowlist(process.env.PLATFORM_PROVISIONING_ALLOWED_IPS);
  if (!allowlist) {
    next();
    return;
  }

  const clientIp = normalizeIp(req.ip ?? "");
  if (!allowlist.includes(clientIp)) {
    next(new ApiError(403, "Provisioning is not permitted from this network"));
    return;
  }

  next();
}
