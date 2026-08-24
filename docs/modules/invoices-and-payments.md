---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - app/modules/invoices
  - app/modules/payments
  - app/backend/routes/invoices.routes.ts
  - app/backend/routes/crm.routes.ts
  - app/backend/routes/payments.routes.ts
  - web/src/lib/payment-ledger.ts
  - web/src/app/(app)/projects/[id]/invoices
  - web/src/app/(app)/dashboard/revenue-this-week
  - web/src/app/(app)/portal/invoices
---

# Invoices and Payments

## Purpose

Own invoice creation, send and pay state changes, voiding, line items, delivery history, payment recording/reconciliation, and read-only payment-ledger reporting.

## Source code locations

- `app/modules/invoices/*`
- `app/modules/payments/*`
- `app/backend/routes/invoices.routes.ts`
- invoice-scoped payment routes in `app/backend/routes/crm.routes.ts`
- organization payment-ledger routes in `app/backend/routes/payments.routes.ts`
- `web/src/lib/payment-ledger.ts`
- `web/src/app/(app)/projects/[id]/invoices/**`
- `web/src/app/(app)/dashboard/revenue-this-week/page.tsx`

## Core models

- `Invoice`
- `InvoiceLineItem`
- `InvoiceDelivery`
- `Payment`

## Routes

- `/api/v1/invoices/*`
- `GET /api/v1/invoices` — organization-scoped work-queue read (see below)
- `POST /api/v1/invoices/:id/void` — voids a non-paid invoice; persistence uses the database-compatible raw status `void`, while normalized UI/activity semantics remain canonical `voided`
- `/api/v1/invoices/:id/payments`
- `GET /api/v1/payments/current-week` — read-only organization-scoped ledger of `recorded` Payment rows in the current organization week, with invoice/project/customer context and organization-timezone-aware boundaries

## Organization work-queue read

`GET /api/v1/invoices` (`InvoicesService.listOrganizationQueue`) returns every invoice in the caller's organization, newest-activity-first, for dashboard/reporting/future-Athena-tool consumers that need a company-wide view rather than a single project's invoices.

- **Scope:** organization-wide (scoped through the invoice's project, since `Invoice` has no direct `orgId` column); every authenticated organization member with `billing.read` may call it. Organization scope is derived from the authenticated request context, never a caller-supplied id, and is enforced both in the query and by forced RLS on the `invoices`/`projects` tables.
- **Filters:** `status` (comma-separated, multiple statuses, legacy-synonym-aware), `sent` (`sentAt` non-null), `overdue`, `partiallyPaid`, `unpaid` (see semantics below), `updatedAfter`, `updatedBefore`.
- **paidAmount/balanceDue derivation:** `Invoice` has no stored balance column — it only carries its own `amount`; payments are recorded separately on `Payment` rows (the same rows the Revenue-This-Week ledger reads). The queue computes `paidAmount` as the sum of that invoice's `Payment` rows with `status = "recorded"` and `balanceDue = amount - paidAmount`, evaluated in the database (via `$queryRaw`, still routed through the same request-scoped RLS session every other service call uses) so `overdue`/`partiallyPaid`/`unpaid` can filter and paginate exactly instead of loading every invoice into memory to filter client-side.
- **Semantics:** `overdue` = due date passed AND `balanceDue > 0` AND status is neither persisted `paid` nor voided. `partiallyPaid` = `paidAmount > 0` AND `balanceDue > 0` AND status is neither persisted `paid` nor voided. `unpaid` = `balanceDue > 0` AND status is neither persisted `paid` nor voided (so partially-paid invoices are included, per the locked product decision). The voided exclusion checks the actual persisted raw value the live `invoices_status_check` database constraint allows (`void`) rather than the canonical display spelling `voided`; the void mutation now persists that same raw `void` value. The queue also checks `cancelled` as a defensive legacy synonym (`legacyInvoiceStatusMap`), even though no currently-reachable write path can produce that value — the constraint has never allowed it either. Persisted `paid` is authoritative for follow-up exclusion even when the manual `mark-paid` path has no Payment row.
- **Pagination:** opaque cursor, default 25 / max 50, `updatedAt desc, id desc` with a stable id tie-breaker, invalid cursor -> `400`. Response is `{ items, total, nextCursor }` with an exact filtered `total`.
- **Response fields:** `id`, `documentNumber` (the existing `invoiceNumber`), `projectId`, `projectName`, `customerName`, `status`, `amount`, `paidAmount`, `balanceDue`, `dueDate`, `updatedAt`. No `orgId` on individual items.

## Permissions

The organization payment-ledger read endpoint and the organization invoice work-queue read both require the canonical `billing.read` permission and still run under the existing authenticated organization/database-session stack. See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

The current ledger counts only Payment rows whose status is `recorded`, matching the existing payment-recording default. It does not infer revenue from invoice status or `paidAt`.

Invoice voiding intentionally distinguishes storage from canonical semantics: `InvoicesService.void()` persists raw `void` because that is the value permitted by the live `invoices_status_check` constraint, while normalization, delivery history, and activity metadata continue to expose the canonical `voided` concept. This avoids changing the schema or lifecycle vocabulary while keeping the write path constraint-compatible.

Payment reconciliation records the Payment, then recomputes the total recorded payments while holding a PostgreSQL row lock on that Invoice. An eligible persisted `sent` or existing `overdue` Invoice becomes `paid` when the recorded total is at least the Invoice amount; the payment, status update, and `invoice.paid` delivery/activity event share the existing request-scoped database transaction. `partially_paid` and new overdue persistence remain derived, and no payment-entry UI is owned by this module slice.

## Frontend surfaces

- `/projects/[id]/invoices/new`
- `/projects/[id]/invoices/[invoiceId]`
- `/dashboard/revenue-this-week` — transaction-level weekly payment ledger; each row links back to its invoice
- `/portal/invoices/[invoiceId]`

The owner dashboard's Revenue This Week KPI uses the same weekly Payment-ledger response as the drill-down. If that read fails, the KPI reports `Unavailable` instead of substituting paid-invoice totals.

## Tests

- `app/tests/invoices.service.test.ts`
- `app/tests/crm.service.test.ts` — payment validation, recorded-payment aggregation, partial-payment derivation, and payment-triggered paid reconciliation
- `app/tests/invoices.void.test.ts` — regression coverage for raw `void` persistence plus canonical `invoice.voided` delivery/activity metadata
- `app/tests/payments.service.test.ts`
- `app/tests/invoice-contract-history.migration.test.ts`
- `app/tests/invoices.queue.test.ts`, `app/tests/invoices.controller.queue.test.ts` — organization work-queue filter/SQL wiring, DTO mapping, and authorization
- `app/tests/rls.integration.ts` (`organization work-queue reads` describe block) — live tenant isolation and real Payment-aggregate balance computation (overdue/partiallyPaid/unpaid, voided exclusion) for the queue read
- `app/tests/rls.integration.ts` — live PostgreSQL concurrent-payment serialization, one paid event, payment durability, cross-organization denial, and voided-invoice non-revival

## Known limitations

- payment recording exists, but public payment processing does not
- payment statuses are not yet a canonical domain enum; the weekly revenue ledger intentionally includes only the existing `recorded` status
- payment recording remains a backend entry point; S011 does not add or redesign payment-entry UI

## Deferred work

- deeper accounts-receivable automation and external payment integration
- canonical payment lifecycle/reversal/refund semantics

## Last verified date

2026-08-24
