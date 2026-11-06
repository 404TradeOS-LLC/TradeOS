import { Router } from "express";
import rateLimit from "express-rate-limit";
import { logInfo, logWarn } from "../logging";
import { verifyResendWebhook, type ResendWebhookHeaders } from "../../modules/email/webhook";

export const resendWebhookRouter = Router();

const ATTENTION_EVENTS = new Set([
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.delivery_delayed",
  "email.suppressed",
]);

// Bounded IP budget for anonymous webhook traffic. This is per-instance on
// serverless deployments; a shared edge limiter is a separate release gate.
const resendWebhookRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests" },
});

resendWebhookRouter.post("/", resendWebhookRateLimit, (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  // A missing or malformed signing secret means the endpoint is not provisioned.
  // Fail closed rather than accidentally accepting unsigned delivery notices.
  if (!secret || !secret.startsWith("whsec_")) {
    res.status(503).json({ error: "Resend webhook is not configured" });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(415).json({ error: "Expected a raw JSON webhook payload" });
    return;
  }

  let event;
  try {
    const headers: ResendWebhookHeaders = {
      "svix-id": req.header("svix-id"),
      "svix-timestamp": req.header("svix-timestamp"),
      "svix-signature": req.header("svix-signature"),
    };
    event = verifyResendWebhook(req.body, headers, secret);
  } catch {
    res.status(400).json({ error: "Invalid Resend webhook" });
    return;
  }

  // Record only trusted event metadata. Never log recipients, subjects,
  // private access tokens or the full event payload.
  const metadata = { eventType: event.type, eventId: req.header("svix-id") };
  if (ATTENTION_EVENTS.has(event.type)) {
    logWarn("email.resend_delivery_attention", metadata);
  } else {
    logInfo("email.resend_webhook_accepted", metadata);
  }

  // Ack only; durable per-tenant delivery state, suppressions, and event replay
  // deduplication require separate reviewed storage and tenant mapping. Do not
  // register this receiver for production webhooks until those are available.
  res.status(200).json({ received: true });
});
