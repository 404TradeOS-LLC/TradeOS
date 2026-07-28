---
status: current
owner: platform
last_verified: 2026-07-28
source_of_truth: true
related_code:
  - app/backend/server.ts
  - app/backend/routes
  - app/backend/middleware/auth.ts
  - app/backend/middleware/errorHandler.ts
---

# API Reference

## Namespace conventions

The backend is mounted under `/api/v1`.

Special cases:

- `/health` is the unauthenticated health endpoint
- `/admin` is the internal HTML admin surface
- `/api/v1/platform/*` is reserved for organization provisioning
- `/api/v1/auth/*` is public auth

## Authentication expectations

Protected API routes require:

- `Authorization: Bearer <token>`
- a resolvable organization membership
- a request-scoped database session for forced RLS

Tenant impersonation through request-controlled organization headers is not supported.

Public routes are limited to:

- `/api/v1/auth/*`
- `/api/v1/platform/organizations`

## Request and response conventions

- controllers own Zod validation and HTTP shaping
- services return typed DTOs
- browser clients normally talk to the backend through `web/src/lib/api.ts` or `web/src/lib/clientApi.ts`
- signup/login themselves go through Supabase Auth directly in Server Actions (`web/src/app/actions/auth.ts`), not through `api.ts` — the module previously also exported unused `signup`/`login`/`AuthSession` helpers that duplicated this path; those were removed as dead code
- binary documents are proxied separately from JSON APIs

## Error conventions

The centralized error handler returns a consistent JSON shape with:

- `error`
- optional `details`

Known Prisma mappings include:

- unique-constraint conflicts to `409`
- foreign-key conflicts to `409`
- record-not-found conditions to `404`

`mapPrismaKnownRequestError` (the function implementing this mapping) is an internal helper local to `errorHandler.ts`; it is not exported, since no other module has ever needed to call it directly.

## Route groups

Mounted route groups from `app/backend/server.ts`:

- `/api/v1/account`
- `/api/v1/auth`
- `/api/v1/platform`
- `/api/v1/cost-database`
- `/api/v1/labor-rates`
- `/api/v1/materials`
- `/api/v1/suppliers`
- `/api/v1/equipment`
- `/api/v1/assemblies`
- `/api/v1/estimates`
- `/api/v1/proposals`
- `/api/v1/invoices`
- `/api/v1/contracts`
- `/api/v1/admin`
- `/api/v1/customers`
- `/api/v1/projects`
- `/api/v1/jobs` (including `GET /api/v1/jobs/dispatch-summary`, a read-only org-wide dispatch-attention aggregate)
- `/api/v1/schedule`
- `/api/v1/notes`
- `/api/v1/change-orders`
- `/api/v1/supplier-integrations`
- `/api/v1/project-intake`
- `/api/v1/knowledge`
- `/api/v1/settings`
- `/api/v1/company`
- `/api/v1/import/customers`
- `/api/v1/brand-studio`
- `/api/v1/intelligence`

AI estimating routes under `/api/v1/estimates`:

- `POST /api/v1/estimates/:id/ai-suggestions`
- `POST /api/v1/estimates/:id/ai-suggestions/apply`
- `POST /api/v1/estimates/:id/ai-estimator/draft`
- `POST /api/v1/estimates/:id/ai-estimator/apply`

`ai-suggestions` requires `crm.read`; `ai-suggestions/apply` requires `crm.write`. The structured AI estimator endpoints (`ai-estimator/draft`, `ai-estimator/apply`) require `billing.write` and are additionally authenticated, rate-limited, and tenant-scoped like other estimate routes. Draft generation returns reviewable line items, server-signed review tokens for resolved targets, tool-run metadata, target-resolution status, and cost breakdowns. Apply accepts reviewed line items, requires accepted lines to present a matching unexpired review token, validates accepted targets against org-scoped active cost items or assemblies, serializes concurrent apply attempts per estimate, skips duplicate or already-existing reviewed lines, and writes estimate lines only by calling the existing Estimate Engine line-item service.

## Detailed module links

- [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md)
- [modules/crm.md](modules/crm.md)
- [modules/cost-book.md](modules/cost-book.md)
- [modules/estimating.md](modules/estimating.md)
- [modules/proposals.md](modules/proposals.md)
- [modules/contracts.md](modules/contracts.md)
- [modules/invoices-and-payments.md](modules/invoices-and-payments.md)
- [modules/projects.md](modules/projects.md)
- [modules/jobs-and-scheduling.md](modules/jobs-and-scheduling.md)
- [modules/activity-and-intelligence.md](modules/activity-and-intelligence.md)
- [modules/brand-studio.md](modules/brand-studio.md)
- [modules/customer-portal.md](modules/customer-portal.md)
- [modules/ai-estimate-assist.md](modules/ai-estimate-assist.md)
- [modules/settings-and-operations.md](modules/settings-and-operations.md)
