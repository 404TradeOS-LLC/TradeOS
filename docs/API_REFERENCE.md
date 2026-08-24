---
status: current
owner: platform
last_verified: 2026-08-23
source_of_truth: true
related_code:
  - app/backend/server.ts
  - app/backend/health.ts
  - app/backend/routes
  - app/modules/auth
  - app/backend/middleware/auth.ts
  - app/backend/middleware/errorHandler.ts
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

Locally issued HS256 access tokens carry a finite expiration (one hour by default; configure the positive `AUTH_JWT_TTL_SECONDS` value when needed) and the verifier rejects missing or malformed `sub`, `iat`, `exp`, issuer, audience, and related registered claims. Expired, malformed, or invalid-signature bearer requests fail before membership resolution. Refresh and Supabase bootstrap also reject inactive application users. Immediate revocation of an already-issued bearer JWT is not represented by a new token store or provider-introspection call in the current architecture.

Public routes are limited to:

- `/api/v1/auth/*`
- `/api/v1/platform/organizations`

`POST /api/v1/auth/bootstrap` is the one auth route that requires a bearer token (a verified Supabase or local JWT) despite living under the public `/api/v1/auth/*` prefix — it links that verified identity to an application user/organization/membership, is idempotent (safe to call repeatedly for an already-bootstrapped identity, which never touches the request body's `organizationName`), and never trusts a client-supplied role or organization id (`bootstrapSchema` is a Zod `.strict()` object accepting only `organizationName`/`regionCode`/`fullName` — any other field is a `400`). A `400` for a brand-new identity with no `organizationName` carries `details: { code: "organization_name_required" }`, a stable discriminator the frontend uses to route to `/finish-setup` rather than parsing the error message text. A `409` means the identity has an `AppUser` record but no active `OrganizationMembership` (a genuinely rare data-integrity edge case, not a normal path). See [modules/auth-and-tenancy.md](modules/auth-and-tenancy.md) for the full lifecycle, including a previously-fixed production bug where every already-provisioned identity's second-and-later call falsely hit that `409`.

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

Every authenticated request already runs inside a request-scoped `Prisma.TransactionClient` (`databaseSession` middleware, `app/db/requestSession.ts`), so service/controller code that needs its own nested transaction must call the existing `runInDatabaseTransaction()` helper rather than the shared `prisma` client's `.$transaction()` directly — the request-scoped transaction client has no `$transaction` method of its own, so calling it directly throws a `500`. This previously broke `PATCH /api/v1/settings` in production and was fixed alongside the same unexercised pattern in `crm`, `brand-studio`, and the project-tasks controller; see [modules/settings-and-operations.md](modules/settings-and-operations.md). `app/tests/requestScopedTransaction.convention.test.ts` guards against reintroducing this pattern.

Acquiring the pre-RLS membership-resolution transaction and the outer request
transaction uses a shared bounded 15-second wait by default
(`RLS_TRANSACTION_MAX_WAIT_MS`) in addition to the request transaction's 60-second
execution timeout (`RLS_TRANSACTION_TIMEOUT_MS`). This preserves the same API,
permission, and RLS contract while allowing parallel authenticated page-loader
requests to queue behind the intentionally one-connection serverless Prisma
pool instead of returning a transaction-acquisition `500` after two seconds.

## Route groups

Mounted route groups from `app/backend/server.ts`:

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
- `/api/v1/jobs` (including `GET /api/v1/jobs/dispatch-summary`, a read-only org-wide dispatch-attention aggregate). Job mutations use named lifecycle routes backed by the centralized transition contract in `app/modules/jobs/lifecycle.ts`: schedule/reschedule, dispatch, travel, arrival, pause/resume, completion, cancellation, reopen, and ready-for-invoice. Completion remains `on_site -> completed`; the route surface does not expose generic arbitrary status mutation.
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

`POST /api/v1/invoices/:id/void` keeps the canonical invoice lifecycle concept `voided`, but persists the raw status `void` because that is the value permitted by the live `invoices_status_check` constraint. Delivery/activity metadata continues to use `invoice.voided` and `newStatus: "voided"`; no schema or API-shape change is required.

`POST /api/v1/invoices/:id/payments` remains the existing backend payment-recording boundary. A valid recorded payment is reconciled inside the authenticated request transaction while the target Invoice row is locked; fully covered eligible `sent` or existing raw `overdue` invoices persist `paid` and emit one transactional `invoice.paid` event. Partial payment and new overdue persistence remain derived, and persisted `paid` invoices are excluded from unpaid/partially-paid/overdue follow-up filters. No payment-entry UI or payment-processor contract is introduced by S011.

`/api/v1/knowledge/*` reads from data vendored into `app/vendor/knowledge-engine/` at build time (`app/scripts/vendor-knowledge-engine.js`) rather than directly from `packages/knowledge-engine/` — that package lives outside the `tradeos-costbook` Vercel project's Root Directory (`app`) and is not present at runtime in production otherwise. The Vercel function package explicitly includes that vendored tree via `app/vercel.json` (`functions.index.ts.includeFiles: "vendor/knowledge-engine/**"`), and the loader resolves both source-style Vercel execution and compiled `dist/` execution paths. No `/api/v1/knowledge/*` request or response contract changes are introduced by that packaging fix. See [modules/ai-estimate-assist.md](modules/ai-estimate-assist.md)'s Known Limitations.

AI estimating routes under `/api/v1/estimates`:

- `POST /api/v1/estimates/:id/ai-suggestions`
- `POST /api/v1/estimates/:id/ai-suggestions/apply`
- `POST /api/v1/estimates/:id/ai-estimator/draft`
- `POST /api/v1/estimates/:id/ai-estimator/apply`

`ai-suggestions` requires `crm.read`; `ai-suggestions/apply` requires `crm.write`. The structured AI estimator endpoints (`ai-estimator/draft`, `ai-estimator/apply`) require `billing.write` and are additionally authenticated, rate-limited, and tenant-scoped like other estimate routes. Draft generation returns reviewable line items, server-signed review tokens for resolved targets, tool-run metadata, target-resolution status, and cost breakdowns. Apply accepts reviewed line items, requires accepted lines to present a matching unexpired review token, validates accepted targets against org-scoped active cost items or assemblies, serializes concurrent apply attempts per estimate, skips duplicate or already-existing reviewed lines, and writes estimate lines only by calling the existing Estimate Engine line-item service.

Estimate lifecycle behavior:

- Estimate responses and organization-queue results use the canonical states `draft`, `ready`, `sent`, `viewed`, `approved`, `declined`, `expired`, and `superseded`.
- Historical `rejected` values normalize to `declined`; canonical `sent` remains distinct from `ready` and is accepted by the estimate queue status filter.
- The currently implemented Estimate Engine mutation path remains draft-only until `POST /api/v1/estimates/:id/finalize` transitions the estimate to `ready`. This S008 slice does not add customer-facing send/view/approve/expire/supersede routes.

Project Athena A12 business tools (`app/modules/athena-tools/**`) add no new REST routes under `/api/v1/estimates` or `/api/v1/jobs` — they are invoked through the existing Athena kernel chat endpoint (`POST /api/v1/athena/chat`, dark behind `ATHENA_KERNEL_ENABLED`), calling application services directly rather than adding tool-specific HTTP endpoints. `EstimateEngineService` gained one new read-only method, `compareEstimates()` (no route). `EstimateEngineService.create()`/`finalize()` and `JobsService.schedule()`/`addAssignment()`/`complete()` retain the existing additive, optional `athenaEvent` response metadata. A12.1 changes the covered mutation semantics: for `EstimateStarted`, `EstimateCompleted`, `JobScheduled`, `TechnicianAssigned`, `WorkCompleted`, and `ProposalSent`, durable canonical-event persistence is required in the same database transaction as the corresponding business mutation. A required event-persistence failure now rolls the mutation back instead of being treated as a non-blocking publish failure. Subscriber delivery/retry/dead-letter/replay remain asynchronous after commit. No new REST route or response field is introduced by A12.1. See [athena/roadmap/A12.1-transactional-event-reliability-plan.md](athena/roadmap/A12.1-transactional-event-reliability-plan.md).

`POST /api/v1/athena/chat` remains the single production Athena entrypoint. As
of Friday, August 14, 2026, it:
- requires standard authenticated organization access;
- derives actor/org/role from server-trusted auth context, not request body;
- resolves exact granted permissions from the authenticated TradeOS session when
  available, with raw-role fallback only for older compatibility call paths;
- can record Athena audit events for request receipt, context gathering, tool
  consideration, action attempt, approval request, completion, and failure;
- enforces fail-closed approval verification for medium/high-risk actions by
  binding approval to org, user, tool, risk, idempotency key, canonical input
  hash, plan id, and step id;
- exposes no separate tool-specific mutation endpoints.

**Unreleased (PR #214):** the optional `idempotencyKey` request contract and durable A6 action-idempotency behavior below exist on PR #214 and must not be treated as shipped on `main` or available in production until that PR is merged and deployed.

PR #214 adds an optional `idempotencyKey` request field: a caller-generated,
trimmed, non-empty retry key of at most 200 characters. It is not an approval
token and grants no permission. The controller forwards that stable retry key
through the existing kernel seam to A6, which binds it to the server-derived
organization and actor, registered tool/version, and canonical hash of validated
tool input before tool execution.

Under PR #214, durable action idempotency adds no new REST route. A completed
duplicate with the same actor/org/tool/version/key/input identity returns the
original persisted action result without invoking the tool again; reusing the
same key for different validated input fails closed. The durable store runs
inside the authenticated request-scoped RLS transaction, while the process-local
store remains a test/local fixture.

Approval and audit persistence for Athena are internal implementation details,
not new public REST resources. Before organization-scoped approval list/detail
reads, overdue rows still persisted as `pending` are conditionally and atomically
transitioned to `expired`; the update is scoped to the authenticated organization
and current `pending` status so concurrent terminal changes are preserved. Their
current source-of-truth behavior is documented in
[athena/SECURITY_MODEL.md](athena/SECURITY_MODEL.md).

Costbook workspace routes under `/api/v1/costbook`:

### Costbook catalog query contract

Collection reads use the bounded response envelope below unless a route is an
explicit scalar, detail, nested-composition, or typeahead compatibility route:

```json
{ "items": [], "total": 0, "nextCursor": null }
```

Catalog list parameters are `limit` (default `25`, maximum `100`), opaque
`cursor`, optional server-side `q`, an endpoint-specific allowlisted `sort`,
and `order` (`asc` or `desc`). Invalid cursors, unsupported sort fields, and
limits above the maximum return `400`. Ordering always includes `id` as a
deterministic tie-breaker; totals include all active filters but never the
cursor predicate. Cursor tokens are versioned, opaque, and bound to the
organization, search/filter state, sort field, and direction. Resource-specific
filters are `active`, `divisionId`, `categoryId`, `subcategoryId`,
`componentType`, `isTemplate`, `supplierId`, and `trade` only where the model
supports them. No query parameter supplies an organization id.

`/costbook/cost-items/search` and assembly search remain bounded plain-array
typeahead compatibility routes for Estimate Builder and AI Estimate Assist;
they are not complete catalog reads. Price history exposes independent
`materialChanges` and `estimateSnapshots` catalog pages, each with its own
cursor and total, so unrelated history streams cannot share an ambiguous
cursor.

- `GET /api/v1/costbook/workspace` — requires `costbook.read`; returns the authenticated organization's Costbook workspace foundation status, role-derived Costbook permission flags, and organization-scoped counts for existing divisions, active cost items, labor rates, materials, equipment, and active assemblies. This C001 endpoint is read-only and does not create materials, labor rates, assemblies, pricing calculations, estimate line items, price-history records, or Athena actions.
- `GET /api/v1/costbook/materials` — requires `costbook.read`; returns the catalog page for organization-scoped materials. Search covers name/SKU and `supplierId` is supported as a filter; safe sorts are `name`, `createdAt`, and `updatedAt`.
- `GET /api/v1/costbook/materials/:id` — requires `costbook.read`; returns one material in the authenticated organization or 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/materials` — requires `costbook.write`; creates one material for the authenticated organization. Accepted strict body fields: `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, and optional same-organization `supplierId`.
- `PATCH /api/v1/costbook/materials/:id` — requires `costbook.write`; updates the same strict field set and records a material price-audit row when `unitCost` changes.
- `GET /api/v1/costbook/labor-rates` — requires `costbook.read`; returns a catalog page with server-side role/description/trade search, `active` and `trade` filters, and safe `role`, `createdAt`, or `updatedAt` sorting.
- `GET /api/v1/costbook/labor-rates/:id` — requires `costbook.read`; returns one labor rate in the authenticated organization or 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/labor-rates` — requires `costbook.write`; creates one labor rate for the authenticated organization. Accepted strict body fields: `role`, optional `description`, `hourlyCost`, `billRate`, and optional `active`.
- `PATCH /api/v1/costbook/labor-rates/:id` — requires `costbook.write`; updates the same strict field set for the authenticated organization only.
- `DELETE /api/v1/costbook/labor-rates/:id` — requires `costbook.manage`; soft-deactivates the labor-rate row by setting `active` to `false`.
- `GET /api/v1/costbook/cost-items` — requires `costbook.read`; returns a catalog page for all organization-scoped CostItems. Search covers code/name/notes; `active`, `subcategoryId`, and supported component-type filters are server-side. Safe sorts are `code`, `name`, `createdAt`, and `updatedAt`.
- `GET /api/v1/costbook/cost-items/search` — requires `costbook.read`; compatibility search alias under the unified namespace.
- `GET /api/v1/costbook/cost-items/:id` — requires `costbook.read`; returns one CostItem in the authenticated organization or 404.
- `GET /api/v1/costbook/cost-items/:id/unit-cost` — requires `costbook.read`; accepts optional positive `quantity` and optional same-organization `regionId` and returns the existing relationship-derived labor/material/equipment unit-cost breakdown.
- `POST /api/v1/costbook/cost-items` — requires `costbook.write`; creates a CostItem for the authenticated organization. Strict required body fields: `subcategoryId`, `code`, `name`, `unitOfMeasure`. Optional fields: `productionRate`, `laborRateId`, `materialId`, `equipmentId`, `subcontractorId`, `notes`.
- `PATCH /api/v1/costbook/cost-items/:id` — requires `costbook.write`; supports partial edits without re-parenting `subcategoryId`. Nullable `productionRate`, `laborRateId`, `materialId`, `equipmentId`, and `subcontractorId` can be explicitly cleared. A PATCH containing `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/cost-items/:id` — requires `costbook.manage`; soft-deactivates the CostItem to preserve historical Estimate references.

CostItem writes never accept a caller-controlled organization id. Before create/update, the service validates the referenced Subcategory and any supplied LaborRate, Material, Equipment, or Subcontractor against the authenticated organization. The same checks back the legacy `/api/v1/cost-database/cost-items/*` compatibility endpoints, which now explicitly require `costbook.read`, `costbook.write`, or `costbook.manage` according to the same read/write/lifecycle split. Existing forced RLS remains database-level defense in depth.

Costbook material DTO:

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "sku": "CONC-4000",
  "name": "Ready Mix Concrete",
  "unitOfMeasure": "CY",
  "unitCost": 150,
  "wasteFactorPct": 5,
  "supplierId": null,
  "supplierName": null,
  "lastPriceUpdate": "2026-08-11T00:00:00.000Z",
  "createdAt": "2026-08-10T00:00:00.000Z",
  "updatedAt": "2026-08-11T00:00:00.000Z"
}
```

C002 uses the existing `materials` table and its forced-RLS tenant policy; migration `20260811130000_restrict_costbook_material_writes` tightens material and material-price-audit writes to the owner/admin Costbook boundary. Material `unitCost` input rejects null, blank, and out-of-precision values before writes reach the database. Supplier price update approve/reject operations that mutate materials or audit rows require `costbook.manage` so the controller contract matches the forced-RLS write policy. C002 does not add material archive/deactivate because the existing `Material` table has no active/archive state, and it does not add labor, equipment, assemblies, pricing calculations, estimate integration, supplier sync automation, Athena recommendations, or autonomous writes.

Costbook labor-rate DTO:

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "role": "Lead Carpenter",
  "description": "Finish trim labor",
  "hourlyCost": 45.25,
  "billRate": 88.5,
  "active": true,
  "createdAt": "2026-08-11T00:00:00.000Z",
  "updatedAt": "2026-08-11T00:00:00.000Z"
}
```

C003 extends the existing `labor_rates` table in place and keeps the older
`trade`/`base_hourly_rate` compatibility columns for legacy code paths. The
new Costbook layer treats `role`, optional `description`, `hourlyCost`,
`billRate`, and `active` as the foundational labor-rate fields. Input rejects
blank roles, blank/null numeric values, negative numeric values, and values
outside the `numeric(10,2)` precision before writes reach the database.

The legacy `/api/v1/materials/*` route group remains mounted for compatibility, but it now shares the same Costbook permission boundary: read-style operations require `costbook.read`, and create/update/delete/bulk-import operations require `costbook.write`.

The legacy `/api/v1/labor-rates/*` route group also remains mounted for
compatibility. Its read-style operations require `costbook.read`; create/update
operations require `costbook.write`; delete requires `costbook.manage`; and
its writes stay inside the same forced-RLS Costbook manage boundary as the new
Costbook labor-rate routes.

C005 hierarchy routes under `/api/v1/costbook`:

- `GET /api/v1/costbook/divisions` — requires `costbook.read`; returns organization-scoped Division DTOs, active rows first.
- `GET /api/v1/costbook/divisions/:id` — requires `costbook.read`; 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/divisions` — requires `costbook.write`; strict body: `code`, `name`, optional `sortOrder`.
- `PATCH /api/v1/costbook/divisions/:id` — requires `costbook.write` for ordinary fields; a PATCH carrying `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/divisions/:id` — requires `costbook.manage`; soft-deactivates by setting `isActive` to `false`.
- `GET /api/v1/costbook/categories?divisionId=` — requires `costbook.read`; optional `divisionId` filter, organization-scoped through the parent Division.
- `GET /api/v1/costbook/categories/:id` — requires `costbook.read`; 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/categories` — requires `costbook.write`; strict body: `divisionId`, `code`, `name`, optional `sortOrder`. Rejects a `divisionId` that does not belong to the authenticated organization.
- `PATCH /api/v1/costbook/categories/:id` — requires `costbook.write` for ordinary fields; `divisionId` is not re-parentable through update and `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/categories/:id` — requires `costbook.manage`; soft-deactivates by setting `isActive` to `false`.
- `GET /api/v1/costbook/subcategories?categoryId=` — requires `costbook.read`; optional `categoryId` filter, organization-scoped through Category → Division.
- `GET /api/v1/costbook/subcategories/:id` — requires `costbook.read`; 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/subcategories` — requires `costbook.write`; strict body: `categoryId`, `code`, `name`, optional `sortOrder`. Rejects a `categoryId` that does not belong to the authenticated organization.
- `PATCH /api/v1/costbook/subcategories/:id` — requires `costbook.write` for ordinary fields; `categoryId` is not re-parentable through update and `isActive` additionally requires `costbook.manage`.
- `DELETE /api/v1/costbook/subcategories/:id` — requires `costbook.manage`; soft-deactivates by setting `isActive` to `false`.

Costbook division DTO:

```json
{
  "id": "uuid",
  "organizationId": "uuid",
  "code": "ELEC",
  "name": "Electrical",
  "sortOrder": 0,
  "isActive": true,
  "createdAt": "2026-08-12T00:00:00.000Z"
}
```

Category and Subcategory DTOs are the same shape, replacing `organizationId`-only with `divisionId`/`organizationId` (Category) or `categoryId`/`organizationId` (Subcategory); `organizationId` on both is derived through the parent join, not a stored column.

C005 reuses the existing `divisions`/`categories`/`subcategories` tables (no new models) and adds an `isActive` column to all three via migration `20260812120000_add_costbook_hierarchy_foundation` — previously only `CostItem` had a soft-delete flag in this hierarchy. That migration also tightens `divisions_write_policy`/`categories_write_policy`/`subcategories_write_policy` from the generic app-wide write boundary (which also granted the legacy `estimator` role) to the same `current_app_can_manage_costbook()` boundary C002/C003 already use, so legacy `estimator` loses direct database write access to these three tables. The legacy `/api/v1/cost-database/{divisions,categories,subcategories}` list+create routes remain mounted at the same paths, but `createDivision`/`createCategory`/`createSubcategory` require `costbook.write` at the controller layer too. C005 does not add pricing calculations, a first-class assembly builder, supplier synchronization, or Athena recommendation behavior.

Settings asset storage metadata routes under `/api/v1/settings`:

- `GET /api/v1/settings/assets/:assetKey` — any authenticated org member; returns the current storage bucket/path/content-type/size for one of `logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`, or 404 if nothing has been uploaded for that slot
- `POST /api/v1/settings/assets` — requires `team.manage`/`company.manage`/`settings.manage` (same gate as `PATCH /api/v1/settings`); accepts only the private `project-files` bucket, the authenticated organization's generated brand-asset path, a supported raster image content type, and a size up to 6 MB; persists new storage metadata and returns the previous record (if any) so the caller can delete the superseded storage object
- `DELETE /api/v1/settings/assets/:assetKey` — same permission gate; deletes the metadata record and returns it (if any) for the caller to delete the underlying storage object

These endpoints never touch Supabase Storage themselves — they only read/write the application's own `settings_asset_uploads` table. The web app's server-only service_role Supabase client (never the anon/publishable key) performs the actual Storage upload/download/delete, calling these endpoints before and after to keep metadata and storage bytes consistent. See [modules/settings-and-operations.md](modules/settings-and-operations.md).

Project task routes under `/api/v1/projects`:

- `GET /api/v1/projects/tasks`
- `GET /api/v1/projects/:id/tasks`
- `POST /api/v1/projects/:id/tasks`
- `PATCH /api/v1/projects/:id/tasks/:taskId`
- `DELETE /api/v1/projects/:id/tasks/:taskId`

`GET /api/v1/projects/tasks` is the org-scoped task feed used by the owner dashboard. It requires `crm.read`, stays inside the existing bearer-auth + membership + request-scoped DB session stack, and returns task rows with project, customer, and optional job context. Query parameters:

- `limit` — optional integer, `1..50`, default service cap `24`
- `includeCompleted` — optional boolean string (`true` or `false`); when omitted, completed tasks are excluded

For nested task mutations, the route parent is authoritative: `PATCH` and `DELETE /api/v1/projects/:id/tasks/:taskId` reject a task whose stored `projectId` does not match `:id` before mutation or activity writes. When `PATCH` changes `jobId`, the replacement job must be active, belong to the authenticated organization, and belong to that same project; a cross-project job is rejected before the task update.

Project lifecycle behavior:

- `GET /api/v1/projects`, `GET /api/v1/projects/:id`, and `PATCH /api/v1/projects/:id/status` return canonical project statuses: `lead`, `estimating`, `awarded`, `active`, `on_hold`, `completed`, or `archived`.
- Historical persisted aliases remain normalized on read for compatibility. Proposal-driven Project side effects persist canonical values only: draft creation/duplication/decline, send, and resend use `estimating`; acceptance uses `awarded`.
- `PATCH /api/v1/projects/:id/status` accepts only canonical values and enforces the shared Project transition contract; organization scope comes from authenticated request context.

`POST /api/v1/proposals/:id/send` retains its existing request/response shape. Under A12.1, the `ProposalSent` canonical event must persist in the same database transaction as the `draft -> sent` mutation; failure of required event persistence rolls that mutation back. Subscriber delivery remains asynchronous and is not part of the HTTP transaction contract. See [modules/proposals.md](modules/proposals.md) and [athena/roadmap/A12.1-transactional-event-reliability-plan.md](athena/roadmap/A12.1-transactional-event-reliability-plan.md).

Proposal lifecycle responses use canonical `declined`. `POST /api/v1/proposals/:id/reject` remains the compatibility route name, but a successful transition from `sent` or `viewed` persists `declined`, records `proposal.declined`, and moves the related Project to canonical `estimating`. Historical stored `rejected` values remain readable and normalize to `declined`; no organization or permission boundary changes.

PR #276 (S010, merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`) normalizes Contract lifecycle responses under `/api/v1/contracts/*` to canonical `sent` in place of stored `pending_signature`. The `contracts.status` check constraint, its default, and the `sign()`/`void()` transition guards are unchanged and still operate on raw `pending_signature`; only the DTO the API returns is normalized. No route, schema, or permission change.

## Costbook continuation API additions

PR #216 extends the existing Costbook namespace without adding parallel domain systems: `/api/v1/costbook/assemblies` exposes the existing Assembly model and composition service; `POST /api/v1/costbook/pricing/preview` is calculation-only and reuses Estimate pricing formulas; and `GET /api/v1/costbook/price-history` returns tenant-scoped `MaterialPriceAudit` changes separately from persisted Estimate pricing snapshots. Supplier feed transport remains under the existing supplier-integration surface, accepts endpoints only from trusted server configuration, and enqueues review proposals rather than mutating Material prices automatically. These additions preserve the existing `costbook.read` / `costbook.write` / `costbook.manage` split and introduce no Athena Costbook write route.

The S027 catalog continuation applies the same page envelope and opaque
keyset-cursor contract to materials, labor rates, equipment, hierarchy,
CostItems, assemblies, assembly templates, supplier review queues, and the two
price-history streams. Search and useful filters execute inside the
organization-scoped database query; the web catalog screens submit those
criteria to the server and expose next-page navigation rather than treating a
bounded response as a complete catalog.


**Unreleased (PR `#257`):** Supplier price-proposal approval and rejection use an atomic pending-status claim inside the existing transaction: only the reviewer that successfully claims the organization-scoped pending row may continue, and a competing reviewer receives conflict/fail-closed behavior. A downstream Material or audit failure rolls the claim back to `pending`; feeds remain review-first and never auto-apply Material pricing. Approve/reject routes require `costbook.manage`. This is a concurrency repair only: it changes neither the Costbook architecture nor its permission model.

`POST /api/v1/costbook/pricing/preview` requires `costbook.read`. `GET /api/v1/costbook/price-history` requires `costbook.manage`; that permission is granted to owner and admin roles, and the controller does not apply a separate manager-role check.

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
