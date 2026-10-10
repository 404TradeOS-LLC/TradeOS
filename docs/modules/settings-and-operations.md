---
status: current
owner: platform
last_verified: 2026-09-27
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

## ABC Supply sandbox connection test (2026-10-09)

Settings → Costbook has a guarded **Test ABC connection** button for the
single reviewed `ABC-654210` supplier SKU. It sends an authenticated,
tenant-scoped request to `POST /api/v1/supplier-integrations/abc/price-probe`
using the existing same-origin API proxy; it never collects, displays or
ships ABC tokens to the browser. Backend access requires both an active
owner/admin role and `costbook.manage`.

The operator probe validates one active supplier product, exact unique
SKU, canonical mapping, nonzero observation and unlinked Material,
then makes a sandbox price request using the same durable Vault rotation
helper as scheduled sync. It can report a positive USD price or a
provider failure/status; its source purchase unit is explicitly **not**
evidence of ABC stocking unit. No Materials, SupplierPriceUpdates,
MaterialPriceAudits or Estimate prices are written. Do not approve
or activate an initial Material baseline solely from this response.


## Supplier evidence workflow identity helper (2026-10-09)

In the authenticated **Settings → Costbook** workspace, an active owner/admin
can copy the production 47802 GitHub supplier-evidence seed's tenant
`orgId` and their own TradeOS application `currentUserId`. The latter is
returned by `OrganizationSettingsService.getSettings` from the authenticated
request context; the UI verifies it against the existing active owner/admin
team-membership list. This intentionally does not infer identity from an email
address or a membership row UUID. Missing, duplicated, or unauthorized actor
records fail closed (no ID card). The UI does not create membership records,
trigger the workflow, change Material prices, or bypass any RLS, review, or
GitHub Actions approval gate.

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

Supplier-SKU discovery/matching and provider-specific connectors beyond ABC Supply remain future work; current feed rows must identify a TradeOS Material by `materialId`.

### ABC Supply sandbox feed fetcher (PR #684, wired by default)

`app/modules/supplier-integration/abcSupply.ts` implements the `SupplierFeedFetcher` contract against the ABC Supply Connect Partner sandbox APIs. Sandbox-only: production hosts are absent from the module. Refresh-token user auth (`pricing.read` scope; pricing is unavailable via `client_credentials` for TPAs), access tokens cached with a 60s refresh margin, up to 50 line items per pricing request with `purpose=estimating`, non-OK or $0.00 lines skipped. Lines whose SKU maps to more than one Material are skipped rather than pricing the wrong material. Configuration is via `ABC_SUPPLY_SANDBOX_*` env vars; the fetcher is a no-op returning `[]` when unconfigured. Quotes flow into the existing proposal/approval queue — approval is still required before any Material price changes.

Wiring: `SupplierIntegrationService` now defaults to `fetchDefaultSupplierFeed` (`app/modules/supplier-integration/feed.ts`), which routes the sync target to the ABC fetcher when its supplierId equals `ABC_SUPPLY_SANDBOX_SUPPLIER_ID` and falls through to the generic HTTPS-endpoint fetcher otherwise — so the scheduler and worker reach the ABC feed with no per-call-site changes (the user-authenticated controller serves the review queue, while the Vercel cron route is separately protected). The ABC route applies the same 15-second abort deadline as the generic fetcher. `ABC_SUPPLY_SANDBOX_REFRESH_TOKEN` is the bootstrap/recovery token; the default runtime loads a tenant-scoped durable token from Supabase Vault first. When ABC rotates the token, TradeOS awaits a write through private `tradeos_private` SQL wrappers before pricing continues. The access rules are defined by the [supplier integration credential boundary](../DOMAIN_MODEL.md#supplier-integration-credential-boundary). A failed durable write fails the sync rather than consuming a rotation that would be lost on a Vercel cold start.

Supplier rows for the feed targets come from the static costbook dataset, not hand-made rows: `npm run db:import-suppliers` (`app/scripts/import-suppliers-from-dataset.ts`) upserts one `Supplier` row per distinct `supplierCode` in `app/modules/costbook/supplierPrices47802.ts` (ABC_SUPPLY, HOME_DEPOT, JONES_AND_SONS, LOWES, MENARDS, NIEHAUS), keyed on `apiIntegrationKey`, then prints the supplierCode → UUID table. Copy the `ABC_SUPPLY` UUID into `ABC_SUPPLY_SANDBOX_SUPPLIER_ID`. The script auto-selects the organization when exactly one exists and requires `--org-id` otherwise; `--dry-run` previews without writing.

Live validation (2026-10-06, via browser + ReqBin since the VM egress proxy blocks ABC traffic): OAuth authorization_code flow → token exchange → product search → pricing all returned HTTP 200 against the sandbox. The documented `lines` request shape is accepted. Sandbox branch is `340` (Orem UT) with ship-to `2010466-2` — the sandbox's only active ship-to serves UT/ID/MT branches only, so Billy's real Terre Haute branch `579` is rejected there with a 401 business error; `579` goes back into `ABC_SUPPLY_BRANCH_NUMBER` when ABC grants production access. Billy decided to stay in sandbox.

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

- `/settings` is the contractor-facing Control Center. It opens on Pricing and prioritizes Company, Pricing, Estimating, Team & Access, Communication, Athena, and Connections before Advanced/admin tooling.
- `/settings/billing` remains the dedicated live subscription surface.
- internal admin HTML surface at `/admin`

The Settings UI distinguishes persisted organization keys from product-level fallbacks. Organization-specific fallback values are intentionally blank/off rather than populated with demo company, pricing, supplier, AI-budget, or security facts. Select/display defaults such as timezone, currency, units, language, date formatting, theme, and base visual colors may still have product fallbacks; the UI identifies values that have not been persisted for the active organization.

The backend `PATCH /settings` controller validates the complete organization-settings schema, so the Control Center sends the full draft on save. The frontend does not claim partial-update semantics. To keep complete saves truthful, organization-specific fallback values are blank/off rather than populated with demo business, supplier, pricing, AI-budget, or security facts; canonical organization branding supplies the required real company name on reads.

Pricing remains a defaults surface, not a competing Costbook. Labor/markup/overhead/profit/waste/material/supplier defaults can be configured here, but Costbook provenance remains authoritative for price trust and Settings does not upgrade stale, placeholder, or unverified supplier data.

Schema cards marked `sampleData` remain clearly labeled and are grouped under Advanced/admin where appropriate. Runtime metadata reports missing diagnostics as not exposed/unavailable rather than synthesizing a healthy state.

The Team & Access section uses the existing permission-aware membership/role response. It does not enable or integrate the separate staging-gated Team & Time workspace.

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
- the ABC Supply sandbox feed is the first provider-specific adapter; further supplier-SKU discovery/matching remains future work
- internal admin surfaces are operational tooling, not contractor-facing product routes
- brand-asset reconciliation is operator-invoked and dry-run by default; no automatic cleanup scheduler exists
- remote PDF asset fetching and arbitrary font-file loading remain outside the approved document-rendering trust boundary

## Deferred work

- supplier-specific adapters beyond the ABC Supply sandbox feed and SKU/product matching beyond the generic trusted-feed contract
- additional operational reporting beyond the current queue/admin summaries
- any automatic brand-asset cleanup schedule requires a separately governed retention/operations decision

## Last verified date

2026-10-06


## ABC Supply onboarding and scheduler operator controls (PR #701)

Use `docs/operations/ABC_SUPPLY_LIVE_PRICING_PILOT.md` for the live
evidence checklist and manual activation procedure. The safe order is:
finish the existing six-supplier restricted-role seed, verify the approved
ABC product identity and stocking unit, preview one candidate via
`npm run costbook:activate-abc-material`, then authorize exactly one
activation with the requested source SKU/unit and independently approved
initial cost. The command is **read-only unless `--apply` with exact
acknowledgements and confirmation** is provided, and the worker identity
must be an active tenant owner/admin with `costbook.manage`.

The command creates no supplier quote or autoapproval. The existing
`/api/cron/supplier-price-sync` route is separately protected by
`CRON_SECRET`, tenant-scoped `SUPPLIER_PRICE_SYNC_JOBS`, the private
Vault refresh-token store, and the established rate limit. Receiving HTTP
200 with zero proposals is **not** proof the ABC provider was contacted;
verify an actual accepted priced line, linked Material, tenant-scoped
pending proposal, durable token rotation if one occurs, and unchanged
Material unit cost until named reviewer approval. Do not expose Vault
credentials, administrative database URLs, or token values in logs or
operator examples. The static September 2026 supplier observations are
not customer-specific live ABC prices.
