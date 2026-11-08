import { createHash } from "node:crypto";

/**
 * Durable Resend delivery-event journal (issue #927).
 *
 * This module owns the tenant-safe processing contract for Resend delivery
 * events. It deliberately does NOT verify Svix signatures: signature,
 * timestamp, and rate-limit enforcement are #923's boundary
 * (`verifyResendWebhook` in `app/modules/email/webhook.ts`, proven by
 * `app/tests/resend.webhook.test.ts`: changed body, expired, and missing
 * signatures are rejected). The only entry point here accepts an already
 * verified event, and it still validates the envelope shape so a wiring
 * mistake can never turn an unverified payload into a write.
 *
 * Storage rules enforced by this layer and the SQL store:
 * - The event inbox is keyed by `svix-id`; a duplicate delivery is a no-op.
 * - Org attribution comes ONLY from the outbound journal row matched by
 *   `email_id`. Payload-supplied org claims are ignored, so a forged or
 *   misdirected event can never correlate or update another tenant.
 * - An unrecognized `email_id` is recorded in the inbox with no tenant
 *   attribution and updates no journal row.
 * - Only allowlisted metadata is stored (`eventType`, `createdAt`); the raw
 *   payload is never stored, only its irreversible SHA-256 digest.
 * - Recipient addresses are never stored; only their SHA-256 digest.
 * - Password-reset mail is user-wide by design: its journal row carries
 *   `orgId: null` and later events never guess a tenant for it.
 * - A durable transaction must commit before the route acknowledges the
 *   event. Any store failure raises `RetryableDeliveryError`, which the
 *   route maps to a retryable 5xx — never a false 200.
 *
 * No suppression is performed here. A hard bounce or complaint only sets
 * `suppressionCandidate` on the owning tenant's journal row; acting on it is
 * governed by `docs/modules/resend-delivery-suppression-policy.md` and
 * requires separate review. No tenant is ever suppressed by inference.
 */

export const KNOWN_RESEND_DELIVERY_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
] as const;

export type KnownResendDeliveryEventType = (typeof KNOWN_RESEND_DELIVERY_EVENTS)[number];

const KNOWN_EVENT_TYPES = new Set<string>(KNOWN_RESEND_DELIVERY_EVENTS);

const DELIVERY_STATUS_BY_EVENT: Record<KnownResendDeliveryEventType, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

// Only these events mark a recipient as a suppression candidate for later
// human-reviewed policy action. `email.suppressed` means Resend already
// suppressed the address provider-side; it is recorded, not actioned here.
const SUPPRESSION_CANDIDATE_EVENTS = new Set(["email.bounced", "email.complained"]);

export const OUTBOUND_EMAIL_KINDS = ["password_reset", "team_invite", "customer_portal_access"] as const;
export type OutboundEmailKind = (typeof OUTBOUND_EMAIL_KINDS)[number];

const OUTBOUND_KINDS = new Set<string>(OUTBOUND_EMAIL_KINDS);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const PRINTABLE_ASCII_PATTERN = /^[!-~]+$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z._-]{0,63}$/;
const MAX_WEBHOOK_BYTES = 64 * 1024;

/** The route must map this to a retryable 5xx, never to a 200 acknowledgement. */
export class RetryableDeliveryError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RetryableDeliveryError";
    this.cause = cause;
  }
}

/**
 * A Resend event that has already passed Svix signature verification
 * (#923's `verifyResendWebhook`). `rawPayload` is the original request
 * bytes, used only to compute the stored payload digest.
 */
export interface VerifiedResendDeliveryEvent {
  svixId: string;
  type: string;
  createdAt: string;
  data: Record<string, unknown>;
  rawPayload: Buffer;
}

export type DeliveryEventOutcomeKind = "recorded" | "duplicate" | "recorded_unmatched" | "ignored_unknown_type";

export interface DeliveryEventOutcome {
  outcome: DeliveryEventOutcomeKind;
  orgId: string | null;
  providerMessageId: string | null;
}

export interface DeliveryJournalMessage {
  providerMessageId: string;
  orgId: string | null;
  kind: string;
  status: string;
  suppressionCandidate: boolean;
  recipientDigest?: string;
}

export interface DeliveryJournalStore {
  recordOutbound(input: {
    providerMessageId: string;
    kind: OutboundEmailKind;
    orgId: string | null;
    recipientDigest?: string;
  }): Promise<{ created: boolean }>;

  /**
   * One atomic unit: insert the inbox row (no-op on duplicate `svix-id`)
   * and, when the row is new and the message is known, apply the delivery
   * state change to the matched journal row. The implementation must resolve
   * the org from its own journal lookup, never from caller input.
   */
  processVerifiedEvent(input: {
    svixId: string;
    eventType: string;
    providerMessageId: string | null;
    payloadDigest: string;
    metadata: Record<string, unknown>;
    nextStatus: string | null;
    markSuppressionCandidate: boolean;
  }): Promise<{ duplicate: boolean; matched: boolean; orgId: string | null }>;
}

export interface RecordOutboundDeliveryMessageInput {
  providerMessageId: string;
  kind: OutboundEmailKind;
  orgId: string | null;
  recipientDigest?: string;
}

/** Irreversible digest of a recipient address. Plaintext is never stored. */
export function hashRecipientAddress(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

export function hashPayload(rawPayload: Buffer): string {
  return createHash("sha256").update(rawPayload).digest("hex");
}

export async function recordOutboundDeliveryMessage(
  store: DeliveryJournalStore,
  input: RecordOutboundDeliveryMessageInput,
): Promise<{ created: boolean }> {
  if (
    typeof input.providerMessageId !== "string" ||
    input.providerMessageId.length < 1 ||
    input.providerMessageId.length > 256 ||
    !OUTBOUND_KINDS.has(input.kind) ||
    (input.orgId !== null && (typeof input.orgId !== "string" || !UUID_PATTERN.test(input.orgId))) ||
    (input.recipientDigest !== undefined &&
      (typeof input.recipientDigest !== "string" || !SHA256_HEX_PATTERN.test(input.recipientDigest)))
  ) {
    throw new Error("Invalid outbound delivery journal entry");
  }
  try {
    return await store.recordOutbound(input);
  } catch (error) {
    throw new RetryableDeliveryError("Outbound delivery journal entry could not be durably recorded", error);
  }
}

export async function processVerifiedResendDeliveryEvent(
  store: DeliveryJournalStore,
  event: VerifiedResendDeliveryEvent,
): Promise<DeliveryEventOutcome> {
  if (!isValidVerifiedEvent(event)) {
    throw new Error("Invalid verified Resend delivery event");
  }

  const providerMessageId = extractProviderMessageId(event.data);
  const payloadDigest = hashPayload(event.rawPayload);
  // Allowlisted metadata only. Never copy payload fields (org claims,
  // recipient addresses, bounce reasons, raw data) into the stored row.
  const metadata = { eventType: event.type, createdAt: new Date(event.createdAt).toISOString() };
  const known = KNOWN_EVENT_TYPES.has(event.type);
  const nextStatus = known ? DELIVERY_STATUS_BY_EVENT[event.type as KnownResendDeliveryEventType] : null;

  let result: { duplicate: boolean; matched: boolean; orgId: string | null };
  try {
    result = await store.processVerifiedEvent({
      svixId: event.svixId,
      eventType: event.type,
      providerMessageId,
      payloadDigest,
      metadata,
      nextStatus,
      markSuppressionCandidate: SUPPRESSION_CANDIDATE_EVENTS.has(event.type),
    });
  } catch (error) {
    throw new RetryableDeliveryError("Resend delivery event could not be durably recorded", error);
  }

  if (result.duplicate) {
    return { outcome: "duplicate", orgId: result.orgId, providerMessageId };
  }
  if (!known) {
    return { outcome: "ignored_unknown_type", orgId: result.orgId, providerMessageId };
  }
  if (!result.matched) {
    return { outcome: "recorded_unmatched", orgId: null, providerMessageId };
  }
  return { outcome: "recorded", orgId: result.orgId, providerMessageId };
}

function isValidVerifiedEvent(event: VerifiedResendDeliveryEvent): boolean {
  return (
    Boolean(event) &&
    typeof event === "object" &&
    typeof event.svixId === "string" &&
    event.svixId.length >= 1 &&
    event.svixId.length <= 256 &&
    PRINTABLE_ASCII_PATTERN.test(event.svixId) &&
    typeof event.type === "string" &&
    EVENT_TYPE_PATTERN.test(event.type) &&
    typeof event.createdAt === "string" &&
    event.createdAt.length >= 1 &&
    event.createdAt.length <= 64 &&
    Number.isFinite(Date.parse(event.createdAt)) &&
    Boolean(event.data) &&
    typeof event.data === "object" &&
    !Array.isArray(event.data) &&
    Buffer.isBuffer(event.rawPayload) &&
    event.rawPayload.length >= 1 &&
    event.rawPayload.length <= MAX_WEBHOOK_BYTES
  );
}

function extractProviderMessageId(data: Record<string, unknown>): string | null {
  const emailId = data.email_id;
  if (typeof emailId !== "string" || emailId.length < 1 || emailId.length > 256) return null;
  return emailId;
}
