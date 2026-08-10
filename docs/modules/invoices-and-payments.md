---
status: current
owner: platform
last_verified: 2026-08-10
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

Own invoice creation, send and pay state changes, voiding, line items, delivery history, payment recording, and read-only payment-ledger reporting.

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
- `/api/v1/invoices/:id/payments`
- `GET /api/v1/payments/current-week` — read-only organization-scoped ledger of `recorded` Payment rows in the current organization week, with invoice/project/customer context and organization-timezone-aware boundaries

## Permissions

The organization payment-ledger read endpoint requires the canonical `billing.read` permission and still runs under the existing authenticated organization/database-session stack. See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

The current ledger counts only Payment rows whose status is `recorded`, matching the existing payment-recording default. It does not infer revenue from invoice status or `paidAt`.

## Frontend surfaces

- `/projects/[id]/invoices/new`
- `/projects/[id]/invoices/[invoiceId]`
- `/dashboard/revenue-this-week` — transaction-level weekly payment ledger; each row links back to its invoice
- `/portal/invoices/[invoiceId]`

The owner dashboard's Revenue This Week KPI uses the same weekly Payment-ledger response as the drill-down. If that read fails, the KPI reports `Unavailable` instead of substituting paid-invoice totals.

## Tests

- `app/tests/invoices.service.test.ts`
- `app/tests/payments.service.test.ts`
- `app/tests/invoice-contract-history.migration.test.ts`

## Known limitations

- payment recording exists, but public payment processing does not
- payment statuses are not yet a canonical domain enum; the weekly revenue ledger intentionally includes only the existing `recorded` status

## Deferred work

- deeper accounts-receivable automation and external payment integration
- canonical payment lifecycle/reversal/refund semantics

## Last verified date

2026-08-10
