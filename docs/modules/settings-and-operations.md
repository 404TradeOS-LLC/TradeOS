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

## ABC selected-account failed-line explanation (2026-10-13)

The Settings **Test selected ABC price** result now shows a short, screened
`ABC says:` explanation only when the matching provider line has a
non-OK status and the API's existing privacy filter accepts it. Opaque
messages containing customer/Ship-To identifiers, credentials, URLs,
markup or secrets are replaced with the existing status-only fallback.
This is a diagnostic aid for provider-eligibility discussions: it does not
change account/branch validation, OAuth, quote amount eligibility, Material
cost, pricing approvals or persistent account selection.

Live OAuth and Ship-To discovery succeeded on October 13. SKU `654210`
still returned an ABC per-line `Error`, not an eligible priced item.
A valid ABC test item/account must be verified; do not make up pricing or
request extra OAuth grants merely because a line is ineligible.

## ABC Supply sandbox OAuth reauthorization (2026-10-11)

Settings → Costbook has a guarded **Connect / Reauthorize ABC** button
(visible to workspace `owner`/`admin` only; the backend enforces
`costbook.manage` plus the owner/admin role). It calls
`POST /api/v1/supplier-integrations/abc/oauth/authorize` through the
existing same-origin API proxy and redirects the founder's browser to
the ABC sandbox authorize URL. After the founder signs in at ABC and
approves access, ABC redirects to the allowlisted TradeOS callback,
which exchanges the code server-side and stores only the refresh token
in the Vault-backed credential store. The browser lands back on
Settings with a success/error flag; no ABC tokens are ever collected,
displayed, or shipped to the browser.

Operator prerequisite: the callback URI
`https://api.404tradeos.com/api/v1/supplier-integrations/abc/oauth/callback`
must be registered on the TradeOSCostbook sandbox app in the ABC
Developer Portal (Manage Applications → TradeOSCostbook → Manage →
OAuth 2.0 Redirect URIs → ADD ADDITIONAL) before the flow can complete.
The API also requires `ABC_OAUTH_STATE_HMAC_SECRET` (a long random
server-side secret, set on Vercel Production + Preview): it keys the
HMAC-SHA256 hashes of OAuth state and browser-binding tokens stored in
`abc_oauth_authorization_states`, and the authorize endpoint fails closed
with 503 when it is unset. Rotating it invalidates only in-flight
authorizations (10-minute TTL); stored refresh tokens are unaffected.
Reconnecting does not create Materials, approve prices, or start the
scheduled sync; verify with **Test ABC connection** afterwards.

Security properties: the callback is bound to the initiating browser via
a short-lived httpOnly/Secure/SameSite=Lax cookie (RFC 6749 section 10.12)
whose secret never leaves the cookie; a missing or mismatched cookie
rejects the callback without consuming the state. The web API proxy
forwards upstream `Set-Cookie` headers so the backend-set binding cookie
reaches the browser.

Fix note 2026-10-11: the authorize endpoint initially 500'd in
production (TTL parameter type mismatch against the state-table
wrapper); the call now casts explicitly and the button works as
described above.

Callback persistence repair 2026-10-12: production callback logs identified a
Prisma connection-pool timeout (pool limit 1) while persisting the new
authorization-code refresh token. The callback's tenant-validated background
session already owns a transaction; the Vault write now reuses that same
transaction without acquiring a second pool connection. Provider-driven
refresh-token rotations during pricing use an independently committed
transaction through a lazily initialized, separate, bounded Prisma pool.
The existing tenant-scoped Vault SQL wrapper is unchanged; the new pool avoids
a deadlock if the caller holds the only connection in the request pool. An unsuccessful callback does not establish a connected ABC
account; retry user-present authorization after deployment.

Diagnostic note 2026-10-12: when the callback fails, the Settings
redirect carries `?abc_oauth_step=request|state|exchange|persist`
alongside `?abc_oauth=error`, naming the stage that failed — `request`
(ABC returned no code), `state` (unknown/expired/replayed state or a
missing/mismatched browser-binding cookie), `exchange` (callback client credentials are missing or ABC rejected
the code exchange), or `persist` (refresh-token storage failed). The
step carries no secrets and the Settings UI behavior is unchanged.

## ABC user-presence / scheduled-pricing compliance guard (2026-10-12)

ABC's Third-Party Aggregator guidance says real customer pricing is
user-present. Even a valid owner/admin identity in a scheduled worker
is **not** an active ABC-authenticated person at pricing-request time.
The default supplier sync now **rejects background ABC pricing before reading
the Vault refresh token or calling ABC**, with a durable failure outcome
rather than a silent success or an unsupported supplier price proposal.
Do not configure the ABC supplier in `SUPPLIER_PRICE_SYNC_JOBS` or enable
unattended ABC price collection. The Vercel cron remains available for
other supported supplier feeds, without bypassing existing approval gates.
For ABC, use an explicit owner/admin action in Settings to list accounts,
select a Ship-To and branch, then request a read-only sandbox quote.
No unit mapping or estimate price is certified by the demo.

This is also a **production-access gate**: requesting an ABC Partner
Developer Production application, providing the required logo and attending
ABC's integration demo are founder/provider actions, not deployment flags.
See [ABC aggregator demo and production checklist](../operations/ABC_SUPPLY_AGGREGATOR_PRODUCTION_DEMO.md).
Official sources:
https://apidocs.abcsupply.com/getting-started/ and
https://apidocs.abcsupply.com/third-party-aggregator-integration-track/.

## ABC Supply Ship-To account discovery API (2026-10-12)

The authenticated `GET /api/v1/supplier-integrations/abc/accounts` endpoint
offers a read-only foundation for the future Settings Ship-To selector.
Role access and tenant isolation follow the shared [RBAC matrix](../RBAC_MATRIX.md)
and [domain model](../DOMAIN_MODEL.md); the endpoint additionally requires
a matching ABC Supplier before loading the tenant's server-side Vault
credential and querying the ABC **sandbox** Search Accounts API. OAuth client credentials
are sufficient to begin discovery even if branch and Ship-To have not been
selected: pricing configuration still requires those values. No request-provided
organization, supplier, branch or Ship-To account is accepted. ABC's `account.read`
scope requires a fresh user-present reauthorization for older pricing-only grants.
Discovery has a 15-second deadline, bounded provider pagination, a normalized
account/branch response, and safe 409 responses for insufficient account grant.
No account selection, saved preference, pricing request, Material update or
unattended customer-price synchronization is performed by this endpoint.
The Settings Costbook panel now offers an owner/admin read-only **Find ABC accounts**
action. It shows account/branch choices from this authenticated endpoint, including
empty-results, reconnect and generic failure states. The chosen Ship-To and branch
exist only as ephemeral component state, never saved in TradeOS settings or browser
storage; they are **not** passed to the price probe or used for scheduled sync.
Settings offers an explicit **Test selected ABC price** action for two
server-allowlisted sandbox diagnostic SKUs. The new read-only endpoint
re-fetches the active authorized Ship-To and associated active branch on each
request, and obtains a user-scoped ABC `pricing.read` quote only after that
check. No selected account is persisted and no Material, supplier observation,
price proposal or pending approval is created. Quoted stocking units are
displayed as provider evidence but are not verified against a canonical
Material mapping. The existing connection probe remains separate.
The quote screen cancels in-flight requests when Ship-To, branch or SKU changes
and ignores stale responses, so a returned amount cannot be shown under a
different selection. The request budget is shared atomically across Vercel
instances through the existing protected supplier cron SQL limiter, in a
separate `abc-selected-quote` namespace. It uses the existing independent
bounded restricted Prisma pool, not the busy authenticated request pool,
and fails closed on database errors.
Actual successful ABC sandbox pricing requires a user-present grant and
provider verification; CI alone does not establish it. Production access
remains subject to ABC Third-Party Aggregator approval (issue #719).

## ABC Supply sandbox connection test (2026-10-09)

Settings → Costbook has a guarded **Test ABC connection** button for the
single reviewed `ABC-654210` supplier SKU. It sends an authenticated,
tenant-scoped request to `POST /api/v1/supplier-integrations/abc/price-probe`
using the existing same-origin API proxy; it never collects, displays or
ships ABC tokens to the browser. Backend access requires both an active
owner/admin role and `costbook.manage`.

The operator probe validates one active supplier product, exact unique
SKU, canonical mapping, nonzero observation and either an unlinked
product or exactly one linked Material verified in the same tenant and supplier,
then makes a sandbox price request using the same durable Vault rotation
helper as scheduled sync. It can report a positive USD price or a
provider failure/status; it also displays the ABC response UOM (when supplied)
and flags whether it matches the historical source unit. When a line is not
priced, the panel shows `providerStatusMessage` only when a matching failed
line includes a short, safe, plain-language explanation. The API suppresses
untrusted URLs, markup, account/ship-to numbers and credential-like or opaque
identifiers; Settings displays a neutral fallback if the message is withheld.
This is diagnostic only, not proof of product eligibility. That source unit by
itself is not proof of ABC stocking UOM. The background ABC feed refuses
price proposals with missing or mismatched response units. No Materials,
SupplierPriceUpdates, MaterialPriceAudits or Estimate prices are written by the
connection test. Initial Material baseline approval remains separate.


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

### ABC Supply sandbox adapter (PR #684; legacy background wiring superseded)

`app/modules/supplier-integration/abcSupply.ts` implements the `SupplierFeedFetcher` contract against the ABC Supply Connect Partner sandbox APIs. Sandbox-only: production hosts are absent from the module. Refresh-token user auth (`pricing.read` scope; pricing is unavailable via `client_credentials` for TPAs), access tokens cached with a 60s refresh margin (cache keyed by scope so pricing and account tokens never mix), up to 50 line items per pricing request with `purpose=estimating`, non-OK or $0.00 lines skipped. `app/modules/supplier-integration/abcAccount.ts` adds sandbox Account API discovery: `POST /api/account/v1/search/accounts` with the documented `accountType=Ship-to` filter (requires the `account.read` grant — requested at authorization; older pricing-only tokens get a sanitized 403 until re-authorized), returning Ship-To accounts with their branches and filtering out retired branchless accounts per ABC guidance. Discovery traverses all reported pages up to a hard limit of 100 pages (50 records each), rejecting invalid or inconsistent pagination, missing `shipTos` fields, and excessive result sizes instead of returning an incomplete or fabricated empty account list. Lines whose SKU maps to more than one Material are skipped rather than pricing the wrong material. Configuration is via `ABC_SUPPLY_SANDBOX_*` env vars. This provider adapter remains a lower-level mapping utility, but **scheduled ABC price fetching is disabled** for Third-Party Aggregators; no background quote is generated or proposed. The explicit user-clicked Settings sandbox quote performs read-only pricing, with no Material writes.

Wiring: `SupplierIntegrationService` still uses `fetchDefaultSupplierFeed` (`app/modules/supplier-integration/feed.ts`). For the designated `ABC_SUPPLY_SANDBOX_SUPPLIER_ID`, scheduled cron/worker/one-shot sync now raises a **terminal**, non-retryable `abc_user_present_required` outcome before accessing Vault, Materials or ABC. It does not fall back to the generic HTTPS endpoint even if configured. All other suppliers continue using the generic HTTPS fetcher and review-first queue. Explicit owner/admin sandbox account discovery and Price Items calls use the separate user-present controller route with a 15-second deadline and Vault-backed token rotation; `ABC_SUPPLY_SANDBOX_REFRESH_TOKEN` is bootstrap/recovery-only. The access rules are defined by the [supplier integration credential boundary](../DOMAIN_MODEL.md#supplier-integration-credential-boundary). Token persistence failures remain fail-closed.

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
