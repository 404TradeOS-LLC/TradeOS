---
status: current
owner: platform
last_verified: 2026-08-16
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
  - app/backend/controllers/supplierIntegration.controller.ts
  - app/tests/supplier-integration.feed.test.ts
  - web/src/app/(app)/settings/page.tsx
  - web/src/components/settings/settings-console.tsx
---

# Settings and Operations

## Purpose

Own the organization settings control center, internal admin summaries, supplier records, and supplier review queue operations.

## Source code locations

- `app/modules/settings/*`
- `app/modules/admin-dashboard/*`
- `app/modules/supplier-integration/*`
- `app/modules/supplier-database/*`
- `web/src/app/(app)/settings/page.tsx`

## Core models

- `OrganizationSettings`
- `Supplier`
- `SupplierPriceUpdate`
- `MaterialPriceAudit`

## Routes

- `/api/v1/settings/*`
- `/api/v1/admin/*`
- `/api/v1/suppliers/*`
- `/api/v1/supplier-integrations/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Current supplier-integration boundary:

- supplier integration reads require `costbook.read`
- queue creation/sync operations use the Costbook write boundary
- approve/reject requires `costbook.manage` and remains an owner/admin governance operation under current role mappings

## Supplier price-feed transport

The existing SupplierIntegrationService queue/review/worker/scheduler remains canonical. The Costbook continuation adds only the previously missing feed transport adapter; it does not create another supplier synchronization system.

- trusted feed endpoints come only from server-side `SUPPLIER_PRICE_FEED_ENDPOINTS`, keyed by Supplier ID
- arbitrary request URLs and `Supplier.website` are never treated as feed endpoints
- configured endpoints must use HTTPS; redirects are rejected
- an existing supplier `apiIntegrationKey`, when present, is used server-side as a bearer credential and is never returned by the API
- responses use a strict minimal quote contract (`materialId`, `proposedUnitCost`), are bounded in quote count and response size, and are subject to an abort timeout
- absent configuration is an honest safe no-op/unconfigured state rather than a fabricated successful sync
- feed ingestion only creates pending `SupplierPriceUpdate` proposals; it never changes `Material.unitCost` directly
- approved proposals continue through the existing transactional material update plus `MaterialPriceAudit` path
- duplicate pending-proposal suppression remains in the existing service
- the review queue collection read uses the shared Costbook catalog contract: organization-scoped server-side search/filter/sort, bounded keyset pages, full filtered totals, and opaque cursors; approval/rejection claim semantics remain unchanged

There is no supplier-SKU matching layer in this slice; feed rows must already identify a TradeOS Material by `materialId`.

## Frontend surfaces

- `/settings`
- internal admin HTML surface at `/admin`

## Tests

- `app/tests/admin-dashboard.service.test.ts`
- `app/tests/admin-dashboard.members.test.ts`
- `app/tests/supplier-database.service.test.ts`
- `app/tests/supplier-integration.service.test.ts`
- `app/tests/supplier-integration.scheduler.test.ts`
- `app/tests/supplier-integration.worker.test.ts`
- `app/tests/supplier-integration.feed.test.ts`

## Implementation notes

The S015 implementation makes Brand Studio the canonical owner of branding
fields while this Settings module remains the compatibility and administration
surface. The implementation preserves the existing Settings route shape,
resolves canonical values before legacy fallbacks, lazily adopts non-empty
legacy values, preserves unknown operational JSON keys, and maps explicit
Settings clears without repopulating stale shell values. See
[S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md](../architecture/S015_BRAND_PROFILE_SETTINGS_ADAPTER_PLAN.md)
for the bounded field map and required authorization/RLS evidence. Operational
Settings fields remain in `OrganizationSettings.settingsJson` and are outside
that adapter.

- Fixed a production bug where every `PATCH /api/v1/settings` call failed with `TypeError: ...prisma.$transaction is not a function`, confirmed against live Vercel runtime logs. Root cause: `OrganizationSettingsService.updateSettings` called `prisma.$transaction(...)` on the shared, request-scoped `prisma` proxy (`app/db/client.ts`); `databaseSession` middleware already wraps every authenticated request in a `Prisma.TransactionClient` via `AsyncLocalStorage` (`app/db/requestSession.ts`), and that proxy resolves `prisma` to the active transaction client whenever one is set. `Prisma.TransactionClient` has no `$transaction` method, so the call threw on every real request; the existing unit test suite never caught this because it mocks `db/client` entirely, bypassing the proxy's request-scoped resolution. Fixed by routing through the existing `runInDatabaseTransaction()` helper, which reuses the active request transaction instead of nesting a new one. The same broken pattern (unexercised in production traffic) was also found and fixed in `app/modules/crm/service.ts`, `app/modules/brand-studio/service.ts`, and `app/backend/controllers/projectTasks.controller.ts` — see those modules' docs. `app/tests/requestScopedTransaction.convention.test.ts` is new static regression coverage that fails if any module reintroduces a direct `prisma.$transaction(...)` call.
- `admin-dashboard`'s `CreateOrganizationInput` and `supplier-integration`'s `SupplierPriceUpdateStatus`/`SupplierFeedQuote` are file-local types; their `export` keyword was removed after confirming no other module imports them by name
- Settings Console brand asset uploads (`logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`) go through a server-only Supabase service_role client (`web/src/lib/supabase/admin.ts`, requires `SUPABASE_SERVICE_ROLE_KEY` — never `NEXT_PUBLIC_`-prefixed, never sent to the browser), not the anon/publishable client used elsewhere. The `project-files` bucket is private; there are no `anon`/`authenticated` Storage RLS policies on `storage.objects` at all, since the service_role key bypasses Storage RLS entirely and authorization is enforced in `uploadSettingsAssetAction`/`removeSettingsAssetAction` before any Storage call (session + org membership + the `team.manage`/`company.manage`/`settings.manage` role gate). Storage location metadata (bucket/path/content type/size) is persisted in the application's own `settings_asset_uploads` table (forced RLS, admin-only write, `app/prisma/migrations/20260728120000_add_settings_asset_uploads`), not inferred from a URL string. The backend accepts only the `project-files` bucket, the authenticated organization's exact generated brand-asset namespace, passive raster content types (PNG/JPEG/WebP/GIF/ICO), and files up to 6 MB, preventing a crafted metadata request from redirecting the service-role read proxy to another object. Reads go through `web/src/app/api/brand-assets/[orgId]/[assetKey]/route.ts`, a server-side proxy that verifies the caller's session org matches the requested org before streaming bytes with `nosniff` and a restrictive CSP; the normal UI receives only the stable app-owned proxy URL. Replacing an asset uploads a fresh, server-generated object name, persists the new metadata row, and only then deletes the previous object, so a failure between those steps leaves an orphaned object rather than a broken active asset. S017 adds a server-only, admin-equivalent, dry-run-by-default reconciliation action (`web/src/lib/settingsAssetCleanup.ts`) that lists only the private organization brand-assets namespace, protects the metadata-referenced current object, applies a 24-hour grace period, and deletes only stale generated names when explicitly run with `dryRun: false`; malformed paths, other organizations, external URLs, recent objects, and unrelated buckets are never eligible.

## Known limitations

- supplier feeds require explicit trusted server configuration per supplier; the adapter does not imply every Supplier is synchronized
- supplier-SKU discovery/matching is not implemented
- **Unreleased (PR `#257`):** supplier pricing is review/proposal based and never auto-applied; approval
  and rejection atomically claim a pending proposal so concurrent reviewers
  cannot apply or audit the same proposal twice
- internal admin surfaces are operational tooling, not contractor-facing product routes
- Settings Console's brand asset fields (`logoUrl`/`darkLogoUrl`/`iconUrl`/`watermarkUrl`, persisted via `organization.logoUrl` and `organizationSettings.settingsJson`) are not currently rendered into any generated document or customer portal page. The live PDF generators (`app/modules/invoices/pdf.ts`, `app/modules/contracts/pdf.ts`, `app/modules/proposal-generator/service.ts`) are pdfkit-based and draw only a `companyName` text header — none of them call `.image()` or reference a logo/brand field, and the portal pages under `web/src/app/(app)/portal/**` don't render one either. The one place in the codebase that does treat a logo as a real `<img>` (`app/modules/documents/frame.ts` / `templates.ts`) has no live caller outside `app/tests/document-frame.test.ts`. A prior commit fixing this module's asset-upload persistence bug described the affected fields as driving "customer-facing PDF and portal branding" — that description is not accurate as of this writing; persisting these fields correctly is still a real, worthwhile fix (the previous blob-URL behavior broke on reload), it just has no visible customer-facing effect yet because nothing consumes the fields downstream.

## Deferred work

- supplier-specific adapters and SKU/product matching beyond the configured generic feed contract
- additional operational reporting beyond current queue and admin summaries

## Last verified date

2026-08-24 (S015 implementation branch; not merged or shipped yet)
