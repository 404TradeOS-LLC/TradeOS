import crypto from "node:crypto";
import { ApiError } from "../../backend/middleware/errorHandler";
import { requireStripeSecretKey, requireStripeWebhookSecret } from "./config";
import type { StripeEventEnvelope } from "./types";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-07-29.dahlia";
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type StripeFormValue = string | number | boolean | null | undefined | StripeFormValue[] | { [key: string]: StripeFormValue };

function appendForm(params: URLSearchParams, key: string, value: StripeFormValue): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => appendForm(params, `${key}[${index}]`, item));
    return;
  }
  if (typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      appendForm(params, key ? `${key}[${childKey}]` : childKey, childValue);
    }
    return;
  }
  params.append(key, String(value));
}

function encodeForm(body: Record<string, StripeFormValue>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) appendForm(params, key, value);
  return params;
}

export async function stripeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, StripeFormValue>; idempotencyKey?: string } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireStripeSecretKey()}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: method === "POST" && options.body ? encodeForm(options.body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? payload.error?.message ?? "Stripe request failed"
      : "Stripe request failed";
    throw new ApiError(502, message);
  }
  if (!payload) throw new ApiError(502, "Stripe returned an empty response");
  return payload as T;
}

function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined): StripeEventEnvelope {
  if (!signatureHeader) throw new ApiError(400, "Missing Stripe-Signature header");

  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) throw new ApiError(400, "Invalid Stripe-Signature header");
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > WEBHOOK_TOLERANCE_SECONDS) throw new ApiError(400, "Expired Stripe webhook signature");

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", requireStripeWebhookSecret()).update(signedPayload).digest("hex");
  if (!signatures.some((signature) => safeEqualHex(signature, expected))) {
    throw new ApiError(400, "Invalid Stripe webhook signature");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ApiError(400, "Invalid Stripe webhook payload");
  }

  if (!parsed || typeof parsed !== "object" || typeof (parsed as { id?: unknown }).id !== "string" || typeof (parsed as { type?: unknown }).type !== "string") {
    throw new ApiError(400, "Invalid Stripe event envelope");
  }
  return parsed as StripeEventEnvelope;
}
