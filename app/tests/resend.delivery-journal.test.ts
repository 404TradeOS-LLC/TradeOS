import { createHash } from "node:crypto";
import {
  hashRecipientAddress,
  processVerifiedResendDeliveryEvent,
  recordOutboundDeliveryMessage,
  RetryableDeliveryError,
  type DeliveryJournalMessage,
  type DeliveryJournalStore,
  type VerifiedResendDeliveryEvent,
} from "../modules/email/deliveryJournal";

const ORG_A = "10000000-0000-0000-0000-000000000001";
const ORG_B = "20000000-0000-0000-0000-000000000002";

interface StoredEvent {
  svixId: string;
  eventType: string;
  providerMessageId: string | null;
  orgId: string | null;
  payloadDigest: string;
  metadata: Record<string, unknown>;
}

/**
 * In-memory stand-in for the Prisma store. It enforces the same contract the
 * SQL store must enforce: providerMessageId unique, svix-id unique, org
 * attribution resolved only from the journal row, and no write on failure.
 * The SQL transaction (single statement batch + ON CONFLICT) is what makes
 * the real store atomic; this fake mirrors the observable outcomes.
 */
class FakeDeliveryJournalStore implements DeliveryJournalStore {
  readonly messages = new Map<string, DeliveryJournalMessage>();
  readonly events = new Map<string, StoredEvent>();
  updateCount = 0;
  failWith: Error | null = null;

  async recordOutbound(input: {
    providerMessageId: string;
    kind: "password_reset" | "team_invite" | "customer_portal_access";
    orgId: string | null;
    recipientDigest?: string;
  }): Promise<{ created: boolean }> {
    this.throwIfFailing();
    if (this.messages.has(input.providerMessageId)) return { created: false };
    this.messages.set(input.providerMessageId, {
      providerMessageId: input.providerMessageId,
      kind: input.kind,
      orgId: input.orgId,
      status: "sent",
      suppressionCandidate: false,
      ...(input.recipientDigest ? { recipientDigest: input.recipientDigest } : {}),
    });
    return { created: true };
  }

  async processVerifiedEvent(input: {
    svixId: string;
    eventType: string;
    providerMessageId: string | null;
    payloadDigest: string;
    metadata: Record<string, unknown>;
    nextStatus: string | null;
    markSuppressionCandidate: boolean;
  }): Promise<{ duplicate: boolean; matched: boolean; orgId: string | null }> {
    this.throwIfFailing();
    const existing = this.events.get(input.svixId);
    if (existing) {
      return { duplicate: true, matched: existing.providerMessageId !== null, orgId: existing.orgId };
    }
    const message = input.providerMessageId ? this.messages.get(input.providerMessageId) : undefined;
    const orgId = message?.orgId ?? null;
    this.events.set(input.svixId, {
      svixId: input.svixId,
      eventType: input.eventType,
      providerMessageId: input.providerMessageId,
      orgId,
      payloadDigest: input.payloadDigest,
      metadata: input.metadata,
    });
    if (message && input.nextStatus) {
      message.status = input.nextStatus;
      if (input.markSuppressionCandidate) message.suppressionCandidate = true;
      this.updateCount += 1;
    }
    return { duplicate: false, matched: Boolean(message), orgId };
  }

  private throwIfFailing(): void {
    if (this.failWith) throw this.failWith;
  }
}

function verifiedEvent(overrides: Partial<VerifiedResendDeliveryEvent> = {}): VerifiedResendDeliveryEvent {
  return {
    svixId: "msg_test_svix_id",
    type: "email.delivered",
    createdAt: "2026-11-05T12:00:00.000Z",
    data: { email_id: "re_msg_123" },
    rawPayload: Buffer.from(JSON.stringify({ type: "email.delivered", data: { email_id: "re_msg_123" } })),
    ...overrides,
  };
}

describe("Resend delivery journal", () => {
  it("records a verified delivered event once and updates the matched journal row", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
      recipientDigest: hashRecipientAddress("customer@example.com"),
    });

    const outcome = await processVerifiedResendDeliveryEvent(store, verifiedEvent());

    expect(outcome).toEqual({ outcome: "recorded", orgId: ORG_A, providerMessageId: "re_msg_123" });
    expect(store.messages.get("re_msg_123")?.status).toBe("delivered");
    expect(store.messages.get("re_msg_123")?.suppressionCandidate).toBe(false);
    expect(store.events.size).toBe(1);
    expect(store.updateCount).toBe(1);
  });

  it("treats duplicate svix-id deliveries as idempotent with no second journal write", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });

    const first = await processVerifiedResendDeliveryEvent(store, verifiedEvent());
    const second = await processVerifiedResendDeliveryEvent(store, verifiedEvent());

    expect(first.outcome).toBe("recorded");
    expect(second).toEqual({ outcome: "duplicate", orgId: ORG_A, providerMessageId: "re_msg_123" });
    expect(store.events.size).toBe(1);
    expect(store.updateCount).toBe(1);
    expect(store.messages.get("re_msg_123")?.status).toBe("delivered");
  });

  it("rejects malformed verified-event envelopes without writing anything", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });

    // Signature verification itself is #923's boundary (verifyResendWebhook,
    // proven by app/tests/resend.webhook.test.ts on that branch: changed body,
    // expired, and missing signatures are rejected). This layer must still
    // refuse any envelope that did not arrive as a verified event, so a
    // wiring mistake can never turn an unverified payload into a write.
    const malformed = [
      verifiedEvent({ svixId: "" }),
      verifiedEvent({ type: "not an event type!" }),
      verifiedEvent({ data: "email.delivered" as unknown as Record<string, unknown> }),
      verifiedEvent({ rawPayload: Buffer.alloc(0) }),
    ];
    for (const event of malformed) {
      await expect(processVerifiedResendDeliveryEvent(store, event)).rejects.toThrow(
        "Invalid verified Resend delivery event",
      );
    }
    expect(store.events.size).toBe(0);
    expect(store.messages.get("re_msg_123")?.status).toBe("sent");
  });

  it("records an unrecognized email_id without updating any tenant", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_org_a",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_org_b",
      kind: "customer_portal_access",
      orgId: ORG_B,
    });

    const outcome = await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({ svixId: "msg_unknown", data: { email_id: "re_msg_nonexistent" } }),
    );

    expect(outcome).toEqual({ outcome: "recorded_unmatched", orgId: null, providerMessageId: "re_msg_nonexistent" });
    expect(store.events.get("msg_unknown")?.orgId).toBeNull();
    expect(store.messages.get("re_msg_org_a")?.status).toBe("sent");
    expect(store.messages.get("re_msg_org_b")?.status).toBe("sent");
    expect(store.updateCount).toBe(0);
  });

  it("cannot correlate cross-tenant IDs: org comes only from the journal row, never the payload", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_org_a",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_org_b",
      kind: "customer_portal_access",
      orgId: ORG_B,
    });

    // Forged payload claims org B and a second message id; the event is for
    // org A's message. Only org A's row may change, and the stored event
    // must carry org A (from the journal lookup), never the payload claim.
    const outcome = await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({
        svixId: "msg_cross_tenant",
        type: "email.bounced",
        data: { email_id: "re_msg_org_a", org_id: ORG_B, orgId: ORG_B, email: "victim@example.com" },
      }),
    );

    expect(outcome).toEqual({ outcome: "recorded", orgId: ORG_A, providerMessageId: "re_msg_org_a" });
    expect(store.events.get("msg_cross_tenant")?.orgId).toBe(ORG_A);
    expect(store.events.get("msg_cross_tenant")?.metadata).not.toMatchObject({ org_id: expect.anything() });
    expect(store.messages.get("re_msg_org_a")?.status).toBe("bounced");
    expect(store.messages.get("re_msg_org_a")?.suppressionCandidate).toBe(true);
    expect(store.messages.get("re_msg_org_b")?.status).toBe("sent");
    expect(store.messages.get("re_msg_org_b")?.suppressionCandidate).toBe(false);
  });

  it("yields a retryable error on database failure rather than a false acknowledgement", async () => {
    const store = new FakeDeliveryJournalStore();
    store.failWith = new Error("connection refused");
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
    }).catch(() => undefined);

    const failing = new FakeDeliveryJournalStore();
    failing.failWith = new Error("connection refused");
    await expect(processVerifiedResendDeliveryEvent(failing, verifiedEvent())).rejects.toThrow(RetryableDeliveryError);
    await expect(processVerifiedResendDeliveryEvent(failing, verifiedEvent())).rejects.toThrow(
      "Resend delivery event could not be durably recorded",
    );
    expect(failing.events.size).toBe(0);
  });

  it("records unknown event types in the inbox without changing delivery state", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });

    const outcome = await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({ svixId: "msg_opened", type: "email.opened" }),
    );

    expect(outcome.outcome).toBe("ignored_unknown_type");
    expect(store.events.size).toBe(1);
    expect(store.messages.get("re_msg_123")?.status).toBe("sent");
    expect(store.updateCount).toBe(0);
  });

  it("handles user-wide password resets explicitly: org stays null, never guessed", async () => {
    const store = new FakeDeliveryJournalStore();
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_reset_123",
      kind: "password_reset",
      orgId: null,
      recipientDigest: hashRecipientAddress("owner@example.com"),
    });

    const outcome = await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({ svixId: "msg_reset", data: { email_id: "re_reset_123" } }),
    );

    expect(outcome).toEqual({ outcome: "recorded", orgId: null, providerMessageId: "re_reset_123" });
    expect(store.messages.get("re_reset_123")?.orgId).toBeNull();
    expect(store.messages.get("re_reset_123")?.status).toBe("delivered");
  });

  it("keeps the outbound journal idempotent on providerMessageId without overwriting attribution", async () => {
    const store = new FakeDeliveryJournalStore();
    const first = await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
    });
    const second = await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "password_reset",
      orgId: null,
    });

    expect(first).toEqual({ created: true });
    expect(second).toEqual({ created: false });
    expect(store.messages.size).toBe(1);
    expect(store.messages.get("re_msg_123")).toMatchObject({ kind: "customer_portal_access", orgId: ORG_A });
  });

  it("never stores recipient plaintext or raw payloads: only digests and allowlisted metadata", async () => {
    const store = new FakeDeliveryJournalStore();
    const rawPayload = Buffer.from(
      JSON.stringify({ type: "email.bounced", data: { email_id: "re_msg_123", reason: "mailbox full" } }),
    );
    await recordOutboundDeliveryMessage(store, {
      providerMessageId: "re_msg_123",
      kind: "customer_portal_access",
      orgId: ORG_A,
      recipientDigest: hashRecipientAddress("Customer@Example.com"),
    });
    await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({ svixId: "msg_bounce", type: "email.bounced", rawPayload, data: { email_id: "re_msg_123" } }),
    );

    const message = store.messages.get("re_msg_123");
    expect(message).toBeDefined();
    expect(JSON.stringify(message)).not.toContain("Customer@Example.com");
    expect(JSON.stringify(message)).not.toContain("customer@example.com");
    expect(hashRecipientAddress("Customer@Example.com")).toBe(
      createHash("sha256").update("customer@example.com").digest("hex"),
    );

    const event = store.events.get("msg_bounce");
    expect(event?.payloadDigest).toBe(createHash("sha256").update(rawPayload).digest("hex"));
    expect(event?.payloadDigest).not.toBe(rawPayload.toString("utf8"));
    expect(event?.metadata).toEqual({ eventType: "email.bounced", createdAt: "2026-11-05T12:00:00.000Z" });
    expect(JSON.stringify(event)).not.toContain("mailbox full");
    expect(JSON.stringify(event)).not.toContain("customer@example.com");
  });

  it("marks hard bounces and complaints as suppression candidates, and nothing else", async () => {
    const store = new FakeDeliveryJournalStore();
    for (const [id, kind] of [
      ["re_bounce", "email.bounced"],
      ["re_complaint", "email.complained"],
      ["re_suppressed", "email.suppressed"],
      ["re_failed", "email.failed"],
      ["re_delayed", "email.delivery_delayed"],
    ] as const) {
      await recordOutboundDeliveryMessage(store, {
        providerMessageId: id,
        kind: "customer_portal_access",
        orgId: ORG_A,
      });
      await processVerifiedResendDeliveryEvent(
        store,
        verifiedEvent({ svixId: `msg_${id}`, type: kind, data: { email_id: id } }),
      );
    }

    expect(store.messages.get("re_bounce")).toMatchObject({ status: "bounced", suppressionCandidate: true });
    expect(store.messages.get("re_complaint")).toMatchObject({ status: "complained", suppressionCandidate: true });
    expect(store.messages.get("re_suppressed")).toMatchObject({ status: "suppressed", suppressionCandidate: false });
    expect(store.messages.get("re_failed")).toMatchObject({ status: "failed", suppressionCandidate: false });
    expect(store.messages.get("re_delayed")).toMatchObject({ status: "delayed", suppressionCandidate: false });
  });

  it("records an event without email_id as unmatched instead of failing the acknowledgement", async () => {
    const store = new FakeDeliveryJournalStore();
    const outcome = await processVerifiedResendDeliveryEvent(
      store,
      verifiedEvent({ svixId: "msg_no_id", data: {} }),
    );
    expect(outcome).toEqual({ outcome: "recorded_unmatched", orgId: null, providerMessageId: null });
    expect(store.events.size).toBe(1);
  });

  it("rejects outbound journal rows with invalid kind, id, org, or digest", async () => {
    const store = new FakeDeliveryJournalStore();
    await expect(
      recordOutboundDeliveryMessage(store, {
        providerMessageId: "re_msg_123",
        kind: "marketing_blast" as never,
        orgId: ORG_A,
      }),
    ).rejects.toThrow("Invalid outbound delivery journal entry");
    await expect(
      recordOutboundDeliveryMessage(store, { providerMessageId: "", kind: "password_reset", orgId: null }),
    ).rejects.toThrow("Invalid outbound delivery journal entry");
    await expect(
      recordOutboundDeliveryMessage(store, {
        providerMessageId: "re_msg_123",
        kind: "password_reset",
        orgId: "not-a-uuid",
      }),
    ).rejects.toThrow("Invalid outbound delivery journal entry");
    await expect(
      recordOutboundDeliveryMessage(store, {
        providerMessageId: "re_msg_123",
        kind: "password_reset",
        orgId: null,
        recipientDigest: "plaintext@example.com",
      }),
    ).rejects.toThrow("Invalid outbound delivery journal entry");
    expect(store.messages.size).toBe(0);
  });
});
