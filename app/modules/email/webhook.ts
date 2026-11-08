import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_MAX_AGE_SECONDS = 300;
const WEBHOOK_MAX_BYTES = 64 * 1024;

export interface ResendWebhookHeaders {
  "svix-id"?: string;
  "svix-timestamp"?: string;
  "svix-signature"?: string;
}

export interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: Record<string, unknown>;
}

/**
 * Verify Resend's Svix-compatible signature over the original request bytes.
 * This does not perform domain, tenant, or delivery-state writes.
 */
export function verifyResendWebhook(
  rawBody: Buffer,
  headers: ResendWebhookHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): ResendWebhookEvent {
  if (!Buffer.isBuffer(rawBody) || rawBody.length < 1 || rawBody.length > WEBHOOK_MAX_BYTES) {
    throw new Error("Invalid webhook body");
  }
  if (!secret.startsWith("whsec_")) {
    throw new Error("Resend webhook secret is not configured");
  }

  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  if (key.length < 16) throw new Error("Invalid Resend webhook secret");

  const id = headers["svix-id"];
  const timestampHeader = headers["svix-timestamp"];
  const signatureHeader = headers["svix-signature"];
  if (
    !id ||
    id.length > 256 ||
    !/^[!-~]+$/.test(id) ||
    !timestampHeader ||
    !/^[1-9][0-9]{9,}$/.test(timestampHeader) ||
    !signatureHeader
  ) {
    throw new Error("Missing or malformed Resend webhook headers");
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > WEBHOOK_MAX_AGE_SECONDS) {
    throw new Error("Expired Resend webhook");
  }

  // Signature header may contain several space-separated versions during key rotation.
  const expectedSignature = createHmac("sha256", key)
    .update(id + "." + timestampHeader + ".")
    .update(rawBody)
    .digest();
  const validSignature = signatureHeader
    .split(/\s+/)
    .filter((value) => value.startsWith("v1,"))
    .some((value) => {
      const encoded = value.slice(3);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
      const actual = Buffer.from(encoded, "base64");
      return actual.length === expectedSignature.length && timingSafeEqual(actual, expectedSignature);
    });

  if (!validSignature) throw new Error("Invalid Resend webhook signature");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("Invalid Resend webhook JSON");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid Resend webhook event");
  }
  const event = payload as Record<string, unknown>;
  if (
    typeof event.type !== "string" ||
    !/^[a-z][a-z._-]{0,63}$/.test(event.type) ||
    typeof event.created_at !== "string" ||
    !event.data ||
    typeof event.data !== "object" ||
    Array.isArray(event.data)
  ) {
    throw new Error("Invalid Resend webhook event envelope");
  }

  return event as unknown as ResendWebhookEvent;
}
