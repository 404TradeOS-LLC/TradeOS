---
status: current
owner: platform
last_verified: 2026-08-28
source_of_truth: false
related_code:
  - app/modules/crm/service.ts
  - app/backend/routes/crm.routes.ts
  - app/prisma/schema.prisma
  - web/src/app/(app)/customers
  - web/src/app/actions/customers.ts
---

# CRM

## Purpose

Own customer records, service addresses, customer equipment, service agreements, notes, customer import, company profile data, and the existing invoice-scoped payment-recording entry point used by the project workflow.

## Source code locations

- `app/modules/crm/*`
- `app/backend/routes/crm.routes.ts`
- `web/src/app/(app)/customers/**`
- `web/src/app/actions/customers.ts`

## Core models

- `Customer`
- `ServiceAddress`
- `CustomerEquipment`
- `ServiceAgreement`

## Customer listing and search

`CrmService.listCustomers(orgId, options)` remains tenant-scoped and excludes soft-deleted customers. Callers may provide a trimmed `query` that is applied in PostgreSQL across customer name, email, and phone, plus a bounded `limit`; the service clamps the result count to prevent unbounded customer-directory reads. Ordinary callers that omit options continue to receive a bounded customer list.

## Routes

- `GET|POST /api/v1/customers`
- `GET|PATCH|DELETE /api/v1/customers/:id`
- `POST|PATCH|DELETE /api/v1/customers/:id/service-addresses/*`
- `POST|PATCH|DELETE /api/v1/customers/:id/equipment/*`
- `GET|POST /api/v1/customers/:id/service-agreements`
- `GET|POST /api/v1/notes`
- `POST /api/v1/import/customers`
- `GET|PATCH /api/v1/company`
- `GET|POST /api/v1/invoices/:id/payments` — payment recording remains backend-owned; `POST` reconciles valid recorded payments against the eligible Invoice inside the existing request-scoped transaction

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

- customer records support soft delete through `deleted_at`
- equipment assets use a free-form `status` field
- service agreements default to `draft`
- payment reconciliation does not persist `partially_paid` or a new overdue state; a fully covered eligible `sent` or existing `overdue` Invoice is advanced to persisted `paid`, while persisted `paid` remains authoritative for follow-up exclusion
- the authenticated invoice detail surface records partial or full payments with amount, date, method, reference, and notes; draft invoices are rejected and displayed balances never become negative

## Emitted activity events

- notes and related operational actions may feed broader activity surfaces through the intelligence primitives

## Implementation notes

- Fixed a production defect (found via static audit after a matching bug crashed `PATCH /api/v1/settings` in production, see [settings-and-operations.md](settings-and-operations.md)): `addServiceAddress`/`updateServiceAddress` called `prisma.$transaction(...)` directly on the request-scoped `prisma` proxy, which throws inside any real authenticated request because `databaseSession` middleware already runs the request inside a `Prisma.TransactionClient` that has no `$transaction` method. Both now use the existing `runInDatabaseTransaction()` helper, matching the convention already used elsewhere (`jobs`, `athena-events`, `athena-memory`, `costbook`). No route contract, permission, or schema change.

## Frontend surfaces

- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/projects/[id]/invoices/[invoiceId]` — staff payment-entry form for eligible sent/overdue invoices

## Tests

- `app/tests/crm.service.test.ts`
- `app/tests/rls.integration.ts` covers payment reconciliation's PostgreSQL locking, tenant boundary, and event behavior
- A12 Athena Office Manager contract coverage verifies bounded name/email/phone customer searches through the service boundary

## Known limitations

- CRM remains intentionally project-centered rather than a separate pipeline subsystem

## Deferred work

- richer communication history and deeper service-agreement workflows

## Last verified date

2026-08-28
