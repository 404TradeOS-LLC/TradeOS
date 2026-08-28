import rateLimit from "express-rate-limit";

export const customerPortalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many customer portal access attempts. Try again later." },
});
