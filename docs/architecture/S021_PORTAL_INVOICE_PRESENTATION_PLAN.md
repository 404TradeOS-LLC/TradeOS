---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - app/modules/invoices
  - app/modules/payments
  - app/backend/routes/invoices.routes.ts
  - app/backend/routes/payments.routes.ts
  - web/src/app/(app)/portal/invoices
related_docs:
  - docs/modules/invoices-and-payments.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/RBAC_MATRIX.md
  - docs/SPRINT_BACKLOG.md
---

# S021 — Portal invoice and payment presentation readiness

## Readiness verdict

S021 is ready for a bounded implementation inside the existing authenticated
portal, invoice, payment, organization-membership, and forced-RLS architecture.
No new payment processor, payment-entry architecture, ledger, money semantic,
customer identity, or schema migration is authorized by this promotion.

S020 remains a separate lower-numbered planned sprint. Its customer/legal
signature boundary is now resolved by ADR-007 as authenticated in-app contract
acceptance/signature evidence without formal e-signature claims. That does not
block this presentation-only readiness contract: S021 depends on S011 and S018,
both of which are DONE with merged implementation and completion evidence.

## Existing source of truth

- Invoice amount is the persisted `Invoice.amount`.
- Recorded payment rows in `Payment` are the only payment amounts counted.
- `paidAmount` and `balanceDue` are derived from those recorded rows inside the
  existing request-scoped database session; no duplicated client accounting is
  allowed.
- `paid` is the persisted terminal paid state. Partial payment and overdue
  presentation remain derived when `balanceDue > 0`.
- Portal invoice reads already use the authenticated server-side session token
  and organization-scoped invoice/project lookup. Forced PostgreSQL RLS remains
  an independent tenant boundary.
- The existing invoice PDF route is a read-only document action. S021 may expose
  or clarify existing presentation, but does not redesign document rendering.

## Authorized implementation boundary

S021 may add or harden:

- portal display of invoice amount, paid amount, balance due, due date, and
  existing payment history where already available;
- truthful paid, unpaid, partially-paid, overdue, and voided presentation from
  existing persisted/derived values;
- same-organization read access and cross-organization/incorrect-ID denial;
- reuse of an already-existing safe payment action only if its current contract
  and authorization are preserved;
- behavioral backend, live PostgreSQL/RLS, and portal tests for the above;
- bounded loading, unavailable, and error states without portal redesign.

## Explicit non-goals and stop conditions

S021 must stop for a founder decision if completion requires a new payment,
billing, pricing, entitlement, refund, reversal, processor, checkout, ledger,
or money-movement semantics; new customer authentication or authorization; an
RLS/RBAC redesign; a schema migration; or a production credential/integration.

It must not add public payment links, a payment processor, payment-entry UI,
new payment statuses, persisted partial-payment state, a new overdue writer, or
automatic payment reconciliation outside the existing S011 contract.

## Required evidence

- same-organization invoice read succeeds with `billing.read`;
- cross-organization and incorrect-ID reads fail closed;
- authoritative amount/balance values match recorded payments exactly;
- paid, unpaid, partial, overdue, and voided presentation follows the existing
  lifecycle semantics;
- no payment is counted twice and pending/failed payments remain excluded;
- forced PostgreSQL RLS independently blocks cross-organization invoice,
  payment, and project access;
- portal loading/error/empty states do not claim a successful payment or invent
  a balance;
- existing actor, organization, audit, and request-session behavior remains
  unchanged.

## Expected implementation surface

Likely files are limited to the existing invoice/payment services and tests,
portal invoice page/components/actions, and their required owner documentation.
No schema or migration file is expected. The exact file set must be confirmed
after a focused baseline test and overlap check before implementation.

## Validation

Required validation is `git diff --check`, repository preflight and docs checks,
app unit/lint/build/integration with PostgreSQL/RLS evidence, applicable web
test/lint/build lanes, and the exact current-head GitHub required checks.
