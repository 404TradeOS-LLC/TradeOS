---
status: current
owner: platform
last_verified: 2026-08-29
source_of_truth: false
related_code:
  - app/modules/settings
  - app/modules/admin-dashboard
  - app/modules/supplier-integration
  - app/modules/supplier-database
  - app/backend/routes/settings.routes.ts
  - app/backend/routes/adminDashboard.routes.ts
  - app/backend/routes/supplierIntegration.routes.ts
  - app/backend/routes/supplierDatabase.routes.ts
  - web/src/app/(app)/settings/page.tsx
  - web/src/components/settings/settings-console.tsx
  - web/src/lib/settingsAssetCleanup.ts
---

# Settings and Operations

## Purpose

Own the organization settings control center, internal admin summaries, supplier records, supplier review operations, and the Settings-side compatibility surface for canonical Brand Studio data.

## Source code locations

- `app/modules/settings/*`
- `app/modules/admin-dashboard/*`
- `app/modules/supplier-integration/*`
- `app/modules/supplier-database/*`
- `web/src/app/(app)/settings/page.tsx`
- `web/src/app/actions/settings.ts`
- `web/src/lib/settingsAssetCleanup.ts`

## Core models

- `OrganizationSettings`
- `SettingsAssetUpload`
- `Supplier`
- `SupplierPriceUpdate`
- `MaterialPriceAudit`

## Routes

- `/api/v1/settings/*`
- `/api/v1/admin/*`
- `/api/v1/suppliers/*`
- `/api/v1/supplier-integrations/*`

## Permissions and tenancy

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

- supplier integration reads require `costbook.read`
- queue creation/sync operations use the existing Costbook write boundary
- approve/reject requires `costbook.manage` and remains an owner/admin governance operation under current role mappings
- Settings brand-asset upload/removal/cleanup uses the existing admin-equivalent `team.manage`, `company.manage`, or `settings.manage` boundary
- organization context is server-derived and request-scoped; forced PostgreSQL RLS remains the tenant floor for application metadata

## Supplier price-feed transport

`SupplierIntegrationService` remains the canonical queue/review/worker/scheduler implementation. The generic transport is review-first and never auto-applies Material prices.

- trusted feed endpoints come only from server-side `SUPPLIER_PRICE_FEED_ENDPOINTS`, keyed by Supplier ID
- arbitrary request URLs and `Supplier.website` are not feed endpoints
- configured endpoints require HTTPS and reject redirects
- an existing supplier integration credential, when configured, stays server-side
- feed responses use the bounded `materialId` + `proposedUnitCost` quote contract
- ingestion creates pending `SupplierPriceUpdate` proposals; approved proposals continue through the existing transactional Material update plus `MaterialPriceAudit` path
- PR #257's merged supplier-review concurrency repair atomically claims pending approval/rejection rows so competing reviewers cannot apply or audit the same proposal twice
- the canonical review collection uses organization-scoped bounded search/filter/sort/keyset pagination
- scheduler execution uses the landed organization/supplier advisory lock plus bounded outcome/correlation metadata

Supplier-SKU discovery/matching and provider-specific connectors remain future work; current feed rows must identify a TradeOS Material by `materialId`.

## Brand Studio compatibility

S015 is merged and complete. Brand Studio is the canonical organization-brand source; Settings remains its compatibility/admin surface. Canonical values take precedence over legacy Settings fallbacks, legacy non-empty values can be adopted non-destructively, unrelated operational Settings JSON remains owned by Settings, and explicit clears do not repopulate stale shell values.

S016 is also merged and complete. Canonical organization branding is consumed by the authenticated proposal, invoice, contract, and shared document-rendering seams with deterministic fallbacks and safe asset/color/font handling. This supersedes older notes that claimed persisted Settings/Brand Studio fields had no downstream document consumer. Remote PDF logo fetching and arbitrary font loading remain intentionally outside that trust boundary.

## Settings brand assets

Settings Console assets (`logoUrl`, `darkLogoUrl`, `iconUrl`, `watermarkUrl`) use the private `project-files` bucket through a server-only Supabase service-role client after session, organization, and permission checks. Browser clients receive only the app-owned authenticated proxy URL.

`SettingsAssetUpload` stores the authoritative bucket/path/content-type/size metadata. Upload replacement follows upload-new → record-current → remove-previous ordering, so a cleanup failure cannot invalidate the current asset.

S017 is merged and complete. Its server-only reconciliation path:

- defaults to dry-run
- scopes listing to the exact organization/asset namespace
- protects the metadata-referenced current object
- applies a 24-hour grace period
- accepts only generated object names
- fails closed when listing evidence is incomplete
- deletes only when explicitly run with `dryRun: false`

The remaining limitation is operational rather than missing implementation: stale non-current objects can remain in private Storage until an authorized operator runs reconciliation. S017 intentionally did not introduce an automatic deletion scheduler or new retention policy.

## Request-scoped transaction convention

Settings uses the repository's request-scoped Prisma transaction boundary. A prior production defect caused `PATCH /api/v1/settings` to call `prisma.$transaction(...)` on the active transaction client; it was repaired by using the established `runInDatabaseTransaction()` helper, which reuses the current request transaction. Static regression coverage now guards against reintroducing that nested-transaction misuse in application modules.

## Frontend surfaces

- `/settings`
- internal admin HTML surface at `/admin`

## Tests

Representative coverage includes:

- `app/tests/admin-dashboard.service.test.ts`
- `app/tests/admin-dashboard.members.test.ts`
- `app/tests/supplier-database.service.test.ts`
- `app/tests/supplier-integration.service.test.ts`
- `app/tests/supplier-integration.scheduler.test.ts`
- `app/tests/supplier-integration.worker.test.ts`
- `app/tests/supplier-integration.feed.test.ts`
- Settings asset upload/cleanup tests under `web/src/**/*.test.ts`
- `app/tests/requestScopedTransaction.convention.test.ts`

## Known limitations

- supplier feeds require explicit trusted server configuration per supplier
- supplier-SKU discovery/matching and provider-specific connectors are not implemented
- internal admin surfaces are operational tooling, not contractor-facing product routes
- brand-asset reconciliation is operator-invoked and dry-run by default; no automatic cleanup scheduler exists
- remote PDF asset fetching and arbitrary font-file loading remain outside the approved document-rendering trust boundary

## Deferred work

- supplier-specific adapters and SKU/product matching beyond the generic trusted-feed contract
- additional operational reporting beyond the current queue/admin summaries
- any automatic brand-asset cleanup schedule requires a separately governed retention/operations decision

## Last verified date

2026-08-29
