# Resend delivery journal and event inbox

Draft implementation for issue #927. The signed webhook receiver itself is
#923's draft (`POST /api/v1/webhooks/resend`); this document covers the
durable layer that must exist before any webhook is registered. No webhook
is registered by this change, and the staging migration inside the PR is
not applied until a separate approval.

## Tables (migration `20261105220000_add_resend_delivery_journal`)

- `email_delivery_messages` — outbound journal. One row per provider send,
  unique on `provider_message_id`. `org_id` is nullable by design:
  password-reset mail is user-wide and must never have a tenant guessed
  for it. `kind` is `password_reset`, `team_invite`, or
  `customer_portal_access`. `recipient_digest` is a SHA-256 hex digest of
  the normalized recipient address; no recipient plaintext, action-link
  token, raw HTML, or provider secret is ever stored. `status` tracks the
  latest known provider state (`sent`, `delivered`, `delayed`, `failed`,
  `bounced`, `complained`, `suppressed`). `suppression_candidate` is set
  only by a hard bounce or complaint; see
  [resend-delivery-suppression-policy.md](resend-delivery-suppression-policy.md).
- `email_delivery_events` — verified event inbox. One row per Svix
  delivery, unique on `svix_id`, so duplicate provider retries are
  no-ops. Only allowlisted metadata is stored (`eventType`,
  `createdAt`); the raw payload is never stored, only its irreversible
  SHA-256 digest (`payload_digest`). Inbox rows are append-only: there is
  no UPDATE or DELETE policy. Journal rows have no DELETE policy.

Both tables have forced RLS. Tenant sessions read only their own org's
rows; rows with a NULL org are visible to no tenant session. All writes go
through the transaction-local `app.resend_webhook` flag, set only inside
the server-only Prisma store transaction — the same pattern as the
`app.login_lookup` flag used for pre-auth lookups.

## Processing contract (`app/modules/email/deliveryJournal.ts`)

`processVerifiedResendDeliveryEvent(store, event)` accepts only an
already-verified event. Svix signature, timestamp, and rate-limit
enforcement are #923's boundary (`verifyResendWebhook`,
`app/modules/email/webhook.ts`, proven by
`app/tests/resend.webhook.test.ts`: changed body, expired, and missing
signatures are rejected). This layer still validates the envelope shape so
a wiring mistake can never turn an unverified payload into a write.

- Known events, processed idempotently: `email.sent`,
  `email.delivered`, `email.delivery_delayed`, `email.failed`,
  `email.bounced`, `email.complained`, `email.suppressed`.
- Unknown types are recorded in the inbox and change no delivery state.
- Org attribution comes ONLY from the outbound journal row matched by
  `data.email_id`. Payload-supplied org claims are ignored, so a forged
  or misdirected event can never correlate or update another tenant.
- An unrecognized `email_id` is recorded in the inbox with no tenant
  attribution and updates no journal row.
- An event without `email_id` is recorded as unmatched rather than
  failing the acknowledgement.
- Any store failure raises `RetryableDeliveryError`. The route must map
  it to a retryable 5xx, never to a 200 acknowledgement. The inbox insert
  and the journal status update share one transaction in the Prisma store
  (`app/db/resendDeliveryJournalStore.ts`), so the route acknowledges an
  event only after the durable write commits.

## Outbound recording

`recordOutboundDeliveryMessage(store, ...)` is called by the send call
sites after Resend returns a provider id, and only then:

- `app/modules/auth/service.ts` — password reset (`orgId: null`,
  user-wide by design) and team invite (`orgId` of the inviting org).
- `app/modules/customer-portal/service.ts` — portal access email
  (`orgId` of the issuing org).

Recording is best-effort and log-only on failure: a journal failure must
never change the auth/portal response. A missed outbound row degrades
safely — a later webhook event for that message is recorded as unmatched
and updates no tenant. The journal is idempotent on `provider_message_id`;
a re-record never overwrites kind or org attribution.

## Route wiring (follow-up, after #923 merges)

The route in #923's branch must call the processor only after
`verifyResendWebhook` succeeds, and acknowledge only on a recorded
outcome:

```ts
const outcome = await processVerifiedResendDeliveryEvent(
  resendDeliveryJournalStore,
  {
    svixId: req.header("svix-id") ?? "",
    type: event.type,
    createdAt: event.created_at,
    data: event.data,
    rawPayload: req.body,
  },
);
res.status(200).json({ received: true, outcome: outcome.outcome });
```

On `RetryableDeliveryError` the route answers 503 so Resend retries;
on any other error it answers 400 without writing. No webhook may be
registered (staging or production) until the staging migration is
applied, the route wiring is reviewed, and a signed staging callback is
proven end to end. Production registration needs separate approval.

## Tests

- `app/tests/resend.delivery-journal.test.ts` — unit tests over an
  in-memory store: duplicate `svix-id` idempotency, malformed-envelope
  rejection, unrecognized `email_id`, cross-tenant non-correlation,
  retryable DB failure, unknown types, user-wide password-reset identity,
  outbound idempotency, digest-only storage, suppression-candidate
  marking.
- `app/tests/auth.service.test.ts` and
  `app/tests/customer-portal.service.test.ts` — call-site journal
  recording (including that journal failure never changes the user flow).
- `app/tests/rls.integration.ts` — live-DB proof that tenant sessions
  cannot write either table, the flagged webhook transaction can, a
  duplicate `svix-id` inserts nothing, and reads are org-scoped with
  NULL-org rows invisible to every tenant. Requires Docker Postgres;
  CI is authoritative.

## Known limitations

- The processor has no caller on `main` until the #923 route wiring
  lands; the outbound journal is live from this PR, the inbox processor
  is complete and tested but unwired.
- No suppression is performed. Bounce/complaint handling beyond the
  `suppression_candidate` flag is a separate reviewed policy decision.
- Stored metadata is intentionally minimal (`eventType`, `createdAt`);
  bounce/complaint reasons are not persisted. The payload digest lets a
  future tool re-verify an event against provider records.
