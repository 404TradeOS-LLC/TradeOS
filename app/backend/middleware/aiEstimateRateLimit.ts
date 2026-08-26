import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

const windowMs = Number(process.env.AI_ESTIMATE_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
const max = Number(process.env.AI_ESTIMATE_RATE_LIMIT_MAX) || 30;

export const aiEstimateRateLimit = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI estimator requests, try again later" },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: "Too many AI estimator requests, try again later" });
  },
});
