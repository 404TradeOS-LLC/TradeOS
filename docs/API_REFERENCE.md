---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: true
related_code:
  - app/backend/server.ts
  - app/backend/health.ts
  - app/backend/routes
  - app/modules/auth
  - app/backend/middleware/auth.ts
  - app/backend/middleware/errorHandler.ts
  - app/backend/routes/costbook.routes.ts
  - app/backend/controllers/assembliesDatabase.controller.ts
  - app/backend/controllers/costbookPricing.controller.ts
  - app/backend/controllers/supplierIntegration.controller.ts
---

# API Reference

## Namespace conventions

The backend is mounted under `/api/v1`.

Special cases:

- `/health` is the unauthenticated, dependency-free liveness endpoint
- `/ready` is the unauthenticated, database-aware readiness endpoint (see `docs/PRODUCTION_HEALTH.md`)
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

`POST /api/v1/auth/bootstrap` is the one auth route that requires a bearer token despite living under the public `/api/v1/auth/*` prefix. It links a verified Supabase or local JWT identity to the application user/organization/membership and never trusts a client-supplied role or organization id.

## Request and response conventions

- controllers own Zod validation and HTTP shaping
- services return typed DTOs
- browser clients normally talk to the backend through server/client API helpers
- binary documents are proxied separately from JSON APIs

## Error conventions

The centralized error handler returns a consistent JSON shape with `error` and optional `details`. Known Prisma mappings include unique/foreign-key conflicts to `409` and record-not-found conditions to `404`.

## Route groups

Mounted route groups from `app/backend/server.ts` include:

- `/api/v1/account`
- `/api/v1/auth`
- `/api/v1/platform`
- `/api/v1/costbook`
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
- `/api/v1/jobs`
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
- `/api/v1/athena`
- `/api/v1/athena/observability`

## Costbook API

The canonical Costbook namespace is `/api/v1/costbook`. It is a compatibility-preserving boundary over the existing catalog/services rather than a second domain implementation.

### Workspace

- `GET /api/v1/costbook/workspace` — `costbook.read`; returns workspace foundation status, permission flags, and organization-scoped catalog counts.

### Materials

- `GET /api/v1/costbook/materials` — `costbook.read`
- `GET /api/v1/costbook/materials/:id` — `costbook.read`
- `POST /api/v1/costbook/materials` — `costbook.write`
- `PATCH /api/v1/costbook/materials/:id` — `costbook.write`; a unit-cost change records the existing `MaterialPriceAudit`

### Labor rates

- `GET /api/v1/costbook/labor-rates` — `costbook.read`
- `GET /api/v1/costbook/labor-rates/:id` — `costbook.read`
- `POST /api/v1/costbook/labor-rates` — `costbook.write`
- `PATCH /api/v1/costbook/labor-rates/:id` — `costbook.write`
- `DELETE /api/v1/costbook/labor-rates/:id` — `costbook.manage`; soft-deactivate

### Equipment

- `GET /api/v1/costbook/equipment` — `costbook.read`
- `GET /api/v1/costbook/equipment/:id` — `costbook.read`
- `POST /api/v1/costbook/equipment` — `costbook.write`
- `PATCH /api/v1/costbook/equipment/:id` — `costbook.write`
- `DELETE /api/v1/costbook/equipment/:id` — `costbook.manage`

### Hierarchy

Division, Category, and Subcategory list/detail routes require `costbook.read`; ordinary create/edit requires `costbook.write`; activation/deactivation and DELETE lifecycle operations require `costbook.manage`. Category/Subcategory parents are validated against the authenticated organization and caller-controlled organization IDs are not accepted.

### Cost items

- `GET /api/v1/costbook/cost-items` — `costbook.read`; active organization-scoped list/search
- `GET /api/v1/costbook/cost-items/search` — `costbook.read`
- `GET /api/v1/costbook/cost-items/:id` — `costbook.read`
- `GET /api/v1/costbook/cost-items/:id/unit-cost` — `costbook.read`; optional positive `quantity` and same-organization `regionId`
- `POST /api/v1/costbook/cost-items` — `costbook.write`
- `PATCH /api/v1/costbook/cost-items/:id` — `costbook.write`; `isActive` additionally requires `costbook.manage`
- `DELETE /api/v1/costbook/cost-items/:id` — `costbook.manage`; soft-deactivate

CostItem writes derive organization scope from auth and validate the Subcategory plus any LaborRate, Material, Equipment, or Subcontractor reference against that organization. An explicitly supplied region that is missing or cross-organization returns 404 rather than silently falling back. PR #210 merged this canonical CostItem management slice at `3c3037faf5c7c3b4f3660b6f43cc6a3b90372e4e`.

### Assemblies

The following routes promote the existing `Assembly`/`AssemblyItem` implementation under the unified namespace:

- `GET /api/v1/costbook/assemblies` — `costbook.read`
- `GET /api/v1/costbook/assemblies/search` — `costbook.read`
- `GET /api/v1/costbook/assemblies/templates` — `costbook.read`
- `GET /api/v1/costbook/assemblies/:id` — `costbook.read`
- `GET /api/v1/costbook/assemblies/:id/unit-cost` — `costbook.read`
- `GET /api/v1/costbook/assemblies/:id/items` — `costbook.read`
- `POST /api/v1/costbook/assemblies` — `costbook.write`
- `PATCH /api/v1/costbook/assemblies/:id` — `costbook.write`; lifecycle `isActive` changes additionally require `costbook.manage`
- `DELETE /api/v1/costbook/assemblies/:id` — `costbook.manage`; deactivates through the existing service behavior
- `POST /api/v1/costbook/assemblies/:id/items` — `costbook.write`
- `DELETE /api/v1/costbook/assemblies/:id/items/:itemId` — `costbook.write`

Assembly requests use strict schemas and never accept caller-controlled organization IDs. New components must reference an active same-organization CostItem or child Assembly. Cycle protection remains enforced. Database RLS/constraints independently verify parent/source tenant scope.

### Practical pricing preview

- `POST /api/v1/costbook/pricing/preview` — `costbook.read`; calculation only.

The body accepts finite nonnegative job/direct cost values, overhead percentage, and either markup or target-margin mode. Target margin must remain below 100%. The result is computed with the existing Estimate formula implementation and includes total cost, sell price, gross profit, and effective markup/margin counterparts. The endpoint creates no pricing-rule record and performs no hidden mutation.

### Price history

- `GET /api/v1/costbook/price-history` — `costbook.manage`.

Bounded filters include `materialId`, `estimateId`, `sourceType` (`cost_item` or `assembly`), `from`, `to`, and `limit`. The response deliberately separates actual `MaterialPriceAudit` catalog-change events from persisted Estimate pricing snapshots. Estimate snapshots are historical consumption observations, not catalog price-change events.

### Supplier integration authorization and feed semantics

Existing `/api/v1/supplier-integrations/*` routes remain the supplier integration surface. Reads require `costbook.read`, proposal enqueue/sync operations use the Costbook write boundary, and approve/reject requires `costbook.manage`.

Feed endpoints are not accepted from HTTP callers. Server-side `SUPPLIER_PRICE_FEED_ENDPOINTS` maps Supplier IDs to trusted HTTPS endpoints; `Supplier.website` is never used as a feed target. Responses are strictly validated and bounded, credentials remain server-side, and feed results enqueue pending `SupplierPriceUpdate` proposals only. Material prices are never auto-applied; approval continues through the existing transactional Material update plus `MaterialPriceAudit` path.

## Estimate / Costbook pricing contract

The existing Estimate Engine is the sole Costbook consumption path. A Costbook-backed `EstimateLineItem` persists `costItemId` or `assemblyId` provenance and captures `unitCost`/`lineCost` when the line is created. Recalculation of existing lines uses the persisted pricing snapshot rather than re-fetching current Costbook pricing. New lines resolve current pricing; duplication/versioning preserves stored source/pricing values.

## AI estimating routes

Structured and suggestion-based estimate-assist endpoints remain under `/api/v1/estimates/*` and retain their existing authentication, tenant, draft-only, review-token, and rate-limit boundaries. The Costbook continuation does not add a second AI/Estimate route or Athena Costbook mutation path.

## Athena

`POST /api/v1/athena/chat` remains the single Athena entrypoint. Athena tools add no Costbook write endpoint in this continuation. Existing Athena approval, audit, event, observability, and transactional event-persistence contracts are unchanged by the Costbook work.

## Settings asset metadata

Settings asset metadata routes under `/api/v1/settings` continue to manage application metadata only; Supabase Storage bytes are handled by the authenticated server-side web layer. Costbook supplier-feed configuration is server environment configuration and does not expose supplier credentials through settings responses.

## Project tasks and jobs

Existing project-task and job/dispatch API contracts are unchanged by this Costbook continuation.

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
