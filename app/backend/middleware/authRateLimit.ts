import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// No tenant identity exists yet at signup/login time, so this is IP-scoped,
// mirroring platformProvisioningRateLimit. Looser than provisioning (this is
// routine user traffic, not a rare ops action) but still tight enough to
// blunt credential-stuffing / signup-spam attempts.
const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;

export const authRateLimit = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, try again later" },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many attempts, try again later" });
  },
});
