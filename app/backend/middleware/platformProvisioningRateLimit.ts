import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// Provisioning has no tenant identity to rate-limit by yet, so this is
// IP-scoped. Defaults are deliberately tight: legitimate provisioning is a
// rare, deliberate operation (new customer onboarding), not routine traffic.
const windowMs = Number(process.env.PLATFORM_PROVISIONING_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const max = Number(process.env.PLATFORM_PROVISIONING_RATE_LIMIT_MAX) || 5;

export const platformProvisioningRateLimit = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many provisioning attempts, try again later" },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many provisioning attempts, try again later" });
  },
});
