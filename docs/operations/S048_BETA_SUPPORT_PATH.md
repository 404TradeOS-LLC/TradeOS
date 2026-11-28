---
status: current
owner: platform
last_verified: 2026-11-28
source_of_truth: true
related_docs:
  - docs/operations/INVITED_BETA.md
  - docs/operations/S048_BETA_ONBOARDING_CHECKLIST.md
  - docs/operations/S048_BETA_FEEDBACK_CAPTURE.md
  - docs/operations/S048_BETA_ROLLBACK_PLAN.md
  - docs/operations/S048_BETA_ONBOARDING_EXECUTION_RECORD.md
---

# S048 — Beta Support Path

Who the beta contractor contacts, how, and what response to expect.
One named contractor only: **Mike Lockler, start December 1, 2026**.

## Support owner

The **founder (Billy Showalter)** is the support owner for the beta, per
the invited-beta runbook. Engineering owns repairs and evidence; it does
not own contractor support contact.

## Contact path

- **Email:** hello@404tradeos.com — the founder's production owner
  account address and the existing alert recipient for Athena alerts.
- **Phone:** 812-562-8504 — the founder's number on record.
- **In person / on site:** the founder's guided onboarding (Dec 1) and
  any site visit he arranges with the contractor.

The founder confirms this contact path at the Dec 1 onboarding
(checklist step 1) and records it privately with the contractor. If the
founder names a different support address or phone at onboarding, that
record replaces this one — this document is updated, not silently
overridden.

## What the contractor is told

- Free beta scope: Customer → Project → Estimate → Proposal → PDF
  delivered outside TradeOS. Jobs, dispatch, field work, invoicing,
  subscriptions, and customer-portal acceptance are deferred surfaces,
  not disabled features.
- Review AI scope, mapping, quantities, provenance, and final prices
  before applying or sending a PDF. No automatic supplier-price or AI
  approval is promised.
- Report a problem without sharing passwords, tokens, or unnecessary
  customer data.

## Response expectation

- **Routine feedback:** triaged every business day in the governed
  issue queue (see `S048_BETA_FEEDBACK_CAPTURE.md`). No faster
  response-time commitment is confirmed; do not promise one.
- **Critical (suspected cross-tenant access, wrong financial output,
  lost/corrupted data, inability to operate safely):** stop new
  invitations immediately, contact the founder at once, preserve
  redacted diagnostics, and follow the reviewed rollback/recovery
  procedure in `S048_BETA_ROLLBACK_PLAN.md`. Never automatically retry
  a money/data operation or roll application code back across
  incompatible schema.

## What is not support

- The founder does not provide a support SLA beyond the business-day
  triage above.
- Engineering does not take support contact directly from the
  contractor; findings reach engineering through the feedback capture
  channel, with the founder as the router for anything critical.
- No support path exists for a second tenant: adding one is a separate
  founder decision.
