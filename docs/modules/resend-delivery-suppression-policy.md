# Resend delivery suppression policy (reviewed policy note)

Policy note for issue #927. This note defines what may happen when
Resend reports a hard bounce or a complaint. It is a policy decision
record, not an implementation of suppression: no suppression is performed
by the delivery-journal PR, and no change here enables it.

## Principles

1. **Per-recipient, per-tenant only.** A suppression may only ever apply
   to the exact recipient address of the exact tenant whose outbound
   journal row the event matched. Org attribution comes only from the
   journal row matched by `email_id`; a payload org claim is never a
   source of attribution.
2. **Never suppress an unrelated tenant by inference.** A bounce or
   complaint for one tenant's message must not affect any other tenant,
   even if the same recipient address appears in another tenant's
   journal. Cross-tenant address reuse (for example, one person who is a
   customer of two contractors) is not evidence of consent withdrawal
   for the other tenant.
3. **No automatic suppression in v1.** A hard bounce (`email.bounced`)
   or complaint (`email.complained`) only sets `suppression_candidate`
   on the owning tenant's `email_delivery_messages` row. Nothing in the
   webhook path, the journal, or any send path reads that flag to skip
   delivery. `email.suppressed` means Resend already suppressed the
   address provider-side; it is recorded as delivery state, not actioned.
4. **User-wide mail is never tenant-suppressed.** Password-reset mail
   carries no org. A bounce on a password-reset message marks the
   candidate flag on that user-wide row only; it must never be used to
   suppress any tenant's mail to that address.

## What a future suppression feature must prove before it ships

- A reviewed design naming the exact suppression store (per-tenant,
  per-recipient-digest), its write path, and its read path in the send
  flow — with a test proving a suppressed digest blocks only that
  tenant's sends to that recipient.
- A test proving a suppression for tenant A does not change delivery
  for tenant B to the same address.
- A test proving a password-reset bounce never suppresses any tenant.
- An operator-visible way to list and clear a tenant's suppressions,
  with audit history of who set or cleared each entry and why.
- Separate approval. Production suppression is never enabled from the
  journal PR and never from draft code.

## What is stored today

Only the `suppression_candidate` boolean on the owning journal row, set
by `email.bounced` and `email.complained`. No suppression list, no
per-recipient blocklist, and no send-path check exists. Until the above
is built and reviewed, a candidate flag is informational: an operator
investigating a bounce looks at the journal row and the provider record
(digest-verified), and takes any customer-facing action manually.
