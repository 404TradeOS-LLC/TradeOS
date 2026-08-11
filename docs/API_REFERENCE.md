---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
related_code:
  - app/backend/server.ts
  - app/backend/routes
  - app/modules/auth
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

`/api/v1/knowledge/*` reads from data vendored into `app/vendor/knowledge-engine/` at build time (`app/scripts/vendor-knowledge-engine.js`) rather than directly from `packages/knowledge-engine/` — that package lives outside the `tradeos-costbook` Vercel project's Root Directory (`app`) and is not present at runtime in production otherwise. The Vercel function package explicitly includes that vendored tree via `app/vercel.json` (`functions.index.ts.includeFiles: "vendor/knowledge-engine/**"`), and the loader resolves both source-style Vercel execution and compiled `dist/` execution paths. No `/api/v1/knowledge/*` request or response contract changes are introduced by that packaging fix. See [modules/ai-estimate-assist.md](modules/ai-estimate-assist.md)'s Known Limitations.

AI estimating routes under `/api/v1/estimates`:

- `POST /api/v1/estimates/:id/ai-suggestions`
- `POST /api/v1/estimates/:id/ai-suggestions/apply`
- `POST /api/v1/estimates/:id/ai-estimator/draft`
- `POST /api/v1/estimates/:id/ai-estimator/apply`

`ai-suggestions` requires `crm.read`; `ai-suggestions/apply` requires `crm.write`. The structured AI estimator endpoints (`ai-estimator/draft`, `ai-estimator/apply`) require `billing.write` and are additionally authenticated, rate-limited, and tenant-scoped like other estimate routes. Draft generation returns reviewable line items, server-signed review tokens for resolved targets, tool-run metadata, target-resolution status, and cost breakdowns. Apply accepts reviewed line items, requires accepted lines to present a matching unexpired review token, validates accepted targets against org-scoped active cost items or assemblies, serializes concurrent apply attempts per estimate, skips duplicate or already-existing reviewed lines, and writes estimate lines only by calling the existing Estimate Engine line-item service.

Costbook workspace routes under `/api/v1/costbook`:

- `GET /api/v1/costbook/workspace` — requires `costbook.read`; returns the authenticated organization's Costbook workspace foundation status, role-derived Costbook permission flags, and organization-scoped counts for existing divisions, active cost items, labor rates, materials, equipment, and active assemblies. This C001 endpoint is read-only and does not create materials, labor rates, assemblies, pricing calculations, estimate line items, price-history records, or Athena actions.
- `GET /api/v1/costbook/materials` — requires `costbook.read`; returns organization-scoped material DTOs sorted by name and SKU.
- `GET /api/v1/costbook/materials/:id` — requires `costbook.read`; returns one material in the authenticated organization or 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/materials` — requires `costbook.write`; creates one material for the authenticated organization. Accepted strict body fields: `sku`, `name`, `unitOfMeasure`, `unitCost`, `wasteFactorPct`, and optional same-organization `supplierId`.
- `PATCH /api/v1/costbook/materials/:id` — requires `costbook.write`; updates the same strict field set and records a material price-audit row when `unitCost` changes.
- `GET /api/v1/costbook/labor-rates` — requires `costbook.read`; returns organization-scoped labor-rate DTOs sorted with active rows first.
- `GET /api/v1/costbook/labor-rates/:id` — requires `costbook.read`; returns one labor rate in the authenticated organization or 404 for missing/cross-organization IDs.
- `POST /api/v1/costbook/labor-rates` — requires `costbook.write`; creates one labor rate for the authenticated organization. Accepted strict body fields: `role`, optional `description`, `hourlyCost`, `billRate`, and optional `active`.
- `PATCH /api/v1/costbook/labor-rates/:id` — requires `costbook.write`; updates the same strict field set for the authenticated organization only.
- `DELETE /api/v1/costbook/labor-rates/:id` — requires `costbook.manage`; soft-deactivates the labor-rate row by setting `active` to `false`.

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

C002 uses the existing `materials` table and its forced-RLS tenant policy; migration `20260811130000_restrict_costbook_material_writes` tightens material and material-price-audit writes to the owner/admin Costbook boundary. Material `unitCost` input rejects null, blank, and out-of-precision values before writes reach the database. Supplier price update approve/reject operations that mutate materials or audit rows require `costbook.write` so the controller contract matches the forced-RLS write policy. C002 does not add material archive/deactivate because the current schema has no active/archive flag, and it does not add labor, equipment, assemblies, pricing calculations, estimate integration, supplier sync automation, Athena recommendations, or autonomous writes.

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
