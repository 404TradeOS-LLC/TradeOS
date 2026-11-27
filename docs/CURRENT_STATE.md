---
status: current
owner: platform
last_verified: 2026-11-17
source_of_truth: true
related_code:
  - app/modules/auth
  - app/modules/billing
  - app/backend/controllers/auth.controller.ts
  - app/backend/controllers/adminDashboard.controller.ts
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - app/prisma/migrations/20260912044500_add_stripe_billing
  - app/prisma/migrations/20260831214500_add_costbook_code_trgm_indexes
  - app/prisma/migrations/20260908120000_add_active_job_assignment_lookup
  - app/prisma/migrations/20261007031500_add_supplier_refresh_token_vault
  - app/backend/routes
  - app/modules/payments
  - app/modules/costbook
  - app/modules/costbook/codes
  - app/backend/controllers/costbookCodesPermitTasks.controller.ts
  - app/backend/controllers/costbookCodesFeeReviews.controller.ts
  - app/prisma/migrations/20261110000000_add_codes_permit_tasks_fee_reviews
  - web/src/app/(app)/costbook/codes/permits
  - web/src/lib/costbook-permits.ts
  - web/src/lib/costbook-permits-api.ts
  - app/modules/cost-database
  - app/modules/assemblies-database
  - app/modules/estimate-engine
  - app/modules/supplier-integration
  - app/modules/athena-kernel
  - app/modules/athena-tools
  - app/modules/athena-tools/costbook
  - app/modules/athena-events
  - app/modules/athena-observability
  - app/modules/athena-action-engine
  - app/modules/athena-mobile
  - web/src/app
  - web/src/app/(app)/dashboard
  - web/src/app/(app)/settings/billing
  - web/src/components/dashboard
  - web/src/app/(app)/costbook
  - web/src/app/(app)/dispatch
  - web/src/app/(app)/team-time
  - web/src/app/(app)/customers
  - web/src/app/(app)/projects
  - web/src/app/customer-portal
  - web/src/app/(app)/portal
  - web/src/app/api/proxy/[...path]/route.ts
  - web/src/app/api/project-files/[projectId]/[fileId]/route.ts
  - web/src/proxy.ts
  - web/src/lib/billing-api.ts
  - web/src/lib/supabase/proxy.ts
  - web/src/lib/team-time-api.ts
  - web/src/lib/team-time-config.ts
  - web/src/lib/team-time-route.ts
  - web/src/lib/team-time-model.ts
  - web/src/components/team-time/use-team-time-workspace.ts
  - web/src/components/team-time
  - web/src/app/api/team-time
  - web/src/lib/api.ts
  - web/src/lib/api-response.ts
  - web/src/lib/estimate-price-readiness.ts
  - web/src/lib/clientApi.ts
  - web/src/lib/customer-portal-session.ts
  - web/src/lib/json-response.ts
  - web/src/lib/proxy-origin.ts
  - app/modules/expenses
  - app/modules/proposals
  - app/backend/controllers/proposals.controller.ts
  - app/backend/routes/proposals.routes.ts
  - app/prisma/migrations/20261123090000_add_proposal_selections_allowances
  - web/src/components/proposals/proposal-selections-allowances.tsx
  - web/src/components/proposals/proposal-selections-allowances-readonly.tsx
  - web/src/components/proposals/clear-proposal-attempt-key.tsx
  - web/src/components/projects/proposal-status-check-card.tsx
  - web/src/components/projects/proposal-status-check-return-form.tsx
  - web/src/lib/proposal-status-check.ts
  - web/src/app/actions/proposals.ts
  - app/backend/controllers/expenses.controller.ts
  - app/backend/routes/expenses.routes.ts
  - app/prisma/migrations/20261102020000_add_job_expenses
  - web/src/components/field/job-expense-section.tsx
  - web/src/components/field/job-expense-form.tsx
  - web/src/app/actions/job-expenses.ts
  - web/src/lib/job-expenses.ts
  - web/src/lib/proxy-cache.ts
  - web/src/lib/cached-org-reads.ts
  - .github/workflows/verify-repository.yml
---

## Daily Gemini spend cap — Athena (2026-11-26, branch `feat/athena-daily-spend-cap`)

Founder-approved 2026-11-26: the Athena kernel enforces a daily Gemini spend cap before calling the real provider — `ATHENA_DAILY_SPEND_CAP_USD`, default $1.00/day (~500 drafts at ~$0.002/call), `0` = kill switch. Spend is read per org per UTC day from the `AthenaGenerationRun` ledger (status `succeeded` or `failed` with non-null `estimatedUsd`); at the cap the kernel returns a succeeded response with a null message and an `athena_daily_spend_cap_reached` warning and never calls Gemini, and the fake provider is never capped. A cap trip emits a model/error telemetry span and feeds a new `daily_spend_cap_reached` alert rule (severity `high`); the existing $10 cost-spike rule is unchanged. The alert evaluation pipeline is scheduled (Vercel Cron route `GET /api/cron/athena-observability-alerts`, daily on the Hobby plan until Pro unlocks the intended 15-minute cadence) and emails newly-firing and newly-resolved alerts to `ATHENA_ALERT_EMAIL_RECIPIENT` (`hello@404tradeos.com`, decided 2026-11-27); it only runs once `ATHENA_OBSERVABILITY_MAINTENANCE_JOBS` (production `orgId:userId`) and the recipient are set on the API project, so until then the in-request telemetry span is the live cap-trip signal. The cap check runs before every provider attempt, so a retry after a provider timeout can never double-spend past the cap. The org-wide read is a read-only STABLE SECURITY DEFINER function, `public.athena_org_daily_spend_usd` (migration `20261127050000_add_athena_org_daily_spend`, rehearsed on a disposable local Postgres 16: all 92 migrations applied cleanly): the generation-runs SELECT policy is actor-scoped, so a plain read would give non-admin actors separate budgets — the function sums the caller's session org and raises 42501 on an org mismatch (proven live: a technician session sees the org-wide $1.20, a foreign org sees only its own spend). Safety-blocked/empty responses persist as failed rows with their input-token usage, so blocked attempts count toward the cap. Part 2 audit: no CI/test/evidence path can reach the real provider (no workflow sets `GEMINI_API_KEY` or `ATHENA_PROVIDER_MODE`; the provider resolves to `disabled` in CI), and staging acceptance (S071/S069) deliberately keeps the real provider for its single live draft re-check, bounded by the cap. Coverage: `app/tests/athena-kernel.spendCap.test.ts`, cap tests in `app/tests/athena-kernel.service.test.ts`, rule tests in `app/tests/athena-observability.alerts.test.ts`, provider usage test in `app/tests/athena-kernel.gemini-provider.test.ts`, live proof in `app/tests/athena-spend-cap.integration.ts`.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2711d338f4135d7cb7747840af96ffd0d056125d069e094086162c2f0754042b -->

## Vercel Fluid CPU fix, PR-2 — web read cache ([PR #1149](https://github.com/404TradeOS-LLC/TradeOS/pull/1149), merged in `d2117e51`)

Lever 2 core of the approved Fluid CPU fix plan. The [web proxy](<../web/src/app/api/proxy/[...path]/route.ts>) gives successful [allowlisted GETs](../web/src/lib/proxy-cache.ts) `Cache-Control: private, max-age=<TTL>` (30–300 seconds) and `Vary: Cookie`, and strips upstream `Set-Cookie` on that branch. Non-allowlisted reads, upstream errors, and mutations keep `no-store` and forward upstream cookies, including the ABC OAuth POST cookie. The layout and Today share token-keyed, request-scoped React reads for settings and Athena capabilities. Today also uses the dispatch summary wrapper. The assembly catalog and the AppNav dispatch badge use TanStack Query; the badge has a 30-second stale time and an organization-scoped key on the root client. The tenant provider creates a new client on each workspace-keyed mount, which is what makes its organization-less keys safe.

Navigation reads remain cacheable. After local writes, estimate builder and checklist refreshes, AI apply verification, assembly unit-cost refreshes, and the Brand Studio save preview bypass the browser HTTP cache with `cache: "no-store"`. The estimate and assembly unit-cost refresh helpers update their query entries directly. Install and deactivation invalidate the stable starter reuse-source key. The builder and codes hints use 30-second and 60-second stale times, respectively. This PR changed no backend APIs, schema, migrations, RLS, or environment variables. A behavioral route test (`web/src/app/api/proxy/[...path]/route.test.ts`) proves a 5xx on an allowlisted GET returns `no-store` and a 200 returns the private cache headers. Server Data Cache remains under the separate PR-6 approval.

### Post-merge follow-up risks

- **Tenant isolation in a warm browser.** Staging proof is pending. On an isolated deployment serving this merge or a descendant, warm Settings, the dispatch summary and badge, and the same Cost Item search in workspace A. Switch to B in the same browser, reload while the original entries are fresh, and repeat the same reads. Use distinguishable fixtures and verify B's payload and UI, including the catalog query and badge; switch back and verify A again. Check that sign-out prevents reuse of authenticated payloads. Verify `private` and `Vary: Cookie` on successful proxy responses without retaining cookie values. Any cross-workspace result warrants reverting the cache change.
- **Estimate freshness after remote and overlapping writes.** The builder's 30-second stale time governs refetch eligibility; it does not schedule a refetch, and the tenant client disables focus refetch. Verify the PR's 30-second expectation with two open tabs and no manual reload. In the editing tab, verify that a successful local write updates lines and totals immediately. Add a browser regression with the HTTP cache warm and responses deliberately reordered: AI apply verification and finalization write the same estimate key outside the builder helper's sequence guard. An older builder response can still replace newer lines or finalized status. Use one ordering rule for all writers, and check that the latest saved state stays visible after revisiting the estimate.
- **Assembly composition can outlive its stale time.** The assembly items query disables mount refetch to preserve appended pages, so a return visit with retained data can show an older composition after another tab edits it even when the unit cost refreshes. Use a multi-page staging fixture to check add/remove, switch and return, and pagination during a pending write. If composition remains stale, refresh it without discarding loaded pages. Also exercise a failed unit-cost refresh and verify the last cost stays visible with an error.
- **Proxy response contract.** The [route tests](<../web/src/app/api/proxy/[...path]/route.test.ts>) cover separate responses from the same allowlisted GET: 503 with `no-store` and no `Vary`, and 200 with `private, max-age=300` and `Vary: Cookie`. In isolated staging with the browser cache enabled, return a 503 for `/api/proxy/athena/capabilities`, restore upstream, and repeat the same request without bypassing the cache. Confirm the repeat reaches upstream and returns the recovered 200 and fresh payload. Cookie handling still needs route coverage: assert that a cacheable 200 strips upstream `Set-Cookie` and that the ABC OAuth authorize POST returns `no-store` and forwards its browser-binding cookie. If an allowlisted GET starts setting a required cookie, take it off the allowlist before rollout: the current proxy would drop the cookie and cache the body.
- **Invocation savings and request deduplication are unverified in deployment.** Capture browser memory or disk hits on repeat navigation with DevTools cache enabled. Compare seven days before and after deployment for web-project invocations and GB-hours, with request volume for context. Trace a single Today render to confirm layout and Today share one upstream settings read and one Athena capabilities read; the source tests check wiring but do not establish per-request deduplication. Record these results before using PR-2 savings to justify PR-6.

<!-- /coderabbit-ai-generated:v1 -->

## Vercel Fluid CPU fix, PR-3 — Athena timeout caps, auth select trim, bounded /ready probe (branch `feat/fluid-pr3-api-slimming-safe`)

Lever 3 safe items of the approved Fluid CPU fix plan (Option A, 2026-11-26). The Gemini provider fetch is capped at the provider deadline (`AbortSignal.timeout` at `ATHENA_PROVIDER_DEADLINE_MS`, default 8,000 ms, combined with the kernel signal), so a hung socket cannot outlive the kernel's provider-timeout race. Provider and request timeouts are terminal: `athena_provider_timeout` / `athena_deadline_exceeded` are `retryable: false`, and the web client no longer offers "Retry safely" on a thrown 504 (verified: the workspace offers retry via `isAthenaRetryableClientError`, and a 504 previously classified as retryable); transport 5xx stays retryable. The per-request auth membership query selects only `{ orgId, role }` — the only fields `resolveAuthContext` reads. The `/ready` probes run in one transaction with `SET LOCAL statement_timeout = '5s'` plus a 5,000 ms application race, so a hung database 503s fast; the response shape is unchanged. No model, provider, flag, auth-decision, RLS, or identity-contract change; deadline values stay env-only. Follow-ups: lower `ATHENA_PROVIDER_DEADLINE_MS` to ~5,000 ms and `ATHENA_REQUEST_DEADLINE_MS` to ~10,000 ms only after staging draft latency p95 < 5,000 ms on ~20 requests (no live latency numbers were measured in this session); investigate merging the auth `set_config`s into the `databaseSession` transaction; PR-4 is the 3.1 transaction split. Live verification still owed after merge: 24 h 504-vs-successful-draft count (no material rise), staging sign-in + one authenticated read, live `/ready` 200 with `projectRef: kssaceuetdjwfqnbzhly` and `/health` `commitSha` equal to the deployed head.

## ABC shared-catalog importer Phase 0 — probe instrumentation (branch `feat/abc-catalog-phase0-probe-735`, 2026-11-26; live run pending)

Phase 0 ("prove the numbers", issue #735) instruments the existing sandbox evidence probe instead of building any importer: `AbcCatalogClient.listRaw` returns parsed provider pages intact for census use (no HTTP route exposes it; `list()` behavior is unchanged), and `probeAbcSandboxCatalogPhase0` fetches exactly three pages at `itemsPerPage=1000` plus one hierarchy page, times each page, and returns only counts, page latency p50/p95 (nearest-rank), and a field census — UOM roles, dimensional variations, hierarchy nesting order, estimated full-catalog storage at 2–5 KB/item. It fails closed on pagination drift, duplicate identities, or any price-like payload key; hierarchy shape deviations are recorded as census findings, not failures. The manual workflow gains a `phase0` input with the same `VERIFY_ABC_SANDBOX_PRODUCT_READ` confirmation and a sanitized Phase 0 step summary. Still zero stored rows, no pricing, no database connection, no Material/Estimate writes. The live sandbox run happens after merge (workflow is main-only, credentials live in the `abc-sandbox` environment, none available locally); its numbers are then posted to #735. DB headroom against the Supabase plan is a Phase 1 check — no plan/limit record exists in the repo. Staging verification is gated on the Vercel 402 being cleared.

First live run 45901367450 (2026-11-26, on the merged commit) FAILED with the generic `provider_or_schema_failure` after ~43 s — consistent with repeated 12 s request timeouts on 1000-item pages (a 25-item page was once observed taking ~29 s), but not proven by the redacted output. Follow-up fix in progress: a 120 s per-request timeout with 2 attempts for Phase 0 only, a 20-minute workflow cap, and distinct failure codes (`provider_request_failed`, `provider_unavailable_http_*`, `schema_mismatch:<field-paths>`) so the next failure names its cause. No numbers were produced; nothing was posted to #735 yet.

Second live run 45904451563 (2026-11-26, on the merged timeout fix `f0d5e3d1`) ran ~51 s — past the timeout — but FAILED with `catalog_probe_hierarchy_shape_mismatch`: real sandbox hierarchy levels do not all carry `code`/`label` as the docs describe, and the probe failed closed on that. Follow-up fix in progress: the hierarchy census records shape deviations as findings (`<level>:missing-code`, `<level>:missing-label`, `<level>:not-object:<kind>`) instead of failing the run, so the next re-dispatch reports the main-page numbers plus the real hierarchy shape. CodeRabbit on #1129 caught a second abort path the census fix missed: the strict `listHierarchy()` mapping throws on a level missing `code`/`label`, so the probe now reads the hierarchy page through the probe-only `listHierarchyRaw` (no mapping) and censuses it too. The probe still fails closed on pagination drift, duplicate identities, and any price-like key.

Third live run 45910971460 (2026-11-26, on merged #1129 `c93b265f`) PASSED validation — the Phase 0 probe completed in 1m 36s. The numbers live in the step summary, which is only readable in the authenticated web UI (no API exposes it); follow-up fix in progress: echo the summary to the job log so the numbers are API-retrievable, then re-dispatch and post them to #735.

Fourth live run 45912230210 (2026-11-26 ~23:40 EST, main `aab1b08a`) PASSED — Phase 0 acceptance posted to #735 (comment 7205823669): provider total 258,494 items / 259 pages at 1,000/page; page latency p50 ~21.5 s / p95 ~28.2 s (full pull ~1.5 h provider time); `branches` 0/3,000 populated in sandbox; hierarchy endpoint 9,059 paths / 182 pages, 2,993 full six-level / 7 partial of 3,000 sampled, with a small set of empty level nodes. Storage estimate 0.53–1.32 GB before indexes.

## ABC shared-catalog importer Phase 1 — schema + RLS (issue #735, branch `feat/abc-shared-catalog-schema-735`)

Phase 1 creates the shared-catalog schema with no importer code: migration `20261127010000_add_abc_shared_catalog` adds `abc_catalog_items`, `abc_catalog_hierarchy` (a table, not a view — hierarchy is seeded from its own endpoint and needs its own index), `abc_catalog_sync_runs`, and `abc_catalog_sync_state`, all org-less with forced RLS, global SELECT for any authenticated session, ingestion-only writes under the `app.abc_catalog_ingestion` flag, and no DELETE policy anywhere; plus the migration-seeded global ABC Supply `Supplier` row (fixed id `73500001-0000-4000-8000-000000000001`, org-less) with a partial unique index and a global-read policy on `suppliers`. All four catalog tables are empty after the migration — the Phase 2 importer fills them. Live RLS coverage in `app/tests/rls.integration.ts` proves any org can read, no org can write, and the background session can write under the flag; `app/tests/abcCatalog.migration.test.ts` guards the migration shape. Migration rehearsal ran on a disposable local Postgres 16 cluster (trust auth, no credentials): all 91 migrations applied cleanly via `prisma migrate deploy`, tables verified empty, global row seeded exactly once with an idempotent re-insert, RLS enabled + forced with all 17 policies present, and live RLS behavior spot-checked as a non-superuser role (tenant read sees rows, tenant INSERT fails 42501, tenant UPDATE/DELETE affect 0 rows, flag-session INSERT/UPDATE succeed, DELETE still affects 0 rows). The rehearsal caught and fixed one real bug before the PR: the partial unique index predicate did not match the `ON CONFLICT` specification (`42P10`). Open checks carried forward: Supabase disk headroom + capacity budget (no Supabase connector exists in this environment and no plan/limit record exists in the repo — the check is: Supabase dashboard for refs `kssaceuetdjwfqnbzhly` (prod) and `qfbgdkbamfaasmtjfyru` (staging), Settings → Database → disk usage vs the plan's included storage, confirming ≥ ~2 GB free for the 0.53–1.32 GB catalog plus trigram/GIN indexes and refresh headroom, before the Phase 2 import); staging verification is gated on the Vercel 402 being cleared. Phase 2 starts from this schema: importer service reusing `AbcCatalogClient.list`, checkpoint-after-commit, content-hash upsert, `Inactive` → not displayable.

## ABC shared-catalog importer Phase 2 — resumable full import (issue #735, branch `feat/abc-catalog-full-import-735`)

Phase 2 builds the importer on the Phase 1 schema: `app/modules/supplier-integration/abcCatalogImport.ts` reusing `AbcCatalogClient.listRaw` (the only read path returning `Inactive` items), paging at 1000/page with checkpoint-after-commit in `abc_catalog_sync_runs` (resume from `checkpoint_page + 1`, cumulative counts), SHA-256 content-hash upsert keyed on `item_number` (second identical run is 0 adds / 0 updates), `Inactive` → `is_displayable = false`, per-item failure capture without aborting the sync, DB-transaction failure aborting the run, provider-drift abort as `partial`, truncated-page abort as `partial` (`catalog_import_short_page`, checkpoint preserved), empty-first-page fail-closed with stored data retained, a checkpoint-0 resume that revalidates page 1 instead of restoring empty totals, run-ownership serialized with a transaction-scoped advisory lock, 120 s page-transaction budget with hierarchy paths batched per page, bounded dry run ending `partial` (not `succeeded`), and a counts-only stdout report (failing item numbers stay in the run row), and hierarchy seed from `GET /api/product/v1/hierarchy` plus item payloads with empty level nodes preserved. One-shot CLI `app/scripts/run-abc-catalog-import.ts` (`--dry-run` first, `--max-pages`, `--resume`, `--db-capacity-bytes`; exit 0/2/1 for succeeded/partial/failed) and manual workflow `.github/workflows/abc-sandbox-catalog-import.yml` (main-only, `abc-sandbox` environment, exact confirmation `IMPORT_ABC_SANDBOX_CATALOG`, sanitized step-summary counts, 360-minute timeout for the ~1.5 h full pull plus second pass). No prices stored (explicit field allowlist + price-key rejection, asserted in unit and integration tests) and no `SupplierProduct`/`Material` rows created (the service has no access to those models, asserted with throwing spies). Headroom gate discharges the Phase 1 open check: the importer measures `pg_database_size` and requires capacity − used ≥ ~2 GB, with capacity from `ABC_CATALOG_DB_CAPACITY_BYTES` recorded from the Supabase dashboard — it fails closed without one and never guesses. Local evidence: unit tests 30/30 and live-Postgres integration tests 5/5 (disposable local Postgres 16, 91 migrations, restricted `tradeos_app` role) proving the full import, 0/0 second run, live resume, dry-run writes nothing, empty-response fail-closed, and resume of a run that failed on an empty first page. The workflow imports into a disposable Postgres in the runner, not staging: no single GitHub environment holds both the ABC credentials (`abc-sandbox`) and a staging database URL (`staging`), so a staging-DB run is blocked on the owner placing one half with the other (exact action in the workflow header and runbook `docs/operations/ABC_SUPPLY_CATALOG_IMPORT.md`); the same script runs against staging unchanged once placed. Live workflow evidence (dry-run bounded, bounded write + in-job resume via `resume_to_completion`, full import with second-run 0/0) is dispatched after merge and recorded on #735. Staging verification via the deployed app remains gated on the Vercel 402 clearing. Dry runs now log one stderr line per hierarchy and item page (counts only), the workflow tees the CLI's stderr to the live step log, and a CLI exit without a report fails validation with the CLI exit code instead of a bare JSON SyntaxError.

## TradeOS master logo package is the canonical brand source — 2026-11-25 (branch `fix/tradeos-brand-logo-source`)

The master logo package (carpenter's-square T mark; copper #C98460, charcoal #222426, warm ivory #F7F5F1) is committed verbatim at `docs/brand/tradeos-master-logo-package/` (README, manifest, vector/, print/, preview/, web/) and is the canonical brand source. Served files live under `web/public/brand/` as byte-identical copies of the package `web/` files, enforced by a hash test (`web/src/app/brand-source.test.ts`); the login entry art is the package vector files in place (`web/public/entry/mark.svg` = `vector/tradeos-mark-light.svg`, `web/public/entry/wordmark.svg` = `vector/tradeos-wordmark-dark.svg`, dark entry surface). The code-drawn mark/wordmark geometry in `web/src/components/entry/logo-paths.ts` is verified byte-identical to the package SVGs by the same test; MetalLogo and the cinematic entry keep their metallic rendering of that geometry. Tab, PWA, Apple, and social images now come from the package: root metadata declares `/brand/favicon.svg` + 32/16 PNGs and `/brand/apple-touch-icon-180.png`, Open Graph/Twitter use `/brand/social-share.png` (1200x630), the manifest points at `/brand/pwa-192.png`, `/brand/pwa-512.png`, `/brand/apple-touch-icon-180.png` with `#222426` background/theme, and `web/src/app/favicon.ico` is the package ICO. The generated `icon.tsx`, `apple-icon.tsx`, `opengraph-image.tsx`, and `pwa/icon-192` + `pwa/icon-512` routes are deleted; the maskable route stays (the package ships no maskable variant) and renders the canonical mark at safe-zone scale on `#222426`. The app-nav mark tile is `#222426`. Five unreferenced `web/public/tradeos-entry-*.svg` files were removed. Brand Studio defaults are the package files as display fallbacks (never persisted into an organization's profile): fresh organizations resolve logo/icon/watermark/cover to `/brand/*` and colors to the package palette in both the web preview (`web/src/lib/brand-studio.ts`) and the backend preview (`app/modules/brand-studio/service.ts`, `TRADEOS_BRAND_DEFAULTS`); explicit profile values and uploaded assets win, the favicon derives from the organization's own logo before falling back to the package mark, mono/print variants derive only from organization-owned art, and the setup checklist/completion still measure the organization's own branding. Deliberately unchanged: the `globals.css` `--copper` UI tokens (WCAG-adjusted, not brand colors) and the entry module's own `--ivory`/`--graphite` tokens. Print/vector masters stay out of the served bundle in `docs/brand/`. No migration, no secret, no production touch.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:b191dbabeb8931d81a980fa8d19eea3818255334243546c0fec1584050a631c1 -->

### Post-merge follow-up risks ([PR #1114](https://github.com/404TradeOS-LLC/TradeOS/pull/1114))

- **Brand Studio preview compatibility.** The favicon variant used to prefer an uploaded icon asset over an explicit profile icon URL. It now prefers the explicit URL in [both](../app/modules/brand-studio/service.ts) [preview builders](../web/src/lib/brand-studio.ts), so organizations with both sources can see a different favicon. The API also now emits `source: "default"` and relative `/brand/*` URLs where slots could previously be missing. Add a fixture with distinct explicit and uploaded icons, verify saved and unsaved previews agree, and confirm preview clients accept the new source and resolve package URLs against the web origin. Document the intended precedence.
- **Document branding across delivery paths.** [Document branding](../app/modules/documents/branding.ts) detects a platform fallback by exact URL, so an explicitly saved primary URL equal to the package path can lose to an older legacy logo. Test that collision and both legacy logo sources, then use source provenance if explicit selection must always win. Open a fresh organization's closeout document through the web proxy and verify the package image loads from the web origin. Check an organization with its own uploaded logo in the same flow. PDFs should still use approved organization storage bytes or the company-name fallback; keep the [tenant-scoped PDF loader](../app/modules/documents/pdf-logo-storage.ts) in place.
- **Cached metadata and install assets.** The old `/icon`, `/apple-icon`, `/opengraph-image`, and `/pwa/icon-{192,512}` routes were removed. A client holding pre-merge metadata or a manifest can still request them. After staging promotion, test a fresh and an existing install on Android and iOS, including the generated Android maskable icon. Check the favicon, login art, and social card at 1440, 1024, 768, and 390 px, and verify an unauthenticated crawler can fetch the new social image. If old URL requests cause missing artwork, assess redirects to the package assets.
- **Verification gaps.** The PR reports that the affected API suites passed, but the full API suite and build were interrupted locally. Confirm their CI results for the merged or promoted revision. The PR discussion does not establish staging or real-device acceptance.
- **Documentation drift.** The older social preview and install icon entries below still describe generated routes. Mark those entries as superseded by #1114 so deployment checks use the current URLs and retain only the still-open acceptance checks.

The merged diff addresses the review findings about legacy document logo precedence and deriving mono/print variants from an organization-owned primary logo. It contains no schema, migration, authorization, or RLS changes.

<!-- /coderabbit-ai-generated:v1 -->

## Estimate Price-stage allowance signals — DES-10 (branch `fix/des10-price-allowance-signals`, 2026-11-25)

The estimate Price stage now surfaces allowance signals alongside the F3 price-readiness chips (DES-10 verdict gap 5; Figma frame 378:442, which lists "Permit allowance $350" and "Jobsite cleanup $275" as explicit allowance rows against the supported subtotal). An allowance line is a lump-sum (LS) estimate line: the measurement contract defines the allowance takeoff family as a priced lump sum, never a measured quantity (`familyForUnit("LS") === "allowance"` in `app/modules/assemblies-database/measurement.ts`), and the web-side unit normalizer maps the ALLOWANCE alias onto LS. `summarizePriceReadiness` (`web/src/lib/estimate-price-readiness.ts`) now counts lump-sum lines, totals them cent-safely (null when any line cost is invalid), and flags unset allowances (lineCost not a positive finite number) by name; `PriceReadinessSignals` renders an "N allowances · $X" chip whenever any exist, an "Allowances: N lump-sum lines · $X" summary line (naming unset lines), and per-cost-type allowance counts in the direct-cost breakdown next to the missing/to-review/unchecked counts. Display-only, like the F3 signals: nothing is repriced and finalization is not gated. Stated limitation: the frame separates its two allowance rows from its six priced work lines by role, and four of those six work lines are also lump-sum units — estimate data carries no allowance flag recording that role distinction, so the signal covers lump-sum lines as the codebase's allowance family. The F8 proposal allowances (`ProposalAllowance` rows on a Proposal) are not the source here: no proposal exists yet at Price stage, and the allowances total there is display-only against `finalPrice`. Still design-only on frame 378:442: the $1,670 reconciliation (F4 fixture data, will not be built), the Pricing provenance disclosure as a Price-stage disclosure, imported-draft state, and the offline notice (no offline detection exists).

## Today Create sheet no longer bricks on a slow advisory lookup; Day timeline map is real — 2026-11-25

Production dogfooding on 2026-11-25 showed the Create sheet rendering zero options ("Could not confirm your workspace access. Reload to try again.") for an authenticated owner, and the Day timeline showing a hardcoded "Map unavailable" stub. Root cause of the Create failure was a timeout, not a 500: the app layout's settings-identity lookup (`resolveSettingsIdentity`, `web/src/app/(app)/layout.tsx`) shared the 1500ms Athena capability budget and failed closed to `{role: null, orgId: null}` on any error, which the nav's `canUseUniversalCreate` gate turned into zero create options. The same session's untimed page-data load of the same settings endpoint had succeeded minutes earlier, and the layout's own comments already record the memberships lookup taking 311–2202ms against staging — the settings lookup simply had too small a budget for a slow production API. The fix gives the settings lookup its own 5000ms budget (`SETTINGS_IDENTITY_TIMEOUT_MS`, matching the memberships budget) and falls back to the role/org claims already in the session token when the lookup still fails; a token without those claims still fails closed to null, exactly as before. The client Athena capability retry in `web/src/components/shared/app-nav.tsx` gets the same 5000ms budget (its 1500ms retry aborted on the same slow API). Server routes remain authoritative — this is presentation gating only, no authorization policy changes, no migration, no RLS change.

The Day timeline now pins today's scheduled jobs by site address: `DispatchJob.project.siteAddress` is plumbed onto Today work items (`web/src/lib/today-data.ts`), geocoded server-side with the Census Bureau's free geocoder extracted from `web/src/lib/weather.ts` into `web/src/lib/geocode.ts` (`geocodeAddress`, fail-soft to null), capped at 10 pins (`MAX_DAY_MAP_PINS`, one lookup per unique address, 2s per lookup, chained off the schedule read so it overlaps the other queue reads). A new `DayMap` client component (`web/src/components/dashboard/day-map.tsx`, Leaflet + OpenStreetMap tiles, free, no key) renders copper dots with popups (title, time, address) and fits the viewport to the pins; it renders only when pins exist, otherwise the timeline alone — the "Map unavailable" stub is removed. Pins are job-site addresses the organization already stores, never live crew locations; tile requests reveal the viewed map area to the tile host. Regression coverage: `web/src/app/(app)/layout.test.ts` (budget ≥ 5000ms, token-claim fallback), `web/src/components/athena/athena-workspace-contract.test.ts` (retry budget ≥ 5000ms), `web/src/components/dashboard/today-command-board-contract.test.ts` (no stub, map + geocoded site address), `web/src/lib/geocode.test.ts`, `web/src/lib/today-map.test.ts`. The Leaflet chunk load is failure-safe: a failed dynamic import (or map-init throw) removes any partially initialized map and hides the container for that pin set, so the timeline stands alone instead of an empty 220px box; a later pin change retries the load.

## Proposal status-check recovery guidance — DES-10 gap #6 — 2026-11-25

Creating a proposal draft is the one estimate-flow step where the contractor could not tell whether their work landed: `createProposalAction` returned the same `{ error, statusCheck: true }` for every failure, `apiFetch` returned the body only (no status, no `Idempotency-Replayed` header), and the form minted a fresh idempotency key per render, so a retry after reload could create a duplicate draft. The web now distinguishes all five create outcomes. `apiFetchWithResponse` (new in `web/src/lib/api.ts`; `apiFetch` delegates to it, body-only contract unchanged) exposes status + headers; `createProposalAction` returns 201 → redirect to the new draft, 200 + `Idempotency-Replayed: true` → redirect to the original draft with `?replayed=1` and the one-time notice "This draft was already created by your earlier attempt — no duplicate was made.", 409 → the server's key-reuse message verbatim + status check only, other 4xx → inline error only (no status check, no retry), 5xx / network / timeout / abort → unknown outcome with the status-check screen + "Try again with the same details" (same key). The idempotency key is minted once per attempt and persisted in sessionStorage keyed by project + estimate (`web/src/lib/proposal-status-check.ts`), resolved by the form on mount and on estimate change, and cleared from the detail page once the attempt is confirmed created (`?created=1`), replayed (`?replayed=1`), or recovered through the matching draft (`?recovered=1`) — every landing carries the resolved key and storage is removed only when its current value still matches, so revisiting an older landing URL after a newer attempt started cannot delete the newer key. Storage failures (blocked store, quota) fall back to the server-generated seed instead of throwing.

Server-side confirmation (folded in from the parallel DES-10 lane, Billy's word 2026-11-25): the no-match return now carries `?confirmedNoMatch=1` — from the confirm action's redirect, through both estimate-builder create links (`EstimateBuilder` and `EstimateStageFlow`) and the intake-only proposal form — into the create action, which forwards `confirmedNoMatch: true` in the API body. `POST /api/v1/proposals` accepts the optional flag (`app/backend/controllers/proposals.controller.ts`, `CreateProposalInput`); on a fresh create the service records a `proposal.status_check_confirmed` activity event on the project (proposal id, estimate id, idempotency key in metadata), and a replay records nothing. The flag is excluded from the idempotency hash alongside `orgId`, so a retry with or without it still replays the same draft. The client-side `proposal.status_check_no_match` entry stays: it records "saw no match and returned", a different fact from the server-side "created again after a confirmed no-match" — one record per fact. The form deliberately does not mint a fresh key for a confirmed no-match: it keeps the stored attempt key, so a retry replays the original attempt if the draft exists (the safe outcome when the loaded list missed it) and records the confirmation only on a genuinely fresh create. Regression coverage: `app/tests/proposals.service.test.ts` (4 new tests) and `web/src/app/actions/proposals-status-check.test.ts` (5 new tests).

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7cdf45411d50351c07f60bbd5aa0b128a3423f74da80c9079daf3fee3cc20f20 -->

### Post-merge follow-up risks ([PR #1108](https://github.com/404TradeOS-LLC/TradeOS/pull/1108))

- **Recovery can identify the wrong draft.** The matcher falls back to estimate ID if no row has a string key, even when the current API returns explicit null keys on legacy rows. On an intake project containing only unkeyed drafts, this can label an unrelated draft “This is your draft.” Treat an explicit null as a supported field with no key, and treat results without verifiable attempt identity as inconclusive. Cover all-null rows, omitted fields during a mixed deployment, and multiple drafts for the same estimate or intake project.
- **Reload safety depends on retaining the submitted key.** When storage is blocked, the form can submit a server seed but the Status Check button reads only storage, so the check loses the actual attempt key. A reload or a no-match return can then submit a different key and create a second draft if the first request committed. Carry the submitted key through recovery, and test a response lost after commit with storage unavailable, including both estimate and intake returns. Cross-tab recovery is also outside the session storage guarantee.
- **Confirmation events are not proof of a completed check.** The API accepts a client-supplied boolean without correlating it to a recorded no-match decision; the confirmation event also omits the authenticated actor. The return action takes the key from the current storage slot rather than from the checked attempt. Before using these events as audit evidence, bind the decision to the authorized actor, organization, project, estimate or intake, and attempt key. Verify stale confirmations cannot be attached to a later attempt and that a different tenant cannot read or write the recovery records.
- **The shared proposal DTO exposes attempt keys beyond staff recovery.** The customer portal uses the shared proposal service; its redaction currently preserves top-level fields. Check list and detail responses for both staff and customer sessions, and keep attempt keys out of customer responses and unnecessary URL, analytics, and log retention. The key is a correlation identifier, not a credential or an authorization control.
- **Live recovery and responsive acceptance are still owed.** On an isolated staging deployment serving the merged change, verify a committed create with a lost response, reload and same-key retry, a 200 replay with the original proposal ID and replay header, and one persisted draft. For a true no-match followed by a fresh create, verify separate no-match and confirmation events, with no additional confirmation on replay; verify a failed event write rolls back the HTTP create. At 1440, 1024, 768, and 390 px, check the guidance card, form errors, keyboard focus, and reduced motion. Include project-load failure and a settings-only failure, which currently prevents recovery from rendering even when the proposal list loaded.
- **The outcome docs still overstate the 409 rule.** The description above groups all 409s as key reuse, but `estimate_not_finalized` is an inline rejection; an unrecognized or uncoded 409 still goes through key reuse. Pin both cases at the HTTP boundary and document the fallback so a new 409 reason cannot silently be mistaken for a draft conflict.

This PR adds no schema migration or RLS policy change. The live checks above remain unverified by the merge evidence.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:3254bf3efa54bd71950bc273a1e15f186242747e7edb6d56f77b74035a972e5f -->

### Post-merge follow-up risks ([PR #1106](https://github.com/404TradeOS-LLC/TradeOS/pull/1106))

- **Job-site address disclosure.** Today now sends full stored job-site street addresses to the Census geocoder in the `address` query parameter. The helper requests 30-minute revalidation. Separately, browsers request OpenStreetMap tiles for the viewport. Confirm both flows are covered by the product’s privacy commitments, including for residential job sites, and verify that outbound URL logging and cache handling match those commitments. Use synthetic addresses for that verification.
- **Stale Create permissions in the UI.** The settings fallback runs on any lookup error, including a 401/403, and reads claims with a decoder that does not verify signatures. It can show Create options based on a stale role after a downgrade or membership removal. Add a behavioral test for a slow settings lookup with a valid owner session and for a stale role after membership changes or a workspace switch. Verify that the API still rejects unauthorized requests, and decide whether explicit 401/403 responses should suppress the fallback.
- **Optional geocoding can delay Today.** The loader awaits geocoding before returning Today data. A cold or failing Census request can add up to the two-second lookup budget after the schedule read if the other reads finish first. Measure with a cold cache and a stalled geocoder; if the delay is material, decouple the map lookup from the timeline render.
- **The populated map still needs browser evidence.** The component fixture has no geocoded pins, so its passing tests do not exercise the Leaflet chunk or tile loading. Add a synthetic pinned-job case that verifies marker and popup rendering, a schedule update at the same coordinates, and timeline usability if tiles fail. The merged code handles Leaflet import and initialization failures, but tile request failures occur after initialization and can leave markers over a blank basemap. On a deployment serving the merged change, verify the owner’s Create options, Ask Athena in an enabled workspace, and the scheduled-job map. Live verification was not established by the PR evidence.

The merged diff contains no backend, API contract, schema, or RLS changes. The queue failures tracked in #1093 were handled separately.

<!-- /coderabbit-ai-generated:v1 -->

## Today queue reads use explicit column selects (#1093) — 2026-11-25

The estimates and proposals organization work-queue reads (`EstimateEngineService.listOrganizationQueue`, `ProposalsService.listOrganizationQueue`) no longer select-all: each now requests exactly the columns its queue item consumes (plus project/customer names, and the latest contract id for proposals), mirroring the invoices queue's explicit-column raw SQL. The hardening follows the #1093 diagnosis — production Today 500ed "Estimates in progress" and "Proposal follow-ups" because the production database lagged the code by additive columns (the DES-10-F2 review-checklist columns on estimates, the DES-10-F7 signature columns on proposals) and both queues selected them. The root-cause fix remains the pending production migration run; this change only makes a future code/DB drift degrade one field instead of taking down a whole queue. Behavior is identical when all columns exist. Regression coverage: `app/tests/estimate-engine.queue.explicit-select.test.ts` and `app/tests/proposals.queue.explicit-select.test.ts` — each simulates the lagging database (a select-all or a select naming a missing column throws a 42703-style error) and proves the queue loads and requests exactly the consumed columns. See `docs/modules/estimating.md` and `docs/modules/proposals.md` ("Organization work-queue read").

## Estimate-less proposal invoice pricing — 2026-11-25

`POST /api/v1/invoices` with a `proposalId` and no `estimateId` no longer 409s when the proposal was created from the project (`estimateId: null`). The estimate-link guard in `InvoicesService.resolvePricingProposal` compared the stored `null` against the request's absent (`undefined`) with strict inequality, so every estimate-less proposal invoice failed — the S069 browser-evidence run (45547231123) died on it in Step A. The guard now normalizes both sides to `null` before comparing, so only a present `estimateId` that differs from the proposal's is rejected. Regression coverage: new service test creates an invoice from an accepted estimate-less proposal with manual line items. See [Invoices and payments](modules/invoices-and-payments.md#estimate-backed-invoice-creation).

## ABC selected-price-probe allowlist widened to ABC-provided test SKUs (#711) — 2026-11-24

The read-only selected-account ABC sandbox quote (`POST /api/v1/supplier-integrations/abc/selected-price-probe`, Settings → Test selected ABC price) accepted only two SKUs (`654210`, `02GASTZ3WW`), which blocked probing the test data ABC API Support sent 2026-11-24 (Penny Simpson). The allowlist is now 20 SKUs: the two pilot SKUs plus the 18 ABC-provided test SKUs — branch 254 items `17CTRV12FN`, `0150013884`; branch 340 priced items `02IKDYARAB`, `02IKDYARCA`, `0150013846`, `0170030023`, `0150013902`, `02CTL303GG`, `05CTSRR10`, `02GATZ3WW`, `04CTPRSTWW`, `01CT25BK`, `14MIDEGBK`; branch 340 $0-price items `07CS300054`, `07GAEGUCGY`, `08GAEPADH`, `23CTCI9GG`, `GGC615VGWH`. It stays a closed allowlist: the server enum (`selectedQuoteSchema`) and the Settings dropdown (`ABC_SELECTED_QUOTE_SKUS`) enforce the same list, no free-form SKU input exists, and an unallowlisted SKU is still rejected with 400 before any provider call (existing route test). The `price-probe` route stays locked to `ABC-654210`. No priced line has been verified yet — this only unblocks the probes; they run in production Settings after deploy. Regression coverage: new route test quotes `17CTRV12FN` at branch 254.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:5c3dfd0b11e4fce98c701a401b6e5d5bac571017508fdddf2b54de74b46dc4b7 -->

## Estimate Scope clarification — DES-10-F1 (merged; staging acceptance pending)

[PR #1090](https://github.com/404TradeOS-LLC/TradeOS/pull/1090) merged as `69a9d0ac9430d194b6e914def1d6edde5d4867e2`. Eligible draft estimates can save a footing field note or a site-check assumption. Athena shows the answer as advisory context on explicit review of matching saved scope. The save leaves items, quantities, and totals unchanged.

### Post-merge follow-up risks

- **Schema and app rollout can get out of sequence.** The clarification routes and Athena draft generation for eligible scopes query the new table. Before promoting a candidate, verify `20261125120000_add_estimate_scope_clarification` is applied in the approved database ledger and the restricted API role can use the table with forced RLS. Record the matching web and API build identities and the API's database identity. Hold promotion if the evidence does not match. If application rollback is needed, keep the additive table and saved notes.
- **A saved field note can outlive the work it describes.** The row is keyed by estimate and question; neither the save nor the read binds the answer to the scope that the user saw. A second session can change the deck scope while the form is open, or make the question inapplicable and later bring it back. When the same question key applies again, Athena can show the old note under the revised scope. Test both two-session cases and decide when to require reconfirmation before presenting that note for review.
- **Finalization recovery refreshes the estimate before returning to Scope.** A `409` with `details.code: ESTIMATE_FINALIZED` moves focus to Back to Scope. The button waits for a fresh estimate response confirming the estimate is finalized and then focuses the read-only Scope heading. A failed refresh keeps the recovery action available. Deployed two-session verification still needs to confirm the error survives the web proxy and the published builder hides draft controls. Verify separately that an identical replay after finalization can return the existing revision without a database write.
- **Tenant and role checks need coverage on the deployed paths.** The PR reports local foreign GET/PUT denials and restricted-role integration coverage for foreign reads and inserts. On the approved candidate, verify foreign GET, PUT, and Athena draft requests return 404 without returning a note. Add restricted-role coverage for attempts to update an existing clarification across organizations, as a same-organization technician, and after finalization; assert the row and revision remain unchanged. Check that the same-organization reader and writer paths still work.
- **Browser acceptance and automated behavior coverage are still open.** Run authenticated acceptance at 390, 768, 1024, and 1440 px on the matching candidate. Exercise a failed save, retry, reload, stale revision recovery with entered text retained, pending navigation, and keyboard focus. Confirm Athena renders the note, while saved items and totals stay identical even when a footing-replacement item already exists. The [PR review](https://github.com/404TradeOS-LLC/TradeOS/pull/1090#issuecomment-7149341567) also identifies gaps in automated form behavior and question selection: cover the real refresh and retry interaction and the cases for new footings without reuse and scope without deck work. The reported hosted checks for final PR head `5d9bcf04` and local browser checks for an earlier tree do not certify the deployed candidate. Record the candidate results before updating release status.

<!-- /coderabbit-ai-generated:v1 -->

## Estimate Review readiness checklist — DES-10-F2 (branch `feat/des10-f2-review-readiness-gate`)

<!-- DES-10-F2-START: keep this entry delimited; parallel DES-10 lanes edit other sections of this file. -->
Review stage (Figma 378:443 / 287:240) now carries a persisted two-item readiness checklist — exclusions reviewed, price sources reviewed — that gates `Finalize estimate`. Persisted as nullable `exclusions_reviewed_at` / `price_sources_reviewed_at` on the estimate (migration `20261123120000_add_estimate_review_checklist`); toggles PATCH through the existing draft-update path; `finalize()` enforces the same preconditions server-side (409). No line-count gate: decision 22-B (Billy's word 2026-11-23) allows finalizing a $0 estimate — the checklist attestation is the gate, not the line count. Omitted Figma items: 01 reconcile the $1,670 difference (DES-10-F4, RESOLVED 2026-11-24 as fixture data — Billy's decision ~09:04 EST; no imported-draft reconciliation will be built; regression coverage in `app/tests/estimate-engine.fixture-reconciliation.test.ts`) and 02 review the footing assumption (DES-10-F1, Codex lane). See `docs/modules/estimating.md` ("Review readiness checklist (DES-10-F2)").
<!-- DES-10-F2-END -->
## Estimate builder identity header — DES-10-F5, 2026-11-23

The estimate builder header now shows identity lines under the `ESTIMATE #{version}` title (F5-A, Billy's decision 2026-11-26 — the per-project version shown as `ESTIMATE #<version>`) and `StatusBadge`: a customer line (the project record's customer name, from the `customer` already embedded in the `getProject` response) and a job-description line (the saved project `simpleScope`, falling back to the project `jobType`). Either line renders nothing when its source data is absent; no new fetch, API, schema, or migration is involved. The customer name truncates and the description clamps to two lines, so the header holds at 390px as well as desktop.

No sequential estimate number exists in the data model — `Estimate` carries only a uuid id and a per-project `version` (`@@unique([projectId, version])`), and `Proposal` has no number field (`Invoice.invoiceNumber` and `Job.jobNumber` belong to later-stage entities that do not exist at estimate time). No numbering scheme was invented and no migration was created; the title shows the existing per-project version as `ESTIMATE #{version}`. The Figma numbering question is decided (F5-A, Billy's decision 2026-11-26): canonical `ESTIMATE #<version>` format; the `EST-####` new series is not used. Pinned by a new source-contract test in `estimate-mobile-contract.test.ts` (17 tests in that file).

## DES-10-F3 — Estimate Price readiness signals — branch `feat/des10-f3-price-readiness-signals`, 2026-11-23 (PR #1044, merged as b31966c2)

<!-- DES-10-F3: begin -->

The estimate Price stage now surfaces price-readiness signals derived from the saved lines (DES-10 verdict gap 3; Figma frames 432:26604 / 432:26746 / 432:27891). `GET /api/v1/estimates/:id` attaches a read-time `priceReadiness` per line item (`missing | current | warn | refresh | reject | unverified | null`); the Price stage renders missing / to-review chips, an attention item naming the affected lines with a "Review in Items" action, per-cost-type counts in the direct-cost breakdown, an omission-check line ("N missing · M to review", or "Omission check complete · no missing or stale prices"), and a low-margin chip when gross margin is below the 10% display threshold. Missing means the line records no price (saved `unitCost` zero with no priced source component — a $0 behind a priced component is an intentional recorded $0, not missing). Unverified / warn / refresh / reject come from the backing material's `lastPriceUpdate` through the shared `priceFreshness()` tiers as `RECENT_RETAIL_VALIDATION` (current ≤ 30d, warn ≤ 60d, refresh ≤ 90d, reject > 90d); assembly lines aggregate their leaf cost items. Lines with no supplier material price (custom, labor/equipment-only) carry `null` and no signal. Display-only: nothing is repriced, finalization is not gated, and the tax warning is untouched; if the readiness lookup fails, the detail read still succeeds with no signal. Skipped, with reasons: allowances (no allowances model exists — DES-10-F8) and the offline notice (no offline detection exists in the estimate flow). Parallel lanes also edit this file in different sections; expect a rebase against their entries.

<!-- DES-10-F3: end --> (feat(estimates): price readiness signals in the estimate Price stage (DES-10-F3))

## Proposal selections and allowances model — DES-10-F8 (branch `feat/des10-f8-proposal-selections-allowances`, PR #1054)

Copperline proposal sections 03 (selections) and 04 (allowances) had no model. Additive migration `20261123090000_add_proposal_selections_allowances` adds `ProposalSelection` (label, nullable detail, status `action_required`/`confirmed`, nullable due date) and `ProposalAllowance` (description, amount >= 0), both org-scoped with forced RLS mirroring `proposal_deliveries`. Eight new endpoints under `/api/v1/proposals/:id/selections|allowances` follow the proposal draft rules (accepted/contracted proposals reject writes with 409); duplication carries both lists to the copy. The staff proposal detail page shows both sections with CRUD; the customer portal shows them read-only. The allowances total is display-only and is never added to `finalPrice` — wiring allowances (and the Figma `PROJECT COURTESY −$1,500` line, which has no model) into totals, rendering selections/allowances in the proposal PDF, and showing them on the authenticated portal accept/decline page are recorded follow-ups in `docs/modules/proposals.md`, not implemented here. Fields were read from the Figma flagship frame `425:45123` via the Figma MCP. No acceptance, estimate-finalize, or totals logic was touched. (feat(proposals): add proposal selections and allowances models (DES-10-F8))

## Public-portal proposal approval + signature — DES-10-F7 (branch `f7/public-portal-approval-signature`, 2026-11-24)

<!-- DES-10-F7-START: keep this entry delimited; parallel DES-10 lanes edit other sections of this file. -->
The public proposal portal is no longer read-only (DES-10 verdict gap 7; Copperline TARGET frames 425:45123 / 425:46807 + signature flow 361:119; founder decision 2026-11-24 ~09:00 EST). `POST /api/v1/customer-portal/proposals/:id/accept` moves a sent/viewed proposal to `accepted` only with a drawn signature image plus the printed name — a typed name alone is rejected, and the signature data URL must decode to an actual image (a bare `data:image/` prefix with no payload is rejected at the HTTP boundary, in the service, and by the trigger) — attributed to the customer record's email on file and the portal session; `POST /api/v1/customer-portal/proposals/:id/decline` moves it to `declined` with an optional reason (≤ 500 chars) and leaves the project untouched. Both take an optional `expectedUpdatedAt` binding the answer to the revision the customer reviewed (a staff edit after the page rendered is a 409, and the conditional update predicates on it); an error response rolls the portal transaction back rather than committing a half-recorded response. The proposal records signer name/email, signature image, reported IP/user agent, and `signedAt` (migration `20261124150000_add_proposal_portal_acceptance`: new `signer_*` / `signed_at` / `declined_reason` columns); acceptance awards the owning project (`estimating` → `awarded`, staff accept parity). Governance is three layers: the portal service asserts the proposal belongs to the session's customer (404 first), the conditional update requires sent/viewed + org/customer scope, and a narrow portal UPDATE policy keyed by transaction-local `app.portal_proposal_id` plus a trigger pins every column except the response itself. The project award is keyed by a second transaction-local id, `app.portal_proposal_project_id` — a subquery over proposals inside the projects policy recurses through the proposals SELECT policy (PostgreSQL 42P17, proven by the live integration test before the fix). Both responses write a `proposal.accepted` / `proposal.declined` delivery event (`delivery_channel: "portal"`, `actorType: "customer_portal"`) plus the activity row; no Athena event, no email. The web approval form requires the review confirmation, printed name, and ink on the signature pad; the answered page state replaces the form. The authenticated `(app)/portal` accept/decline surface is unchanged. ADR-010's magic-link identity model is unchanged — its permitted customer-originated writes are extended by a DES-10-F7 amendment in the ADR itself. Live coverage: `app/tests/proposal-portal-acceptance.integration.ts` (13 tests: accept + award + audit trail, double-accept 409, concurrent double-accept, decline, no-signature 400, empty-payload signature 400, stale-revision 409, current-revision accept, draft/foreign/cross-org 404, no-email 409, expired session 401, replayed link 410, raw-UPDATE RLS probe with the portal context asserted first), `app/tests/proposals.portal-acceptance.test.ts`, `web/src/components/proposals/portal-proposal-approval.test.ts`. See `docs/modules/proposals.md` ("Public-portal approval + signature (DES-10-F7)") and `docs/modules/customer-portal.md`.

Portal redemption origin check (2026-11-24): the redeem route's cross-origin guard (`shouldRejectProxyMutation`, `web/src/lib/proxy-origin.ts`) rejected the legitimate confirm-form POST on staging with "Cross-origin portal redemption is not allowed" — the browser's POST arrived without an Origin header (stripped on the browser/proxy path), and the guard rejected any mutation with a missing Origin even though the request was same-origin (verified by curl: a same-origin POST passes, a foreign or missing Origin fails). The guard now also accepts a missing Origin when `Sec-Fetch-Site: same-origin` is present — a forbidden header that websites cannot forge, proving a same-origin navigation. A present Origin stays authoritative: a mismatched Origin is still rejected even with a same-origin Sec-Fetch-Site, and a missing Origin without one is still rejected. The other guard callers (staff proxy, composite import) do not pass Sec-Fetch-Site and keep the previous strict behavior. Coverage: `web/src/lib/proxy-origin.test.ts` (missing-Origin + same-origin fetch-site allows; cross-site/same-site/none still reject; foreign Origin still rejects).

Portal redemption origin check, follow-up (2026-11-24, same day): the Sec-Fetch-Site exception did NOT fix staging — the F7 re-verification on staging `c18eaf88` failed again (fresh draft proposal `d2d4c530`, $8,500, Sent; steps 1–3 passed, the confirm-form POST returned the same 403 five times across two browsers and three tokens, tokens unconsumed). Live curl repro against staging proved the fix was deployed and working for header-carrying requests (no Origin + `Sec-Fetch-Site: same-origin` → 303; matching Origin → 303; neither → 403; GET → 405, not the 403 — the browser's failing request is the POST, whose JSON error renders as a bare page), so the browser's POST must arrive with neither header: both are stripped on the browser/proxy path before the handler (the browsers under test route through the TLS-terminating sandbox egress proxy; curl via a CONNECT tunnel is opaque and keeps the headers). The guard now accepts a third same-site proof for the no-Origin case: a valid-format pending-access cookie (`tradeos_customer_portal_pending_access` — httpOnly, `SameSite=strict`, path-scoped to `/customer-portal/access`, cleared on the redeem response, so a cross-site request cannot carry it, while header-stripping intermediaries cannot remove it). A present Origin stays authoritative over the cookie proof as well, and requests with no Origin, no same-origin fetch-site, and no valid cookie are still rejected. The other guard callers do not pass the cookie proof and keep the previous strict behavior. Coverage: `web/src/lib/proxy-origin.test.ts` (missing Origin + valid cookie allows; missing Origin with neither proof rejects; mismatched Origin still rejects even with the cookie).

Portal redemption origin check, third failure — root cause (2026-11-24, same day): the cookie proof ALSO did not fix staging — the F7 re-verification on staging `004ffe6f` failed a third time (fresh draft proposal `24143e06`, $8,500, Sent; steps 1–2 passed, the confirm-form POST returned the same 403). The "both headers stripped" theory was wrong, and curl could never have shown it: proven in a real Chromium against the live app, the browser's POST carries `Origin: null` (the literal string), `Sec-Fetch-Site: same-origin`, and the valid-format pending-access cookie. Chrome serializes the POST's Origin as the opaque string `"null"` because the confirm flow declares `Referrer-Policy: no-referrer` (the access route sets it on its 303 and the confirm page sets it via metadata) — proven by an A/B in Chromium: with no-referrer the POST sends `Origin: null`, without it the page origin. The guard treated any non-empty Origin as authoritative, so `new URL("null")` threw and the guard rejected before the Sec-Fetch-Site and cookie proofs were ever consulted. The fix treats the serialized opaque origin `"null"` exactly like a missing Origin: it falls through to the same proofs. A present, parseable Origin stays authoritative (mismatched still rejects, even with a cookie), and a request with `Origin: null`, no same-origin fetch-site, and no valid cookie is still rejected — so a cross-site attacker page that suppresses its own referrer still cannot redeem: it would send `Sec-Fetch-Site: cross-site` and cannot carry the SameSite=strict cookie. Coverage: `web/src/lib/proxy-origin.test.ts` (`"null"` + same-origin fetch-site allows; `"null"` + valid cookie allows; `"null"` with neither proof rejects; `"null"` + cross-site fetch-site without a cookie rejects); real-Chromium repro of the full access → confirm → redeem flow against a local build now returns 303 on the redeem POST instead of 403.

Signature display (2026-11-24, same day): the recorded signature was stored but never rendered anywhere — the staff proposal page had no acceptance section and the PDF Acceptance block drew blank lines, proven live on staging `ffa142a3` (accepted proposal `e0ebcc16`: portal and staff page showed acceptance text, no image; Preview PDF page 2 blank lines). The staff proposal page now shows an Acceptance card (`ProposalAcceptanceCard`, right column after the lifecycle panel) with the signature image, signer name, signed date, and signer email whenever the proposal is `accepted` and carries acceptance evidence, and renders nothing otherwise. The proposal PDF Acceptance block (`writeAcceptanceBlock`, both the estimate-backed and project-draft render paths, served live by `ProposalsService.getPdf`) draws the signature image above the signature lines with the signer name and signed date under them; unsigned proposals keep the blank lines. The image is embedded only after the same integrity validation that guards storage (signature magic-bytes check plus PDF image byte validation) and a PNG pixel-stream pre-validation (chunk CRCs, IDAT inflate, expected scanline size, filter bytes 0..4 — PDFKit decodes PNG pixels asynchronously and an inflate/filter error there escapes any try/catch around `doc.image`); bytes that fail any check — including stored GIF/WebP, which PDFKit cannot embed — fall back to name and date text, and an embed failure never breaks the PDF. The signed block grows from the measured signer-label height. Coverage: `app/tests/proposal-pdf-acceptance.test.ts` (8 tests: image + name + date on both PDF paths, blank lines when unsigned, graceful fallback for invalid bytes and for corrupt pixel data, valid alpha-channel signature, long signer name) and `web/src/components/proposals/proposal-acceptance-card.test.ts` (3 tests).
<!-- DES-10-F7-END -->

## Codex P2 fixes from the #1079 promotion review — 2026-11-24

Four verified-unfixed defects found by the Codex review of the staging promotion (#1079, head `bd025379`), fixed on main. (1) Portal signatures must decode to an actual image: `isValidSignatureDataUrl` now checks the decoded payload against the magic bytes of the declared type (PNG/JPEG/GIF/WebP), so `data:image/png;base64,AA==` and base64-encoded prose are rejected; migration `20261124185609_add_signature_image_magic_bytes` carries the same check into the portal response trigger via `public.is_valid_signature_image` (the landed `20261124150000` migration is not edited). The web server-action pre-check in `web/src/app/actions/proposals.ts` keeps its own length-only copy — follow-up, not changed here. (2) Punch verification is conditional on still-resolved: `CloseoutService.verifyPunchItem` now uses `updateMany({ id, status: "resolved" })` and 409s when nothing matches, so a concurrent reopen is no longer silently overwritten with verified. `resolve`/`reopen` share the read-then-write pattern and are a follow-up. (3) Selection/allowance create/update/delete each advance the parent proposal's `updatedAt` in the same transaction as the child write, so a portal accept bound to a previously rendered `expectedUpdatedAt` 409s after a staff change to either list. (4) Invalidating a costbook mapping-reuse request now clears `reuseLoading`, so picking another template or changing a filter mid-request no longer leaves the reuse selector and Apply button disabled until reload. Coverage: `isValidSignatureDataUrl` unit tests, live integration tests proving the trigger rejects a 1-byte signature and accepts a real 1x1 PNG and that an allowance change invalidates the reviewed revision, closeout verify unit tests (conditional predicate + reopened-race 409), selections/allowances unit test proving all six mutations bump the parent revision, migration content tests, and a source-contract test for the reuse loading clear.

## Costbook PR frontend Preview allowlist — landed via PR #997 (merged 2026-11-15 as `d09f51a1`)

Vercel's deployed source configs `web/vercel.json` and `app/vercel.json`
contain `git.deploymentEnabled["**"]=false`, with only `main` and
`staging` explicitly allowed. Read-only Vercel queries confirmed no
deployment for branch heads of draft Costbook PRs #771/#773/#774 in
either project. This explains why green GitHub CI cannot be treated as a
working staging preview.

PR #997 (superseding #775) landed the narrow allowlist enabling
`feat/costbook-*` **frontend** preview deployments only, rebuilt from
branch `feat/costbook-preview-policy-20261018`. The backend deployment
restriction and staging-only secret inheritance remain unchanged. The
merged change touches only the web preview allowlist; preview READY,
identity, authenticated backend behavior, and staging RLS remain
unverified.

## Beta Proposal PDF layout repair — source candidate

A four-width staging PDF run exposed overlapping wrapped Customer/Project metadata and CRLF control glyphs; independent MuPDF rendering confirmed both defects. The bounded source repair measures shared metadata cards and normalizes saved line endings, with actual-fixture PDF operator regressions. Local/hosted verification and final staged visual acceptance are recorded in the PR; beta GO is not implied.

## Recoverable invoice creation — draft candidate, 2026-11-09

PR #956 adds a commit-confirmed, authenticated draft endpoint and an explicit same-request retry on the mounted New invoice form. The additive request-key migration landed separately in #977 and protected Production run `43360847290` and Staging run `43365023839` succeeded; the release coordinator verified the resulting columns, unique index, pair constraint and forced RLS. Hosted PostgreSQL on `a3c368a` passed all 197 integration tests, including overlapping retry and tenant-denial coverage. Four-width authenticated invoice browser/PDF evidence remains pending. See [Invoices and payments](modules/invoices-and-payments.md#recoverable-invoice-draft-creation).

The New invoice form's initial submit now reads "Save invoice draft" (DES-7 handoff, Figma `1177:2802`; approved 2026-11-18, re-created as a PR after the original local commit was lost unpushed). The unconfirmed-save label "Retry same draft" is unchanged.

## DES-7 invoice decisions a–d — implementation, 2026-11-23

Billy answered the five DES-7 decisions 2026-11-23 ~07:10 EST (a–d all A; e — pinning the Figma revision — is his). All four are implemented in one PR against main `255bbc41`:

- **(a) Mobile Send / Open PDF placement:** the draft detail page renders a top action row (`InvoiceTopActions`, visible only below `xl`) with Send invoice (drafts) and Open PDF, so neither is buried below the invoice body at 390px. The aside keeps the same actions for desktop widths only.
- **(b) NOT SAVED badge:** the new-invoice form shows a `NOT SAVED` badge whenever it holds unsaved changes (any estimate/proposal/type/progress/due-date/line edit), cleared on save, never shown while pending/confirmed/unconfirmed.
- **(c) Mark-viewed:** a customer portal view is the writer — `CustomerPortalService.getInvoice` calls `InvoicesService.markViewed` after its organization + customer scope check. A `sent` invoice moves to persisted `viewed` with `viewedAt` (additive nullable column, migration `20261123120000_add_invoice_viewed_at`) and an `invoice.viewed` portal-channel delivery event; repeat views are idempotent, drafts can never be marked viewed, and invoices already past viewed keep their status while gaining their first `viewedAt`. The write runs under a narrowly scoped portal RLS policy (migration `20261123120100_add_invoice_portal_viewed_policy`, keyed by transaction-local `app.portal_invoice_id`, trigger-pinned columns — the contract-signing precedent). The detail page surfaces the Viewed badge plus `Viewed <date>`.
- **(d) Payment Failure:** defined as a failed manual record-payment attempt (validation or server error) — there is no online payment flow to fail. The attempt records an `invoice.payment_failed` delivery event carrying the reason (`POST /api/v1/invoices/:id/payment-failures`, `billing.write`); the invoice status does not change. The detail page shows the Payment Failure banner with the reason while it is the latest payment outcome; a later successful recorded payment (or mark-paid) supersedes it.

Still owed: the Figma revision pin (DES-7e, Billy's) and authenticated 390/768/1024/1440 browser acceptance (same-ID detail + PDF, tenant/role denial). See [Invoices and payments](modules/invoices-and-payments.md#viewed-and-payment-failure-des-7).

## Proposal-acceptance job verification: stale-state guard, P2002 fallback, assignment-response role check — 2026-11-11

Job transitions, scheduling/rescheduling, and reopen now accept an optional `expectedUpdatedAt` revision token (same pattern as the ProjectTask status guard): a token that no longer matches the job's `updatedAt` fails with HTTP 409, the write predicate always carries a revision (the token, or the just-read `updatedAt` when omitted), and a lost-update (P2025) on the guarded write maps to the same 409. The controller accepts the token as an ISO string on transition/schedule/reschedule/reopen requests; no frontend change sends it yet. `createFromAcceptedProposal` now re-reads and returns the existing job when creation hits the unique `source_proposal_id` index (P2002) instead of surfacing a raw constraint error. Assignment accept/decline now enforces the field-worker role boundary, so non-field roles fail with 403 instead of a misleading 404. Mocked unit coverage added for pause/resume, dispatch/start-travel/arrive, cancel, reopen, the invalid-transition matrix, unassigned-technician denials, and the stale guard; the concurrent-duplicate-conversion and stale-token live tests are written as `app/tests/jobs.from-proposal.integration.ts` for CI (no local Docker PostgreSQL). PR #810 merged 2026-11-04; see API_REFERENCE.md. Hosted PostgreSQL/browser acceptance remains outstanding; authored tests alone are not certification.

## Proposal-acceptance follow-ups (DEV-22) — 2026-11-24, branch `dev22/proposal-acceptance-followups`

All three #976 follow-ups, founder-decided 2026-11-21, implemented and authorized 2026-11-24. (a) `Job.sourceProposalId` is now a real foreign key (`proposals(id)`, ON DELETE RESTRICT, migration `20261124141015_add_job_source_proposal_fk`; column cast TEXT → UUID with a pre-apply audit rejecting cross-org references; rehearsed on a local PostgreSQL 16 disposable database, including the dirty-database failure modes — cross-org reference and orphan both fail the deploy loudly before any write). Direct creates linking a cross-org proposal fail 404, same as a missing one. (b) The version-1 approval baseline freezes `customerId`, `serviceAddressId`, and the structured `serviceAddress` at acceptance; older baselines are never rewritten. A proposal-derived job still cannot move to another project or customer (409), but its live service address stays editable for field ops. (c) Rescheduling a dispatched job requires explicit `confirmDispatchReversal` (409 `dispatch_reversal_confirmation_required` without it); a confirmed reschedule returns the job to `scheduled`, records `dispatchReversed: true` on `job.rescheduled` plus a dedicated `job.dispatch_reversed` event in the same transaction, and the job must be explicitly redispatched. The Dispatcher Workspace shows the reversal warning with a confirmation checkbox. The `ready-for-invoice` route now accepts the `expectedUpdatedAt` token like every other transition, and the workspace sends it — closing the last frontend gap. Unit coverage in `app/tests/jobs.service.test.ts` (93 tests) plus web parser tests and a live integration suite `app/tests/jobs.dev22.integration.ts` (5 tests: FK restrict, cross-org 404, baseline freeze, live-address edit, confirmed-reschedule + redispatch), run against local PostgreSQL 16 (no Docker in this environment). See `docs/modules/jobs-and-scheduling.md`, `docs/DOMAIN_MODEL.md`, `docs/API_REFERENCE.md`, `docs/WORKFLOW_LIFECYCLES.md`, `docs/RBAC_MATRIX.md`.

## Codes & Permits tasks and fee reviews — issue #946 TODO 5, draft PR 2026-11-09

Draft PR branch `feat/codes-permits-tasks-fees-946` (from `main` `c1b3cb0e`) adds owner-assigned permit/inspection tasks (`codes_permit_task`) and a price-neutral fee-review workflow (`codes_fee_review`), plus Athena jurisdiction/version enrichment, under issue #946. See [Codes & Permits tasks and fees](architecture/COSTBOOK_CODES_PERMITS_TASKS_FEES.md). Permit statuses are explicit only (`not_submitted` through `inspection_failed`) and never inferred; submitting requires an explicit confirm step and there is no auto-submit. Fee reviews are price-neutral by construction: the service contains no estimate write, `costItemId` is set only by an explicit select step on an approved fee, and pending/rejected/unselected fees are financial no-ops (unit + live-RLS tests prove the linked estimate's totals unchanged after approval). Athena enrichment (`app/modules/costbook/codes/jurisdiction.ts`) is pure functions only — missing/stale/ambiguous jurisdiction resolves to `needs_verification`, superseded source versions stay readable, and only citation + SHA-256 hash is stored, never full code text. Forced RLS on both tables; cross-org reads return nothing and cross-org writes are refused.

**Merge order (blocking):** #945 pilot → TODO 2 (PR #960, `feat/codes-permits-registry-946`) → TODO 4 (`codes_job_assessment`; merged via PR #961, 2026-11-21) → this PR. The migration's `assessment_id` foreign keys reference TODO 4's table, now on main via PR #961 (2026-11-21); the RLS integration lane is no longer expected red on that account. The Athena tool-file wiring lands on the rebase after #945 merges. Four-width browser acceptance (390/768/1024/1440, staging test account only) is still owed: no working preview deployment exists for this branch, and the #945 preview is blocked on a stale Preview `DATABASE_URL` only Billy can fix in the Vercel dashboard. No merge, staging migration apply, or production touch without Billy's word and independent review or his ADR-009 authorization.

## Estimate authenticated acceptance — 2026-11-05

The opt-in S053 Beta Evidence run now joins Apply acknowledgements to the retained review payload and authenticated organization-scoped Estimate read, requires visible verified saved-line rows, hard-reloads the builder, and checks exact acknowledged IDs, descriptions, persisted quantities and reviewed target links. The separate tenant-isolation lane requires foreign Estimate detail GET to return 403/404; S053 continues to require foreign Athena draft/apply denials. Source checks do not equal a successful deployed run: exact deployment SHA, approved non-production tenant, synthetic identity and protected operator-dispatched `mode=full` evidence remain required. No RLS or permission policy changed.


## Invoice request-key database expansion — draft PR #977 (2026-11-12)

Draft [PR #977](https://github.com/404TradeOS-LLC/TradeOS/pull/977) isolates `20261109172000_add_invoice_create_request_key` from the still-unmerged recoverable-invoice feature [PR #956](https://github.com/404TradeOS-LLC/TradeOS/pull/956). It adds only nullable `invoices.create_request_key` and `create_request_hash`, a not-yet-validated paired-field check, and a unique index scoped to `(project_id, create_request_key)`. The current unkeyed invoice application remains unchanged; no Prisma model, API, or web updates are included in #977. This is **proposed source, not a deployed or applied migration**. Staging and production were observed without these columns/index on 2026-11-12. The exact SQL passed disposable PostgreSQL migration and lock-timeout/rollback rehearsal on #956 ([run 43178931845](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/43178931845)), but this does not prove production lock safety. Before any merge, verify the production migration Environment approval gate and old-client compatibility; then coordinate a protected staging migration, invoice read/write maintenance window, production schema-first rollout, runtime identity, tenant isolation and PDF acceptance. A merge to `main` may trigger a production deployment and the production migration workflow, so #977 remains draft/HOLD pending explicit release gates.

## Invoice finite-value and void guards — 2026-11-05

`InvoicesService` now rejects non-finite invoice inputs at the service layer: a progress invoice requires a finite `percentComplete` in (0, 100], manual line items require finite `quantity`, `unitPrice`, and `lineTotal`, and `dueDate` must parse as a valid date (400, not 500). The HTTP controller already rejected non-numeric strings; the service guard closes the in-process path, where NaN passes every range comparison and Postgres `numeric` would persist it. Voiding an already-void invoice now returns 409 instead of recording a duplicate void event. Project create/update also reject whitespace-only names. This is pending exact-head CI/review/merge; no schema, RLS, or permission policy changed (the `jobs_select_policy` RLS test comment was corrected to admin/owner-or-active-assignee only — comment-only, dispatcher was never in the SELECT policy).


# TradeOS Current State


## Assembly Catalog recipe versions and installed-template review (issue #518)

The recipe version is a per-recipe structural revision count. Installs persist
recipe identity, version and time, and installed template detail compares the
saved and current versions. The tenant-scoped review shows structural and
mapping impact. A Costbook writer can explicitly confirm one template after
resolving any missing mappings. The update and actor-attributed audit record
commit together. Existing Costbook prices and persisted estimate pricing
snapshots stay as recorded. See
[Assembly Catalog implementation](architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md).

## Closeout and warranty workspace — S069, implementation branch, 2026-11-24

Field completion → punch/closeout documents → customer handoff → warranty record organization is now built (branch `feat/s069-closeout-warranty-workspace`, base main `efcaa8f2`). New models `PunchItem` (`punch_items`), `ProjectCloseout` (`project_closeouts`, one row per project), `WarrantyRecord` (`warranty_records`), migration `20261124120000_add_closeout_warranty_workspace`, all with forced RLS and direct `org_id`. `CloseoutService` (`app/modules/closeout/service.ts`) + controller/routes mounted at `/api/v1/closeout`: punch create/list/get/update/resolve/verify/reopen, closeout create/get/mark-ready/mark-handoff, warranty create/list/get/update/delete, and a closeout document endpoint. The readiness checklist is computed from real records — completed jobs, signed contract (`signedAt` set, the reliable signal), non-draft invoice, accepted proposal (`not_applicable` when the project has no proposal at all), open punch count — and `markReady` 409s with the missing list otherwise. No closeout operation mutates a Contract, Proposal, Invoice, or Estimate row; a live-PostgreSQL snapshot-stability test (`app/tests/s069.closeout.integration.ts`) proves contract `snapshot_json` and invoice/proposal state byte-identical after closeout. Every punch resolution, closeout transition, and handoff leaves an attributable `ActivityEvent` (`punch_item`, `project_closeout`, `warranty_record` registered as `IntelligenceEntityType`s). No permission change: staff routes reuse `crm.read`/`crm.write`; ready/verify/handoff are manager-only (owner/admin/dispatcher); punch resolve is manager-or-assigned-technician, enforced in the service (the shared permission keys cannot express "the assigned technician"). The RLS test caught a real defect before merge: the migration's write policies first used `current_app_can_write()`, but the deployed helper was widened in `20260706120000_add_beta_backend_foundation` to include dispatcher AND technician, so a technician INSERT succeeded at the live boundary — all 12 S069 policy predicates now spell out `current_app_role() IN ('owner', 'admin', 'estimator', 'dispatcher')` explicitly, and the S069 tables are immune. The widened global helper is a pre-existing system-wide condition left as-is; other tables are not immune — an owner decision, not fixed here. Warranty records organize only warranties the contractor actually gave: `coverageText` is staff-supplied and must quote the source document, no default or invented coverage exists, and no warranty given means no record (the workspace says so explicitly). The customer portal handoff is read-only: `CustomerPortalService.getProject` now carries `closeout` (status, checklist, resolved/open punch counts, warranties, document link), scoped through the existing portal session, plus a portal document route; no portal writes exist. The closeout document is served as `text/html` (rendered closeout frame + warranty frames) — the pipeline has no HTML→PDF converter (pdfkit is bespoke per-document drawing for proposals), so no PDF is served. The web project workspace gains a Closeout tab (checklist, punch lifecycle, warranty records, ready/handoff actions) and the portal project page a read-only handoff section. S073 matrix extended with the three tables (validator green). Live-PostgreSQL RLS integration coverage (`app/tests/rls.integration.ts`, same-org allowed / cross-org denied / assigned-technician carve-out) and focused service/controller tests are included; browser evidence tooling mirrors S068 (capture script + contract + workflow, dispatch-only) and is pending dispatch from `main` after merge; S069 stays `IN_REVIEW` until a full exact-SHA non-production run passes. Known limitations: a project with no contract at all can never reach `ready` (signed contract + final invoice are required artifacts) — its closeout stays draft with the missing items listed; the document is HTML, not PDF; no downstream roll-up of closeout into estimates/invoices/contracts exists. Review repair (2026-11-24, PR #1073 CodeRabbit findings): the write policies now also require each referenced parent (project, and job/contract/invoice where present) to belong to the caller's organization (the job check goes through a narrow SECURITY DEFINER probe, `app_job_belongs_to_caller_org()`: a plain EXISTS on jobs would deny service-authorized writes because jobs are assignment-scoped for non-admins — verified live when the flat check broke the technician resolve and dispatcher writes), the punch-item assignee update carve-out is technician-only, punch-item edits write conditionally on the row still being unverified, handoff rechecks the readiness checklist, warranty edits record a `warranty_record.updated` event with the changed fields, and a null warranty `startsAt` renders as Not recorded rather than the record's creation date. Review repair round 2 (2026-11-24, PR #1073, 5 new findings): handoff now writes conditionally in a single statement (still `ready` AND no `open`/`in_progress` punch item) so a punch reopen/create between the recheck and the write cannot land a handoff with an open punch item — a lost race re-reads and 409s, and a double-handoff race test proves exactly one attempt succeeds; each closeout table gained a restrictive `*_customer_portal_scope_policy` so a portal session reads only its own customer's projects (same-organization/different-customer live RLS coverage added); the portal checklist's completed-job evidence comes from the narrow read-only `app_completed_job_ids_for_project()` probe (SECURITY DEFINER, same shape as the job probe — verified live that it answers under a portal session while a direct jobs read returns zero rows), used only on the portal path — jobs RLS untouched, staff paths keep the plain jobs read; the recorded warranty `endsAt` now renders as "Expires" in the warranty frame and "Coverage ends …" in the portal handoff section, "Not recorded" when absent, never an invented date. Follow-up noted, not done: `markReady` still uses the recheck-then-write shape — making its write conditional the same way as handoff is a separate change.

Evidence-failure repair (2026-11-25, run 45553851005): the first browser-evidence run failed B2/C1b/D1/E1 and all 8 viewport captures on one product defect — the Closeout tab rendered no "Closeout and warranty" heading (only the separate warranty tab carried that title), so the contract marker was absent. `CloseoutTab` now renders the heading as its own section title (18px Space Grotesk, matching the design contract's Section scale), with a failing-first source test in `closeout-workspace.test.ts`. The same run exposed three script weaknesses, fixed in the capture script without changing the contract: C3's UI-verify wait keyed on the counts line, which is already true after resolve — it now waits for the Verify control to disappear or a form error to appear, and surfaces the form's error text; E2's document 500 arrived with no body — `staffProxyRaw` now attaches the truncated redacted response body to status-mismatch asserts; and every screenshot sat after its marker assert, so the failed run produced zero PNGs — captures are now best-effort before the assert in the B2 draft, ready/handed-off viewport, and portal loops, and portal-viewport failures record a page snippet to distinguish the "Portal access required" shell from a render miss. C3/E2/F1 mechanisms remain unproven until the re-dispatched evidence run: the verify service wiring, document brand helpers, and portal handoff probe are all null-safe/correct on static inspection, so the re-run is the live repro.

## Change-order approve/reject audit events — S068, implementation branch, 2026-11-24

Change-order approval and rejection now leave an attributable audit trail. `ChangeOrdersService.approve()` / `reject()` (branch `feat/s068-change-order-certification`, base main `c7717c69`) record an `ActivityEvent` after the successful status update via `ActivityTimelineService`: `entityType: "change_order"`, `eventType: "change_order.approved" | "change_order.rejected"`, title `Change order #N approved|rejected`, actor = the authenticated staff user passed through from the controller (`requireAuthContext(req).userId`), metadata `{previousStatus, newStatus, coNumber, projectId, amount}`. `change_order` is registered in the closed `IntelligenceEntityType` union (`app/modules/intelligence/types.ts`) by this PR, so the events are queryable through the typed filter (`GET /api/v1/intelligence/activity?entityType=change_order`). Previously both methods wrote only `status` plus the `approvedAt` / `rejectedAt` timestamp, with no actor recorded. No permission change: both routes still require `billing.write`. Approve/reject are now explicitly draft-only — `canTransitionChangeOrderStatus` returns true for same-status transitions (`from === to`), so approve-from-approved previously re-approved instead of 409ing; the service guards on draft status first, so every non-draft decision attempt is a 409 with no event recorded. No schema/migration change. Customer-portal approve/reject is blocked by design (ADR-010 limits customer-originated writes to signing pending contracts; the portal returns `changeOrders: []`) and was not built. No downstream roll-up exists: nothing reads an approved change order into estimate totals, invoice lines, or contract amounts — whether it should is a founder decision (S068 GAP-3). Live-PostgreSQL integration evidence (`app/tests/s068.change-orders.integration.ts`) is written to prove approval writes exactly one attributable event and leaves the linked contract `snapshot_json` and proposal pricing byte-identical; it is CI-verified-only (no Docker on the authoring VM, never cited as passed locally). Browser evidence is pending dispatch from `main` after merge; S068 stays `IN_REVIEW` until then.

## First-estimate onboarding — DES-3 slice 1, implementation branch, 2026-11-23

A dedicated first-estimate onboarding route now exists in the `feat/first-estimate-onboarding` branch (base main `255bbc41`), built on Billy's 2026-11-23 word to build DES-3 (Figma page 22 — Onboarding, `54:3`; the brief had recommended deferring). Signup, login, auto-provisioning, and the legacy `/finish-setup` recovery route are untouched. The dashboard (`web/src/app/(app)/dashboard/page.tsx`) redirects a brand-new organization — no projects and no draft/ready estimates, `crm.write` role, not skipped — to `/onboarding` before Today loads; any read failure fails open to the dashboard, and completing onboarding clears the redirect by itself because the created draft estimate makes the org non-empty.

The route (`web/src/app/(app)/onboarding/`) is a two-step wizard following the framed Step 3 (`58:2` / `59:4`, verified against the Figma MCP): Step 1 picks trade types, Step 2 is the scope composer with the Figma example jobs (including the garage-floor painting text verbatim), a known-context work chip, the four "What TradeOS does next" steps, and the "Build My First Estimate" CTA. Step 1 has no Figma frame — it is the minimal rail flow the DES-3 brief describes. Deferred setup (Company, Pricing depth, Payments, Team) is shown as explicitly non-blocking. The completion action (`web/src/app/actions/onboarding.ts`) creates the Project (name derived from the scope, first work type as `jobType`, scope as `simpleScope`), creates a draft Estimate, and lands on the draft estimate workspace. No draft is staged at completion: `generateDraft` persists only generation metadata, not retrievable line items, and there is no endpoint to fetch a staged draft, so a draft POST would discard its result — Athena review generates the draft on demand from the persisted scope instead. An estimate-create failure redirects to the saved project instead of retrying the create. Skip sets a browser-scoped cookie (`tradeos-onboarding-skipped`, 180 days) and returns to Today. The first-run gate reads projects bounded (`GET /api/v1/projects?limit=1`), and `/onboarding` is in the session-refresh proxy matcher so a returning local-auth user is not bounced to login on token expiry.

Deliberate slice-1 boundaries: the wizard is session-scoped — there is no persisted onboarding state, skip/resume, or migration (no schema change in this PR). The labor baseline and region were removed from the wizard (Codex review, PR #1043): no organization-defaults persistence path exists for them, so asking for inputs the estimate cannot use would be contractor-visible unfinished UX; labor/region defaults return with the persisted-onboarding follow-up slice (migration + RLS). Draft persistence + hydration is likewise a follow-up slice (storage + GET + migration). Athena review does not auto-run on landing — the user continues from the workspace's existing Athena review button. Four-width authenticated staging acceptance is still owed. This is pending exact-head CI/review/merge; nothing is deployed. Prior art: PR #731 (closed unmerged 2026-10-16 by the founder, branch `feat/p0-first-estimate-quickstart-20261013` retained) built a single-screen quick start on the same route; this slice is a fresh build against current main and the DES-3 scope, not a continuation of that stale omnibus branch.

## First-estimate onboarding — DES-3 slice 2 (persisted state), implementation branch, 2026-11-25

Slice 2 persists what slice 1 kept in the browser: an org-scoped onboarding-state record (migration `20261125120000_add_organization_onboarding_state`, table `organization_onboarding_states`, one row per org: `status` in_progress/skipped/completed, `currentStep` 1–2, `workTypes`, `scopeText`, `laborRateCents` $1–$500/hr default 4800 = $48/hr, `region`, `skippedAt`/`completedAt`; forced RLS with explicit per-role policies — owner/admin/estimator/dispatcher may write, viewer/technician denied, no `current_app_can_write()` fallback). New API group `/api/v1/onboarding` (`app/modules/onboarding/`, controller + routes, `crm.read`/`crm.write`): `GET /state`, `PATCH /state` (upsert progress), `POST /skip`, `POST /complete`. A skipped row reopens on a later progress save; a completed row keeps `completed` while its defaults may still update.

On the web side the skip is now org-scoped (`POST /skip` via the skip action, failing open to the dashboard) and the slice-1 browser cookie is set only as a failure fallback when the persisted skip write fails (Codex P2, PR #1105 — without it a failed skip bounces the user back to /onboarding in a loop); it is read as a legacy fallback in the first-run gate, which also reads the persisted skip. The wizard resumes where the org left off: the page loads state server-side and passes it as `initialState` (step, work types, scope, region); Step 1 asks for an optional region — the labor-baseline control was removed per Codex P1 review on PR #1105 (no estimate-pricing consumer reads it yet, so collecting it promised a rate the first estimate never applied; completion still records the $48/hr default on the state row for the follow-up wiring slice) — with a work/region context chip on Step 2; step transitions save progress best-effort through a new `saveOnboardingProgressAction`, which sends explicit nulls for cleared scope/region so deleted text is not restored on resume (Codex P2, PR #1105); completion persists the final answers and marks the record completed best-effort after the draft estimate is created — a persistence failure never blocks the redirect. Deliberate slice-2 boundary: labor/region live ONLY on the onboarding-state record — they are NOT copied to `organizations.default_labor_rate`/`region_code` (owner-managed settings values the estimate engine reads from neither today); wiring the estimate engine to the persisted baseline is a follow-up. Draft persistence + hydration remains a follow-up slice; the Athena auto-run on landing is slice 3 (see below). Four-width authenticated staging acceptance is still owed for the wizard as a whole. This is pending exact-head CI/review/merge; nothing is deployed.

## First-estimate onboarding — DES-3 slice 3 (Athena review auto-run on landing), implementation branch, 2026-11-25

Slice 3 removes the slice-1 boundary that the review waited for a click: onboarding completion now lands directly on the Athena review route (`/projects/:id/estimates/:estimateId/assist?autoReview=1`) instead of the builder, and the review generates the structured draft once on landing. The assist page reads `searchParams.autoReview` (exact-match `"1"` only) and passes `autoRunReview` to `AIEstimateAssist`, which fires the existing `runReview` mutation once on mount — ref-guarded against re-renders and React StrictMode double-effects, gated on a non-empty scope and no existing draft, reusing the manual path (no second fetch, no draft staged at completion, still review-only: nothing reaches the estimate without the user's accept step). A failed auto-run surfaces through the existing generation error alert and the manual "Run Athena review" button stays available. Every other landing — including the builder's "Athena review" button, which navigates here without the param — stays manual. The builder and its DES-10-F6-converged stage actions (`StickyTaskAction`) are untouched. Deliberate slice-3 boundary: no draft persistence + hydration (still a follow-up slice), no engine wiring for the persisted labor baseline. Four-width authenticated staging acceptance is still owed for the wizard as a whole. This is pending exact-head CI/review/merge; nothing is deployed.

## PR Commander — autonomous PR coordination — 2026-11-10

Branch `feat/pr-commander-autonomous` (base main `2b116767`), draft PR
pending. `.github/workflows/pr-commander.yml` plus
`scripts/pr-commander.mjs` / `scripts/pr-commander-lib.mjs` (48/48 unit
tests passing) sweep every open PR hourly at :17 UTC and on
`pull_request` events, evaluate each against the unchanged merge bar, repair
deterministically repairable findings, request CodeRabbit re-review, and
enable native auto-merge only when every gate passes at one exact head SHA.
**Status: dry-run only, not activated.** The arming variable
`TRADEOS_PR_COMMANDER_WRITE_ENABLED` does not exist yet by design; Billy
enables it only after the activation checklist in
[PR Commander](PR_COMMANDER.md). Founder-only boundaries changed 2026-11-21: review dismissals, staging-apply gate clicks, and production touches are no longer founder-only (blanket authorization). The Commander workflow itself still never dismisses a review, undrafts a PR, applies staging-apply gates, or touches production (no paths for those actions); undrafting a draft that is not READY and ruleset changes remain founder-gated. Copilot Agent Merge is not available as a
delegation path (0 org seats, quota failures — verified 2026-11-10).
Operating docs: [PR Commander](PR_COMMANDER.md) and
[PR Commander configuration](PR_COMMANDER_CONFIGURATION.md). First live
dry-run sweep still owed after the PR lands; the workflow has never executed
on GitHub.

## Invited PDF beta evidence — local candidate, 2026-11-06

Founder selected a free 1–3-business beta ending at contractor-delivered Proposal PDFs with reviewed AI assist included. A local `beta_pdf` scenario extends the existing evidence runner without changing application APIs, schema, permissions, pricing or existing scenario defaults. It adds authenticated PDF transport/receipt retention, Proposal reload checks and foreign PDF denial, and requires exact SHA/current-run artifacts. S053 assertion-name drift is repaired. This is unmerged source, not deployed acceptance. Clarification persistence, documented deck/Estimate→Proposal discrepancies, environment/RLS/recovery proof and onboarding gates remain HOLD in [the beta runbook](operations/INVITED_BETA.md).

## Estimate Apply saved-line identity — implementation branch, 2026-11-04

The rebased `feat/figma-to-code-completion` slice extends structured Apply idempotency acknowledgements with the matched saved-line ID and reconciles acknowledged lines through the existing authorized, organization-scoped Estimate detail read before showing Saved & verified. A missing read, missing line or target/quantity/description mismatch remains unconfirmed and preserves the retained request for explicit retry. Review-only skips do not count as saved, and verified saved identity does not certify current pricing evidence. See [AI Estimate Assist](modules/ai-estimate-assist.md#saved-line-identity-reconciliation--2026-10-31). This is pending exact-head CI/review/merge; deployment and full-workflow readiness are unverified.

Saved-line verification also compares against the retained Apply request (quantity within the persisted Decimal(12, 4) rounding, description when the request supplied one): an idempotent retry that acknowledges a line edited in another tab after the apply no longer certifies values that differ from the accepted review. (PR #941 Codex review fix, ported to main 2026-11-07.)

## Job expenses / actual job costs — Issue #885 implementation, pending release

The first-party Job Expenses workflow is implemented in the `feat/885-expense-payment-responsibility` branch (PR #891), not verified as deployed. The baseline `20261102020000_add_job_expenses`, payer `20261102074000_add_job_expense_payment_responsibility`, and extended `20261102081500_complete_job_expenses` are additive migrations. Existing expense rows remain contractor-paid by default. The new columns provide a USD currency marker, description, unique per-job idempotency key, private receipt metadata, and void provenance. `JobExpenseEvent` preserves append-only create, update, receipt-link and void history; forced RLS and job/org joins constrain access. The migration requires reviewed staging application and live RLS evidence before production.

`/api/v1/jobs/:jobId/expenses` validates cents, dates, category, payer and organization/job scope. Atomic insert-with-conflict protection prevents double-posting the same expense even during concurrent retries; reuse of a key with different values is rejected. Edits and soft voids are auditable. The dedicated `POST /:expenseId/receipt` registers a bounded, job/expense-owned storage path; `GET /:expenseId/audit` returns the history under the same scope. Private receipt uploads use the existing server-only storage client with post-auth authorization, capped size and JPEG/PNG/PDF signature checks; receipt downloads authorize the exact job and expense before retrieving from private storage.

In the mobile `/field` workspace, technician, owner, admin, and dispatcher sessions pass the page gate (founder decision 2026-11-03, wider gate kept in PR #891); manager and any other role stay denied, and the project-page field link helper admits the same four roles. Authenticated job/organization authorization still applies to viewing, recording, editing, voiding, and attaching receipts. Contractor-paid actuals and customer-paid items are separate; voided items are retained but excluded from totals. The quoted estimate is displayed separately and must not be labeled actual profit. Job-specific earned revenue is not yet modeled, so the summary explicitly leaves `recognizedRevenueCents` and `profitCents` null rather than inventing profitability. Authenticated browser checks, storage credential provisioning, staging migration verification, and required exact-head CI and review gates are outstanding until confirmed.

Review hardening in PR #891: a keyed create retry is compared against the immutable `created` audit-event snapshot, not the row's current fields, so an edit, receipt link, or void after creation no longer turns a retry of the original submission into a 409 (a mismatched payload still conflicts; legacy rows without a created event keep the current-field comparison). Receipt attach verifies the exact object exists in the `project-files` bucket when storage is configured (missing object → 400, verification failure → 502, unconfigured storage → check skipped, preserving prior behavior). `/ready` now also requires the expense migration columns (`job_expenses.payment_responsibility`, `receipt_storage_path`, `idempotency_key`, `voided_at`, `job_expense_events.expense_id`), so readiness stays `not_ready` until the expense migrations are applied — apply them before relying on a ready deployment for expense traffic. The branch is reconciled to current main; the shared `4.25mb` server-actions cap in `web/next.config.ts` serves both expense receipts and brand images.

## PR #810 branch currency and staging release state — 2026-11-02

The accepted-proposal Job handoff branch is being reconciled against current main; neither merge nor production release is authorized by this note. Staging already applied the Job provenance migration once (67 completed migrations, zero unfinished as checked); API-only source promotion #837 merged, and frontend promotion #904 remains draft. The separate Job Expenses migration is missing from the 68-file staging source inventory, so the protected staging release candidate is not migration-parity certified. Protected binding attestation run 41106407474 passed, with sensitive fields runtime-inferred, not independently secret-project-verified. Authenticated step-9 tenant, concurrency, rollback and four-viewport evidence remains outstanding; do not repeat the completed Job migration or claim acceptance.

## Authenticated private contractor-logo loading for PDFs — pending release

A proposed backend service reads the active `SettingsAssetUpload` row for the already-authenticated organization and only the `logoUrl` slot. It rejects cross-tenant paths and MIME mismatches before a bounded, no-redirect Supabase Storage download from the private `project-files` bucket. Only PNG/JPEG bytes within 1 MiB and PDFKit pixel limits reach invoice/contract/proposal renderers. Missing credentials or unsafe images produce the existing company-name PDF rather than errors. Backend `SUPABASE_SERVICE_ROLE_KEY` must be provisioned as a protected server-only secret by the environment owner; metadata access is still subject to existing request-scoped RLS. No production secret was read or provisioned and no actual customer PDF acceptance is claimed. Issue #870 remains open until authenticated staging visual verification, environment provenance and output checks pass.

## PDFKit trusted-logo byte rendering — merged primitive; storage bridge pending acceptance

A new no-network PDF rendering helper validates bounded PNG/JPEG bytes (1 MiB, 2048px max edge, 2 MP max area) and draws them in invoice, contract, and proposal header slots. Malformed/unsafe inputs fall back to the contractor's company-name text. PNG logo bytes additionally prove their pixel stream decodes before PDFKit touches them (`isDecodablePngImage`, applied in `drawValidatedPdfLogo`): a header-valid PNG with corrupt IDAT or a bad scanline filter byte fails closed to text instead of hanging or crashing the render, matching the proposal-signature path (PR #1094 follow-up). Tests cover image embedding and rejected payloads. PR #873 implements the organization-scoped private Storage byte reader, enabled only with protected backend credentials. No public bucket or arbitrary URL fetch is added. Staging credential provenance, seeded same-tenant image, cross-tenant tests, and PDF visual acceptance remain open under issue #870.

## Contractor-brand-only proposal PDF headers — merged PR #868

Issue #870 local visual fixtures showed that a wrapped company name could overlap the title. The shared header measures the name and title, expands the dark header, and restores the left margin for contact details after both logo and tagline rendering. Authenticated staging acceptance is still pending.

Proposal PDF generation already resolves the authenticated organization's Brand Studio values. The proposed repair removes the unconditional large TradeOS label from both proposal PDF header variants; the opt-in `showPoweredByTradeOS` footer remains unchanged. Jest regression coverage exercises an actual PDF buffer for both white-label and opt-in states. No customer/tenant identity, proposal financial content, estimate totals, authentication or API contract changes. GitHub exact-head CI and visual PDF acceptance remain required. The renderer supports bounded logo bytes and PR #873 adds the org-scoped loader. Live uploaded-image appearance remains unverified because staging has no active logo asset.

## Next.js starter-asset cleanup — merged PR #869

The proposed brand cleanup deletes only the five unused starter SVGs under `web/public/`: `vercel.svg`, `next.svg`, `file.svg`, `globe.svg` and `window.svg`. A repository code search found no references to these filenames in application source; canonical TradeOS entry SVGs, browser/iPhone icon routes, Android icon routes, and the manifest are preserved. This is not a removal of the Vercel hosting integration or Vercel Speed Insights. Exact-head CI, deployed route regression checks, and review remain release gates. No production deletion or deployment is claimed.

## Transactional email platform branding — merged PR #847

Security, team invitation and customer portal access email HTML now uses one graphite/copper TradeOS platform shell, while existing copy, one-time URLs, expiration notices, plain-text alternatives and delivery idempotency remain unchanged. Customer document branding remains organization-specific and is not modified. Unit coverage for the shell is added; hosted tests, email-client rendering and provider-delivery checks remain separate gates. No deployment or delivery certification is claimed.

## Resend delivery-event journal — merged PR #957 (2026-11-17, `9c46ed04`), issue #927

A durable, tenant-safe delivery journal and signed ingress-to-journal route are implemented in merged PR #957 (branch `feat/resend-delivery-journal-927`); the branch was reconciled with current `main` after PR #937 merged: additive migration `20261105220000_add_resend_delivery_journal` adds forced-RLS `email_delivery_messages` (outbound journal, unique `provider_message_id`, nullable `org_id` for user-wide password resets, recipient digests only) and `email_delivery_events` (verified inbox keyed by `svix-id`, allowlisted metadata plus payload digest only). `app/modules/email/deliveryJournal.ts` processes verified events idempotently with org attribution resolved only from the journal row; `app/db/resendDeliveryJournalStore.ts` is the server-only write path behind the transaction-local `app.resend_webhook` flag. Outbound recording is wired at the auth (password reset, team invite) and customer-portal send call sites and is best-effort — a journal failure never changes the user flow. The signed Resend route now verifies the raw request, commits the journal transaction, and acknowledges only after commit; database failures return a retryable 503. No suppression is performed; bounces/complaints only set a `suppression_candidate` flag (see `docs/modules/resend-delivery-suppression-policy.md`). The staging migration is NOT applied and no webhook is registered; both need separate approvals. Unit, live-DB RLS integration, and ingress tests cover the contract.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## TradeOS Android install icon extension — dependent implementation branch

A follow-up branch based on PR #843 adds 192x192 and 512x512 PNG route handlers plus a 512x512 maskable icon with a smaller safe-area mark. The web manifest points to these routes and retains the existing iPhone Apple icon. Assets are generated from the canonical entry mark. These changes are not deployed; exact-head build, route image responses, and real Android install behavior remain unverified. This branch depends on the parent branding PR and must not be merged independently before its base is integrated.

## TradeOS browser and installed-app branding — PR #843, 2026-10-31

The proposed frontend change replaces the generic dashboard-header chevron with the existing cinematic-entry TradeOS vector mark. It adds Next.js metadata icon routes (`/icon` and `/apple-icon`) and a web manifest (`/manifest.webmanifest`) using graphite/copper branding. The default `web/src/app/favicon.ico` has been deleted to avoid overriding the TradeOS icon in browser tabs. No backend, tenant permissions, financial data, or schema changes are included.

This is proposed code, not deployed or certified behavior. Required final-head frontend lint/typecheck/build and repository checks, deployed browser favicon rendering, and iPhone Safari Add to Home Screen validation remain release gates. Existing iOS shortcuts may cache an old icon and require recreation. Android maskable icon assets, social preview metadata/artwork, and document/email brand consistency remain separate follow-up work.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## TradeOS Android install icon extension — dependent implementation branch

A follow-up branch based on PR #843 adds 192x192 and 512x512 PNG route handlers plus a 512x512 maskable icon with a smaller safe-area mark. The web manifest points to these routes and retains the existing iPhone Apple icon. Assets are generated from the canonical entry mark. These changes are not deployed; exact-head build, route image responses, and real Android install behavior remain unverified. This branch depends on the parent branding PR and must not be merged independently before its base is integrated.

## TradeOS browser and installed-app branding — PR #843, 2026-10-31

The proposed frontend change replaces the generic dashboard-header chevron with the existing cinematic-entry TradeOS vector mark. It adds Next.js metadata icon routes (`/icon` and `/apple-icon`) and a web manifest (`/manifest.webmanifest`) using graphite/copper branding. The default `web/src/app/favicon.ico` has been deleted to avoid overriding the TradeOS icon in browser tabs. No backend, tenant permissions, financial data, or schema changes are included.

This is proposed code, not deployed or certified behavior. Required final-head frontend lint/typecheck/build and repository checks, deployed browser favicon rendering, and iPhone Safari Add to Home Screen validation remain release gates. Existing iOS shortcuts may cache an old icon and require recreation. Android maskable icon assets, social preview metadata/artwork, and document/email brand consistency remain separate follow-up work.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## Platform social link preview — pending verification, 2026-10-31

The proposed TradeOS root social metadata declares a 1200x630 Open Graph image and Twitter large-card preview using the canonical entry mark and "BUILT FOR WHAT YOU BUILD." branding. The image is generated by the Next.js `opengraph-image.tsx` route. Static source tests verify the route's dimensions, mark reference, and metadata wiring; hosted TypeScript/build, image rendering, external social scrapers and deployed URL visibility remain separate verification gates. This is platform branding, not customer document or tenant-brand overrides.

## Frozen Apply recovery — 2026-10-31

Full review now retains one Apply payload across an unconfirmed response, blocks concurrent edits/generation and ignores obsolete-record callbacks. A first-attempt known server refusal permits correction; a later refusal cannot erase uncertainty from an earlier lost response. See [AI Estimate Assist](modules/ai-estimate-assist.md#frozen-apply-recovery--2026-10-31) for the owning contract and verification boundaries. Saved-line identity, authenticated acceptance and financial fixture continuity remain separate gates; no full-workflow or deployment certification is claimed.


## Estimate full-review scope continuity — 2026-10-31

The builder's header and contextual Athena review entry now share one guarded navigation path. Dirty draft scope is saved through the existing Project PATCH before navigation; failed saves retain the editor and never navigate, duplicate entry is blocked, and leaving the record suppresses late navigation. Unchanged scope and finalized estimates do not gain a new write. The builder is keyed by Project/Estimate so record changes start fresh local draft state.

Full review reads the authorized Project response, verifies that it owns the requested Estimate, and seeds the editor with saved `simpleScope`. Missing or mismatched pairs fail closed. It still starts without suggestions or a structured draft; generation and Add remain explicit. No scope is placed in URLs/browser storage, and no auth/RLS, schema, pricing, or backend contract changes.

This implements the intent of the Figma full-review continuity targets (390 `1098:30215`, 768 `1098:30274`, 1024 `1098:30333`, 1440 `1098:30399`), not full visual parity or end-to-end readiness. Local focused validation: 9 behavioral navigation/record-pair tests plus 15 existing Estimate mobile contracts passed (24 total). Full web tests, lint, TypeScript/build, component/browser and authenticated persistence/tenant evidence remain required; this environment contains only fetched source snapshots and has no web dependencies. Initial head 73702f3 passed 561 web tests, 47 existing component cases, lint/build, docs and 189 PostgreSQL integration tests. Code head `6c8056e` then passed [Verify repository 41218673255](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/41218673255): 561 web tests, all 51 component cases (including four new real-Builder cases at 390/768/1024/1440), web lint/build/type checking and 189 PostgreSQL integration tests. The four retained failure screenshots were inspected. A subsequent cleanup only removes the unused fixture variable found by code-quality review; final-head checks remain a merge gate. Synthetic router/transport do not establish authenticated durable reload or tenant denial. No merge, deployment or completed numbered sprint is claimed.


## Estimate quick-create partial-failure recovery — implementation branch, 2026-10-29

The Today and Universal Create estimate path saves a Project before posting a
draft Estimate. On `fix/estimate-create-saved-project-recovery`, a failed or
ambiguous Estimate POST redirects to the saved Project with an explicit notice
to inspect its Estimates before starting another. The form is not submitted a
second time, so the recovery does not create another Project automatically.
Successful Estimate creation still opens the existing Estimate Workspace.
This bounded frontend change does not add backend idempotency, infer whether an
ambiguous POST committed, or certify an authenticated browser journey. Merge
and deployment remain subject to current-head checks and repository review.

## Cinematic sign-in entry — implementation branch, 2026-10-24

Founder-approved entry presentation is implemented on `feat/cinematic-entry`
from main `7013cdcaab8faabcb9c0dd8e7a045ac776c9c748`. `/login` now uses the
approved full-screen copper mark/wordmark introduction and centered sign-in
scene. Initial visits use four seconds; returning visits use 2.5 seconds.
Reduced motion bypasses the introduction; Skip/Escape and a metallic vector
fallback keep entry usable without WebGL, storage, or a loaded renderer chunk.

The existing `loginAction`, session/bootstrap logic, dashboard destination,
password recovery and account creation remain authoritative. No simulated
success state, inspection controls, auth policy, backend, database or workspace
theme changes ship. Route-local tokens and self-hosted fonts live in
`web/src/components/entry/entry.module.css`; the canonical brand exception and
component owners are recorded in `.stitch/DESIGN.md` and `docs/ui-guide.md`.

Software-renderer guard (2026-10-30): on software rasterizers (SwiftShader,
llvmpipe, Windows WARP via the Microsoft Basic Render Driver) the cinema
skips the PMREM environment pass; an unknown or unavailable renderer name
counts as software too. The pass itself is fast, but its deferred cost
blocked the main thread past the intro exit timer in GPU-less environments,
so the first intro overstayed its scheduled four seconds and the component
suite's intro-timing test failed. The scene lights still shade the metal
there; hardware renderers keep the full reflective environment. Approved
4s/2.5s timing, Skip/Escape, focus restoration, and the reduced-motion
bypass are unchanged.

Wall-clock verification (2026-11-06): a live probe measured the film
covering the staging login for ~23s, but staging predates the guard above
(it runs a deployment whose cinema chunk lacks the PMREM skip), so that
overstay is pre-fix behavior, not a defect on current main. On current
main, in a real browser, the film dismisses on schedule once mounted:
first-visit 4.1–4.6s and returning 2.5–3.0s (intended 4s / 2.5s), measured
in-page with a MutationObserver. The component suite gains a real-browser
wall-clock regression test for this (the existing timing test uses
Playwright's virtual clock, which masks real main-thread blockage) that
asserts the film is gone within 5.5s first-visit and 4s returning
(intended durations plus 1.5s slack), measured from mount, and that the
film no longer intercepts pointer events after dismissal. A module-scope
preload of the cinema chunk was tried and reverted: it did not change the
measured dismissal times, and it broke the existing virtual-clock timing
test (the chunk's evaluation block during bundle load leaves the
accessibility tree stale after reload, so the dialog is not found by role).
No source change ships with this verification; staging still needs a
promotion to a build that includes the guard above.

Historical Chromium download block: the earlier local component-browser run
was blocked before launch by a missing Chromium binary after the official
download returned an invalid archive. That limitation is resolved for this PR:
the cached Chromium headless shell was reused, and the current PR head reports
553 frontend unit tests and 47 Playwright component tests passing, with lint,
TypeScript, production build, dependency audit, and docs checks passing.

The real entry component was visually inspected in an isolated browser harness
with synthetic transport. This does not certify successful authentication,
deployed behavior, Lighthouse scores, or actual GPU rendering. Review and
deployment verification remain separate gates.

Entry control parity (2026-11-23, issue #1026): the Email/Password inputs and
Sign in button now render 48px per canonical Figma frame 548:2780
(`entry.module.css` `.field input` and `.primary` heights 54px → 48px); the
password visibility toggle keeps its 44px target with 2px vertical margins
inside the 48px field, and the Forgot-password link stays 44px. The email
label reads "Email", matching Figma. `docs/design/ENTRY_CONTROL_PARITY.md`'s
`min-h-12` prescription was never applied and is superseded — the heights
live in the entry module. Rendered geometry at 390/768/1024/1440 still needs
browser evidence.

## Field authorization evidence — PR #702

The Field page now has executable denied-role tests, alongside its static
UI/action contract checks. Missing authentication and non-technician roles
return before job requests, including direct job links. JobsService tests
assert unassigned technician reads/transitions fail without status or activity
writes. A disposable-PostgreSQL test covers both an unassigned job and a same-org job assigned to another technician against raw reads and updates, with service denial for the unassigned case. Hosted integration and repository checks passed at the merged PR head; local Docker was unavailable. No RLS, authorization policy,
storage implementation or field capture capability is changed or certified.
## Proposal draft status-check recovery — 2026-10-29

The finalized Estimate Review links to the existing Proposal Review form with its `estimateId`. That form creates a draft through the existing proposal action; customer send remains a separate explicit action, and returned errors preserve edited fields.

The form's API-error state provides a direct link to the same authenticated Project's Proposals tab (`?tab=proposals`) so staff can inspect the list before manually retrying. Local payment-schedule validation stays inline. This is a navigation aid, not a server status lookup or idempotency guarantee: it does not auto-retry or infer the POST result. Authenticated runtime behavior and tenant-denial evidence remain separate verification gates.

## Web performance telemetry — PR #744

The Next.js root layout includes Vercel Speed Insights for browser performance
measurements. The dependency is scoped to `web/`; the JSON-only Express API
does not load a browser telemetry SDK. This does not certify production metrics
collection or enable the optional service in the Vercel project dashboard.


## API validation security prerequisite — 2026-10-27

Existing PR #795 is extended to repair the dependency audit blocking Today 2.0 PR #798. The isolated runtime branch retains dotenv/Vercel patch updates, adds patched Zod 4.6.7 including Vercel's transitive validator, and includes body-parser 1.20.9 from #799. The previous identifier syntax contract is preserved using `z.guid()`; record and enum pipeline compatibility repairs do not alter JWT/membership, permissions, RLS, financial or supplier policy. No production change or merge is claimed. Full verification and PR-only major-upgrade review remain required; the independent moderate ip-address patch is tracked by #786. See [runtime upgrade evidence](architecture/API_VALIDATION_RUNTIME_UPGRADE.md).

## Today AttentionItem component proposal — 2026-11-01

PR #841 (`feat/today-attention-item-figma-align`) merged as `335841c0357d75da982e397e6f43d2bc3f2bbbf8`. It extracts the existing Today Needs You row into a reusable, responsive `AttentionItem` component, mapping persisted priority to Info, Action, and Urgent presentation while preserving the existing source data and open-item action. Figma source: master file `xImUa9CYUjx3Cb3zTrkfnY`, node `16:42`. Vercel production deployment `dpl_3usxyViVgRZNwGHUHWsrB963gvcN` is READY on `app.404tradeos.com`. Figma Code Connect metadata inspection is blocked by the connected seat's access level. See [Figma traceability](design/CORE_WORKFLOW_FIGMA_CODE_TRACEABILITY.md).



## Needs You filtered-empty recovery

The Needs You view offers **All actions** when active filters return zero loaded records. It clears search, source, priority, and assignee in place, restores search focus, and announces the updated loaded-row count. Source failures and unknown totals keep their existing semantics. The reviewed Figma targets are [desktop](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1338-3201) and [mobile](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1338-3272). Authenticated staging acceptance remains pending.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:3c19130944cc740d6232b00915b934562264d7e39c1fa953c77383bfbf6d17e8 -->

### Post-merge follow-up risks ([PR #1121](https://github.com/404TradeOS-LLC/TradeOS/pull/1121))

- **Hosted verification is unconfirmed for the final revision.** The [run cited in the PR description](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/45760744650) was reported in progress and cited alongside the earlier `bb268593` head. The [later Codex review](https://github.com/404TradeOS-LLC/TradeOS/pull/1121#issuecomment-7207606659) completed with no findings on `3ad8df8`; that review does not establish a hosted CI result. Confirm the required checks against the final PR head and retain the run links with their SHAs and conclusions. The squash commit on main is `1e882b2528c11ff1fde3505a8a9ace482edfa05f`.
- **Authenticated reset behavior still needs staging evidence.** The four responsive cases used packaged Chromium with synthetic responses, and the observed staging web candidate lacked a matching API deployment. Once an approved staging web/API pair serving the merged change is available, record both deployment revisions and exercise `/dashboard/needs-you` at 390, 768, 1024, and 1440 px in a test tenant. Record the loaded row identities before filtering, apply search, source, priority, and assignee filters to reach zero matches, and activate **All actions**. Verify all four defaults, the return of the same loaded rows, the result announcement, search focus, and visibility above the Control Dock. Include touch activation at 390 px and keyboard activation, and verify that a partial-source case still reports an unknown total with its unavailable-source indicator intact.
- **The design sample can be read as loading additional actions.** The read-only Figma master currently returns from one action to the six-action canonical sample. Once edit access is restored, align the linked desktop and mobile reset frames so the before-filter and post-reset states show the same underlying loaded records and the same total semantics.

The merged handler filters the existing authenticated snapshot and does not request or write data. The diff adds no access, tenant isolation, API contract, or migration change.


<!-- /coderabbit-ai-generated:v1 -->

## Today 2.0 implementation branch — 2026-10-26

PR #798 continues on `feat/today-2-command-center` (`EXISTING_WORK_FOUND`, Sprint ID NONE). Today, Needs You and Work share authenticated source data, operational indicators, contextual source workspaces, semantic themes and the persistent five-slot Control Dock. Previous head `fdcc63cc6c6a28d94c8642e9e821857fda729960` passed 518 frontend tests, 20 Chromium component tests and hosted PostgreSQL integration/migration rehearsal (run 40427077847). Its real Vercel Preview is READY; unauthenticated dashboard redirect to login was observed. Secure sign-in was declined, so authenticated live-data journeys remain unverified.

The current continuation adds task-status editing to the contextual workspace for existing `crm.write` roles, using the established authenticated project-task PATCH endpoint and its transactional activity record. Controls require a structured source task/project target and canonical write permission. A save is reported only after the server confirms the same record and requested status. Pending saves block duplicate submission and dialog dismissal; offline edits send no request; failures preserve the unresolved source. A successful save refreshes all operational data from source truth. The existing task PATCH now accepts optional `expectedUpdatedAt`; Today uses a guarded status-only route that requires this source revision and fails closed on older backends. The atomic update rejects stale/concurrent saves with 409 and advances revisions even within one millisecond; legacy clients can omit the guard. No rejected save records an activity event.

Real stale proposals, overdue invoices/tasks/jobs, blocked tasks, conflicts and pending approvals feed Needs You; passive drafts remain separate. Counts retain unknown/partial semantics. Distinct people are not invented crew groups. The backend addition is the optional task revision precondition; no schema, role, JWT/membership, RLS, financial or supplier policy changes. Field Task writes, unsupported visit/crew/milestone aggregation and broader Athena confirmation/execution remain acceptance gaps. Current continuation verification belongs in [Today 2.0 implementation evidence](architecture/TODAY_2_IMPLEMENTATION.md); earlier results do not certify a later head.

## Openings and dishwasher catalog gap — source branch, 2026-10-18

PR #774 on branch `feat/costbook-openings-appliance-gaps-20261018`
is retargeted to main after parent PR #773 merged as `ef983efc` (and #771). Adds three distinct
unpriced EA source recipes: flanged vinyl window for **new construction**
(CSI 08 53 13, NAHB 4000), sectional steel garage door for qualified
installation (CSI 08 36 13, NAHB 4000), and ready-connection built-in
dishwasher (CSI 11 31 00, NAHB 5000). Manufacturer reference IDs
SRC-0071–SRC-0073 resolve to JELD-WEN, Clopay and GE installation pages.

All price, labor, product choice, construction, utility, and permitting
conditions still require estimator validation. A combined 107 templates
are proposed, not merged/installed/deployed or authenticated verified
by this status entry. New research templates reuse costbook.write,
tenant mapping, review and installed Estimate snapshot behavior.

> **Correction (2026-11-23, docs lane — plan-staleness corrections):** the
> sentence above is stale. The 107 templates are merged on main: #771 (88
> research recipes, squash `15d7e0c7`, 2026-10-19), #773 (2 kitchen-gap
> recipes, squash `ef983efc`, 2026-10-23), #774 (3 openings/appliance
> recipes, squash `e17a166d`, 2026-10-23). 105 are installable; 2 remain
> install-blocked on unregistered sources SRC-0049/SRC-0050 (issue #518).
> Authenticated browser verification is still owed (issue #518 S5). This
> correction is confined to this section; parallel lanes are editing other
> sections of this file.

## Kitchen assembly gaps — merged PR #773 (2026-10-23)

PR #773 on branch `feat/costbook-kitchen-assembly-gaps-20261018` extends
merged PR #771's research catalog with two additional scoped, unpriced kitchen
recipes: wall cabinet installation by EA, and straight-run prefabricated
laminate countertop by LF. Both are NAHB finishing phase 5000 and CSI division
12; source refs `SRC-0069` and `SRC-0070` are registered. The combined
catalog has 104 candidate templates. The work preserves per-tenant installation
and Estimate Engine snapshots, and expressly blocks EA-to-LF piece conversion.

No new wall-cabinet or laminate unit price was inferred. Stone/quartz slab
fabrication, sink/cooktop cutouts, kitchen fillers, backsplash and separate
mechanical/electrical scope are not silently included. PR #773 merged as `ef983efc` after all four required checks passed on
reviewed head `97709786`. Authenticated staging mapping/install evidence
remains a separate certification gate; no deployment is certified.

## Custom Item control ergonomics — implementation pending review

The Estimate Builder's existing Custom Item form now scopes 44px text inputs
to phone/tablet widths, keeps compact 32px text inputs at desktop widths, and
uses 44px Add/select controls and a 44px Taxable label target. Field labels
align at the top; the desktop Add action aligns with the text-input control
row rather than the bottom of wrapping cost help. Shared primitives and
other Estimate entry modes are unchanged.

This implements the bounded control ergonomics from the canonical Figma
Custom Item handoff (793:11017), not the entire illustrated shell. Request
payloads, explicit blank-cost gating, validation, pending/failure retention,
and success reset/refresh remain the existing contracts. Component-browser
evidence uses production React Query, Input/Button/Label and generated
Tailwind with controlled transport; it does not certify authentication,
tenant isolation, server persistence, or deployed runtime behavior.


## Estimate mapping keyboard repair — on main

The Figma mapping handoff keyboard work is on main (branch
`fix/estimate-mapping-keyboard` no longer exists in remotes; the picker
carries the contract and the component suite covers it). PR #781 is merged as
`979198fc86edbababf57029e8d73b7ea08a26191`; its retry behavior is already on main.
The existing starter-component picker still lacked combobox Arrow/Enter/Escape
navigation. This bounded frontend repair keeps focus in the input, skips
incompatible/already-mapped options, exposes the active descendant, scrolls the
active result into view, and closes on Escape/Tab. Enter selects only an active,
currently available result; pending/debouncing/failed searches cannot select stale
rows. Pointer selection and explicit Install then Estimate Add remain separate.
No backend, auth/RLS, pricing, snapshot or mutation contract changes.

The isolated Playwright component suite passed all four cases using Chromium
153, production React and mapping logic with synthetic query/Input fixtures at
390/768/1024/1440. The same 390px case failed against the base implementation
at its first ArrowDown active-descendant assertion. Its evidence does not
certify the authenticated full application, persistence or tenant isolation.
Authenticated full-app workflow evidence remains pending.

## Estimate mapping resolve screen — dedicated install-time gate

Selecting a starter recipe in the estimate builder now opens a dedicated
"Resolve required assembly mapping" screen instead of an embedded panel. All
recipe components map on one screen through the existing
`StarterComponentMappingPicker` and compatibility assessment, with
incompatibility reasons inline. A "Before you continue" checklist surfaces
the four already-enforced checks — mapped identity, unit/kind
compatibility, active organization access, and price-snapshot persistence
on the separate Add — and the explicit actions are "Resolve Cost item
mappings" (Install, then the existing separate Add) and "Keep draft
unchanged" (close with zero mutation; Install never fires). No backend,
auth/RLS, pricing, snapshot or mutation contract changes; the install gate
conditions are unchanged, only surfaced. This is the install-time gate only;
no re-resolve flow for saved estimates is added. The handoff step/state
matrix is covered by extended component evidence (checklist states,
resolve gating, install pending/failure, keep-draft zero mutation) and a
new intercepted Playwright matrix spec for the authenticated journey,
which still needs a signed-in session and draft route to run.

## Historical assembly rematch repair — PR #772

The second pass retains 18 additional historical supplier matches, yielding
153 raw component rows and 75 assemblies with partial material rollups.
Recipe quantities are preserved; ten-square synthetic rolls, 900-SF housewrap
rolls and a derived ten-LF sill allocation use explicit price conversions.
The exact 2-inch R-10 tongue-and-groove XPS observation replaces an ambiguous
edge match. Incompatible collated/bulk nails, cap-fastener lengths, unproven
foam adhesive/sealant/felt specifications and mechanically attached NailBase
remain unmatched. NailBase attachment is documented by CertainTeed at
https://www.certainteed.com/products/commercial-roofing-products/flintlastic-sa-nailbase.
These are dated research observations, not live quotes or bid-ready prices;
the existing audit boundary still excludes known first-pass false positives.

## Costbook researched assembly activation — PR #771 (proposed, 2026-10-18)

PR #771 on branch `feat/costbook-88-assembly-activation-20261018`
expands the existing 14 reviewed installable starter recipes with all 88
static `TradeosAssembly` recipes in the same Costbook and Estimate setup
path (102 browseable templates total). The researched set is explicitly
marked research, includes preserved component quantities and research
source IDs, and is NOT preinstalled or pre-priced. 2 recipes reference
absent source registry entries (SRC-0049–SRC-0050); API/UI block their
installation until those sources are verifiably repaired. (SRC-0041–SRC-0048
were registered 2026-11-21, DEV-23 / issue #518 S1; 9 of the 11 formerly
blocked recipes are installable.) NAHB phase
filtering and strict first-unit component mapping are added. Existing
tenant ownership, `costbook.write`, transaction-scoped assembly installs,
Cost Item lookup, and Estimate Engine snapshots remain unchanged.

Status: SOURCE IMPLEMENTATION UNDER REVIEW. Hosted checks are required;
authenticated staging/production execution is not certified. do not describe the 77 source-complete research
templates as price-ready without local mapping and estimator review.

## Items cost columns checkpoint — 2026-10-17 UTC

Reconciled main `41a62cea99c7bc91eda45d805e4b0363b8906132`: #760 progressive entry is merged as `17c339cf`, production READY `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL`; #761 explicit line-edit cost is merged as `41a62cea`, production READY `dpl_12gVocD7WKCA9vwgSp89YKc4apwi`. These are exact-source deployments, not authenticated workflow certification. Older pending/blocked statements below are historical.

Branch `feat/estimate-items-cost-columns-20261017` reconciles canonical Desktop Items `378:441` (Estimates page `4:10`, high-fidelity context/screenshot inspected). Existing saved items lacked quantity/unit-cost/line-cost columns and visible editor labels. Shared desktop column tracks now align actual saved values; mobile keeps the compact quantity × unit-cost summary and 44px edit actions. Six editor fields have visible, associated labels. Internal costs are explicitly distinguished from customer pricing; saved lineCost is rendered directly, never recomputed. Existing PATCH, draft/permission gates, validation, pricing and snapshots are unchanged.

The missing-header regression failed on the base; all 16 isolated layout/edit/entry/stage browser cases now pass across 390/768/1024/1440. Headers align with cells, cost text matches the response, labels/keyboard Cancel work, mobile targets fit and no horizontal overflow occurs. Every mutation is intercepted; synthetic reads are clearly labeled. Desktop 1440/1024 and mobile 390 renders inspected. Local Web 506/506, lint/build, governance 151/151, docs 40/40, ownership/preflight and Playwright discovery pass. Current branch is unmerged/undeployed pending exact-head hosted checks/review. Authenticated nonproduction persistence and tenant denial remain unverified.

## Estimate line-edit cost presence — 2026-10-17 UTC

Items entry #760 is merged as `17c339cf`, web production source READY at `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL`. The next bounded edit-cost branch repairs the same unknown-to-zero defect in `EditableLineItem`: clearing Unit cost kept Save enabled and the handler coerced the empty string to zero. Save and the handler now require explicit input, the required field explains intentional zero, and rejected edits announce an alert while retaining entered values. Numeric zero remains allowed by the existing backend contract. No backend financial, authorization or snapshot rule changes.

A 390px regression failed before the repair; all 12 isolated edit/entry/stage browser cases then passed across 390/768/1024/1440. All mutation requests were intercepted, so this proves frontend validation/recovery only. The new branch's checks/merge/deployment remain separate from #760's delivered source and from authenticated nonproduction certification.


## Estimate Items progressive entry — 2026-10-17 UTC

Main `f9a93dc4` includes responsive stages (#755), single-stage finalization recovery focus (#758) and updated persisted-price evidence instrumentation (#756/#757); #751 is closed without merge. The bounded Items branch `fix/estimate-items-progressive-entry-20261017` reconciles canonical Desktop Items `378:441`: saved lines remain central while Add assembly, Costbook and Custom item open the existing entry controls inline. Catalog entry filters source kinds and fetches only the selected source with a distinct cache key and explicit loading state; starter mapping, resolved unit-cost review and explicit Add remain authoritative. Draft fields and same-source selection survive closing/reopening; changing catalog kind clears its prior selection. Only active Items owns the search shortcut; opening a form focuses its first field.

A browser reproduction also confirmed an existing blank custom Unit cost became a numeric zero request. The form now requires an explicit cost before Add and guards the same input in its handler; intentionally entered 0 remains valid. No new Estimate write, pricing calculation, source trust or backend permission contract. New isolated browser coverage intercepts all mutations and uses explicit synthetic catalog reads, proving frontend interaction rather than backend persistence. Current branch delivery and verification are tracked by the handoff/PR; previous merged source delivery must not imply this branch is deployed. Authenticated nonproduction workflow and data-plane isolation remain unverified.


## Proposal failure input retention — 2026-10-16

The existing proposal creation form lost uncontrolled edits when its server action returned validation/API errors: React treated the returned error state as a fulfilled action and reset the fields. A real incomplete-payment-row reproduction restored the initial company/scope and erased the entered milestone. The form now cancels that native reset; successful creation still follows the existing redirect. Failed attempts retain all fields/checkboxes and focus an alert followed by the retry submit in keyboard order. No server action, validation, financial or authorization behavior changes.

Four executed local browser cases at 390/768/1024/1440 submit the real server action's payment validation twice and verify all edits survive. Explicit synthetic form props only; no backend creation call or authenticated persistence claim. Selected-price #752 is merged at `3811e583`, production source READY. Separate estimate recovery #751 has green technical gates but its normal merge was rejected by GitHub because CodeRabbit's stale CHANGES_REQUESTED review remains; re-review is externally rate-limited.


## Selected Estimate price in proposal review — 2026-10-16

The existing proposal-new form previously displayed the project's intake price range even when a finalized Estimate was selected. The backend instead snapshots that Estimate's saved total as the new proposal's fixed price. The focused frontend continuation now displays the selected Estimate total, preserves cents, announces changes and identifies the pricing basis; intake-only selection is labeled Intake range and does not imply a fixed price. The existing server action and backend financial/lifecycle/authorization rules are unchanged.

A read-only browser matrix passed at 390/768/1024/1440 with explicitly synthetic local props, two different saved totals, selection changes, submitted form identity and no write requests. The temporary route/config is removed. Authenticated proposal creation, persistence and production functionality remain unverified; CI/merge/deployment belong to the focused PR.


## Focused Estimate proposal handoff evidence selector — 2026-10-16

After responsive stage PR #755 merged, the finalized Estimate page has both header Create proposal navigation and Review-stage Review proposal draft; the existing Beta Evidence union locator can match both. The bounded branch `test/beta-estimate-proposal-review-link-20261016` selects the existing exact Review-stage handoff instead. Only the non-production evidence runner, its source-contract test, and owner docs change. This does not create a Proposal, alter backend totals, bypass financial authorization, or constitute a passing authenticated certification run.


## Estimate finalization recovery focus — bounded frontend slice (2026-10-16)

The responsive Estimate Workspace merged in #755, with one Review stage at all breakpoints and a distinct finalized-to-proposal handoff. The earlier independent PR #751 was closed without merge; its focusable recovery UI is **not** in main. The branch `fix/estimate-finalization-error-focus-20261016` ports only the still-needed accessibility behavior onto that current shared Review stage: on actual finalize mutation failure, the visible error notice gains focus and scrolls above fixed mobile controls; keyboard focus then proceeds to Retry. Failed writes keep the saved draft; a successful finalize remains server-acknowledged before the Proposal link appears.

No API mutation, customer delivery, financial computation, Costbook source, role/tenant/RLS, database, or production config changes. Source assertions are distinct from authenticated failed-server browser verification. PR CI/review and deployment remain separate.


## Estimate → Proposal authenticated evidence hardening — proposed 2026-10-16

The isolated branch `test/estimate-proposal-evidence-parity-20261016` repairs the canonical Beta Evidence runner for the actual focused-stage Estimate workspace: it explicitly navigates Items / Price / Review, including returning from the s053 Athena assistant page. It refuses silently skipping a missing mobile navigator and verifies `aria-current="step"` before interacting. The browser test now checks authenticated persisted Estimate line costs and subtotal, saved ready state/total, and persisted Proposal `estimateId`/`finalPrice` equality after separate explicit Create. The existing non-production host/data-plane guards, synthetic run identities, tenant denial, four viewport screenshots, source-keyed fixed-price mathematics and credential-artifact scanning are unchanged. No production data mutation or auth mechanism changes.

This work only enhances the certification *test path*. Its source tests are not real authenticated evidence. PR #751 remains review-blocked, #755 owns the responsive builder UI, and true runtime certification requires an approved full Beta Evidence run with retained sanitized artifacts and backend isolation proof. No S053 or release readiness status is upgraded on source evidence.


## Responsive Estimate stages — 2026-10-16 implementation

Mobile navigation #754 merged as `9769dacf`; exact-source production deployment `dpl_CEbaBSEUmbp45yjcwbLCRA8sZdKZ` is READY. The active `feat/estimate-responsive-stages-20261016` branch closes the demonstrated desktop composition gap against canonical Figma `378:440–443`: one Scope → Items → Price → Review flow at every width, workspace beside a dark contextual Athena rail at lg and above, inline desktop progression/finalization, and existing mobile actions above the dock. Existing Project scope, Costbook selection, line edit/delete, pricing and finalize APIs remain authoritative. The old duplicate desktop controls are removed.

Inactive forms stay mounted and hidden so unfinished item/pricing inputs survive stage changes and resizing. Only active Items owns its search shortcut. Failed dirty-scope saves retain text and block progression; saved totals stay distinct from unsaved pricing input and Athena suggestions. No persisted clarification, price-verification gate, public send action, or financial rule is invented. Full visual parity and authenticated persistence/tenant proof remain incomplete. Exact checks and current PR delivery are recorded in the session handoff and implementation ledger.


## Universal Create access — proposed 2026-10-13

The mobile Create sheet now derives its write entry points from the backend-authenticated current role. CRM and billing entries reuse the shared permission contract; Job/Schedule use the normalized manager roles accepted by JobsService. Technician/viewer and unknown roles do not receive write entry links. Advisory Ask Athena retains its independent existing capability gate. The shell reads role and Athena capability concurrently with bounded requests, and missing role confirmation leaves write entries unavailable with retry guidance. Dock geometry, sheet focus/scroll/close behavior, destinations and backend authorization remain unchanged. Role predicate tests are evidence for presentation gating; rendered role/viewport and live tenant/API verification remain open.



## Price → Review → Copperline handoff — frontend parity slice 2026-10-15 (PR pending)

The current Estimate Workspace remains a four-stage mobile experience and a continuous desktop workbench. The bounded `fix/estimate-price-review-copperline-handoff-20261015` UI branch adds a read-only direct-cost breakdown from the persisted EstimateLineItem `lineCost` values grouped by recorded type, distinctly labeled internal and excluding overhead/markup/tax. The saved Estimate `totalPrice`, not this grouping, remains the only shown customer total. The Review stage labels individual line costs internal, explicitly states that Finalize does not send to customers, and shows inline failed-finalization detail with a retry using the existing `POST /estimates/:id/finalize` mutation; the saved draft stays available on failure. After backend status becomes non-draft, the contractor moves to the existing proposal draft form, which already surfaces creation errors and requires explicit Create.

Canonical Figma frames 432:26604 (desktop Price), 432:26746 (warnings), 432:27891 (mobile Price), 432:27999 (mobile Review), and Copperline 425:45123 / 425:46807 were reconciled in place. Mockup prices/dates remain examples. Public customer proposal acceptance is still **TARGET only**, not implemented by this slice. No proposal acceptance, backend pricing/repricing, tenant/RLS, schema, tax computation, or contract/payment mutation is introduced. Browser/hosted lifecycle certification and real provider-price trust remain separate evidence gates.

## Estimate scope, direct-cost transparency and recovery — implementation 2026-10-16

The follow-up `fix/estimate-desktop-scope-recovery-20261016` lane, based on merged Price/Review PR #748, exposes one shared scope editor at desktop and mobile widths, using the existing Project PATCH contract. Save acknowledgment records the submitted scope snapshot; pending saves disable editing, failures retain input, and mobile stage progression still awaits successful saving. This is capability-constrained parity with Figma Scope `432:25161`, not a new estimator or full desktop stage redesign.

Price now groups persisted line-cost snapshots by actual cost type, with cent-safe display aggregation and unavailable values kept distinct from zero. Review explicitly labels internal costs and margin, preserves the backend-finalize-before-proposal boundary, and offers retry after failed finalization. Delete failures expose a shared refresh/reconciliation action instead of silently disappearing. Existing Estimate Engine, authenticated proxy, tenant/RLS, pricing approval, supplier and proposal contracts remain unchanged. Local checks and hosted delivery evidence are recorded in `docs/design/FIGMA_IMPLEMENTATION_LEDGER.md`; browser parity and production behavior are not inferred from builds.


## ABC catalog no-refetch product disclosure — 2026-10-15 pending CI

Production's catalog route now returns ABC sandbox products, but its default 25-product page can spend seconds waiting for the upstream provider (one observed page took ~29 seconds), and some concurrent request-scoped auth sessions fail with Prisma connection pool timeout (connection limit 1, timeout 10s). This supersedes PR #745's product-card navigation: that previous approach made a second catalog request for its details screen. This could hit the same connection bottleneck and did not establish a reliable production click-through.

This bounded frontend follow-up replaces the catalog's whole-card navigation with native `<details>/<summary>` disclosure inside the **already authenticated and loaded** provider listing. Selecting a product requires **zero additional HTTP calls**, database sessions or ABC OAuth activity. It displays only provider-listed item number, manufacturer, family, ID, unit options, color, finish, available variations and provider-supplied warnings; absent attributes are explicitly "Not supplied." The UI makes it clear these are catalog listing attributes, not deeper Get Item verification, branch stock, customer-authorized prices or approved Materials. The former standalone product-detail route remains for direct URLs but is not an advertised navigation path until item-level authorization is proven.

This does **not** repair the separate Prisma pool exhaustion on page loads or grant ABC Get Item / customer-specific pricing access. Those are independently tracked follow-ups and must not be hidden by UI verification. No catalog replication/cache is introduced under ABC's terms. Required GitHub checks and real hosted signed-in browser proof are pending; keep #735 open.




## Reviewed Costbook insertion in Estimate Items — proposed 2026-10-15

The bounded branch `fix/estimate-picker-reviewed-add-20261015` changes the existing desktop/mobile Estimate Items picker, not the Estimate Engine or supplier pricing authority. Search keyboard Enter now selects a Costbook item/assembly for review instead of inserting a highlighted result. A selected tenant Cost Item uses the existing read-only `/costbook/cost-items/:id/unit-cost` endpoint for its current stored-cost preview; installed assemblies retain the existing current-unit-cost/recipe preview. Estimate Add is enabled only for an explicitly selected installed source with a finite nonnegative resolved preview, positive quantity, and no pending mutation or preview refresh. A mapped starter assembly cannot install until its read-only cost preview resolves; installation and Estimate Add remain separate explicit actions. Failed/unknown previews do not silently use zero or write Estimate lines. The backend remains the authority for cost snapshots at line creation, so after adding contractors should review the persisted line before finalizing.

Only UI source and focused regression tests are modified; no new pricing data, supplier quote trust, schema/migration, RLS, authorization, tenant scope or proposal mutation is introduced. This is source-level implementation proposed for CI and review, not an authenticated browser or production certification.
## Public portal access design parity — proposed 2026-10-14

The bounded `feat/portal-access-figma-parity-20261014` frontend branch aligns the customer magic-link confirmation and generic denial presentation with canonical Figma frames 205:34, 205:35, 651:3762, and 651:3845. A reusable customer-only public shell provides consistent branding and responsive card layout. The confirm route still reads only the HttpOnly pending cookie, denies malformed tokens, and submits only an explicit POST to the existing same-origin redemption endpoint. The access-error page remains non-enumerating and exposes no unsupported invitation/retry action.

This is frontend presentation and source-regression coverage only. No backend, portal session, customer identity, tenant/RLS, contract signing, proposal decision, payment, or token-handling behavior changes. Hosted CI, authenticated portal browser evidence, accessibility checks and production deployment remain unverified until collected. This branch is not an S059 certification or release-readiness claim.

## Entry control geometry — proposed 2026-10-13

The same Entry parity lane now restores the existing official wordmark to the canonical mobile brand slot, aligns mobile tagline/drawing placement with default frame `547:2218`, and removes an unreferenced underline. Existing static assets are reused without editing bytes. This is code-backed parity work; screenshot/asset comparison remains unverified. BrowserAct CLI's daemon failed to initialize, and the available cloud browser cannot reach this workspace's localhost server.

The canonical mobile Entry response frame `548:2780` specifies 48px credential inputs/sign-in action and a 44px recovery target. The login page now overrides shared Input/Button default heights at its own callsites and announces pending submission through `aria-busy`. Password reveal inherits the larger field's geometry. Existing auth action, navigation, assets and shared default sizes remain intact. Rendered viewport/keyboard evidence is still required; local Chromium downloads return invalid archives. This is control-geometry parity only, not full Entry/boot certification.

## Contextual Athena scope freshness — proposed 2026-10-13

The estimate context panel now binds advisory suggestions to the project, estimate and normalized scope actually sent for review. Editing the scope or changing record context marks the result stale, announces the required refresh and disables Add. A late response cannot make suggestions current for a later edit. Loading/error states disable applying previous results, and suggestion writes/reviews are serialized in the UI. The existing authenticated line-item API, source keys, reviewed quantities, pricing resolution and explicit Add contract remain unchanged. Predicate tests verify scope/record freshness; runtime browser and real API evidence remain separate. No one-question clarification capability or full Figma parity is claimed.


## ABC live sandbox evidence and safe failed-line diagnostics — 2026-10-13

The live Vercel backend confirms a successful user-present ABC OAuth
callback, followed by a successful authenticated Search Accounts request
and two selected-account pricing requests returning HTTP 200 at the HTTP
boundary. The Settings test for supplier SKU `654210` shows provider
line status `Error`, with no eligible positive-priced line/UOM.
Therefore account authorization is proven at the HTTP workflow level,
but **a valid ABC sandbox priced SKU is not yet proven**.

The next scoped feature allows the browser to show only a short,
privacy-screened `status.message` from a matching failed ABC Price Items
line, reusing the older probe's screening. Unsafe/missing text stays
unavailable, and no Material updates or account preferences are saved.
Real ABC Production entitlement remains dependent on provider approval.


## ABC aggregator unattended-pricing protection — implemented in PR #723

ABC's Third-Party Aggregator user-presence requirements are enforced in the
background supplier feed: a scheduler identity or stored Vault grant is not
user presence. Unattended ABC pricing fails closed before any provider
request. The default ABC UUID match rejects immediately, and a second
check blocks an ABC-tagged supplier from generic HTTPS transport when the
configured ABC supplier UUID is missing or stale. Other suppliers continue
through the reviewed supplier feed path. Owner/admin user-clicked sandbox
account discovery and selected-account read-only quotes remain available.
This does **not** establish a live eligible ABC price, production API
entitlement, or permission
to conduct multi-supplier price comparisons using ABC-derived prices.
The operator evidence/demo plan lives in
`docs/operations/ABC_SUPPLY_AGGREGATOR_PRODUCTION_DEMO.md`.

## ABC sandbox OAuth reauthorization — 2026-10-11

The stored ABC refresh token is gone (0 saved tokens in Vault), and ABC
requires user-present authorization for third-party customer-specific
pricing, so the connection cannot be restored by retrying the old token.
A new user-present reauthorization flow is implemented but not yet
exercised end to end: owner/admin `POST
/api/v1/supplier-integrations/abc/oauth/authorize` returns the ABC
sandbox authorize URL (PKCE S256, `pricing.read offline_access account.read`,
10-minute single-use state bound to the initiating tenant session), and
the unauthenticated `GET
/api/v1/supplier-integrations/abc/oauth/callback` consumes the state
exactly once, exchanges the code server-side, and persists the refresh
token through the existing Vault path. The env bootstrap refresh token
is now recovery-only; the durable Vault credential is authoritative and
pricing fails closed when no token exists. The callback URI must still
be registered in the ABC Developer Portal before the flow can run, and
the daily cron must not consume user-context pricing tokens until ABC
confirms unattended customer-specific pricing in writing.

Fix 2026-10-11: the authorize endpoint 500'd in production because the
TTL parameter reached Postgres as bigint while
`tradeos_private.create_abc_oauth_state` takes integer (42883); the call
site now casts it explicitly. No API or flow change.

Status 2026-10-12: the flow has now been exercised end to end three
times (user + automated browser, two clients) and fails deterministically
at the callback: ABC sandbox sign-in succeeds and redirects back, but
Settings lands on `?abc_oauth=error`. The callback now reports the
failing stage via `?abc_oauth_step=request|state|exchange|persist` so
the next attempt identifies whether the failure is in state validation,
the ABC code exchange, or token persistence.

Callback persistence repair proposed 2026-10-12: production runtime logs on
`0119f731` identified `abc_oauth_step=persist` failing with Prisma's
connection pool timeout (10 seconds, limit 1). The callback wrapped Vault
persistence in a tenant-scoped transaction while the rotation-oriented helper
opened another transaction. The focused fix gives the authorization callback
an owner/admin-guarded in-session Vault write, while retaining independent
commits for provider refresh-token rotation. This patch alone is not proof of
an authorized sandbox quote, a stored token, or a production deployment.

Provider refresh-token rotation hardening proposed 2026-10-12: the rotation
helper previously acquired a nested transaction from the request's one-
connection Prisma pool, risking the same timeout as the OAuth callback.
A lazily initialized independent Prisma client now commits provider rotations
through a separate restricted tenant-RLS session before pricing continues.
Focused tests assert Vault write argument order/SQL and a PostgreSQL test
models a held request connection with an independent rotation transaction.
Cross-instance concurrent refresh serialization and live ABC validation are
separate unverified gates, and this PR is not yet deployed.

## ABC selected-account sandbox quote — proposed 2026-10-12

The next reviewed slice adds a user-initiated, **read-only** selected-account
price probe. Its API re-fetches the ABC sandbox authorized Ship-To/branch
relationship on every request and uses the same Vault-backed user grant to
request one strictly allowlisted sample item with quantity 1. Quotes require
one matched `OK` line, a positive USD price and provider stocking unit.
It does not save account preferences, approve a Material price, insert
observations or validate the provider unit against TradeOS Material mapping.
The optional ABC documentation sample SKU is not proof that a given sandbox
account can price it. No user-authorized live account/price evidence was
available during this implementation; completion of that real-world test
requires a fresh founder browser authorization and the sandbox response.
Production API activation requires ABC Third-Party Aggregator approval (#719).

## ABC sandbox Settings account selector — proposed 2026-10-12

Following the merged read-only Ship-To discovery API, the next proposed web
slice adds owner/admin Settings account and branch selection. The screen
fetches accounts from the authenticated same-origin proxy and shows only
branches linked to the selected Ship-To. Handles empty responses, safe 409
reauthorization guidance and generic errors. Selection is **ephemeral and
read-only**, with no preference storage or pricing probe routing changes.
Actual live account discovery and priced item/UOM remain unverified; ABC
production access still requires Third-Party Aggregator approval.

## ABC sandbox Ship-To discovery API — 2026-10-12

After merging PR #718, the bounded sandbox account discovery client is ready.
The scoped next slice exposes `GET /api/v1/supplier-integrations/abc/accounts`
under an existing authenticated, tenant-RLS, owner/admin `costbook.manage`
gate. It resolves only the tenant's configured ABC Supplier, loads its durable
Vault refresh token, and performs bounded, read-only `account.read` Search
Accounts with a 15-second deadline. Unknown or old pricing-only grants get a
sanitized reauthorization status; no provider response body, token, Material
or price updates are returned/written. This is **not** evidence of a live
sandbox account discovery, a user account picker, successful priced SKU or
ABC production approval. The selector, chosen-account price request, and
aggregator production compliance are later governed steps.

## ABC sandbox connection probe — 2026-10-09

The existing cron/Price Items integration still cannot contact ABC
with zero SKU-linked active Materials. A new authenticated,
owner/admin-only `POST /api/v1/supplier-integrations/abc/price-probe`
and Settings → Costbook button permit **one server-allowlisted** reviewed supplier SKU
(`ABC-654210`) to be quoted directly, even after verified Material activation, against the sandbox **without**
creating any Material or price-update proposal. Both paths share
the existing durable Vault token-rotation helper; no production ABC
token or provider quote has been verified merely by adding this code.
The response does not certify stock UOM. The governed approval and
existing Estimate snapshots remain unchanged.

Update 2026-10-12: ABC probe provider status visibility is limited to a
matching failed line with a short, safe plain-language explanation. Bare
domains, URLs, embedded account digits, ship-to identifiers, UUID-shaped IDs,
markup and credential-like text are rejected; absent/unsafe messages result
in a generic Settings fallback. A successful quote or other raw status message
is not disclosed through `providerStatusMessage`. No Material, price,
approval, OAuth or account-selection behavior changes.

Separate production-access gate: ABC's official Third-Party Aggregator track
requires a production application request and integration review demonstration
before real customer accounts/pricing can be used. The TradeOS adapter still
hardcodes sandbox endpoints. Before enabling production API access, validate
the required user-present pricing model and ABC restrictions against
competitive price comparison; existing scheduled supplier sync is not a
certification of terms compliance. See
https://apidocs.abcsupply.com/third-party-aggregator-integration-track/ and
https://apidocs.abcsupply.com/getting-started/.


## Authenticated supplier-workflow IDs — 2026-10-09

TradeOS Settings → Costbook exposes the existing protected 47802 supplier-evidence
workflow's organization UUID and **application** user UUID to signed-in owners/admins.
The Settings API returns `currentUserId` from the verified backend authentication
context; the UI verifies that this actor belongs to exactly one active owner/admin
entry in the same tenant-scoped membership list before showing individual Copy
controls. Email, membership UUID, Supabase auth subject, and Supabase project ID
are never substituted. The panel fails closed for missing or ambiguous identities,
and the underlying GitHub workflow still requires its production confirmation,
restricted database role, and owner/admin RLS permissions. This UI does not seed
observations, grant roles, or certify live ABC pricing.


## ABC sandbox stocking UOM gate — proposed 2026-10-10

The ABC Price Items response carries `lines[].uom` for eligible priced lines.
The new adapter preserves the provider-sourced unit and shows it in Settings.
The supplier feed refuses to enqueue a proposed Material price unless the
response unit matches the tenant Material unit of measure. Unknown or
mismatched units fail closed without price conversion. This does not reauthorize
OAuth, create a Material or approve supplier price updates.

## Supplier feed serverless activation — 2026-10-07

The backend now has a Vercel-native supplier-price cron boundary at `GET /api/cron/supplier-price-sync`, scheduled daily by `app/vercel.json`. It is protected by `CRON_SECRET` plus a bounded IP rate limit, consumes only explicit `SUPPLIER_PRICE_SYNC_JOBS` targets, and reuses the existing membership-derived background database session and review-first supplier pricing flow.

ABC Supply serverless scheduling is hardened for OAuth refresh-token rotation. The environment refresh token is bootstrap/recovery configuration; the current rotated token is read from and persisted to Supabase Vault through private `tradeos_private` SQL wrappers. Those wrappers validate active owner/admin tenant context and the canonical `ABC_SUPPLY` supplier row. The restricted `tradeos_app` role receives execute-only access to those helpers, not direct Vault access. If a rotation cannot be persisted, pricing does not continue, preventing a Vercel cold start from losing the replacement token.


## Costbook legacy assembly match audit — implementation slice 2026-10-08

The checked-in `pricedAssemblies.ts` dataset remains historical generated evidence rather than a canonical pricing source. A new bounded audit registry identifies high-confidence false positives only when the assembly requirement and supplier product contradict on an identity-defining nominal dimension, product type, or material/use specification. The first pass covers more than twenty concrete rows including 2x10 joists matched to 2x4 lumber, 2x8 deck joists matched to 5/4 decking, roller sleeves matched to firebrick, helical-pile extensions matched to concrete brick, and interior finish paint matched to exterior paint.

`AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS` is a non-mutating filtered view for review/analysis. The raw legacy array is preserved for provenance, and the audit does not invent substitute products, modify Costbook records, change assembly recipes, mutate Estimate snapshots, or write production data. Existing precomputed assembly rollups remain historical and are not promoted to current governed pricing by this slice.


## Costbook cross-supplier canonicalization — implementation slice 2026-10-06

Supplier/workbook canonical-key strings are no longer treated as sufficient evidence for cross-supplier equality. The bounded Costbook slice introduces a TradeOS-owned SPF precut-stud crosswalk, normalizes recognized supplier aliases into stable identities, makes nominal size/length/species conflicts hard exclusions, and allows multi-supplier comparison only after a governed identity is established. Legacy exact-key price lookups remain compatible only when their eligible evidence belongs to one supplier; a shared ungoverned key fails closed rather than becoming an accidental cross-supplier join. Supplier-evidence imports may establish a canonical link when the product is first created, but subsequent imports never overwrite the stored link; manager review remains the explicit mutation path.

The known generated assembly mismatch that priced a 92-5/8 in. 2x4 stud component from a 104-5/8 in. Niehaus product has been removed; the component remains unpriced rather than accepting a dimensionally different substitute or inventing a unit conversion. Governed comparisons also fail closed when candidate observations use incompatible comparison units. The slice adds no schema/migration, RLS/auth/permission change, Material price mutation, or Estimate repricing path. Exact-head verification passed on `ef7e7f5345051720e975e9e974d422e6a5c00dde`, including App unit/typecheck/build/integration, Costbook provenance + supplier-seed dry run, docs/governance, dependency review, CodeQL, branch currency, and CodeRabbit review with no unresolved threads.


## S053 certification hardening — 2026-10-04

Finalized estimates keep contextual Athena review readable but no longer render the **Add to estimate** mutation control; the authoritative Estimate Engine already rejects line-item writes once an estimate leaves draft. S053 browser evidence also removes any run-created Athena lines in a best-effort `finally` cleanup when post-apply assertions or reload checks fail, preventing a failed viewport from contaminating later evidence or canonical pricing assertions. These are bounded certification repairs; they do not change estimate lifecycle, pricing, auth, tenant/RLS, or the separate TARGET clarification contract.

## Today real exception queue expansion — 2026-10-04

The canonical **Needs You** section now consumes two additional existing, persisted exception sources without turning normal progression into attention work. Organization-scoped incomplete Project Tasks are loaded through the existing `GET /api/v1/projects/tasks` contract and only persisted `status=blocked` rows enter Needs You. Manager-capable dashboard sessions also use the existing `GET /api/v1/schedule/conflicts` preview over the current organization week; each returned technician overlap links to the canonical Schedule workspace for resolution. Technician/non-manager sessions do not call the manager-only conflict preview.

These sources degrade independently. If stale Proposal, overdue Invoice, blocked-task, or schedule-conflict truth is unavailable, the Today header reports the Needs You count as unavailable rather than substituting zero. The queue still excludes ordinary draft estimates, normal sent proposals, not-yet-due invoices, and other passive workflow events.

No pricing-verification or material-unavailable row is synthesized by this slice. Current persisted Estimate lines retain source IDs and price snapshots but do not expose a company-wide persisted freshness/provenance exception contract sufficient to support those rows truthfully. That remains a separate domain/API requirement rather than a UI guess.

## Contractor lifecycle advisory-lock repair — 2026-10-04

The full synthetic contractor walkthrough exposed a real job-creation failure: PostgreSQL `pg_advisory_xact_lock()` returns `void`, and the affected Prisma `$queryRaw` calls attempted to deserialize that result. Job-number generation, technician schedule serialization, and structured AI Estimate Assist apply now execute those existing transaction-scoped locks with `$executeRaw`, matching the repository's established advisory-lock pattern. The repair changes no lifecycle, route, schema, RLS, permission, pricing, or AI review boundary.

## S067 scheduling and Site Visit continuity — implementation slice

The bounded S067 frontend slice reuses the existing conflict-aware Job schedule
and the existing optional `SiteVisit.jobId` persistence contract. Managers can
open **Capture site visit** from scheduled Job context in Dispatch or the
Project workspace. The intake route validates the requested Job against the
Project's loaded, unarchived Jobs before rendering linked context; missing,
archived, wrong-Project, or otherwise unavailable Job ids fall back truthfully
to Project-only Site Visit capture. Finishing a linked visit forwards `jobId`
through the existing Project Site Visit endpoint, preserves the Job context
after redirect, and revalidates Project, Today, Dispatch, and Field surfaces.

The Site Visit workspace continues to work without any Job query parameter.
Technicians remain read-only for CRM/Site Visit writes; the new capture links
use the existing owner/admin/dispatcher write-role boundary. Project Site Visit
history now distinguishes linked Jobs from Project-only visits without creating
another calendar or visit model.

This slice changes no Job schedule/reschedule/conflict implementation, backend
route, lifecycle state, schema/migration, role/permission, auth/RBAC/RLS policy,
GPS/route behavior, notification system, or external-calendar integration.
Repository verification and retained responsive/permission/tenant-negative/
refresh evidence remain required before S067 can be called complete, and S056
remains its separate release-certification prerequisite.

## Customer → Project canonical continuity — 2026-10-04

The Customer-originated Project creation path now matches the canonical S052 interaction without changing the underlying data model. `/projects/new?customerId=...` resolves the existing organization-scoped Customer record, presents its active saved ServiceAddress rows, and copies the selected formatted address into the existing `Project.siteAddress` string only. The form explicitly states that no Project→ServiceAddress relationship is created. Customer identity is preserved through a hidden server-owned form value after the scoped read rather than asking the contractor to reselect the same CRM record.

Customer-context creation offers **Create project** and **Create & start estimate**. Normal creation now opens the newly created `/projects/:id` workspace immediately so persisted Customer/address/scope continuity is visible after refresh; the estimate action reuses the existing `intent=estimate` path and existing Estimate create API. Context-free Project creation and the existing Job intent remain intact. No backend route, schema, migration, auth/RBAC/RLS, Customer merge, Lead model, or ServiceAddress ownership behavior changes in this slice.

# Current State

# Current State

# Current State

## Canonical entry experience parity — 2026-10-04

The authenticated-login entry surface now matches the canonical TradeOS Figma entry composition without changing authentication behavior. `web/src/app/login/page.tsx` preserves the existing `loginAction`, recovery link, account-creation link, browser autocomplete, and fail-closed error presentation while replacing the generic centered Card with the approved responsive graphite/copper identity surface and direct sign-in workspace. The canonical TradeOS identity and construction-line artwork are exported as static SVG assets under `web/public/`; mobile, tablet, and desktop use their matching Figma variants. Password visibility is an explicit accessible local control only and does not alter credential submission or persistence.

This is a presentation-only frontend slice. It adds no auth/session/Supabase/RBAC/RLS/onboarding behavior, no alternate redirect path, and no new product capability. Focused source-contract coverage pins the canonical copy, responsive artwork variants, existing auth action, recovery/account links, and the absence of a parallel client authentication path.

## S066 mobile field continuity — merged implementation

PR #634 merged as `50fe143a31e245718cb97d31f4595883a156d84a` after exact-head Web unit tests, lint, build/dependency audit, Docs consistency, Sprint governance, PR branch currency, Dependency review, Live documentation reconciliation, and Verify repository passed. The bounded S066 frontend slice connects the existing Project workspace to
the existing assignment-scoped Field workspace without creating another Job
surface. Technician Project views expose an **Open field job** action on the
Job rows already returned through the forced-RLS Project read, handing the
selected Job to `/field?job=<id>`. The Field route preserves that explicitly
requested Job instead of silently replacing it with the first Job in today's
assigned queue. The existing `getFieldJob` contract remains the authorization
boundary, so an unassigned, wrong-organization, or otherwise inaccessible Job
still fails closed. The web DTO now reflects the already-returned `archivedAt`
field: archived Project rows do not offer the Field handoff, and an old direct
link to an archived assigned Job renders a non-actionable error instead of
field transition controls. Repeated `job` query parameters are normalized
before trimming so malformed links do not crash server rendering.

An authorized assigned Job outside the current organization-day list can render
with truthful schedule context and an explicit outside-today notice. If the
daily list fails but the explicitly opened assigned Job still loads, the
workspace degrades locally and discloses that the list is unavailable rather
than discarding the usable Job context.

This changes no Job lifecycle transition, backend route, schema, permission,
RBAC/RLS policy, invoice handoff, or field persistence capability. Existing
photo/issue/change-order/offline/inventory/messaging/timekeeping exclusions
remain in force. Retained authenticated 390/768 responsive, assignment/tenant-negative, failure,
and refresh evidence remains required before S066 can be called complete or
release-certified.


## Desktop estimate visibility repair — 2026-10-02

The nightly gate reproduced a production draft estimate showing only its header
and totals at a desktop viewport. The mobile workflow hides at `lg`, while the
desktop editing container had no responsive display override. This repair makes
the existing desktop workspace visible at `lg`, preserving the staged mobile
flow below that breakpoint. A focused regression checks the matching visibility
boundary. CI and post-merge/deployment browser verification remain required;
this repair is not a release-certification or sprint-completion claim.

## Staging fixture authentication hardening — 2026-10-04

The former credential-free web/API staging bypass is being replaced by a backend-only synthetic fixture identity protected by a strong encrypted `TRADEOS_STAGING_FIXTURE_SECRET`. Web Preview authentication returns to the real local/Supabase session path; the public fixture marker no longer authenticates the API. The backend still requires the dedicated staging Supabase/data-plane checks, exact synthetic owner membership, and normal request-scoped RLS. The guarded staging-repair control provisions or reuses only its managed staging-branch secret, masks/exports it to the evidence job, rebuilds the exact staging SHA from Git, and verifies the secret-gated fixture against the synthetic estimate before readiness is accepted. Production remains denied.

This is a staging/evidence security repair, not a production auth bypass, tenant-model change, or S053 completion claim. S053 still requires a current-head authenticated browser matrix and tenant-isolation evidence after the repair lands and staging is re-synchronized.

## Contractor beta lint-only cleanup — 2026-10-04

The contractor beta walkthrough exposed one unused parameter in the Customer action test fixture. The test callback now omits that unused parameter so web lint remains clean; this is test-only maintenance and does not change Customer behavior, runtime code, auth, tenancy, API contracts, or product state.

## Current milestone

TradeOS is in RC1 hardening. The active posture is production readiness, lifecycle consistency, contractor-facing usability, tenant-boundary verification, and retained release evidence rather than MVP planning.

## Local-development authentication fallback — 2026-10-04

Local development can run the existing backend local-auth session contract without a configured Supabase project. Login goes directly to the backend local-auth endpoint when the public Supabase URL/key are absent; session reads and the protected-route proxy fail closed when neither a usable local session nor Supabase configuration exists; logout clears/revokes the local session and skips Supabase sign-out when Supabase is not configured. When Supabase is configured, the normal Supabase authentication path is unchanged. This is a local-development compatibility repair, not a production auth bypass or RBAC/RLS change.

## Authenticated shell and navigation

- The authenticated web shell uses a shared 404TradeOS copper token system and
  semantic warning, success, info, and destructive tokens. The light-theme
  semantic fill/foreground pairs are contrast-tested for normal-size text;
  copper remains the sole brand accent.
- Light surface tokens in `web/src/app/globals.css` carry the exact Figma
  variable values from the TradeOS — Product Design System library (master
  file `xImUa9CYUjx3Cb3zTrkfnY`, sampled 2026-11-22): `--background`
  `#f7f5f1`, `--foreground` `#222426`, `--card`/`--popover` `#fffdf9`,
  `--muted` `#f0eeea`, `--muted-foreground` `#696965`, `--border`/`--input`
  `#dbd6cd`, `--accent` `#eee7df`, `--accent-foreground` `#94542f`. The
  previous oklch round numbers rendered slightly different colors (for
  example `--accent-foreground` `#8a5620` and warm-hue `--foreground`
  `#241e18`). Dark-mode Figma values and the secondary, sidebar,
  destructive, ring, and chart tokens were not sampled in that pass and are
  unchanged.
- The responsive navigation includes the 404TradeOS Control Dock with Today,
  Dispatch, Create, Work, and More actions. The More sheet preserves the
  existing routes and permissions, traps keyboard focus, restores focus on
  close, and coordinates body-scroll locking with the global command palette.
- The Dispatch attention badge is advisory and loads after the authenticated
  shell renders through the same-origin client API, aborts on unmount, and
  propagates cancellation through the proxy; the Dispatch workspace remains
  the source of truth when the advisory lookup fails.
- Status badges use solid semantic fills with their paired foreground tokens
  so warning, success, info, and destructive labels remain contrast-safe in
  both themes.
- Route-level loading states expose concise status announcements while keeping
  visual skeletons decorative. Document skeleton grid ratios normalize
  Tailwind-encoded underscores for valid CSS at the wide-screen breakpoint.
  Every loading.tsx in the app now carries this pattern (`role="status"
  aria-live="polite" aria-busy="true"` plus an sr-only label), not just the
  document-detail skeletons.
- A personal, per-browser Light/System/Dark theme toggle lives in the nav
  (desktop header and the mobile More sheet); it is stored in localStorage,
  not organization settings, applies before first paint via a blocking script
  in the root layout to avoid a flash of the wrong theme, and live-updates
  when "System" tracks an OS scheme change. The `.dark` token set existed
  beforehand but was never applied anywhere before this.
- The light-theme focus ring/border (`--ring`) is a darker copper shade
  (`#5c3814`) than `--copper` itself, computed to clear WCAG 1.4.11's 3:1
  non-text contrast against background/card/input surfaces; the previous
  value only reached 1.7-1.93:1. Dark theme's ring is unchanged.
- `PageHeader` supports an optional `breadcrumbs` trail (in addition to the
  existing single-level `backHref`); the estimate builder and the invoice,
  proposal, and contract detail pages use it to show the parent project by
  name, not just a generic "Back to project" link.
- Costbook catalog tables and the Dispatch work-queue table have sticky
  column headers (`top-16`, matching the app header's height) with an opaque
  background so scrolled row content doesn't show through.
- A `@media print` stylesheet hides site chrome (header, nav, every button)
  and forces light, ink-safe colors regardless of the viewer's theme, for
  invoices, proposals, and contracts.
- The global error boundary (`web/src/app/error.tsx`) and a new
  `(app)/not-found.tsx` use plain contractor-facing copy (no "API logs"/
  engineering language) and always offer a link back to the dashboard rather
  than stranding the viewer.
- A "?" keyboard-shortcuts overlay and a bell-style "what's new" popover
  (real shipped-change summaries in `web/src/lib/changelog.ts`, never
  invented copy) are mounted once in the nav shell.
- Two dashboard sections (Knowledge Runtime Coverage, Recent project
  lifecycle) are collapsible via `CollapsibleCard`, persisted per-browser;
  Needs Attention, the KPI grid, and Quick Actions always stay expanded.
- Owner-dashboard KPI icon metadata crosses the React Server Component boundary as serializable identifiers; the client-side KPI grid resolves those identifiers to Lucide components locally so dashboard rendering never passes component functions from the server into a client component.
- `EmptyState` supports an optional decorative `icon` and is reserved for
  genuine loaded-data absence. `feedback-state.tsx` now encodes the canonical shared state
  taxonomy and supplies `FilteredEmptyState` plus `FeedbackState` for non-empty recovery
  and access boundaries. The first production migrations separate Materials filtered-no-match
  from a genuinely empty Material catalog and separate Costbook-import permission/load failure
  from missing business data. Material load failure confirms no Costbook data changed and
  offers retry/back navigation; import restriction confirms no import/data mutation occurred.
  This is the start of the cross-product rollout, not a claim that every existing route has
  already migrated away from historical `EmptyState` error/permission usage.

## Settings contractor control center

The authenticated `/settings` surface now follows the canonical contractor-control-center hierarchy rather than presenting every platform/admin section with equal visual weight.

- The default landing section is **Pricing**, with Company, Estimating, Team & Access, Communication, Athena, and Connections grouped as common contractor settings.
- Workspace/display, Branding, Roles & Permissions, CRM/document/template compatibility controls, Knowledge, API keys, Security, Billing compatibility, Backups, Audit Log, and Developer metadata remain available under **Advanced / admin** rather than competing with labor/markup/waste controls.
- Team and role summaries continue to use the existing permission-aware organization membership response. This does not enable or absorb the separate staging-only Team & Time workspace.
- Team & Access now offers an owner/admin Add member form (`web/src/components/settings/add-member-form.tsx`) that attaches an existing TradeOS auth user through `POST /organizations/:id/members` (email, full name, role, and the person's TradeOS sign-in ID). It creates no sign-in and sends no email invite: the person signs up first, then the owner attaches them, and the directory updates in place on success. Server 401/403/409 and validation errors surface with the backend message instead of being swallowed. The sign-in ID is the person's authentication subject (the session subject the backend member lookup matches on), shown on their own Settings page under Team & Access → Your TradeOS sign-in ID — it is not the application user UUID shown under Supplier workflow IDs, which the member lookup does not match. The form also accepts `local:<uuid>` subjects for local-auth accounts. Workspace switching closes the attached-member gap: the app nav shows a workspace switcher (`web/src/components/shared/workspace-switcher.tsx`, header on wide screens and the More sheet on mobile) whenever the signed-in user belongs to more than one workspace. It lists the user's active memberships (`GET /api/v1/auth/memberships`, earliest first, name + role) and activates the selected one through `POST /api/v1/auth/select-organization`, which validates an active membership in the requested org and issues a fresh session whose token carries that org; the local session cookies are replaced and the page refreshes into the selected workspace. The refresh token is bound to the selected membership, so refresh preserves the switch. The Add member success message tells the new member they can switch to the workspace from the workspace menu once they sign in. The (app) shell is keyed by the active workspace, so switching remounts the shell subtree instead of carrying tenant-owned client state (for example a Settings draft) from one workspace into the next, and the switcher re-enables immediately after a successful switch instead of staying disabled until a reload. Two residual risks from the #1065 port were repaired after the merge: the remount key is now derived from the session token's orgId claim first (every backend-issued session signs the active org into the token, and a switch replaces the token atomically), with the settings lookup only as the fallback — the lookup alone could fail or exceed 1.5s in both workspaces and leave the key stuck on "unknown", so a Settings draft initialized from workspace A's props survived the switch and a later save would have written A's values under B's session. The estimate builder's catalog searches also read through a tenant-scoped QueryClient (`web/src/components/shared/tenant-query-provider.tsx`) mounted inside the keyed shell, so a switch discards the previous workspace's cached items; the root provider's client survives switches by design and now serves only routes outside the (app) group. Three staging-only correctness fixes from the same workspace-switcher work were ported to main so the staging promotion merges cleanly: the memberships lookup in the (app) shell now gets its own 5000ms budget (`WORKSPACE_MEMBERSHIPS_TIMEOUT_MS`, `web/src/app/(app)/layout.tsx`) instead of the shared 1500ms advisory budget — `GET /api/v1/auth/memberships` takes 311–2202ms against the staging API, and the 1500ms abort failed closed to no memberships, hiding the switcher for multi-workspace users; the memberships fetch passes `cache: "no-store"` (`web/src/lib/api.ts`) because per-user auth-scoped data must never be served from any framework cache; and the Add member form's sign-in ID placeholder is the RFC 4122 example UUID `123e4567-e89b-12d3-a456-426614174000` (`SIGN_IN_ID_PLACEHOLDER`, `web/src/lib/add-member.ts`) instead of a real staging account's application user ID, which owners had pasted into the form and the submit then failed with a duplicate-record error.
- Team & Access also offers an owner-only Send invite form (`web/src/components/settings/send-invite-form.tsx`, helper `web/src/lib/send-invite.ts`) for a person with no TradeOS account yet: the owner enters an email and a role (Technician default, Dispatcher the only other option) and the form calls the existing `POST /api/v1/account/invites` endpoint, which persists the invite and schedules the invitation email in the background; the recipient accepts at `/invite/accept` and creates their sign-in there. The form is shown only to owners because the endpoint is owner-only (`requireRoles ["owner"]`); admins see Add member but not Send invite. The confirmation names the email, role, and expiry (invites live 7 days). The helper returns only inviteId, email, role, and expiry — it never handles the raw invitation token, which the server returns only outside production. Known gap: a pending invite is not listed anywhere — the members endpoint reads membership rows only, never invite rows, so the "Pending invites" count stays 0 and the invitee appears in the directory only after accepting. Resend/revoke of a pending invite has no UI and no endpoint. Staging acceptance of a real invite send is still owed (after main is promoted to staging), and production sends silently fail until issue #872 is fixed (API Production is missing EMAIL_FROM + APP_BASE_URL).
- Pricing values remain organization settings; Costbook/source provenance continues to govern whether material/supplier pricing is trustworthy. Settings defaults never upgrade stale, placeholder, or unverified Costbook data.
- The frontend distinguishes persisted organization keys from product fallbacks. Missing organization-specific business, pricing, AI, template, communication, and security values no longer render as fabricated company facts.
- The backend `PATCH /settings` contract still validates the complete settings object, so the Control Center sends the full draft on save. The frontend truthfulness fix therefore focuses on safe fallbacks: organization-specific business, pricing, supplier, AI, communication, and security defaults are blank/off rather than fabricated facts.
- Scaffolded integration/admin cards remain explicitly marked as sample data. Developer metadata reports unavailable/unexposed values as such rather than claiming healthy platform state without a live diagnostics source.

No backend Settings route, permission, tenant, RLS, Brand Studio, supplier, billing, or Team & Time contract changes are included in this frontend reorganization.

## Customer ↔ Project connection

The current Customer workflow now exposes the existing CRM/Project relationship directly without adding a parallel lead or address model.

- Customer list/detail reads use the canonical `crm.read` permission and Customer/address writes use `crm.write`; technician/read-only roles do not receive write controls.
- Customer creation performs an advisory same-organization duplicate check using exact normalized name/email comparison over bounded authenticated Customer searches. Each term requests at most 250 rows. A failed search or a full 250-row result is treated as incomplete, and creation fails closed until the lookup can complete.
- Possible matches are advisory: staff can open an existing Customer or explicitly create a separate record. TradeOS does not silently merge Customer records or use phone-only similarity as a definitive match.
- Customer detail loads active CRM ServiceAddress rows and lets authorized staff add, edit, and soft-remove them through the existing organization/customer-scoped service boundary.
- Project create/update coverage verifies that the selected `customerId`, `siteAddress`, and plain-language `simpleScope` remain organization-scoped and persist through the existing Project controller.
- No schema, migration, RLS, Customer merge, Lead database, CRM-stage, or Project-parent model was added.

Automated unit/controller coverage owns the bounded search, fail-closed duplicate workflow, service-address parent checks, permission denial, and Customer-linked Project persistence. Authenticated browser mutation/reload evidence and disposable PostgreSQL/RLS certification are still outstanding; this section does not claim those acceptance gates complete.

## Project-backed Lead and Site Visit workspace

TradeOS now presents two canonical pre-estimate Lead states directly from existing Project/SiteVisit truth instead of introducing a parallel Lead database.

- A Project with no Estimate, Proposal, Contract, or Job and status `lead` renders the **New Lead** overview on its default Project route.
- A Project with a captured Site Visit, no Estimate, no Proposal/Contract/Job, and status `lead` or `estimating` renders **Ready to Estimate**.
- Once an Estimate exists, the Project falls back to the normal Project workspace; this slice does not invent later Lead-stage screens beyond the approved canonical states.
- Lead progress is derived from Project existence, Site Visit presence, Estimate presence, and `awarded` status. Qualification is not stored as a separate Lead-stage field.
- The Lead overview uses existing Customer contact data, Project scope/address/job type, Site Visit measurements/notes, Project photo files, missing-information output, AI follow-up questions, and intake confidence. Budget, timeline, and source are shown as not recorded because they are not dedicated Project fields today.
- The Site Visit route is now capture-first on mobile: photos, measurements, and field notes are primary; arrival/departure/GPS/transcript/customer/material/safety/verification details remain available under progressive disclosure.
- **Finish Visit** continues to call the existing `createSiteVisitAction`; no Site Visit API or storage semantics changed.
- The next commercial handoff is **Create Estimate**, using the existing Project-linked Estimate action. The UI explicitly does not claim Site Visit findings are automatically converted into priced Estimate line items.
- The prior direct Site Visit → Proposal-draft shortcut is removed from the intake page.

No new Lead, opportunity, qualification, Site Visit session, CRM-stage, Estimate-generation, or backend persistence model is introduced.

## Implemented product areas

- Auth and tenancy, including local-session refresh hardening, Supabase JWT verification, organization bootstrap/recovery, request-scoped database sessions, and forced PostgreSQL RLS.
- CRM: customers, service addresses, customer equipment, service agreements, notes, and company profile.
- Projects and project workspace, including task and site-visit workflows.
- Estimating: estimate creation, sections/line items, Costbook provenance, custom lines, pricing formulas, tax, duplication, comparison, finalized-estimate behavior, and review-first AI Estimate Assist.
- Proposals, contracts, invoices, recorded payments, and downstream lifecycle flows.
- Invoice line-item storage uses canonical selling-price columns `unit_price` and `line_total`; production migration `20260902200000_contract_invoice_line_price_columns` applied successfully on 2026-09-08, removing the synchronized legacy `unit_cost`/`line_cost` aliases and their sync objects. The disposable PostgreSQL rehearsal verified canonical data, index/constraint preservation, and tenant-scoped forced RLS; live production schema verification confirmed the canonical columns, required indexes, and forced RLS. The `unitPrice`/`lineTotal` API contract stays unchanged.
- Jobs and Dispatch: job creation from the project workspace, scheduling, assignment, rescheduling, conflict handling, field-status transitions, and dispatcher work queues.
- Team & Time staging integration: `/team-time` uses the existing signed-in Supabase session through a same-origin server route to call the staging `team-time` Edge Function. It supports assigned-job punches, breaks, manager review/correction, employee vs. subcontractor classification, and approved-hours CSV handoff. The route requires an exact same-origin `Origin`; its server-only gate requires `TEAM_TIME_ENABLED=true`, pins `TEAM_TIME_SUPABASE_PROJECT_REF` to the verified staging project, and checks that it matches the project reference in the `NEXT_PUBLIC_SUPABASE_URL` hostname. It is always disabled on Vercel Production. Staging verification on 2026-09-25 confirmed the function is active at version 4 with JWT verification and the two Team & Time migrations applied. The corresponding Edge Function and migration source are not currently versioned in this repository; this is a release blocker for production enablement. Staging has no active job assignments or Team & Time profiles yet, so live phone-to-office testing is pending. Payroll submission and location verification are not implemented or claimed.
- Owner dashboard (contractor command center): a synthesized header status sentence (greeting + attention count + today's job count), organization work queues ("Needs attention"), a Continue Working panel surfacing each in-progress project's next non-blocking step (proposal not sent, contract needed after an accepted proposal, scheduling needed after a signed contract, invoice needed after completed field work — deliberately distinct from Needs Attention's stuck/overdue states, all derived from already-loaded project detail with no added queries), an Outstanding Money card aggregating canonical invoice `balanceDue` into total/overdue receivables with honest partial-total disclosure when the loaded invoice page doesn't cover every open invoice, KPI drill-downs, payment-backed revenue, dispatch-backed schedule, task pressure, a merged activity feed spanning task movement plus proposal/contract/invoice/site-visit milestones (`entityType: "project"` activity events), quick actions, truthful degraded states, and bounded project-detail fan-out that preserves healthy recent-project data when one detail request fails.
- Financial Intelligence draft lane (#507): the organization-wide `billing.read` financial summary reports current-week recorded cash, exact open/overdue balances, unsigned proposal opportunity, and projected committed margin from unique accepted-proposal Estimate snapshots. Every source reports complete/partial/unavailable coverage; failed reads remain unknown instead of zero. Projected margin excludes tax and includes persisted estimate overhead; it is not actual job margin. Actual job costs remain unavailable until TradeOS persists verified labor, material, and equipment usage against jobs. The current Dashboard integration remains intentionally deferred on this draft branch so the newer Today Command Board is not replaced by the stale pre-command-board layout.
- Brand Studio and Settings/organization operations.
- Stripe Billing SaaS subscription foundation is implemented on PR #491: hosted Checkout for Starter/Pro/Business/Scale, 14-day trials, signed webhook synchronization, tenant-scoped billing/event persistence, a TradeOS-native entitlement resolver, Stripe billing-portal session creation, and `/settings/billing`. The server-owned catalog drives both displayed prices and checkout validation. Persisted organization-scoped attempts plus stable Stripe idempotency keys prevent duplicate Checkout sessions, while authoritative subscription hydration protects against out-of-order webhook delivery. Stripe—not the browser return URL—is authoritative for subscription state, and only `active` or `trialing` grants entitlements. The sandbox product/price catalog exists, but this is not yet a live-mode or production-deployment claim: runtime API key, webhook-signing secret, webhook endpoint registration, and a sandbox Customer Portal configuration still require environment setup and end-to-end evidence.
- Customer portal document views and the public customer magic-link portal approved by ADR-010.
- Knowledge Runtime integration and backend structured estimator orchestration. `knowledge-runtime/repository.ts`'s trade classifier (`inferTrade()`) was rewritten 2026-09-08 from raw substring matching (which misclassified the Tree Service assembly-index record as trade "Trim") to a deterministic, word-boundary/token-aware matcher that prioritizes each record's own curated `category` field and returns `null` on genuine ambiguity rather than guessing. Full before/after audit of the entire Knowledge Engine corpus: `docs/reports/KNOWLEDGE_TRADE_INFERENCE_AUDIT_2026-09-08.md`. No pricing value or Costbook record changed.

## CRM operating overview

The authenticated `/crm` route now composes the pre-job relationship workflow from existing organization-scoped sources: Customers, Projects, incomplete Project Tasks, `site_visit.created` activity, and the Proposal work queue. It introduces no Lead table, opportunity table, CRM-stage field, or follow-up table.

Pipeline lanes are derived at render time. Project `lead` remains Lead unless a real Site Visit milestone exists; Site Visit activity plus pre-proposal work can surface Ready to Estimate; Project `estimating` remains the estimating source; Proposal `sent`/`viewed` supplies Proposal Sent; and Project `awarded` supplies Awarded. Accepted-proposal side effects therefore stay owned by the existing Project/Proposal lifecycle rather than CRM.

The Follow-ups surface uses existing incomplete organization Project Tasks, including tasks created through Athena's bounded `create-follow-up` tool. Because Project Tasks do not persist a separate follow-up type, the UI describes them honestly as Project Tasks due next rather than inferring a new record class. Source reads use independent settled loading so one unavailable queue degrades visibly without blanking healthy CRM data.

## Customer workspace

The authenticated `/customers/[id]` surface now follows the canonical Customer overview without inventing a separate customer analytics model.

- The page loads the canonical Customer record plus a bounded fan-out of the most recent eight linked Project details. Individual Project failures degrade locally; if a Project detail fails or the customer has more Projects than the bounded fan-out, the workspace explicitly reports partial coverage instead of treating missing work or money as zero.
- **Needs You** is limited to supported human-attention signals in the loaded customer work: overdue Invoices with a positive balance, stale unanswered Proposals using the existing 14-day dashboard staleness policy, and blocked Project Tasks. Draft Estimates and normal progression do not become attention items.
- **Current work** is derived from real Project status plus the latest available non-terminal Job, Proposal, or Estimate context. The surface does not fabricate completion percentages or unsupported customer-stage fields.
- **Money** aggregates server-derived Invoice `amount`, `paidAmount`, and `balanceDue` across the loaded Project details while excluding voided Invoices from the financial rollup. Partial Project coverage remains disclosed next to the workspace.
- **Upcoming** uses the dispatcher Jobs list filtered by the real `customerId` and the backend-provided current-week time boundary, so scheduled time and assigned-technician names come from the Job/assignment source of truth.
- **Recent activity** is composed only from timestamps already present in loaded Project records: Proposal sent/viewed/responded events, recorded Invoice payments, Site Visit captures, and Project file creation. TradeOS does not synthesize customer messaging history when no such communication contract exists.
- Customer files link back into the authenticated Project Documents workspace; the Customer page does not expose raw Project-file storage URLs.
- Existing Customer edit, portal-link issuance, and soft-delete actions are preserved behind their current permissions. Portal link issuance remains limited to owner/admin/dispatcher/estimator.
- The canonical Figma customer-scoped Athena card is intentionally deferred while contractor Athena is not authoritative on current `main`; the Customer workspace does not link into the operator-only Athena observability route.

No Customer/CRM backend route, schema, permission, RLS, Invoice/Proposal/Job lifecycle, portal-session, or communication subsystem changes are included in this frontend composition slice.

## Costbook domain

The canonical Costbook workspace is implemented across `/api/v1/costbook/*` and `/costbook/*` while reusing the established catalog tables and services instead of creating duplicate pricing subsystems.

Implemented Costbook surfaces include:

- workspace summary
- divisions, categories, and subcategories
- materials
- labor rates
- equipment
- Cost Items
- Assemblies and components, including a versioned 14-recipe residential starter catalog browsed by NAHB work group and classified with CSI section codes. Installation requires an estimator to map every slot to a distinct, active, same-organization Cost Item with a compatible unit and component kind before real reusable Assembly/AssemblyItem records are created atomically; the shared catalog carries no prices.
- calculation-only pricing preview
- Material price audit/history and Estimate pricing snapshots
- supplier-feed proposal/review flow
- ABC Supply sandbox adapter (PR #684; **background use superseded**): mapping/token code remains, but `fetchDefaultSupplierFeed` now blocks the ABC supplier's unattended scheduled sync with a terminal `abc_user_present_required` outcome before Vault/Material/provider access. Other supplier feeds continue unchanged, and ABC does not fall back to configured generic feed URLs. ABC's user-present, owner/admin selected-account sandbox diagnostic route remains read-only with Vault token rotation, account/branch revalidation and positive USD/UOM checks; it never creates a price proposal or updates Materials. Historical 2026-10-06 sandbox HTTP 200/OAuth evidence does **not** prove an eligible priced line; live successful Ship-To/branch and unit pricing remain unverified. No ABC Production entitlement is known.
- regional supplier evidence intake (PR #531): normalized supplier workbooks are staged into tenant-scoped `SupplierProduct` and `SupplierPriceObservation` evidence through authenticated, manager-gated endpoints. Priced, unavailable, and not-listed states are preserved; the importer never changes `Material.unitCost` or creates `SupplierPriceUpdate` rows. The supplied validation bundle contains 8 workbooks, 5,189 products/observations, and 701 unavailable observations; Carter Lumber remains catalog-only because all 670 observations are unavailable. The authenticated `/costbook/supplier-evidence` review surface reads those same rows, shows stored availability/price/source facts, previews the governed pilot canonical matcher, and lets `costbook.manage` actors confirm only a suggested canonical identity through the existing reviewed-match endpoint. That review changes `SupplierProduct.canonicalMaterialKey` only; the mutation re-runs the governed matcher and rejects a different key or a relink of an already-linked product. The review surface preserves each observation's stored currency and pages through the evidence set with an organization-scoped cursor; it never promotes an observation into `Material.unitCost` or reprices an Estimate.
- authenticated `/costbook/import` batching for governed composite installed-price benchmarks; its same-origin server proxy checks mutation origin before reading the HttpOnly session, keeps the bearer token server-side, accepts 1–500 row API batches, and the browser import client sends batches of up to 100 rows and up to 80 KiB of encoded request data while preserving the same authorization, tenant scope, validation, and idempotent upsert boundary; any individual encoded row larger than 80 KiB is rejected before upload so an oversized one-row batch cannot cross the backend parser boundary
- bounded search/filter/sort/cursor pagination across canonical catalog collections

Costbook permissions, organization scope, request-scoped sessions, and forced RLS remain the authority for tenant boundaries. Estimate lines preserve source identifiers plus captured `unitCost`/`lineCost` snapshots so later catalog changes do not rewrite historical estimate pricing.

Cost Item and Assembly case-insensitive substring search is supported on both `name` and `code`. The database provides GIN `pg_trgm` indexes for both fields, including `idx_cost_items_code_trgm` and `idx_assemblies_code_trgm`, so the existing `ILIKE '%query%'` code predicates do not rely on the unrelated btree uniqueness indexes.

### Costbook pricing-intelligence UI

The authenticated Costbook frontend now follows the canonical search-first information hierarchy without inventing a universal trust score.

- `/costbook` prioritizes Materials, Labor, Equipment, and Assemblies search/navigation and keeps hierarchy, Cost Items, calculation-only pricing preview, import, and other administration below the primary pricing workflow.
- The landing page may preview recent active Materials, but each preview uses the real stored Material `unitCost`, `supplierName`, and `lastPriceUpdate` only. A missing supplier/date is shown as missing rather than converted into a confidence or freshness claim.
- The shared `PricingProvenance` presentation primitive has separate catalog and research evidence modes. Ordinary Material records do not receive “high confidence”, “verified”, “current local”, placeholder, or stale-age labels from supplier/date alone.
- Research Review retains its richer persisted provenance contract (status, source/reference, observation/retrieval dates, regional basis, confidence) and its existing named-human review + explicit promotion governance.
- No global stale threshold, “price health” count, supplier auto-apply, research auto-promotion, or Athena pricing mutation is introduced.
- `/costbook/assemblies/[id]` now provides the canonical estimator-first Assembly detail using existing tenant-scoped reads only: Assembly identity/scope, per-output-unit recipe quantities, current recursively resolved unit cost, and bounded component count. The page deliberately does not invent sell price, gross margin, job quantity, confidence, or component-level supplier/date provenance because those fields are not returned by the current Assembly detail contract. Estimate-specific use remains inside Estimate Items, where the existing engine captures source identity and pricing snapshots. Assembly composition/edit/deactivate, starter installation, unit-cost resolution, and Estimate snapshot semantics are unchanged.

### Costbook composite installed-price benchmarks (INDOT)

The INDOT ingestion lane adds an organization-scoped reference dataset for installed/composite awarded-bid unit-price benchmarks without changing canonical material, labor, equipment, estimate, proposal, invoice, or customer bill-rate values. `costbook_composite_price_benchmarks` stores source/year/item identity plus low, weighted-average, high, quantity, provenance, geography, and source-row metadata. The table uses forced RLS; reads remain tenant-scoped and writes require the established owner/admin `costbook.manage` boundary. Imports derive organization and importer identity from authenticated request context and upsert idempotently by `(org, source, year, item)`. The authenticated `/costbook/import` surface streams a locally selected normalized file in bounded batches through a same-origin proxy; it does not embed the source dataset or expose the session token to browser JavaScript. INDOT benchmark values are reference evidence only and are never decomposed into invented material/labor/equipment costs or written directly into production pricing.

### Material active/deactivate state

Material catalog rows now carry an `isActive` flag (migration `20260912120000_add_material_active_state`), matching the Division/Category/Subcategory/CostItem/LaborRate soft-delete pattern. `GET /api/v1/costbook/materials` accepts an `active` filter, a PATCH changing `isActive` requires `costbook.manage`, and the authenticated `/costbook/materials` page shows an Active/Inactive status badge with a manager-only Deactivate action. No RLS policy changed: `materials_write_policy` already restricted every material write to the `costbook.manage` boundary.

### S027 production-readiness truth

The implementation that older revisions of this document labeled **Unreleased** is merged repository state:

- PR #257 merged the supplier review concurrency repair.
- PR #260 merged the standardized Costbook catalog query contract.
- PR #268/#271 repaired bounded Supabase/Vercel serverless database pooling and TLS compatibility.
- PR #273 merged the bounded request-transaction acquisition wait.
- PR #274 added the real PostgreSQL `connection_limit=1` contention regression and hermetic timeout coverage.
- PR #278 supplied the production deployment/replay evidence referenced by the S027 readiness record.

The S027 readiness record is now `DONE`. GitHub Actions workflow run `#22` on
`main` at `c7003f3` passed all 36 authenticated route/viewport captures at
**1440 / 1024 / 768 / 390 px**, including keyboard focus, equipment
validation/create/edit/reload/delete, pricing preview, deployment immutability,
and credential scanning. The redacted evidence artifact is `#10042902412`.
The earlier production replay still records the nine canonical Costbook routes
with `200` API responses and no warning/error/fatal entries in the exact-
deployment logs. See `docs/architecture/COSTBOOK_S027_READINESS.md`.

Cold/concurrent Costbook requests in the retained production evidence reached approximately 12.6 seconds in the worst observed case. Treat that as performance follow-up, not as proof of an incomplete response.

### Costbook ↔ Athena boundary

Athena A12 includes three landed **read-only/recommendation-only** Costbook Intelligence tools under `app/modules/athena-tools/costbook`:

- catalog lookup
- margin analysis
- price recommendation

Those adapters call existing `CostDatabaseService` / `AssembliesDatabaseService` methods and shared Estimate formulas. They do not reach Prisma directly, do not define competing pricing math, and do not mutate Costbook or stored pricing state. Athena Costbook writes/autonomous Costbook mutation remain outside the intended module boundary and require separate governance.

### Costbook ↔ Knowledge Engine: provenance status and candidate ingestion contract

The 2026-09-08 audit (`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md`) established that the relational Costbook above and the read-only Knowledge Engine corpus (`packages/knowledge-engine/`) are independent systems with no write path between them, and that the canonical Knowledge Engine cost items carry no provenance/timestamp/confidence trail. The figure previously recorded here as "1,770 of 1,795" was wrong and is corrected as of 2026-09-12: the canonical export holds 1,795 items across 24 categories, **all 1,795** of which lack item-level provenance, and it contains **zero** Tree Service items (the 25 Tree Service files are staged under `packages/knowledge-engine/knowledge/knowledge/cost-items/tree-service/` and have never been merged into `exports/json/costbook.json`). `npm run costbook:audit-provenance` reports the same 1,795/1,795 figure. A follow-up slice landed a provenance-aware foundation without changing either system's pricing:

- Every Knowledge Runtime trade, search result, matcher output, and AI Estimate Assist suggestion/draft line item now carries `provenanceStatus` (`"documented" | "unverified-legacy" | "placeholder"`), defined once in `app/modules/costbook/provenance.ts`. It is resolved per-trade from `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`'s new `provenanceStatus` field, defaulting to `"unverified-legacy"` when missing/unrecognized. All 24 legacy "Stable" trades resolve to `"unverified-legacy"`; Tree Service resolves to `"placeholder"` (its own per-item files self-label `pricingStatus: "PLACEHOLDER"`); no trade is currently `"documented"`.
- `app/modules/costbook/candidateCostItem.ts` defines the governed candidate contract, and `CostbookCandidateService` now persists it through Stage 6's reviewed queue. Candidates remain unapproved until a human `costbook.manage` reviewer records the decision; promotion is explicit, org-scoped, and requires an existing matching Subcategory before it creates new Costbook component rows.
- Stage 6 added the `CostbookResearchCandidate` migration/model, forced RLS, review/promotion constraints, candidate routes, and regression/RLS coverage. No existing production Costbook row or Knowledge Engine price changed, and the Knowledge Engine remains an independent static corpus until Stage 7.

### Costbook Stage 6: reviewed candidate persistence, review, and promotion

A follow-up slice implements Stage 6 of `docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md`: the first real, human-review-gated bridge between a researched candidate and the production relational Costbook.

- New model `CostbookResearchCandidate` (migration `20260908050000_add_costbook_research_candidates`) persists the Stage 5 contract per organization, with forced RLS matching `materials_write_policy` (any org member with `costbook.read` may see the queue; insert/update requires `current_app_can_manage_costbook()`, i.e. owner/admin). Database check constraints independently require a named human `reviewedByUserId`/`reviewedAt` whenever `reviewStatus` is `approved`/`rejected`, and require an approved review plus `promotedAt`/`promotedByUserId` whenever `promotedCostItemId` is set — defense in depth alongside the application-layer `isEligibleForCostbookPromotion()` gate.
- `app/modules/costbook/candidateCostItemService.ts` (`CostbookCandidateService`) adds `create`/`listPage`/`getById`/`review`/`promote`. `review()` records `reviewedByUserId` as the authenticated caller's real user id — never a free-text field, so a synthetic reviewer identity like `"AI"` or `"system"` cannot be recorded. `promote()` re-checks `isEligibleForCostbookPromotion()` against the persisted row inside a transaction serialized by a per-candidate Postgres advisory lock (never trusting `reviewStatus` alone), requires an existing Subcategory in the organization matching the candidate's `category` (422 if none — it does not invent Division/Category/Subcategory structure), and writes exclusively through the existing `CostbookService.createMaterial`/`createLaborRate`/`createEquipment` and `CostDatabaseService.create` methods — no parallel pricing store, no direct Prisma writes to production tables from this module.
- New routes under `/api/v1/costbook/candidates` (`GET`/`POST` list+create requiring `costbook.write`/`costbook.read`, `GET /:id`, `POST /:id/review` and `POST /:id/promote` requiring `costbook.manage`, mirroring supplier-integration's approve/reject boundary). See `docs/API_REFERENCE.md`.
- AI may prepare and submit candidates (as an authenticated owner/admin-permissioned caller); AI may never approve or promote one — both actions require an authenticated human's `costbook.manage` session, and the reviewer/promoter identity is always that user's real id.
- No existing production `CostItem`/`Material`/`LaborRate`/`Equipment` row is modified by this slice; promotion only ever creates new rows from an already-approved candidate. No Knowledge Engine export data changed. Stage 7 (regenerating the Knowledge Engine corpus from governed Costbook data) remains unimplemented.

### Costbook item/assembly provenance trust layer (2026-09-11)

The reconciled provenance slice extends the existing trade-level trust marker without changing any pricing value:

- Cost-item and assembly schemas accept the same nine optional provenance/source fields: `provenanceStatus`, `sourceName`, `sourceUrl`, `sourceIdentifier`, `sourceDate`, `retrievedAt`, `confidence`, `reviewedBy`, and `reviewedAt`.
- Knowledge Runtime resolves record-level provenance when present, otherwise preserving the existing trade-level fallback. Invalid provenance/confidence values and blank optional metadata are ignored rather than promoted into trusted output.
- AI Estimate Assist suggestion and structured-draft records expose optional `provenanceDetail`, and the UI shows the status/source/date/confidence context without changing the match-confidence score or pricing decision.
- The new-batch approval/validation pipeline requires provenance fields for newly submitted cost-item batches; existing canonical data is not rewritten.
- `npm run costbook:audit-provenance` is wired into repository CI as a structural audit. Missing source metadata remains an explicit warning; structural corruption fails the check.
- Coverage remains deliberately honest: the current canonical corpus has no real item- or assembly-level source citations populated, so the new detail fields remain absent until authoritative/licensed or qualified-estimator-reviewed data is supplied.

### Costbook research review: normalization, matching, UI, and promotion audit (2026-09-12)

A follow-up slice closes the pipeline gap between the landed Stage 6 candidate
queue and a reviewer who can actually use it. No schema change was required:
the existing `CostbookResearchCandidate` model, its forced RLS policies, and
its review/promotion check constraints already cover this work.

- **Stage 3 landed.** `app/modules/costbook/knowledgeCandidateNormalizer.ts`
  converts a Knowledge Engine corpus record into a typed candidate, and
  `app/modules/costbook/candidateMatch.ts` performs deterministic duplicate
  analysis (`new-candidate` / `probable-match` / `ambiguous-match` /
  `conflict`) with signed price deltas. Both are pure — no Prisma, no
  organization, no I/O — so neither can mutate Costbook state. An ambiguous or
  conflicting match deliberately names no target, so name similarity alone can
  never steer an overwrite.
- **Fails closed, and fabricates nothing.** Normalization refuses any record
  missing a cited source, source date, retrieval timestamp, confidence, a
  supported unit, or a usable cost, and reports machine-readable block reasons
  instead of defaulting the missing field. A record that asserts no source
  stays `unverified-legacy`. Because the corpus carries no per-item market
  field, `regionalBasis` is recorded as an explicit national/default basis
  rather than presenting national research as local pricing.
- **New read-only endpoints.** `GET /api/v1/costbook/candidates/summary`
  (real per-organization queue counts), `GET .../candidates/corpus-report`
  (deterministic classification of the shared corpus), and
  `GET .../candidates/:id/match` (duplicate analysis through the canonical
  `CostDatabaseService`). `POST .../candidates/from-knowledge`
  (`costbook.write`) ingests a single corpus item as an unreviewed candidate or
  fails with 422 naming the missing evidence. Ingestion can never approve or
  promote.
- **Promotion audit trail.** Review and promotion now append an immutable
  `ActivityEvent` (`entityType: "costbook_research_candidate"`) inside the same
  transaction as the decision, recording the reviewer, the outcome, the
  provenance that justified it, and the Cost Item a candidate became. Reusing
  the existing org-scoped, RLS-protected activity feed rather than introducing
  a second audit store.
- **Review UI.** `/costbook/research-review` is the first real human review
  surface for researched pricing. Every count comes from live data; an empty
  queue reports zeroes. The detail panel shows complete provenance beside the
  current Costbook price and the difference. Approve, reject, and promote
  render only for `costbook.manage`; read-only viewers get a truthful
  explanation rather than disabled controls. The forms submit no reviewer
  identity or organization id — the API records the authenticated caller.
- **Nothing historical moved.** Promotion only ever creates new rows, so no
  existing `Material`, `CostItem`, `LaborRate`, `Equipment`, estimate snapshot,
  proposal, contract, or invoice price changed, and no Knowledge Engine export
  data changed. Stage 7 (regenerating the corpus from governed Costbook data)
  remains unimplemented.

Honest coverage note: because **no** Knowledge Engine item currently carries a
cited source, the corpus report returns 1,795 total / 0 documented / 0
candidate-ready, and `POST .../candidates/from-knowledge` correctly rejects
every item in the canonical corpus today. The end-to-end ready path is proven
by deterministic fixtures, not by a claim that the research corpus is usable.

### First real-source trade proven end to end: Jones & Sons Terre Haute aggregate (2026-09-14)

The Costbook research pipeline now has one real cited material slice wired through the canonical candidate path: the two branch-verified Jones & Sons Terre Haute aggregate records. `app/modules/costbook/jonesAndSonsIngestion.ts` serializes ingestion per `(orgId, sourceIdentifier)` with a transaction-scoped advisory lock, checks for an existing candidate inside the same RLS-bound transaction, and creates only candidate-state rows. The operator script derives the actor from active organization membership; it never reviews or promotes records. PostgreSQL integration coverage includes same-organization concurrent ingestion, tenant isolation, review, promotion, and source/audit provenance. No live tenant population is claimed; a real operator run and human review/promotion remain separate actions. See `docs/reports/JONES_AND_SONS_TERRE_HAUTE_INGESTION_2026-09-12.md`.

## Lifecycle normalization status

The bounded lifecycle-normalization sequence through Project, Estimate, Proposal, Contract, Invoice, and Job behavior has landed through the numbered sprint evidence recorded in `docs/SPRINT_BACKLOG.md` and the corresponding architecture/completion records.

Important compatibility truths that remain intentional:

- historical Project aliases remain readable while new writes use canonical Project states;
- Estimate `sent` remains distinct from internal `ready`;
- historical Proposal `rejected` normalizes to canonical `declined`;
- Contract persistence may retain compatibility storage such as `pending_signature` while DTOs expose the canonical lifecycle contract;
- Invoice paid/partial/overdue presentation is derived from persisted Invoice/Payment truth rather than inventing ledger rows;
- destructive historical rewrites are not implied by lifecycle normalization.

## Customer portal and identity

Two portal surfaces are intentionally distinct:

- `/portal/*` is the authenticated staff preview/workspace.
- `/customer-portal/*` is the ADR-010 public customer-scoped magic-link surface.

The public portal uses one-time hashed access tokens redeemed into short-lived hashed sessions, customer/tenant-scoped forced-RLS reads, replay/revocation protection, and a narrowly authorized pending-contract customer-signing transition with explicit customer attribution. It does not claim certificate-backed signing, notarization, or standalone legal identity verification.

Customer-portal invitations are delivered through the server-side
transactional email adapter. The emailed GET is non-consuming: it places the
validated opaque token into a ten-minute HttpOnly cookie restricted to the
access path and redirects to a token-free confirmation page. Redemption occurs
only after an exact-origin confirmation POST, which prevents automated email
link scanners from spending the single-use invitation; that POST clears the
pending cookie before redirecting to the portal or access-error flow.

Customer-portal server API reads preserve structured backend errors, normalize non-JSON upstream failures into the portal failure path, and reject malformed successful responses explicitly instead of leaking raw parser exceptions.
The portal redemption web route now fails closed when the backend exchange returns an absent, malformed, or expired session payload or fails before returning a response. It clears the pending invitation and creates no session cookie in these cases. Focused service and web tests cover more replay, expiry, malformed input, draft exclusion, and document-scoping denial paths; current-head authenticated browser and live RLS certification remain pending, so S059 is not complete.

The four customer-portal detail pages (project, proposal, invoice, contract) now render the same truthful "Portal access required" state as the portal home page when their portal fetch fails (expired, revoked, or absent session), instead of letting the throw surface as Next.js's generic error page; a vm-render test (`web/src/app/customer-portal/customer-portal-detail-access.test.ts`) covers the expired-session render for all four. S059 evidence tooling is built on this branch and unit-tested but not yet run: `.github/workflows/s059-browser-evidence.yml` with `app/scripts/s059-browser-evidence.mjs`, `app/scripts/s059-deployment-identity.mjs`, and the contract module/test, plus live-PostgreSQL expiry evidence in `app/tests/s059.portal.integration.ts`. No browser run has been dispatched and no certification is claimed; see `docs/architecture/S059_CERTIFICATION_EVIDENCE.md` for the step list, the expiry-browser blocker (staging-DB write access, owner: Billy), and the staging-vs-main note (staging `7c428acd` lacks main's #1001 session-hash scoping and #937 proposal redaction).

## Athena implementation state

Athena remains a feature-flagged orchestration layer over existing application services rather than a parallel business-domain implementation.

Landed foundations include:

- kernel lifecycle and execution persistence
- memory infrastructure with scoped visibility rules
- canonical event/outbox persistence and delivery infrastructure
- action engine, approval/risk boundaries, and durable idempotency
- observability/trace/alert derivation
- first-party business tools routed through existing application services
- safe background/retry/correlation semantics
- security audit-event coverage
- governed first-party plugin/runtime boundaries through A13
- A14 channel-aware voice/mobile readiness primitives

Athena business tools must preserve service ownership and existing authorization/RLS boundaries. Direct Prisma access from tools, duplicate domain logic, and autonomous Costbook mutation remain outside the intended module boundary.

### Athena-first Today and review-only estimate handoff (draft PR #1009, November 18, 2026)

A founder-authorized [draft PR #1009](https://github.com/404TradeOS-LLC/TradeOS/pull/1009) proposes moving the existing authenticated, capability-gated AthenaWorkspace above the Today hero and operational metrics, opened in a compact layout on Today only. Full /athena remains available, and Needs You/Work keep their existing semantics. No alternate AI service, automatic action or permission boundary is introduced.

Contractor-typed job notes can be transferred only after explicitly selecting **Review as estimate**. A versioned same-tab sessionStorage handoff (5-minute TTL, 4,000-character maximum) is consumed once by the existing /projects/new?intent=estimate form to populate editable Project.simpleScope for human review. The existing authorized Project/Estimate form action remains the only persistence path. Athena-generated responses, amounts, line items or a fictitious conversation ID are never transferred automatically. Browser storage may be unavailable; the existing ordinary estimate entry remains usable.

**Global navigation in this draft:** when the existing Athena capability gate is enabled, the authenticated TradeOS header now renders a one-tap **Ask Athena** link on mobile and desktop. It retains current page/project context through the shared `buildUniversalCreateHref("athena", pathname)` resolver and a 44-pixel minimum hit target. When the capability is disabled or unresolved, the shortcut is absent. This is implemented source only; no matching deployed preview or authenticated phone acceptance has been verified.

**Not yet done:** durable multi-turn contractor conversation context, one-question clarification carry-forward, iPhone voice/photo attachment transport, AI-generated estimate items, authenticated nonproduction acceptance, or production deployment. The [isolated 390px mobile design](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1245-2446) and [1440px desktop design](https://www.figma.com/design/xImUa9CYUjx3Cb3zTrkfnY?node-id=1245-2492) are editable **drafts**, not approved replacements of canonical Figma screens. Exact-head CI, review, security and functional acceptance remain mandatory before promotion or merge.

### Athena draft-refusal regression fix (2026-11-25, PR pending)

Turning the deeper Athena flags on in production (router/planner, action engine, observability, 2026-11-25 ~06:39 EST) exposed a regression verified live the same morning: three plain questions were refused — "What's on my schedule today?" and "Draft a short summary of my schedule today for me to review." were denied ("Athena can't perform that action yet"), and "How many active jobs do I have today?" failed input validation ("Athena could not validate the input for this action."). The dashboard showed the data existed (0 active jobs). Two root causes, both in the deterministic path (no model involved): (1) the router classifier and kernel policy treated the bare word "schedule" as a mutation keyword, so read-only schedule questions classified as `mutate_business_record`, the planner emitted a `needs_clarification` plan, and the policy gate denied it; (2) the planner emitted a tool-call step for *every* discovered tool with empty input for any non-mutation intent, so once A12 had registered real tools the first step's input-schema validation failed for every plain question. The fix carves "my schedule" / "active jobs" out as read-only phrases in both classifiers (genuine scheduling verbs still classify as mutations and are still denied), makes the kernel offer discovered tools by intent — only `dispatch_overview` discovers tools, everything else fails soft to the draft path with zero candidates (explicitly supplied candidate tools, the DI seam the A5/A6/A7 orchestration tests use, are honored as-is) — and registers the first read-only dispatch tool for the question, `tradeos.athena.tools.dispatcher.active-jobs` (active-jobs count from `getDispatchSummary` plus the first page of `JobsService.list`, non-terminal/non-archived, no permission gate with RLS/assignment narrowing per the dispatch-provider precedent, customer contact details omitted). The existing `optimize-day` tool's summary now leads with the active-jobs count, and the existing `search-customers` tool covers customer lookup by name/phone. Production side effect fixed in the same change: every typed Athena message used to auto-append to the estimate notes, so the three questions landed in the Estimate handoff panel as notes 1–3; notes are now added only by an explicit "Add to estimate notes" tap on the message (verbatim starters can never be added). No flag rollback, no migration, no write tools. Authenticated live draft re-check is owed after merge + deploy.

### Contractor Athena workspace

The authenticated web route `/athena` is now the contractor-facing Athena Workspace rather than the owner/admin observability dashboard. It uses one browser kernel client over the existing `POST /api/v1/athena/chat` contract, carries optional validated selected scope (`customerId`, `projectId`, `jobId`, `estimateId`, `invoiceId`, and bounded page context), and renders the kernel's real summary/message, warnings, follow-ups, clarification, degraded, denied, timeout/failure, and telemetry-reference states. The app navigation exposes this contractor workspace to authenticated users; individual Athena tools continue to enforce their existing permission/risk/service boundaries.

Owner/admin observability is preserved at `/athena/ops`. Existing operator subroutes for approvals, traces, tool health, model/cost, and events/DLQ remain operator-gated and their Overview link now targets `/athena/ops`.

The contractor UI does not fabricate data the chat response does not expose. The current kernel result does not include a provider-by-provider “context used” list, so the workspace shows selected-scope/write-path/authority trust statements but does not claim which context providers were used. The platform also has no durable contractor conversation/session lifecycle behind the optional `conversationId` reference, so the workspace does not invent or send one; visible turns are page-local UI history only. When the kernel returns `needs_clarification`, the workspace surfaces at most one question at a time. When it returns `awaiting_approval`, the workspace shows the proposed action and points at the real approvals queue (owner/admin see the link; others are told to ask an owner or admin) instead of simulating approval or performing a direct business write.

Repository implementation does not prove Athena is enabled in a deployed environment. `ATHENA_KERNEL_ENABLED` and deployment configuration remain authoritative.

### Job-scoped Athena contractor route (DES-4 Option A)

The job-scoped Athena workspace lives at `/projects/:projectId/jobs/:jobId/athena` (canonical Figma frame 289:2). It reuses the same AthenaWorkspace component and kernel contract as `/athena`, with the selected job attached as scope, a job-specific context rail (job, customer, project, latest change order when present, accepted-baseline estimate when present, latest field note), and job-specific starters. Access is decided by `web/src/lib/athena-job-access.ts`: owner/admin/dispatcher for any job, technician only for a job they are assigned to (matched by user id against the job's assigned technicians); anyone else is redirected (technicians to /field, others to the job page). Entry links live on the job detail page and the field job view. The entry links and the route are capability-gated the same way the app-shell navigation is: when the kernel is disabled, the links are hidden and the route renders an unavailable state instead of the workspace. A capability-check failure hides the links but still renders the route, where the workspace surfaces the backend error if the kernel is truly off. `/athena` and its operator gate, routes, and observability controller are untouched.

The BUILD READY write states are wired to a real confirmation flow (`web/src/components/athena/athena-confirmation-card.tsx`): on a succeeded result, the contractor may choose **Save as job note**, review the proposed note text, edit it, and confirm it. Confirming posts through the existing Job note service (`POST /api/v1/jobs/:jobId/notes`, the same endpoint the field note form uses) via the authenticated proxy, with Saving → Saved / Could not save (with retry) states; Not now discards the draft. The note is capped at 5,000 characters, matching the field note form, and the cap is enforced before saving (an oversized summary returns to editing rather than posting above it). The composer stays disabled while a save is in flight, so the card — and any failure — stays visible until the save completes. The accepted estimate's id travels in the workspace scope, so the Estimate context row renders for jobs with an accepted baseline. No kernel change, no new auth model, no new endpoint.

One limit to carry plainly: the `awaiting_approval` card is wired but currently unreachable through the chat path — the kernel's action engine maps that state to a denied result before the client sees it, so the card renders only if a future kernel change surfaces the state. The approval machinery itself remains reachable only through the /athena/approvals queue.

### Mobile context sheet (DES-4 follow-up, canonical Figma frame 289:165)

At phone widths the job route presents the same workspace as a bottom sheet instead of the desktop route: `web/src/app/(app)/projects/[id]/jobs/[jobId]/athena/job-athena-sheet.tsx` renders the compact workspace inside the shared `BottomSheet` (`web/src/components/ui/bottom-sheet.tsx`, promoted from the AppNav Create/More sheets per DESIGN.md §11 — backdrop close, Escape close, focus trap, focus restoration, body-scroll lock, safe-area padding, drag handle, slide-in). The sheet floats between the app header and the Control Dock (8px side margins, ending above the dock), so the product bar and dock stay visible around it, as drawn. Its header carries "Athena" with the Job scoped badge and the `{jobTitle} · {jobNumber} · {status}` line (status label shared with `StatusBadge` via `formatStatusLabel`); the composer uses the frame's "Ask about this job…" copy and stays pinned to the sheet's bottom while the conversation scrolls. The Confirm Write card renders inside the sheet unchanged. Closing the sheet returns to the job page. The AppNav sheets were refactored onto the same `BottomSheet` with no behavior change (the More sheet's handle spacing converged from mb-3 to the shared mb-4). The sheet mounts only below the md breakpoint (`useMediaQuery("(max-width: 767px)")` in `web/src/hooks/use-media-query.ts`): CSS hiding alone would leave it mounted at desktop widths, where its scroll lock and Tab/Escape handling would break the desktop workspace, so off-breakpoint it returns null and unmounts, releasing those effects.

Limits carried plainly: the frame shows a drag handle but specifies no drag physics, so there is no drag-to-dismiss or snap-point behavior — dismissal is backdrop, Escape, or Close. The "Job scoped" badge uses the production outline Badge (the frame's solid blue fill has no production Badge variant). The sheet's empty state shows only the composer, matching the compact Today panel; the job starters remain desktop-only. No authenticated phone acceptance has been run for the sheet yet (four-width staging acceptance is still owed for the route as a whole).

### A14 voice/mobile readiness

A14 extends the existing Athena kernel rather than creating a second assistant or
channel-specific execution engine. The request contract can carry additive safe
interaction metadata for text, mobile, or voice. Voice can be disabled
independently with `ATHENA_VOICE_ENABLED` without disabling text/mobile Athena.
The request-scoped voice registry view only narrows the existing A2/A12 tool
surface: medium/high-risk tools are unavailable through the voice-only path,
while low-risk tools with contextual confirmation bind confirmation to the exact
registered tool/version and A6 canonical validated-input hash.

The A14 mobile C010 provider delegates selected-job reads to `JobsService`, so
existing actor scope and forced RLS remain authoritative. It exposes only
minimized field context (job identity/status/priority, city/state, schedule
windows, selected page) and omits customer contact details, full street address,
and assignment identity. The backend does not accept or persist raw audio. A14
is backend readiness infrastructure; it does not claim a production speech
provider integration, offline autonomous execution, or production enablement.

The A14 post-merge correctness repair aligns runtime behavior with those
contracts: an unconfirmed contextual voice action returns a kernel-level
`needs_clarification` challenge before A6/idempotency, so the confirmation pass
cannot be persisted or replayed as a completed action; the mobile provider
remains `explicit_only` and is requested only for `mobile`/`voice`, not ordinary
`text`; and the assembled bounded context is carried forward into both tool
execution and the model-provider seam. These changes do not broaden authority,
tenant scope, or PII exposure.

Repository merge state does not by itself prove Athena is enabled in production; feature flags and deployment configuration remain authoritative.

## Security and tenant-boundary posture

Current repository architecture uses authenticated request context plus organization membership authorization, request-scoped database sessions, and forced PostgreSQL RLS as layered tenant protection. Route/service permission checks remain defense in depth rather than a substitute for database isolation.

Security-sensitive maintenance already landed includes:

- local refresh-token rotation/revocation hardening
- Supabase JWT claim/lifetime validation
- organization bootstrap/RLS lookup repairs
- tenant-boundary regression coverage
- protected storage/server-action session checks
- managed project-file Storage is private by default; browser-facing links for storage-backed photos and documents use a same-origin binary proxy that authenticates the session, resolves the requested project through the tenant-scoped backend, verifies the file belongs to that project, and only then downloads the exact metadata-backed object with server-only Storage credentials. Public object URLs require the explicit `SUPABASE_STORAGE_BUCKET_PUBLIC=true` opt-in; missing, false, or unrecognized values fail closed. Legacy files without managed `storagePath` metadata retain their previously saved URL.
- project-file Storage deletion resolves tenant-scoped metadata and completes the `crm.write`-protected metadata delete before removing only exact generated, project-scoped Storage objects; ambiguous metadata-create failures preserve Storage so a late commit cannot point at deleted data, and cleanup failures abort instead of reporting a successful deletion
- bounded database transaction acquisition under serverless contention
- safe audit/security event capture
- exact-origin enforcement for cookie-backed `POST`/`PUT`/`PATCH`/`DELETE` calls through the generic authenticated Next.js API proxy before the HttpOnly session is read or translated into a backend bearer token; safe read methods remain unchanged
- browser-side same-origin API response handling normalizes non-JSON proxy/upstream failures into `ClientApiError` with the HTTP status preserved and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- server-only staff API response handling preserves structured backend error status/details, normalizes non-JSON upstream failures into `ApiClientError`, and treats malformed successful responses as explicit API contract failures rather than leaking raw parser exceptions
- Stripe Billing webhooks are mounted before JSON parsing, verify the exact raw body against `Stripe-Signature` with timestamp tolerance and timing-safe HMAC comparison, atomically claim event IDs for idempotent retry handling, hydrate authoritative subscription state, and enter an explicit tenant RLS context only after resolving `tradeos_org_id` from Stripe metadata

The authenticated-proxy origin check closes the same-site sibling-origin CSRF gap that `SameSite=Lax` cookies do not cover by themselves without changing backend JWT, membership, permission, or RLS policy.

This document does not treat a passing unit test or route-level organization predicate as equivalent to RLS evidence where the repository requires PostgreSQL-backed verification.

## Deployment and beta-evidence posture

Repository state and production state are separate evidence domains.

Known retained deployment evidence includes the S027 production Costbook replay described above and later production/auth fixes recorded by their owning PRs. Exact release-candidate browser evidence, environment configuration, credentials/storage states, and retained multi-viewport artifacts must be proven through the approved deployment/evidence workflows rather than inferred from merged code.

The Stripe Billing implementation in PR #491 is repository/preview work until its migration is applied and sandbox environment configuration is complete. The connected Stripe sandbox already has the four subscription products and eight monthly/annual prices, but the current integration still requires a runtime Stripe API credential, webhook endpoint/signing secret, `TRADEOS_APP_URL`, and an active sandbox Customer Portal configuration before end-to-end Checkout/renewal/cancellation evidence can be retained. Live-mode price IDs/secrets must be configured explicitly; production code refuses to fall back to sandbox price IDs.

RC smoke run #10 on 2026-09-02 proved the repaired workflow now passes its
non-production configuration gate without serialized storage-state secrets, but
the owner authentication check still used a stale lifecycle identity and timed
out on successful-login navigation. The bounded follow-up maps owner auth to the
maintained Beta smoke credentials while keeping the field technician password
isolated; this is evidence-fixture maintenance, not a product auth-policy change.

Run #11 then returned a login alert before credential evaluation. A direct
sanitized signup probe reported `SUPABASE_URL is not configured`; the stable
staging backend remained database-ready, isolating the defect to its missing
branch-scoped Supabase issuer URL. The Beta owner and technician now have
confirmed staging Supabase Auth identities mapped to their existing active
owner/technician memberships. The first guarded environment-repair dispatch did
not alter the deployment: Vercel CLI 59.11.2 prompted before `env update` and
rejected the removed `redeploy --yes` option. The workflow now uses the verified
non-interactive update and redeploy contracts. Full lifecycle evidence remains
blocked until the corrected repair dispatch restores the staging backend and the
smoke rerun passes.

Customer magic-link portal implementation is merged, but its merge alone does not constitute beta-readiness evidence. The same applies to other product flows that still require authenticated rendered verification.

## Contractor project-to-job bridge

The authenticated project workspace now has a reachable `Create job` path into `/projects/[id]/jobs/new`. The form resolves the linked customer, reuses saved service addresses, can create a missing service address through the existing CRM contract, and creates the initial Job through the existing authenticated `POST /api/v1/jobs` API before continuing into `/dispatch`. Before any missing-address CRM mutation, the form normalizes and validates the required job title and job type so an invalid job submission cannot leave a newly created service address behind.

This closes the prior UI-only break between approved/billable project work and field execution. It does not add a new Job lifecycle, permission, role, schema, migration, RLS policy, or authentication mechanism; the existing backend service and request-scoped tenant boundary remain authoritative. Repository implementation truth is separate from RC promotion evidence: the full contractor flow still requires retained authenticated proof through payment -> job -> schedule -> dispatch/field progression -> completion plus the required 1440 / 1024 / 768 / 390 viewport evidence.

## RC dashboard schema-drift incident

On 2026-09-01, the production-like Supabase database serving the RC deployment was behind the repository migration head. The API Prisma client queried `estimates.tax_pct` and project-detail financial fields that were absent from the database, causing the estimate queue and one project-detail request to return generic 500 responses while `/dashboard` itself rendered. The authenticated organization, membership, and forced-RLS context were valid; authorization was not bypassed or weakened.

The repository-authoritative migrations from `20260814120000` through `20260831214500` were applied to the canonical RC database and its Prisma migration history was reconciled with the exact repository checksums. This incident also adds structured 5xx request logging and a readiness schema check for dashboard-critical estimate, invoice, and contract columns. The focused application repair is merged as `e09101f6c436f1f5648f2188a9621b5dc1a26477` and the backend is deployed READY as `dpl_2gWxCWF4wbiQS7FBxeu3a522h1VK` at `tradeos-costbook-ocq61wy8f-billykshowalters.vercel.app`; the frontend was correctly unchanged because no web files were modified. Authenticated multi-viewport and contractor-smoke evidence remain outstanding until the runtime-authenticated RC workflow completes and retains its artifacts; no baked browser-state secret is required by that workflow.

## Canonical invoice workspace

The authenticated invoice detail at `/projects/[id]/invoices/[invoiceId]` now follows the canonical Money/Invoice workspace rather than a stack of equally weighted administration cards.

- The page leads with server-derived Invoice total, recorded paid amount/payment count, and balance due. It does not recompute a competing running balance in the browser.
- Billing/customer/job context and work-performed line items remain visible in the main record surface; Invoice activity continues to use the existing sanitized timeline contract.
- When an eligible sent/overdue Invoice has a positive balance, **Record Payment** is the dominant billing action for users whose role matches the backend `billing.write` grant. The existing role-list regression remains locked to the backend permission map.
- Record Payment explicitly means logging money already received. The workspace states that recording a Payment does not mean TradeOS processed the customer's payment.
- Manual `mark paid without recording a payment` and Invoice voiding remain supported existing actions, but are progressively disclosed under **More billing actions** instead of competing with the normal payment-recording path.
- The real Invoice PDF and staff Customer Portal preview remain available from the Document panel. Customer-view telemetry is not claimed because the current product does not record it.
- Draft Invoice send behavior, Payment reconciliation, status derivation, organization/tenant scope, RLS, and backend lifecycle semantics are unchanged.

The Money page's Expense receipt-capture design remains `[TARGET]` in canonical Figma and is not implemented by this slice.

## Customer portal project workspace

The public project workspace at `/customer-portal/projects/[id]` follows the canonical document-focused portal composition without expanding capability. It presents verified customer/project context, the latest shared Proposal and Contract, every returned Invoice, and a Money summary built from active, non-voided Invoice `amount`, `paidAmount`, `balanceDue`, and recorded-payment rows. Voided invoices remain visible as document history but are excluded from current Money totals. Public Proposal review remains read-only. Pending Contracts link to the existing customer-signing route; signed and voided Contracts are described according to their actual status. Messaging, project progress/photos, schedule updates, customer change-order approval, and Pay Now remain unavailable. ADR-010 access-token/session/replay/revocation certification remains a separate evidence lane.

## Current verification surface

Backend commands defined in `app/package.json` include:

- `npm test`
- `npm run test:integration`
- `npm run lint`
- `npm run build`

Frontend commands defined in `web/package.json` include:

- `npm test`
- `npm run lint`
- `npm run build`

Repository governance additionally uses documentation consistency, dependency review, branch-currency/live-reconciliation checks, and PostgreSQL-backed integration/migration rehearsals where applicable.

### Beta contractor vertical regression coverage

`app/tests/beta-vertical-price-transfer.test.ts` chains real `ProposalsService.create()` and `ContractsService.create()` calls (not per-module mocks with independent fixtures) to guard the estimate -> proposal -> contract price and scope transfer, including its tenant-isolation (`orgId`) and `documents.manage` role-guard boundaries. `web/src/app/actions/invoices.test.ts` and `web/src/app/(app)/projects/[id]/invoices/[invoiceId]/page.test.ts` pin `recordInvoicePaymentAction`'s validation/payload/error-handling contract and lock the invoice page's `canRecordPayment` role list to the backend's `billing.write` grant in `app/domain/contracts.ts`. Record-payment UI/API and contract amount/snapshot rendering were already correct; this closes the prior zero-regression-coverage gap on that path. It does not add authenticated browser/Playwright e2e coverage (no such harness exists in this repository) and does not add the `subtotal`/`taxAmount`/`taxPct` fields `Proposal` is still missing, so only a single collapsed `finalPrice` survives estimate -> proposal -> contract.

## Known blockers and unresolved technical debt

- S036's active JobAssignment lookup index is merged in PR #476
  (`96caffc8877f77b96f8c3ae099d147c839be355f`). It targets the S035-observed
  dispatch queue assignment scan with a partial `(org_id, job_id)` index for
  non-removed, non-declined assignments. The migration is repository-complete
  but remains unapplied to production until its attached isolated before/after
  plans, measured write-cost, rollback rehearsal, and production cost budget
  are accepted. The selective synthetic fixture shows a conditional plan
  benefit; the representative fixture does not select the index.
- Persisted organization-wide Costbook pricing-policy/rule governance is not implemented; `/costbook/pricing` remains calculation-only preview behavior.
- Supplier feeds remain review-first and do not auto-apply prices; supplier-SKU matching beyond the ABC Supply sandbox feed's duplicate-SKU skip and further provider-specific connector depth remain future work.
- Athena Costbook writes/autonomous pricing mutation are not implemented.
- Stripe Billing sandbox runtime configuration is incomplete until an API credential, webhook-signing secret, webhook endpoint, app URL, and active Customer Portal configuration are installed and exercised. Stripe Connect/direct contractor customer payments remain a separate follow-up integration and are not provided by PR #491.
- Production environment values, Preview isolation, runtime-authenticated RC sessions, and multi-viewport browser artifacts must be verified externally rather than inferred from repository state.
- Settings brand-asset uploads use a shipped S017 orphan reconciler: stale generated, non-current objects can remain in private Storage until an authorized operator runs the dry-run-by-default cleanup after the 24-hour grace period. No automatic cleanup scheduler exists by design.
- The residential Assembly Catalog pins catalog/recipe metadata and quantities, publishes its NAHB/CSI coverage matrix, validates Cost Item unit/type compatibility on client and server, and installs within an explicit tenant/RLS transaction. Measurement contracts (issue #518 S8, 2026-11-23) formalize the five takeoff families (area, linear, count, volume, allowance) plus mass/time component-rate families, exact area conversions (1 SQ = 100 SF, 1 SY = 9 SF), per-template contract assessment enforced at install through `blockingReasons`, and a pure verified-takeoff-to-assembly-quantity derivation; the persisted takeoff-record connection is a follow-up gated on S065 + S4. The October 2026 browse-facet slice filters the reviewed starter payload by NAHB, CSI division, trade, output unit and tenant installed status; it derives installation status from all active assemblies and resets stale mappings when switching filters. Live tenant isolation coverage for the install flow already exists. Installs accept two optional per-assembly overrides (DEV-17 S10, issue #518): an absolute waste % (`wasteOverridePct`, 0–100) replacing each mapped Material's own waste % on material legs, and a production factor (`productionRateFactor`, greater than 0 and at most 10) multiplying each mapped CostItem's production rate on labor/equipment legs — stored on the Assembly, applied at pricing time through the existing unit-cost resolver, editable after install via PATCH (`null` clears), with recipe quantities never rewritten and child assemblies resolving with their own overrides. An explicit 1440/390px two-role SHA-attested browser evidence workflow is implemented but has not yet run; authenticated evidence and qualified-estimator expansion beyond the 14-recipe baseline remain outstanding; see `docs/architecture/ASSEMBLY_CATALOG_IMPLEMENTATION.md`.

## Canonical sequencing

Numbered-sprint eligibility and ordering are owned by `docs/SPRINT_BACKLOG.md` and the repository reconciliation protocol. `CURRENT_STATE.md` describes implementation truth; it does not override the backlog, readiness plans, ADRs, or completion-evidence records.

## Module documentation

See `docs/modules/` for the maintained domain/module records and `docs/architecture/` for readiness plans, ADRs, and completion evidence.

## Web password recovery

The web forgot-password flow uses Supabase Auth recovery: the recovery request is sent through Supabase, `/auth/confirm` exchanges the PKCE or token-hash link for a server-side session, and the reset form updates the Supabase password. Legacy backend-token reset links remain supported. This avoids requiring the web recovery flow to reach Prisma or the backend Resend adapter.
The callback attaches Supabase recovery session cookies directly to its redirect response before navigating to `/reset-password`, preventing the reset form from losing the recovery session between requests. After a successful exchange it resolves the authenticated Supabase user server-side and stores that verified `user.id` in the short-lived HttpOnly `tradeos-recovery` marker. `/reset-password` requires that same live user before rendering the native form or updating the password, so a stale marker, unrelated sign-in session, or unresolved recovery identity fails closed. Malformed or unrecognized recovery callbacks log only a static diagnostic; recovery query strings, PKCE codes, and token hashes are never written to server logs.

`/reset-password` verifies a valid recovery session server-side (the `tradeos-recovery` cookie set by `/auth/confirm`, or a legacy invite token) before ever rendering the password form. A missing session, or an `?error=` from a failed `/auth/confirm` exchange (expired, reused, or scanner-consumed link), renders a recovery-error card with a link back to `/forgot-password` instead of the form — the form is never shown to a caller without a valid session. `resetPasswordForEmail`, the `/auth/confirm` exchange, and `updateUser` each log their real Supabase error server-side (`console.error`) on failure while returning a generic, safe message to the client.

## Dashboard weather compatibility seam

The standing dashboard weather selector in `web/src/lib/dashboard-weather.ts` remains intentionally disabled until adverse-weather handling is owned by the scheduled exterior-job needs-attention queue. It preserves its typed input contract and returns `null` without issuing Census or NWS requests; the follow-up lint cleanup is behavior-neutral.

## RC beta evidence validation — 2026-09-05

- Beta Evidence run `33945411532` completed successfully against the approved non-production RC preview with deployment SHA correlation to `ee2300a438311e50f6813510578c125073a1f850`. Authentication, tenant isolation, 1440/1024/768/390 browser captures, downstream contractor workflow, artifact validation, and credential scanning all passed.
- The validated contractor path creates a customer and project, builds and finalizes an estimate, transfers the exact customer-facing price into a proposal, sends and accepts it, creates a contract, and creates an invoice with the accepted `$7,105.07` total.
- RC defects repaired for promotion are browser API proxy path normalization, proposal cents preservation, invoice Decimal-to-number display normalization, and mobile `PageHeader` wrapping that removes 390px horizontal overflow.
- Custom estimate line items are valid without a Costbook source. Migration `20260905050000_allow_custom_estimate_line_items` changes the database invariant from exactly-one-source to at-most-one-source, preserving mutual exclusivity while allowing source-less custom lines.
- Tenant-isolation evidence now asserts denial at the authenticated same-origin API proxy/backend boundary (403/404 required) and treats the browser page as a secondary UX signal, avoiding false failures from Next.js error boundaries that can retain an outer HTTP 200 after a denied server-component fetch.

## Customer portal issuance

The authenticated contractor customer detail workflow now exposes the existing staff portal-link issuance endpoint. Authorized staff can create a single-use, expiring customer-scoped link, copy it once, and share it through the controlled UI. Customer redemption, session scoping, portal reads, and revocation remain on the existing security boundary; email delivery remains follow-up work.


## Today command board

The owner dashboard is now the canonical Today command surface rather than a dashboard-plus-widget-stack. The page-level header identifies Today first, keeps company/freshness context secondary, and the landing route renders one four-part operational rhythm: **Now / Needs you / Coming up / Money**.

- **Now** owns work already moving and normal resumable progression: today's scheduled Jobs, draft/ready Estimates, Continue Working stages, and Project-backed work that is ready to begin estimating.
- **Needs you** is exceptions-only. It currently contains stale Proposal follow-up, overdue Invoice action, persisted blocked Project Tasks, and schedule conflicts for manager-capable sessions; ordinary draft Estimates, non-stale sent Proposals, not-yet-overdue Invoices, and normal next workflow steps do not appear there.
- **Coming up** is sourced from real scheduled Jobs after today's organization-timezone boundary through the end of the backend-provided current-week window. It is not an unscheduled-work or Continue Working bucket.
- **Money** is a receivables summary over canonical Invoice/payment truth. It does not create a parallel Money ledger or link to a nonexistent organization-wide Money route; overdue action stays in Needs you, with direct Invoice detail available when one is loaded.

The previous task board, recent-activity feed, Knowledge Runtime diagnostic card, recent-project lifecycle card, KPI tile wall, and standalone receivables/schedule panels are not rendered below Today. Their dedicated underlying workspaces remain available. The landing page also no longer loads task/activity, Knowledge stats, payment-ledger, or weather data solely for removed dashboard modules. Schedule, Estimate, Proposal, and Invoice source failures degrade locally inside the command surface instead of replacing healthy sections.


## Universal creation entry point

The mobile Control Dock Create action now opens a keyboard-accessible bottom creation sheet instead of navigating directly to project creation. Estimate from scope is the featured first action, followed by Job, Customer, Invoice, Change Order, and Schedule; each option reuses an existing production route and closes the sheet before navigation. The existing More sheet behavior and Control Dock touch targets remain unchanged.


## Estimates primary workflow

Estimates are now a first-class authenticated workspace at `/estimates`, backed by the existing organization estimate queue and linking directly into project estimate builders. Desktop primary navigation keeps Today, Dispatch, Projects, and Estimates visible together; lower-frequency Customers and Costbook remain available in secondary navigation. The universal Create sheet's featured Estimate from scope action lands on project intake with the scope field emphasized and ready for plain-language entry. No estimate or queue API contract changed.


## Estimate workbench composition

The estimate builder now presents a continuous desktop workbench rather than a stack of independent metric and totals cards. A compact summary rail keeps Job Cost, Sell Price, Gross Profit, and Margin visible; the editable line-item workspace receives the dominant area; and the pricing inspector remains sticky beside it. Existing Costbook search, custom lines, pricing mutations, finalization, and estimate state remain unchanged. The mobile staged workflow and contextual Athena/assembly work remain the next estimating pass.


## Mobile estimate stages

The estimate builder provides the canonical mobile staged path—Scope, Items, Price, and Review—rather than collapsing the desktop workbench into one column. Scope is now editable in place and persists through the existing partial Project PATCH using `simpleScope`; the same current draft is passed to contextual Athena. Items remain the single production list and now expose only the source identity the persisted estimate line actually carries: Assembly source, Costbook source, or Custom item. Price keeps the existing authoritative pricing controls. Review remains customer-facing while preserving the real lifecycle: draft estimates finalize first, then create a proposal; the UI does not pretend a draft estimate can directly send a proposal.

Leaving Scope through the dominant Continue action or a stage tab now waits for the existing Project `simpleScope` PATCH when the draft differs from the persisted scope. A failed save keeps the contractor on Scope and surfaces the mutation error, so Review and proposal creation cannot silently use different wording. Each mobile stage keeps one dominant bottom action above the Control Dock with safe-area spacing. Stage language is normalized to Scope → Items → Price → Review with Continue to items / Continue to price / Continue to review. Persisted estimate lines do not currently carry the pre-apply Athena provenance detail, so the Items surface does not fabricate documented/unverified trust badges after apply.

The one-dominant-action pattern is now a shared component, `StickyTaskAction` (`web/src/components/shared/sticky-task-action.tsx`, Figma canonical component node `268:93`, issue #1025): a sticky shell at `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` (dock height plus safe area) with one full-width primary Button (`min-h-11` 44px target) and an optional supporting hint below it; at `md` and above the shell goes static and unstyled and the button shrinks to its natural width. The Site Visit form's "Finish Visit" action is migrated to it, and the estimate builder's four stage actions (Continue to items / Continue to price / Continue to review / Finalize estimate) are converged onto it (DES-10-F6), replacing the local `EstimateStageAction` fixed-position duplicate; labels, order, and gating are unchanged, and the `pb-24` clearance padding the fixed shell needed is removed with it. The Athena workspace composer is intentionally not migrated — assessed 2026-11-23 after #1029 merged and it does not fit: it is a multi-element form (Textarea + Send + scope disclosure), not a single dominant action; StickyTaskAction has no slot for the input, its shell wraps only the action while the composer sticks as a whole form, and the composer has two sticky modes (page and sheet) where the component expresses one. Figma's 36px button / 8px centered hint are converged to the production 44px target and `text-xs` muted hint style.

## Contextual Athena in estimating

The estimate builder includes an embedded Athena context panel beside the desktop pricing inspector and within the mobile Scope stage. It uses the existing reviewable suggestion contract to surface assembly and Costbook matches, confidence, provenance warnings, and explicit setup-required states without applying anything automatically. The full review route now uses contractor-facing Athena terminology while the internal API/type names remain unchanged. Estimate Engine mutations remain authoritative.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:3ef1395cbb64d988feb45a9cdd7c565dd9a341cb46b740ab27e1c3e921414854 -->

The canonical one-question interaction was still a gap when this mobile workspace update landed. See [DES-10-F1](#estimate-scope-clarification--des-10-f1-merged-staging-acceptance-pending) for the merged footing clarification and pending staging evidence.

<!-- /coderabbit-ai-generated:v1 -->

## Contextual Athena provenance clarification

Contextual Athena now labels legacy Costbook matches as “Unverified pricing” in addition to placeholder pricing warnings, matching the full AI Estimate Assist provenance language. This is presentation-only; source trust remains review-first and no estimate records are applied automatically.

## Assembly pre-install cost preview

The starter assembly mapper now provides a read-only pre-install cost preview after every required slot is mapped. It resolves each selected same-organization Cost Item through the existing unit-cost endpoint, shows cost per assembly unit, accepts an output quantity for a job-cost estimate, and exposes loading/unavailable states. Preview failures now include an explicit retry action with an in-progress label; install remains gated until a finite, nonnegative preview resolves, including after a retry. The retry target is at least 44px high on mobile, retains the compact desktop size, and exposes progress through a dynamic accessible name and persistent polite status region. The preview does not create, mutate, or apply pricing; installation remains an explicit review-first action.

## Starter-catalog bulk mapping reuse (DEV-17 S9, issue #518)

The starter assembly mapper now offers a "Reuse mapping from an installed assembly" block above the per-slot mapping list. Choosing an installed template assembly and applying its mapping suggests one Cost Item per target slot — the first source item, in source-item order, that passes the same per-slot unit/kind compatibility check the install path enforces. A Cost Item is suggested for at most one slot; slots with no compatible source item stay unmapped with a reason, and slots the estimator already mapped by hand are never overwritten. The suggestions endpoint (`GET .../starter-catalog/:templateId/mapping-suggestions`, `costbook.read`) is read-only and org-scoped: inactive items, child-assembly items, and foreign-tenant Cost Items are never suggested, and installation still goes through the unchanged install contract with its full re-validation. No migration and no install-path change.

## S064 embedded Assembly Picker — active implementation

The Estimate Items picker now treats assemblies as a first-class embedded estimating choice rather than a bare search result. Installed organization assemblies can resolve their current unit cost and a bounded component preview through the existing Costbook assembly APIs; the picker shows the selected quantity's estimated job cost, persisted assembly identity, and an explicit provenance/trust note before the contractor chooses **Add**. The authoritative write remains the existing Estimate Engine line-item endpoint, and a successful add invalidates the current estimate query so Items and totals refresh in place.

The same search now includes TradeOS starter assembly recipes that are not already installed. These results are explicitly labeled **Setup required** and expose the recipe slots/quantities and reviewed starter-catalog provenance. Each slot can be mapped inline to an active compatible Costbook item; duplicate or unit/type-incompatible mappings fail closed, mapped Cost Items resolve a read-only pre-install cost preview, and installation uses the existing tenant-scoped starter-catalog install contract. Installation does not write the estimate line: after install the picker converts to the real organization assembly, resolves its current assembly cost, and still requires the contractor to use the separate explicit **Add** action. TradeOS does not invent Cost Item mappings or a price. Core S064 search → setup → preview → install → explicit add → refresh behavior is now implemented on PR #624; final verification, responsive evidence, and any reproduced defects remain before completion.

## Sprint execution / certification separation — 2026-10-02

External browser/deployment availability is no longer a global development mutex. When a sprint's implementation is merged and repository-verified but its final authenticated evidence is blocked only by the non-production evidence environment, that sprint remains incomplete (`IN_REVIEW`) and release certification stays blocked, while independent downstream implementation may continue against the landed contract. Reproduced product defects and auth/RBAC/RLS, tenant-isolation, schema/migration, financial-correctness, or unresolved product-policy failures remain hard blockers and are not covered by this exception.

Under this rule S053 remains `IN_REVIEW` until its full authenticated browser run passes; S064 is the current `READY` implementation sprint. No S053 release-certification claim is implied.

## S053 structured estimate-assist

The estimate-assist frontend now stages structured scope-to-estimate drafts through the existing `/ai-estimator/draft` and `/ai-estimator/apply` contracts. Draft generation remains review-only; accepted lines retain backend review-token, draft-status, organization-target, idempotency, and Estimate Engine safeguards. Authenticated browser certification at 1440/768/390 remains pending.


## Schedule / Dispatch workspace

The existing authenticated `/dispatch` route now defaults to the current contract-backed Schedule workspace rather than the legacy attention table. Plain `/dispatch` renders the organization-timezone-aware Day view; `?mode=week` uses the backend-provided week boundary; and `?mode=crew` groups real scheduled work using stable sorted technician identities while displaying technician names. All three views are derived from `GET /api/v1/jobs` plus `GET /api/v1/jobs/dispatch-summary`; they do not maintain a second client calendar store.

A persistent Unscheduled tray comes from the existing Job `unscheduled` state and visibly discloses its six-row display bound when more Jobs exist. Schedule cards reuse the existing dispatcher actions for assignment, schedule/reschedule, dispatch, conflict preview, and authorized override behavior. The prior attention/all/invoice-ready work queue remains available through `/dispatch?view=...`; attention pagination keeps an explicit queue discriminator so page-one navigation does not fall back to the Day board.

This is an interim production composition, not a claim that Schedule has an approved canonical calendar-grade visual. `.stitch/DESIGN.md` still classifies Schedule visual authority as partial/pending approval. The UI does not imply drag/drop persistence, GPS/live location, route optimization, external calendar synchronization, or automatic conflict resolution. The current dispatcher assignment editor still requires a technician user UUID because the only existing organization-member list exposed to the web Settings contract is owner/admin-only; widening that read boundary is not part of this slice.

## Mobile Field Workspace

The mobile technician field workspace now presents today's assigned jobs through a current-job-first mobile layout with schedule/arrival context, service address directions, job briefing, bounded lifecycle actions, equipment disclosure, and a dedicated report-back notes area. This remains a frontend refinement over the existing authenticated technician and job APIs; no new backend endpoint or data model is introduced.

Current-job selection is lifecycle-aware: On site, Traveling, Paused, and Dispatched work ranks ahead of Scheduled/Unscheduled and terminal Completed/Cancelled records while preserving the server's existing schedule ordering inside a lifecycle tier. The selected-job workspace uses a section landmark inside the app shell rather than nesting a second `main`, and the dominant mobile lifecycle action is viewport-fixed above the Control Dock so it remains reachable while the technician moves through briefing and report-back content.


## UI branch reconciliation — 2026-10-02

A current-`main` reconciliation pass recovered four contractor-facing UI slices from stale branches without merging obsolete branch history:

- Estimate Workspace contextual Athena suggestions remain review-first and can now be explicitly added to the current estimate; a successful acceptance refreshes the estimate Items/totals on desktop and mobile.
- Universal Create preserves current Project context for Job, Invoice, and Change Order creation, otherwise routes through an intent-aware Project chooser; Schedule opens real unscheduled work and Ask Athena carries current page/Project context only when Athena is enabled.
- Athena Workspace uses the focused two-column hierarchy from the later UI polish pass without replacing the recovered canonical workspace.
- Schedule/Dispatch presents the same real Jobs and conflict-aware actions with a flatter action-workspace hierarchy rather than nested card chrome.

The older `feature/ui-review-mobile-field-workspace`, `feat/canonical-athena-workspace`, and `feat/canonical-crm-workspace` branches were not merged wholesale: current `main` already contains newer Field Workspace behavior and the recovered Athena/CRM implementations from PRs #588 and #587.


## S062 Universal Create reconciliation — 2026-10-02

PR #615 merged the shared Universal Create route contract and context-aware entry routing. Current `main` now keeps existing Project context for Job, Invoice, and Change Order entry, routes context-free versions through the Project chooser, opens Schedule on the real unscheduled queue, and carries current page/Project context into Athena when enabled.

S062 is implemented on `main` through merged PR #629 for the two authorized continuity gaps:
- Customer creation now keeps the exact persisted Customer returned by the existing CRM create route and uses that server-owned id to continue into `/customers/{customerId}`; duplicate-review and tenant/auth behavior are unchanged.
- Context-free Create → Job now preserves only the validated `job` continuation through Project creation and redirects the newly created Project into `/projects/{projectId}/jobs/new`. Estimate continuation remains unchanged, and invoice/change-order creation behavior is not broadened.

The implementation reuses the existing CRM/Project APIs and Universal Create destination helper; it adds no backend route, schema, migration, auth/RBAC/RLS, billing, or payment change. Focused unit coverage pins created-Customer identity handoff and allowed new-Project continuation intents. The implementation PR merged as `6f6a0a6567c1413c837afc86b943c1c45f5f03e0` after exact-head Web/docs/governance checks passed. S062 remains `IN_REVIEW` until authenticated browser, permission/tenant-negative, and state-refresh evidence for its owned journey is retained. S052/S056/S058 remain separate release-certification prerequisites; no browser-certified release claim follows from this merge.


## S063 CRM continuity readiness — 2026-10-03

The existing Project-backed Lead and Site Visit flow (PR #582), Customer connection (PR #586), and /crm operating overview (PR #587) are already on main. S063 must extend those sources. Today /crm shows the first Project per mobile pipeline lane, up to five per desktop lane, and the first five incomplete Project Tasks. Its task DTO carries assignedTo but the overview does not show ownership. Proposal Sent and Awarded are already derived from Proposal/Project truth; CRM does not own acceptance mutations. Merged PR #631 (`b25988a11a3a4b62551f5bc3091f5fd298da6684`) implements complete bounded access/navigation, truthful existing Task ownership, and awarded-Project handoff. The branch displays all loaded follow-ups (the API read remains capped at 50), makes every loaded pipeline Project reachable on desktop/mobile, links Task rows to the Project Tasks tab, and labels Awarded links as canonical Project destinations. No new CRM persistence or lifecycle is authorized. The code is merged; authenticated browser/permission/refresh certification remains outstanding.

## S061 Today structural completion reconciliation — 2026-10-02

PR #585 already shipped the canonical Today page structure now present on current `main`: `OwnerDashboardHeader` plus one `TodayCommandBoard` with **Now / Needs you / Coming up / Money**. The old repeated task/activity/Knowledge/KPI/widget regions are absent, compact action rows remain the dominant interaction, and unavailable/partial data stays explicit. S061 is implementation-complete but remains `IN_REVIEW` until S060 supplies its separate live-data/multi-viewport release certification.


## S052 Customer → Project certification harness merged — 2026-10-03

The Customer/ServiceAddress/Project implementation needed for S052 remains the merged PR #586/#629 contract. Certification PR #637 merged as `16d297f70e8bd0d2e89b3506e06cd04cbfbd3a60` after exact-head required CI, branch currency, security/governance checks, and all review conversations passed or were resolved. The bounded harness on `main` now provides the opt-in `s052` selector, exact deployed-SHA correlation, owner Customer create/update + ServiceAddress + duplicate/validation + Customer-linked Project persistence/reload assertions, synthetic admin Customer→Project evidence at 1440/768/390, inactive-membership denial, foreign Customer/Project tenant probes, and fail-closed artifact validation.

S052 remains `IN_REVIEW`. No retained full non-production `s052` run has passed yet. At post-merge reconciliation the frontend deployment created for exact merge SHA `16d297f70e8bd0d2e89b3506e06cd04cbfbd3a60` was canceled, while the available staging frontend remained on an older SHA; dedicated synthetic admin/inactive and foreign-tenant fixture availability also cannot be established through the available secret-safe integrations. This is an external certification-evidence gap, not evidence of a product failure.


## Costbook Data Foundation — 2026-10-02

Founder-requested Costbook data-foundation work extends the existing Costbook and does not change numbered sprint status. Reconnaissance confirmed that the current Supplier, SupplierProduct, SupplierPriceObservation, LaborRate, Assembly/AssemblyItem, MaterialPriceAudit, research-candidate, and EstimateLineItem snapshot systems are the implementation base rather than targets for replacement.

Merged PR #628 (`8d37fdbe146a4b45c40c1d58a4c1e5678eee14cf`) adds the 12-item canonical pilot registry around `SupplierProduct.canonicalMaterialKey`, a precision-first deterministic supplier matcher/review flow, append-oriented supplier observation imports, a pure trust-first PriceResolver, and read-only `GET /api/v1/costbook/pricing/resolve`. The resolver returns provenance, confidence, freshness, alternatives, and a reason for selection. Current regional supplier observations are conservatively classified as retail validation rather than being upgraded to account or negotiated pricing. Explicit organization filtering remains in the service query and existing forced RLS remains the database boundary.

Costbook source metadata follow-up (2026-11-17): the resolver response now preserves the observation's recorded market code, city, state, and postal code for the selected evidence and alternatives. Missing fields remain null; the resolver does not infer a region from partial location data. Existing freshness classification is unchanged. Estimate-facing use and freshness policy still require verification and approved product decisions before this queue item can be completed.

The BLS slice reuses the existing Costbook research-candidate review system. It records Terre Haute OEWS area `0045460` with Clay, Sullivan, Vermillion, and Vigo counties, expands the validated core-trade mean/median evidence without inventing missing percentiles, implements Terre Haute → Indiana → national benchmark fallback, and models June 2026 ECEC construction benefits only as an explicitly inferred national burden input. BLS evidence still cannot become a customer bill rate automatically.

This slice does not add QBO, ABC, 1build, retail scraping, automatic price application, a second Costbook catalog, a second assembly model, or a second Estimate snapshot system. Existing consumed Estimate pricing remains historical through persisted EstimateLineItem values.


## Costbook normalization: NAHB phases + material classification codes — 2026-10-08

Merged PR #694 (`fd1e6479968fe890db2e9ffedef0af41c11e6827`) established the founder-approved Costbook normalization and nullable material-code contract. Runtime migration deployment and tenant backfill remain separate verification boundaries:

- All 88 `TradeosAssembly` entries now carry `nahbPhase` (`"1000"`–`"6000"`, NAHB job-cost build sequence) alongside the preserved `csiDivision`; new `tradeosAssembliesByNahbPhase` helper and `NAHB_PHASE_TITLES`/`isNahbPhase` in `app/modules/costbook/tradeosAssemblies.ts`. Distribution: 13/11/10/16/38 across phases 1000–5000; 6000 intentionally empty (completion/inspection is not assembly work).
- Migration `20261008132000_add_material_classification_codes` adds nullable `omniclass_23` and `unspsc` to `materials` plus an index; no NOT NULL, no backfill, existing import/pricing paths untouched. Material create/update/bulk-import accept both codes and the DTO returns them (`unspsc` validated as 8-digit at the API boundary).
- New `app/modules/costbook/canonicalMaterialCodes.ts`: `CANONICAL_MATERIAL_CODES` keyed by static-corpus `canonicalKey` with mapped/ambiguous/unmapped statuses, provenance, deterministic backfill queue, and coverage helpers. Verified coverage is deliberately progressive: 17 roofing/exterior materials use UNSPSC Codeset v8.1201 (e.g. shingles → `30151508`, siding → `30151802`, gutters → `30151703`), plus three governed untreated SPF 2×4 framing-stud keys use `30103605` (`Wood planks`) from the published UNSPSC v17.1001 detailed list. Treated, engineered, and otherwise ambiguous lumber remains unmapped; 7 roofing/exterior entries remain explicitly ambiguous and never silently merge. OmniClass 23 codes are pending verification against the CSI publication.
- **2026-10-08 five-family backfill (merged follow-up):** the full research program landed in `CANONICAL_MATERIAL_CODES` — 397 new rows (319 mapped, 78 ambiguous), all read from UNSPSC Codeset v8.1201, zero invented: framing lumber (83 → `30103603`), engineered lumber (27 → `30103601/602/606/607`), fasteners (109 → 17 verified fastener commodities), concrete/masonry (62 → 5 verified commodities), insulation (116 → `30141503/504/506/507`). Codeset gaps (bagged concrete mix, grout, pavers, housewrap/WRB, tapes, baffles) stay ambiguous with empty code fields and documented reasons. Map now holds 425 entries; 267 map to keys in the static corpus (74 greenfield framing/engineered keys are canonical-ready but not in the corpus yet). Packages live under `docs/research/costbook-classification-backfill/`.
- **Sheathing backfill (2026-10-18 research package):** 63 more rows landed in `CANONICAL_MATERIAL_CODES` — 62 mapped to UNSPSC `30103604` "Wood sheathing or sheets" (OSB, softwood plywood, ZIP and radiant-barrier panels, subfloor and underlayment panels), all UNSPSC Codeset v8.1201, zero invented; commodity rests on the 2026-10-08 full class-30103600 codeset read. One key stays ambiguous with an empty code field: `SHEATHING-DENSGLASS-1_2-4X8` (glass-mat gypsum sheathing — not a wood product; no verified gypsum-panel commodity yet, recorded for a future gypsum/drywall pass). Map now holds 491 entries; 347 mapped / 69 ambiguous against the static corpus. Package: `sheathing-classifications.csv` + `sheathing-verification-report.md` under `docs/research/costbook-classification-backfill/`.
- Classification-assisted matching in `canonicalProductMatcher.ts`: supplier-carried UNSPSC/OmniClass codes confirm an already-strong text match, narrow weak matches to human review, and downgrade code conflicts to human review (duplicate/misattribution prevention). With no codes present, matcher behavior is byte-identical to before.


### Material classification visibility in Costbook Materials — PR #696

The bounded web UI slice adds nullable `omniclass23` and `unspsc` fields to
the web Material DTO, then renders stored codes in the existing
`MaterialsCatalog` on both desktop and mobile through
`MaterialClassification`. A Material with at least one populated code shows
"Classification codes recorded"; with both code fields explicitly absent (null) it shows "Classification
unmapped"; if either field is missing from an older API response and no
other recorded code is available, it shows "Classification unavailable".
None of these labels means the product identity, supplier price, source
publication, or unit conversion has been verified. Supplier/date evidence
continues to use the existing `PricingProvenance` component.

This is read-only. Material create/edit requests, organization permission
checks, supplier price review, pricing engine, and estimate snapshots are
unchanged. The web type accepts missing code fields during phased runtime
rollout. Live migration/backfill, authenticated responsive browser evidence,
and hosted checks require separate verification; the Figma target designs do
not establish backend capability.


## ABC Supply SKU onboarding / live-price evidence (PR #701, 2026-10-09)

Branch `feat/abc-supply-reviewed-material-pilot` proposes a single-product,
operator-reviewed ABC SupplierProduct → Material activation. The operator defaults
to read-only; any mutation requires a validated active owner/admin Costbook
membership, exact product-key/SKU/unit acknowledgements, a separate explicitly
approved baseline price, and an atomic audit/linking transaction. The existing
supplier-worker review queue, rather than automatic price mutation, remains
authoritative. ABC Price Items response lines are additionally checked for
known request ID, matching SKU, USD denomination and representable precision.

**Production database read-only evidence, 2026-10-09:** six Supplier rows,
510 SupplierProducts, 510 SupplierPriceObservations, zero Materials, zero
SupplierPriceUpdates. All 510 observations are ABC Supply **static 2026-09-14
source data**, occupying source rows 1–510; 165 ABC products carry SKUs and none
is linked to a Material. The complete checked-in dataset expects 584 ABC /
3,188 total products. The governed bulk seed is therefore incomplete. A
successful supplier cron with `proposed: 0` does not prove ABC Pricing was
contacted. No new token refresh, real ABC quote, seed, Material write, queue
approval or production deployment was performed for PR #701.

Pending after code review: finish idempotent restricted-role import and verify
3,188 records; manually select one genuinely sandbox-quotable SKU and independently
approved baseline cost; verify unit compatibility; run explicit single-product
activation; trigger protected cron; check for an attributed, tenant-scoped
**pending** proposal and provider token continuity; have a human review before
any Material update. Vercel environment listing returned HTTP 403 in this
inspection, so configuration completeness was not independently verified.
See `docs/operations/ABC_SUPPLY_LIVE_PRICING_PILOT.md`.

## Davis-Bacon SAM.gov wage-feed integration (PR #700, pending)

Implements key-free determination discovery and per-revision document parsing with org-scoped `davis_bacon_determinations` and `davis_bacon_rates`. A composite `(determination_id, org_id)` FK prevents a rate from pointing across tenants; active county coverage is reconciled on complete discovery. SAM.gov downloads execute outside the short RLS-backed persistence transactions. The protected cron reports per-document failures as failures. This feed is **not production verified** until migration and live two-tenant RLS tests pass on seeded staging; it does not approve prices or alter material costs.


## ABC Supply Product API catalog — issue #735 proposed code, not live verified (2026-10-13)

A bounded first-slice implementation is proposed on
`feat/abc-catalog-provider-backed-browse-735`: sandbox
`client_credentials`/`product.read` with bearer-token separation from
existing user-present customer pricing, read-only provider-page validation,
rate/backoff handling, and server-side paginated authenticated Costbook browse.
The route is disabled by default and writes no SupplierProduct, Material,
SupplierPriceObservation, CostItem, or Estimate records. All returned products
are labeled unpriced; the browser surfaces no false current/local pricing.
Tests are proposed but CI/runtime evidence is required before marking shipped.

The requested permanent, indexed 200k+ shared catalog replication and delta
synchronization are **not implemented**. ABC API Terms (Apr 9, 2026) prohibit
building a database or permanent copy of content without express permission
and restrict caching; obtain written ABC approval (storage, retention, search
display, image use, deletion/inactive semantics) before that persistence slice.
Existing September research-seed ABC rows must not be counted as an authenticated
Get All Items import. No verified live item count, user-authorized positive
customer quote, database import, deployed UI, or estimate-from-live-ABC test
is claimed for issue #735. Provider-backed browse is not the final acceptance
of the founder's full-catalog mission.


## ABC Supply Product API real-sandbox verification — proposed follow-up (2026-10-13)

PR #736 is merged on `main` as `e3e8a872227e7a52cad3a216e357a88f3c03f760`; its provider-backed catalog browse remains disabled until intentionally configured. The next bounded branch `feat/abc-catalog-live-sandbox-proof-735` adds a manual guarded sandbox Product API proof. It will verify `client_credentials`/`product.read` and one or two real pages, then report only provider totals and checked in-memory identity counts; it never stores catalog data, changes Materials, or requests customer-specific prices.

Until a **successful manual Actions run** using authorized credentials exists, no live sandbox item totals, imported records, checked branch availability, deployed browse URL, or verified positive customer price should be claimed. The separate ABC Terms permission for permanent replicated catalog storage remains pending. Full data ingestion and incremental sync are not complete.


## ABC Supply on-demand product detail — proposed issue #735 slice (2026-10-13)

The branch `feat/abc-catalog-product-detail-735` extends the merged read-only `AbcCatalogClient` with the provider's documented sandbox `GET /api/product/v1/items/{itemNumber}` endpoint (with variation and same-family embedding). The authenticated Costbook detail surface, linked from ABC catalog search, displays exact item identity, provider product hierarchy, UOM options, nested length variations, related family records, and Prop65 warnings without inventing missing attributes. Only Active items with exact matching item numbers may be displayed. This route shares the existing ABC catalog global rate budget, respects the disabled-by-default browse gate, and does not make Material, CostItem, SupplierPriceObservation, Estimate or customer-pricing writes. Branch/customer availability is deliberately `not-verified` until user-present account and branch authorization.

This is code proposed for CI/review, **not** proof of a successful Get Item sandbox call, complete catalog import, live price, or deployed browser. ABC permission for durable catalog replication/display and the manual product.read live proof remain independent gates.

## ABC hierarchy browser — issue #735 follow-up

Following merge of #737 and independently merged #738 (on-demand Get Item), branch `feat/abc-hierarchy-browser-735` adds the separate **Get Product Hierarchy** read path and web screen. It supplies six official ABC category code/label levels with pagination, supplier-sourced only; TradeOS Costbook will link to it from the sandbox catalog. The feature is disabled by default and uses the same sandbox TPA `product.read` read credentials, Costbook permission, rate limit, and no-persistence contract as the existing browsable product list. This does not import, index, or license the full ABC catalog, prove a live provider call, expose branch-specific availability, or complete pricing-to-estimate. CI and authorized hosted browser evidence remain pending until verified.

## ABC branch ordering eligibility — issue #735 proposed continuation

On branch `feat/abc-branch-order-availability-735`, TradeOS adds a sandbox-only, provider-backed Get Item Availability read and a contextual product detail link. The ABC response lists branches at which an item can be ordered and its provider-listed dimensional lengths. It does **not** represent on-hand inventory stock, specific customer's Ship-To approval, a Price Items quote, verified material price, or persistent catalog synchronization. The same catalog feature flag, `costbook.read` permission, global rate limiter, and server `product.read` token govern the read; no supplier responses are cached or written to the database.

Until exact-head CI, real ABC sandbox integration and authenticated hosted UI evidence run, this is unproven against genuine provider availability. ABC data-copy rights and user-present customer-specific pricing remain external blockers. Issue #735 stays open.


## Costbook picker control ergonomics — 2026-10-23

The existing embedded Costbook/assembly catalog picker now uses 44px search,
Section and Quantity inputs below 1024px (32px text inputs at larger widths),
plus 44px Add, Clear, native cost-type Select and Taxable label targets. Shared
primitives and their defaults are unchanged. Search, preview gates, mapping,
mutation payloads, explicit Estimate Add, retained errors and reset behavior
remain the existing source contract.

The isolated `tests/components/catalog-item-controls.spec.ts` mounts the actual
production picker, React Query, Base UI components and Tailwind at four widths.
It exercises focus/keyboard selection, failed stored-cost preview, Clear with
retained non-default values, quantity validation, non-default Add payload,
pending/failure/retry and confirmed-success reset using synthetic transport.
This harness does not prove authenticated persistence, tenant isolation, live
supplier pricing, or full illustrated-shell parity. Current-head test results
are recorded in the PR and Figma handoff, not inferred from source assertions.

## Assigned-job task visibility (Today follow-up, 2026-10-27)

`GET /api/v1/projects/assigned-job-tasks?limit=50` returns open shared tasks
attached to the authenticated user's actively assigned, non-archived, nonterminal
Jobs. The controller derives organization and user identity from authentication;
unknown query keys and limits outside 1–50 are rejected. The service additionally
filters Project and Job tenant ownership and active (not removed or declined)
JobAssignments, under the existing forced RLS session. This projects the same
tasks already exposed by an authorized Job detail read; it grants no writes.

Technician Today uses this endpoint rather than the organization task queue.
Shared tasks appear in Work, with blocked/overdue tasks in Needs You and due-day
counts using stored calendar dates. Free-text `assignedTo` remains display-only,
not personal authorization. Field rows open `/field?job=…`; the existing Field
workspace now displays Job DTO tasks and directs progress reports to Job notes.
Task status edits retain existing office permissions. Results at the 50-row cap
are explicitly partial; a task-source failure leaves job scheduling usable and
task counts unknown. No schema, RLS policy or mutation authority changed.

## Today routine follow-up recovery (2026-10-27)

The existing `tradeos.athena.tools.office.create-follow-up` tool now advertises
optional action-engine idempotency. Previously its `not_supported` metadata
bypassed reservation even when the Workspace supplied a stable retry key, so
an ambiguous-response retry could create a second task. Keyed calls now reuse
the existing durable receipt scoped by tenant, actor, tool and version, with
canonical validated-input binding. A changed input under the same key fails
closed. Unkeyed legacy callers retain their previous behavior.

This repairs execution recovery for an existing low-risk internal task tool;
it does not send customer messages or grant new permissions. `crm.write`,
resource/service tenant checks, RLS, audits and all approval policies remain
unchanged. High-risk confirmation/resume is still a separate contract; this
change does not turn an approval state into success or resubmit restricted
actions. Action-engine dispatch is required for receipt guarantees; calling
the service or tool handler directly does not provide deduplication.

## Personal field-task ownership and status updates (2026-10-27)

Implementation on `feat/field-task-ownership` adds nullable
`ProjectTask.assignedUserId` (user FK, no name-based backfill). Shared job tasks
remain readable. Only the authenticated technician personally assigned by user
ID, with an active non-declined JobAssignment on a nonterminal/unarchived Job,
may use `PATCH /api/v1/jobs/:jobId/tasks/:taskId/status`. The strict payload is
status plus mandatory expectedUpdatedAt. The transaction locks Job/assignment
rows, checks tenant/identity/revision, updates atomically and records activity.
Stale saves return 409; invisible/not-assigned records return 404.

The migration removes technicians from the historical broad project-task write
policy (whose generic helper includes technicians), adds a narrowly scoped RLS
update policy, and restricts technician updates to status/timestamps with an
immutable-column trigger. DB-controlled timestamps retain millisecond revision
precision. Technician task create/delete/reassignment remains denied.

Owner/admin/dispatcher may create or revise explicit assignment through the
Project Tasks forms and the existing guarded generic PATCH. The new scoped
`GET /api/v1/projects/:id/task-assignees` returns only permitted active-member
choices and a server-derived capability. Legacy estimator ordinary task writes
are preserved; this new identity-administration capability is not silently
granted. Existing office status/title/note updates do not revalidate historical
assignment eligibility unless identity or Job linkage changes.

Today and Field job details return a server-derived canUpdateStatus flag based
on the actual auth role, not the normalized settings presentation role. Only
explicit nonempty matching identity, revision and capability enable the shared
status editor; older/partial responses fail closed. UI saves use the narrow
Job endpoint and verify record/project/Job/status before showing success.
Assignment changes refresh the source and operational routes. No optimistic
queue dismissal, automatic retry, financial change or production migration.

This is a schema/RLS change requiring governed review and migration rehearsal
before activation. Unit/type/build and hosted PostgreSQL/browser results must
be recorded from the final head; authored tests alone are not certification.

## Step 9 accepted-proposal field handoff — PR #810 (unmerged)

A proposed, separate branch closes the missing accepted Proposal → tracked Job
link: a manager selects the customer's ServiceAddress; the backend creates
one unscheduled Job, preserves accepted proposal scope and price as an immutable
JSON baseline and returns the existing job on retries. The workflow remains
behind an additive DB migration, exact-head CI, authorized staging and
authenticated end-to-end evidence. **This is not shipped or production
certified**, and it does not automatically assign a crew, sign a contract,
create invoices or change accepted prices. See `docs/modules/jobs-and-scheduling.md`.

### Step 9 approved Job display (PR #810, proposed)

The unmerged accepted-proposal handoff branch also adds a manager-only Job approval-baseline detail page, linked from the successful conversion, with source proposal provenance and immutable scope/price/terms. It remains unshipped pending exact-head CI, staging migration, and authenticated browser evidence.

### Pending P0 staging migration-history reconciliation — 2026-10-28

PR for issue #811 proposes a protected, staging-only reconciliation of the already-executed invoice expand migration. Direct evidence: Supabase migration history stores the exact executable SQL used by the tracked Prisma file (comments differ); staging has 46 applied Prisma migrations, 0 unfinished, and 42 invoice rows with matching old/new monetary values. The workflow is **not merged or executed** by this documentation change. The later invoice contract migration remains blocked pending proof all legacy writers are retired. No production migration or staging schema deployment is certified.

The follow-up staging migration workflow now proposes a hard stop on the destructive invoice contract phase until the protected Environment holds a matching approved retired-writers SHA and a separate exact dispatch confirmation. Neither this gate nor the history reconciliation has been merged or executed at this point.

### Proposal draft create idempotency — merged PR #819 (2026-10-29)

PR #819 merged to `main` as `bc85a503025be60c6ff472a03a17fa34c0565ec8` from reviewed head `895115789a80934aad75201889ea3c22845df77b`. Proposal Review sends a per-attempt UUID in `Idempotency-Key`; the authenticated API derives the organization-scoped Project, stores a canonical SHA-256 request fingerprint, and enforces one row per `(project_id, idempotency_key)`. A new draft returns `201`; the same key and canonical payload replay the original proposal with `200` and `Idempotency-Replayed: true`; changed payload under the same key returns `409`. Keyless legacy clients remain compatible without deduplication. The additive migration adds nullable key/hash fields, a paired-null constraint and project-scoped unique index; auth, tenant context, RLS, permissions, price derivation and separate proposal-send behavior are unchanged.

The client retains its UUID across server-action errors. A full reload seeds a new key, so the existing authenticated Project proposals list remains the recovery path. There is no status lookup endpoint or automatic retry. Exact PR-head verification passed: App/Web unit and integration tests, typecheck/build/lint, PostgreSQL migration/RLS rehearsal, Docs consistency (#4755, #4758–#4760), live docs reconciliation, governance, branch currency and dependency review. PostgreSQL concurrency coverage verified four same-key requests under request-scoped RLS: one insert, three replays, one persisted proposal. The merge is verified on `main`; this is **Implemented**, not evidence of production deployment. The protected production migration has not been executed, and authenticated production/browser behavior is not certified.

## P0 Team & Time schema and RLS remediation — 2026-10-30 (PR #827, draft)

The staging-only Supabase Team & Time table migrations were formerly missing from repository migration history. This branch adds tracked Prisma equivalents `20261030004500_team_time_foundation` and `20261030005500_team_time_integrity` before `20261030010000_force_team_time_rls`; missing tables now FAIL the FORCE migration instead of marking a no-op applied. Existing tables are preserved and no anon/authenticated access grants or tenant policies are added. Deployed staging Edge Function v6 is the source baseline for a not-yet-deployed paginated candidate at `supabase/functions/team-time/index.ts`, tested with synthetic authenticated caller/membership/job/shift requests and 201-shift/oversized-workspace regressions.

Crucial boundary: the live Edge Function uses a server-side Supabase **service-role** key (BYPASSRLS). FORCE does not change that and is not sufficient for service-role tenant isolation. Explicit organization, membership, assignment and shift checks are the actual function authorization gates; new tests verify denial paths. Staging currently has ENABLED but not FORCED RLS and zero policies. All migrations and function snapshot are source-only pending exact-head CI, review and protected staging approval. Production Team & Time remains disabled; no runtime deployment is claimed.

## Accepted-scope fallback repair — 2026-10-30

#837 review identified a mutable Project scope fallback in the shared #810 Job
conversion source. Three regression cases reproduced it for null, empty and
whitespace proposal scope. The bounded repair rejects those new conversions
with HTTP 409 and preserves existing-Job retries; it changes no schema, roles,
workflow or deployment settings. New-head hosted checks remain required.
The founder directed #810 ready for review; staging binding attestation,
API-first #837 promotion, matching web deployment, authenticated step-9 and
release review still gate release. Undrafting does not certify acceptance.

## Project WorkspaceHeader convergence — PR #844

PR #844 (`feat/figma-workspace-header`) proposes a responsive visual convergence of the existing project detail header with Figma master file `xImUa9CYUjx3Cb3zTrkfnY`, node `15:32`. It keeps project-specific status, current metadata, existing actions and back navigation; it introduces no shared universal header, data behavior, or persistence. The PR is open and this change is not merged or deployed.

## Project edit page wiring — PR pending (2026-10-31)

A staging acceptance test (2026-10-31) proved the project overview exposed no way to edit a project: the existing `EditProjectForm` (name, job type, site address, simple scope) was imported nowhere, so the established update path (`updateProjectAction` → PATCH `/api/v1/projects/:id`, requiring `crm.write` and tenant scope) was unreachable from the UI. This change wires it up without new backend work: a new `/projects/[id]/edit` page renders the existing form behind the shared `PageHeader` with breadcrumbs back to the project, an "Edit project" link appears in the lead overview header action row and in the workspace header actions, both gated on the existing write-role set (owner/admin/dispatcher/estimator) as a presentation gate only — the API independently enforces `crm.write` and tenant scope. Project status editing is intentionally out of scope; status changes keep their existing transition action. No migration, no invoice-form change.

### Manual invoice creation without an estimate — 2026-10-31 (unmerged branch)

The 2026-10-31 staging acceptance test proved the new-invoice UI could not create an invoice without a finalized estimate: the form's Estimate select was `required` (browser native validation: "Please select an item in the list.") and `createInvoiceAction` returned "Select an estimate to bill against." when `estimateId` was empty. The backend already accepted direct `lineItems` without an `estimateId` (controller `createSchema` leaves both optional; the service throws only when both are absent), so no backend, migration, or schema change was needed. The web fix makes the Estimate select optional ("No estimate — manual invoice") and, when no estimate is selected, renders a manual line-item editor (description, quantity, unit price; unit of measure defaults to "each") whose rows the server action validates (at least one complete line, quantity greater than zero, unit price zero or more, max 100 lines) before posting `lineItems` with no `estimateId`. The bill-against-estimate path, including accepted-proposal pricing and progress-invoice percent-complete validation, is unchanged. This is a web-only change; it does not create any customer, job, or invoice record by itself and is not evidence of deployment.

### Manual invoice findings fixes — 2026-11-01 (PR pending)

Follow-up to manual invoice creation: CodeRabbit review on the staging promotion found two data-integrity gaps in `createInvoiceAction`'s manual path, both fixed server-side with no backend or schema change. A blank unit price on a manual line no longer converts via `Number("")` to 0 and persists as a silent zero-priced line; blank prices are rejected while an explicit 0 stays allowed. A manual progress invoice now scales like the estimate path (`app/modules/invoices/service.ts` `resolveLineItems`): quantities scale by `percentComplete/100`, line totals round to cents with the rounding residual on the largest line so the lines sum exactly to the invoice total, and the backend persists the supplied `lineTotal` values. Full manual invoices are unchanged in outcome. No form-side change: the manual editor has no per-line add gate to mirror, so server validation (surfaced as the form error) is the guard.

### Manual invoice review-thread fixes — 2026-11-01 (PR pending)

Second follow-up to manual invoice creation: CodeRabbit's re-review of the staging promotion raised two further threads, both fixed with no backend or schema change and no change to the blank-price rejection or progress-scaling behavior. First, an untouched manual row no longer fails the whole submission: the form pre-fills a fresh row's quantity with "1", so the old skip check (all three fields blank) missed it; a row is now skipped when description and unit price are both blank, regardless of quantity, since such a row carries no billable information. Second, the manual-line transformation is now testable: parsing, validation, and progress scaling moved verbatim from `createInvoiceAction` into pure `web/src/app/actions/manual-invoice-lines.ts` (no Next.js imports), executed directly by `manual-invoice-lines.test.ts` against real FormData, while the action stays thin — it delegates to `parseManualLineItems`, scales, and posts the lines with `estimateId` undefined when no estimate is selected. The bill-against-estimate path is unchanged.

### Draft invoice editing — 2026-11-01 (PR pending)

The 2026-11-01 staging acceptance test proved no invoice edit surface existed at all: the detail page offered only Send / PDF / Portal / Void, and `/invoices/[invoiceId]/edit` 404d. This change adds the missing surface with a minimal new backend path (no migration, no schema change): `InvoicesService.update` plus `PATCH /api/v1/invoices/:id`, requiring `billing.write` and organization scope, draft-only (409 otherwise), with an `invoice.updated` delivery/activity event. Line replacement is restricted to manual (estimate-less) full drafts, recomputing the total from the direct lines exactly as on creation; progress drafts (lines already scaled, unscaled base not stored) and estimate-linked drafts (lines are an allocation of the estimate's sell total) support due-date-only edits, with an on-screen note explaining why. The UI adds an "Edit invoice" link on the detail page (drafts only, same `billing.write` role list as the payment form) and a new `/edit` page whose form reuses the create form's indexed line fields and `parseManualLineItems` validation (blank prices rejected, untouched rows skipped); the editor markup mirrors the new-invoice form rather than extracting a shared component, because the new form's shape tests pin those fields inside `form.tsx`. Send/void/payment flows and the estimate path are unchanged.

### Estimate Price-stage tax breakdown — 2026-11-01 (PR pending)

The estimate engine already computed tax correctly (taxable-share allocation in `app/modules/estimate-engine/formulas.ts`, surfaced by the estimate DTO as `taxAmount` / `preTaxTotalPrice` / `totalPrice`), but the builder never rendered a tax amount anywhere: the Price panel's summary showed gross profit, margin, and markup only, and Review showed total plus margin only. This change is display-only — no engine, API, mutation, or pricing-math change. The Price stage's pricing summary now renders a Pre-tax total, Tax (with the saved tax rate, e.g. "Tax (7%)"), and Customer total row set, reading the saved estimate snapshot so pre-tax + tax = total; the Review stage's total block renders the same pre-tax / tax / total breakdown above the estimate total. The rows render unconditionally (Tax $0.00 when nothing is taxable), consistent with the existing "no line marked taxable" warning, which is unchanged.

### PDF download 500 on non-Latin-1 project names — 2026-11-01 (PR pending)

Opening an invoice PDF returned `{"error":"Internal server error"}` on both staging ("TEST Project — Delete Me") and production ("Condo Two — Renovation & Punch List"), reproduced on staging for an ordinary draft invoice. Root cause was not rendering, branding, auth, or tenant scope: the PDF filename is built from the project name with only whitespace collapsed, and the controller set it unsanitized in the `Content-Disposition` header. Node rejects non-Latin-1 header characters, so the em-dash (U+2014) threw `ERR_INVALID_CHAR` after rendering succeeded, and the error handler mapped it to a 500. The fix adds one shared helper, `sanitizeDownloadFilename` (`app/modules/documents/format.ts`), which replaces every character outside printable ASCII with `-`, and applies it at all five header sites: invoice, contract, proposal, proposal-generator, and customer-portal PDF controllers (the sibling sites built filenames the same whitespace-only way). No route, renderer, brand, auth, migration, or schema change; the downloaded filename is ASCII-folded (an RFC 5987 `filename*` Unicode-preserving variant is follow-up). Regression coverage: `app/tests/documents.download-filename.test.ts` pins the sanitizer and asserts Node's own header validation accepts the sanitized production and staging filenames while rejecting the raw ones.

### Shared navigation keyboard state — 2026-11-02 (replacement for PR #874)

Existing `PageHeader` breadcrumb/back links now expose a visible semantic focus ring, and existing `ProjectWorkspaceTabs` announces its current page with `aria-current="page"` and names its navigation region. Focus coverage is source-contract tested, with the earlier reviewed implementation rebased as a new clean-main PR because governed PR-maintenance dispatch is unavailable in this integration. Hosted exact-head checks and rendered authenticated/mobile acceptance remain separate.

### CRM and Customers bounded loading — 2026-11-02 (replacement for draft PR #883)

CRM overview reads five existing organization-scoped sources with one default 20-second `AbortSignal.timeout`, passed through the existing `apiFetch` clients. Each read settles independently so an unavailable source produces the existing per-source warning while other data remains usable. The Customers page uses the same existing warning style and does **not** mount `CustomerDirectory` when its customer list request fails; unavailable data must not appear as a genuine empty directory. A controllable AbortSignal in the loader enables a deterministic test of a pending request that rejects on timeout; no new data source, API authorization or page navigation was introduced. This patch supersedes stale draft #883 on fresh main. Its new head requires complete CI, review and authenticated application acceptance before release.


### New Project → Task continuity release reconciliation — 2026-11-02

The existing Universal Create → Task flow preserves `intent=task` through new Project creation and redirects the contractor to that Project's existing Tasks form. It does **not** create a Task automatically. The implementation and associated source-contract regression tests from PR #893 have been carried forward unchanged onto the latest main-based release branch after #894 merged; newer CRM and shared-navigation code is preserved. Exact-head hosted verification, branch currency, review and authenticated responsive acceptance must still be proven on the new PR. No schema, API or production action is part of this fix.

### Field page gate extended to owners — 2026-11-02

The `/field` page previously admitted technician-role accounts only: any other canonical role hit a "Technician workspace" empty state before any job request, so an owner-role founder account could not reach the field job view or its job-expense section even though the expense API is role-agnostic within the organization. The gate in `web/src/app/(app)/field/page.tsx` now admits exactly technician and owner; admin, dispatcher, manager, and unauthenticated requests are still denied before any job request, and no other page gate, API authorization, or RLS policy changed. The denied-state copy now reads "technician and owner accounts". Regression coverage in `web/src/app/(app)/field/page.test.ts` pins both directions: admin/manager/dispatcher still denied, technician and owner pass the gate and load the job list.

## Beta readiness control surface — merged PR #915; operator-isolation hardening in PR #928

- The read-only, refreshable `/beta-readiness` route merged via #915 on 2026-11-04 (merge commit `b566de4c9584444cff2f779614a179f8bf8f489d`). The route observes GitHub and Vercel metadata only; it links to `.github/workflows/beta-evidence.yml` without dispatching or replacing it.
- **Security finding:** the merged page checks the authenticated organization's owner/admin role but not whether that organization is the authorized TradeOS platform operator. Because the collector uses platform-level GitHub/Vercel readers, customer-organization admins could otherwise see shared release metadata. PR #928 adds a server-only exact operator organization UUID allowlist before any collector call. It intentionally denies all access until `TRADEOS_BETA_OPERATOR_ORG_ID` is explicitly configured in an approved environment; the ID is never embedded in client code or documentation. **Do not regard #928 as landed until it is separately reviewed and merged.**
- Source-level gate logic fails closed on missing required check policy, review threads, migration inventory/checksum proof, protected staging authorization, ledger/RLS/tenant validation, matching API/web deployment and runtime-binding identity, private receipt acceptance, 1440/1024/768/390 screenshots, concurrency/rollback evidence and final review. No operator toggle marks these passed.
- The completed Job handoff migration must never be replayed. #810 and #891 merged to `main` on 2026-11-04; #907 is the protected staging Expense runner, while #905 and #906 were closed **without merging** as superseded. As of the live 2026-11-04 read-only inspection, staging has 67 completed migrations, zero unfinished, and exactly the three Expense migrations pending. `job_expenses` and `job_expense_events` are absent; source merge is not a protected migration execution. Protected staging approval, effective API/web bindings, and authenticated owner/technician and tenant isolation remain unverified.
- Source merge and READY production-target deployment metadata are **not** authenticated staging release acceptance. See `docs/testing/BETA_CONTROL_SURFACE.md`.
- Review fixes on the PR branch: the PR card no longer shows a green verified tone unless reviews are approved and threads are resolved; timestamps render with a pinned locale/time zone so server and browser text match; settings errors other than 401/403 render a retryable unavailable state instead of a 404; Vercel observations filter to staging-branch deployments; PR review reads follow pagination; reviewer state ignores comment-only and pending reviews; and an approval counts only when it targets the current head. Required-check sourcing now reads the main branch ruleset (`GET /rules/branches/main`, unioned across applicable rulesets) instead of legacy branch protection, which 404s for main; required CI is verified only when a current-head success run matches both the required context and, when the ruleset binds one, the bound GitHub App id taken from the ruleset response itself (never hardcoded), and the policy read fails closed to unverified. The rules read needs no special scope on this public repository.
- Follow-up review fixes on the PR branch: required-check reads now also collect commit statuses for the head SHA (mapped without app identity, so a status can satisfy only an unbound requirement and never a bound one), and Vercel staging lookups page through deployments with a fixed page bound instead of stopping at the first 25.

- PR #921 adds operator-organization owner/admin-only visibility for the `More → Tools & admin → Beta readiness` link — resolved server-side in the app layout from the authenticated organization against `TRADEOS_BETA_OPERATOR_ORG_ID`, so a customer organization's owner/admin never sees it — while retaining the server-side route guard; it also adds a testable exact owner/admin role guard and updates the control surface's status presentation so closed-unmerged #905/#906 proposals display as **superseded**, not active merge conflicts. Twelve opt-in, read-only browser acceptance cases cover distinct authenticated synthetic operator-owner, technician, and other-customer-owner identities at **1440/1024/768/390**; ordinary CI skips these and **must not be counted as acceptance**. No valid synthetic state or protected runtime binding was available for live execution at this verification, so authenticated role/viewport acceptance remains **UNVERIFIED**.

- PR #921 adds a testable exact owner/admin role guard and updates the control surface's status presentation so closed-unmerged #905/#906 proposals display as **superseded**, not active merge conflicts. Twelve opt-in, read-only browser acceptance cases cover distinct authenticated synthetic operator-owner, technician, and other-customer-owner identities at **1440/1024/768/390**; ordinary CI skips these and **must not be counted as acceptance**. No valid synthetic state or protected runtime binding was available for live execution at this verification, so authenticated role/viewport acceptance remains **UNVERIFIED**.

### Brand Studio direct logo uploads — 2026-11-02 (PR #897, unmerged)

Brand Studio's four existing Settings-backed brand asset slots now accept a local raster file picker and drag/drop as a proposed frontend change instead of requiring users to paste image URLs. The flow reuses the existing server-authenticated `uploadSettingsAssetAction` / `removeSettingsAssetAction` and private proxy, and saves the canonical BrandProfile after uploading. It includes local preview, replacement and removal controls, with optional advanced URL entry retained. Only PNG, JPEG, WebP, GIF and ICO up to 4 MiB are supported; raw SVG, light-logo and cover-image file slots require separate reviewed work. This does not change backend authorization, Storage policies, tenant isolation rules or PDF rendering. Hosted exact-head CI, authenticated upload/reload/replace/remove at mobile and desktop widths, and cross-tenant refusal remain unverified release gates; no production deployment is implied. Replacing an image in a slot remounts that slot's preview after a successful upload: the upload returns the same canonical proxy URL, so without the remount the preview would keep showing the old bytes while the persisted profile keeps the canonical URL.

### Staging password-reset request failures now return truthful errors — 2026-11-03 (PR pending)

Staging /forgot-password returned "We couldn't process that request. Please try again." for every submit (reproduced in-browser 2026-10-31) with no reset email arriving, while the server log captured only the provider message. The request action collapsed every Supabase failure into that one generic message, and its redirect URL carried a `?next=/reset-password` query the /auth/confirm route does not need (it defaults `next` to /reset-password and only allows that path). The fix: the recovery redirect is now the bare /auth/confirm path, the server log records the provider status and code, and the client message is classified — rate-limit failures say to wait and retry, redirect/allowlist failures say recovery is misconfigured for the deployment, and anything else keeps the previous generic message. No message confirms whether an address has an account, and no provider error text is echoed to the client. Staging follow-up (not proven locally): confirm the staging Supabase project's Auth redirect allowlist contains the staging web origin, redeploy, and submit a live reset for the staging test account.

## PR #933 review repair — foreign Proposal proof

The PDF isolation check now requires an authenticated dedicated owner/admin in a pinned distinct synthetic organization and successful exact Proposal reads surrounding the smoke-account denial. Missing or deleted records cannot certify isolation from a 404. The evidence validator requires the ownership proof, workflow preflight/full checks include the new fixture credentials, and the cohort runbook explicitly requires retained PDF renderer results for the release SHA. This is evidence tooling only; live staging acceptance remains unverified.

PR #933 follow-up: fixture proof must belong to the same passing foreign-PDF probe; when route/status fields are present, they must match that proof’s Proposal ID and HTTP status. Legacy compact reports may omit those fields. Split proof/PASS entries and mismatched routes/statuses fail validation.

## Contractor walkthrough form repairs — 2026-11-06

The six-step synthetic staging walkthrough exposed two form usability defects. The
project-to-job form previously passed a single full `project.siteAddress`
string into the Street field and left City/State/ZIP blank. The job form now
splits only unambiguous comma- or newline-separated US addresses into their
structured fields; ambiguous free-form values are retained in Street and
explicitly flagged for human confirmation rather than guessed. Existing
customer service-address selection and its tenancy/API guards are unchanged.

The new- and edit-invoice Due date controls previously depended on browser-native
`type=date` interactions that do not accept ordinary keyboard typing reliably
across clients. Both now accept typed `MM/DD/YYYY` or `YYYY-MM-DD` with a separator-capable mobile keyboard, normalize
valid calendar dates to ISO `YYYY-MM-DD` before sending to the backend, reject
invalid dates in the server action, and preserve blank/clearable due dates.
No invoice lifecycle, payment, or sending behavior changes.

This code/contract update is **not** evidence of a deployed staging retest.
The producer → accepted proposal → job → draft invoice browser path requires a
fresh authenticated nonproduction acceptance run after deployment.

PR #931 / issue #927 (merged 2026-11-08 as `53e01c38`): provider-time delivery-status ordering is repaired in the merged branch. Known-message callbacks lock the journal row; older callbacks cannot replace newer status, while append-only events and sticky suppression candidates are preserved. Bounded parseable provider dates normalize to UTC. No schema/RLS change; tests use disposable PostgreSQL only. Route integration, protected staging application and signed callback proof remain open.

### TradeOS Motion System implementation — PR #918 (draft, branch `feat/tradeos-signature-motion`)

Branch `feat/tradeos-signature-motion`, PR #918 (draft), implementing the Billy-supplied TradeOS Motion System specification (21 sections, dated 2026-10-01), reconciled with the prior design pass in `docs/design/SIGNATURE_MOTION_SYSTEM.md` (see `docs/motion-system.md` for the full reconciliation, including the Figma looping Connection Line prototype, which is deliberately NOT shipped as an ambient loop). Scope is frontend-only: a Motion collection in `web/src/lib/motion/` (spec §02 tokens in TS + CSS, §17 interrupt coordinator keyed by organization + entity + request/revision, §16 reduced-motion preference, §05 integer-minor-unit price-delta model, §§06/13 lifecycle mapping), six presentation-only primitives in `web/src/components/motion/` (LifecycleLine, PriceDelta, ChangeDiff, ConnectionLine, ResolveSequence, StatusRegion — no fetches, mutations, timers confirming persistence, or `animationend` business logic), and the wired adapters (resolve, recalculate, connect, lifecycle) on the estimate, proposal, field, Today, and invoice surfaces. The estimate builder stage navigation moves a single copper marker to the acknowledged active stage (280ms transit, instant under reduced motion), with semantics, focus behavior, and the mobile contract test unchanged. No backend, schema, secret, or deployment change; the evidence workflow gained input guards and dispatch options only (unauthenticated estimate rejection, hyphen-leading `spec_file` rejection, `spec_file` exact-spec validation, targeted estimate runs require a draft route; TEST Org credential selection via `use_test_org`; targeted `spec_file` dispatch; optional read-only tenant verification via `smoke_org_id`) with no product-behavior change; no business state, permission gate, or financial control is touched. Validation on the branch: web unit suite 749 pass / 0 fail, web lint clean, web build succeeds, root pr:test 298/298, docs:check PASS. NOT yet verified: desktop/mobile/reduced/error browser evidence (§19 matrix was green on CI run 42319985720 at 390/768/1024/1440 on the pre-rebase head; re-run owed on the rebased head) and authenticated staging acceptance. Remaining adapters (actuals, boot completion states, field voice/photo/change/dependency states) are follow-ups in `docs/motion-system.md`, each needing its acknowledged-state seam verified before wiring. This entry records a branch, not a merge or deployment.

### TradeOS Motion System adapters — PR #918 (draft)

Second commit on the same branch (PR #918 draft; full record in `docs/motion-system.md`). Four adapters wired, each against a verified acknowledged-state seam; no backend, schema, workflow, secret, or deployment change; no business state, permission gate, or financial control touched.

- ResolveSequence → Athena interpretation: the assist page's "Athena review pipeline" card renders the draft line-item descriptions (verbatim, payload order) once a `StructuredAIEstimateDraft` payload has arrived and no newer generation is in flight; a regeneration invalidates the prior draft and shows the skeleton with the submitted scope captured verbatim. Human accept/apply remains the acknowledgement path; the sequence renders interpretation only.
- PriceDelta → estimate repricing: no caller carried previous totals, so the previous-totals source is the last server-confirmed estimate record, snapshotted in the pricing mutations' `onSuccess` before the refetch lands. The Price stage shows "Last recalculation" only when the saved total moved, with reasons (line item added/updated/removed, custom item added, overhead/tax saved, Athena suggestion added). Finalize, scope saves, and starter-catalog installs are excluded (no price change); a pricing-mode Apply snapshots with its own reason because changing the percentage reprices, and concurrent successes before the refetch mark the pending baseline ambiguous (never rendered as a per-edit delta, cleared once its refetch lands) instead of re-attributing their combined change. USD follows the product's existing money convention; estimates carry no currency field.
- ConnectionLine → estimate-to-proposal: the proposal detail snapshot card renders Estimate → Proposal confirmed only when `proposal.estimateId` is non-null, i.e. only for a created record. The creation form and preview page render no confirmed line.
- LifecycleLine → field, Today, invoice, payment: field selected-job progress for linear statuses only (paused/unscheduled/cancelled render no line); Today selected-job progress only for kind `job` items whose plain status string maps exactly onto the linear job lifecycle; invoice progress derived from record fields (sent by `sentAt`, partially-paid by more than one recorded payment (a single payment covering the invoice in full never passed through a partial phase), viewed never claimed completed for lack of a view signal); payment completion renders as paid only on `status === "paid"` with a reconciled zero balance — any other balance renders no line.
- Blocked with cause: actuals (no first-party actuals surface exists; Expense is target-only) and supplier-switch recalculation (no such UI exists, and the product invariant forbids it — estimate prices are snapshots that must not drift when Costbook changes). Nothing was fabricated for either.
- Validation on the branch, run on pre-rebase head b9e01be0 (the branch was rebased to 3c333630 after these results; they do not validate the rebased head): web unit suite 750 pass / 0 fail, web lint clean, web build succeeds, root pr:test 299/299, docs:check PASS. App backend suite untouched (CI runs it); §19 browser evidence still open (matrix green on CI run 42319985720 on the pre-rebase head; re-run owed on the rebased head). Two harness notes: the field vm-sandbox test allowlist gained stubs for the new field-page imports plus a "Scheduled (Current)" assertion, and the mobile contract test's `onAdded()` regex was widened to `onAdded(` for the intentional reason-carrying callbacks (the success-notification contract is unchanged; exact reasons are pinned by the new contract test). This entry records a branch, not a merge or deployment.
- CodeRabbit review repair (2026-11-08, review 5819226509 on the pre-head commit): the evidence workflow now rejects an unauthenticated dispatch carrying `estimate_stage_path` and rejects a hyphen-leading `spec_file` (CLI-option injection); `docs/README.md` states `use_test_org` selects TEST Org credentials only when `authenticated_smoke` is enabled and that `smoke_tenant_label` must match the TEST Org's Settings company name. `ResolveSequence` takes a caller-owned `generationKey`, and the assist page passes a per-regeneration counter, so a new Athena generation replays the reveal even with identical categories. The estimate builder clears a price-neutral pending recalculation snapshot once its refetch lands with the total unchanged, so it cannot suppress the next price-changing edit's delta; a moved total keeps its snapshot and a superseded snapshot is never cleared by an older refetch. The concurrent-success ambiguity policy is unchanged (the pending delta clears instead of re-attributing a combined change), and the pre-mutation-total capture and ambiguity-baseline-preservation findings were open as documented follow-ups, not silent changes (see the 2026-11-09 repair below). This entry records a branch, not a merge or deployment.
- CodeRabbit review repair (2026-11-09, review on head 516b17c6): the pre-mutation-total capture is implemented — every pricing mutation captures its pre-write total in `onMutate` and threads it through to the recalculation snapshot (remove, add, custom add, edit, pricing mode, overhead/tax; the Athena panel captures before its POST), with a contract test pinning the plumbing (`estimate-pricing-delta-contract.test.ts`). The ambiguity-baseline-preservation finding is closed as keep-clear: the concurrent-success policy is unchanged (the pending delta clears instead of re-attributing a combined change), per the PR contract, `price-delta.test.ts`, and this record. The evidence workflow now validates `spec_file` to one exact checked-in spec under `tests/playwright/` and rejects targeted estimate runs without a draft route (the estimate specs skip without one); the estimate-stage-path guard in both estimate specs rejects backslashes and verifies the resolved URL stays on the approved origin. Validation on the branch: web unit suite 751 pass / 0 fail, web lint clean, web build succeeds, root pr:test 300/300, docs:check PASS. §19 browser evidence still open (re-run owed on the new head). This entry records a branch, not a merge or deployment.
- Codex review repair (2026-11-10, thread on `web/src/lib/motion/price-delta.ts` line 106, head 7f6139e6): the 2026-11-09 keep-clear decision is superseded — Codex showed the clear-to-null policy has a real defect: when three pricing mutations succeed before the refetch lands, the second clears the snapshot to null, the third re-snapshots the same baseline, and the refetch then attributes all three changes to the third edit. The fix preserves the ambiguous baseline as a marker (`RecalculationSnapshot.ambiguous`) instead of clearing it: a second success against the same baseline marks it ambiguous, a third success keeps the marker (no re-snapshot), the Price stage never renders a delta for an ambiguous baseline, and the refetch clears the marker once it lands so the next edit snapshots the new baseline normally. `price-delta.test.ts` gains the two- and three-edit cases plus the post-refetch normal-snapshot case; the adapters contract test pins the render guard and the refetch clearing. Two CodeRabbit threads from review 5853795403 on the same head are also fixed here: the login-failure screenshot in `app/scripts/beta-evidence/auth-setup.mjs` now masks the visible email field (Playwright `mask`), so the failure evidence carries no credential material; and the 750/299 validation line above now states it was run on pre-rebase head b9e01be0, not the rebased head. Two further Codex threads from the re-review on head 094aea49 are fixed here as well: `MotionCoordinator` now stores the active request ID alongside the revision, and `isLatest()` / `acceptEvent()` require both to match, so a retry at an unchanged revision supersedes the earlier request (regression test added); and the evidence-workflow route guard now covers every estimate spec (`*estimate-*.spec.ts` — all five carry the skip guard), so a targeted run cannot report green while skipping every test. Validation on the branch: web unit suite 753 pass / 0 fail, web lint clean, web build succeeds, root pr:test 363/363, docs:check PASS. This entry records a branch, not a merge or deployment.

## Staging runtime identity evidence — proposed repair, 2026-11-12

Issue #759 now has a proposed read-only web `GET /api/staging-runtime-identity`
endpoint, available only on Vercel Preview builds of `staging`. It reports a
validated full commit and allowlisted public Supabase/backend destinations,
fails closed for unexpected values, and never reads or returns credentials.
This replaces neither authenticated tenant proof nor key provenance checks.
Live API/web staging still serves `c800425f`. Team & Time was updated to ACTIVE
v7 with the reviewed declined-assignment filter; fetched source matches the
repository, JWT verification remains enabled, and unauthenticated access returns
401. Authenticated role/tenant acceptance remains pending.
All 71 staging migration names/checksums match main;
do not replay them. See [the staged release sequence](operations/staging-runtime-parity.md).

Update 2026-11-25 (S071): the endpoint now also reports `environment: "preview"` in its 200 body (the Vercel environment it already gated on), and API `/health` now reports `environment` (`production` | `preview` | `development`, from `VERCEL_ENV`, omitted when unrecognized). The canonical identity contract in `app/scripts/beta-evidence/lib/deployment-identity-contract.mjs` verifies commit, environment, backend host, and data-plane identifier from these runtime surfaces and fails closed on any mismatch, missing value, or unparseable identity — no secret or env inventory is fetched.

## Beta evidence fixture mismatch repair — 2026-11-12

Staging run `43130359603` passed runtime and migration gates but failed after
login because the selected smoke account did not match the configured tenant.
The proposed repair adds an explicit TEST Org option using existing encrypted
TEST_STAGING credentials, pinned to a live-verified active synthetic owner org.
It rejects mismatched environment/UUID/label and never falls back on missing
credentials. Actual authenticated organization assertion and tenant denial remain
unchanged. No credential or membership mutation is performed.

### Invoice creation recovery ergonomics — 2026-11-13

Existing invoice PR #956 now includes actual project/customer context, the
approved 680 px maximum workspace, scoped 44 px controls/actions, numbered
mobile manual-line controls, error-context keyboard focus and a compact
last-submission summary while a save is unconfirmed. Retry remains explicit and
uses the retained original payload/key; pending editors are disabled, and
success opens the existing server-ID invoice detail route. No send/payment or
pricing authority changes. Figma reference frames: 1179:2800, 1179:3484 and
1183:3546 in the canonical master. Four-width isolated component regression is
added; authenticated deployed acceptance remains a separate release gate.

## Job revision propagation — 2026-11-13

Field transition forms retain the loaded Job revision and dispatcher schedule,
reschedule and dispatch actions send the revision from the displayed list row.
Job list summaries now include `updatedAt`. Missing or malformed revisions fail
closed with refresh guidance; stale backend responses remain visible as errors.
This connects the optional Job optimistic-concurrency API to normal UI actions;
no lifecycle, role, tenant or migration semantics are changed.

## Proposed Costbook Codes & Permits branch — 2026-11-08

Branch `feat/costbook-codes-permits-vigo-pilot` adds a static, cited, read-only Vigo County / Indiana code-reference index, strict authenticated `GET /api/v1/costbook/codes` route, Costbook `Codes & Permits` page and tests. It deliberately marks parcel applicability **unverified** and does not create Cost Items, prices, permits, inspections, migrations, Athena claims, or estimate changes. This is **proposed** work until CI, review, merge, deployment identity and authenticated mobile/desktop acceptance are verified; no live release is claimed. See `docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md`.

## Codes & Permits DB registry — issue #946 TODO 2 (draft 2026-11-09)

Branch `feat/codes-permits-registry-946` (base is now `main`; TODO 1 merged as #945 on 2026-11-15, `8c2bd9f4`) moves the pilot index into the database: migration `20261109220000_add_codes_authority_jurisdiction_source` adds `codes_authority`, `codes_jurisdiction`, `codes_source` and append-only `codes_source_history`, all `FORCE ROW LEVEL SECURITY` with authenticated-read-only policies (no tenant write policies; writes await the governed ingestion path in TODO 3). The six pilot references are seeded as `reviewed` rows; `GET /api/v1/costbook/codes` now reads the DB with an unchanged response shape, validation, cache directive, permission gate and advisory status (row ids are stable seed UUIDs instead of pilot slugs). The in-code registry remains the seed source — and, until TODO 7, the Athena tool's read path. No pricing, CostItem, estimate or tenant data lives in these tables; the no-duplication proof is in `docs/architecture/COSTBOOK_CODES_PERMITS_PILOT.md` with executable assertions in `app/tests/costbook-codes-registry.migration.test.ts` and `app/tests/costbook-codes-registry.rls.integration.ts`. Schema/migration is PR-only: merge needs independent review or Billy's ADR-009 authorization, and any staging migration apply is his gate click. RLS integration coverage is CI-authoritative (local runs need docker `postgres:16-alpine`).

## Athena Codes & Permits pilot integration (proposed 2026-11-08)

This same draft feature branch additionally registers a `costbook.read` gated read-only Athena tool for the shared official-source registry, with SDK contract tests. No new authoritative location provider, pricing writer, approval record, schema/RLS policy, or human-compliance decision is implemented. Hosted app/web/Athena/docs checks **passed** at exact executable-code commit `2f888d7e87d93fae6e36cc098543f1a99b318529` (GitHub run #42462868320). Independent review, protected staging/runtime identity, exact-head authenticated browser verification and source-law currency remain unverified; subsequent docs-only edits need their own current-head checks.

## Administrative membership provisioning repair — 2026-11-14

A restricted-role PostgreSQL reproduction confirmed that member upsert failed at application-user RLS for both new users and existing identities outside the organization. The bounded repair uses the existing provisioning policy only after database-backed administrator validation, preserves foreign user profiles, and commits user/membership/audit changes together. Source and disposable-database checks do not establish live staging offboarding acceptance.
## Proposed direct offline proposal approval — not yet deployed

Following a verified six-step synthetic staging contractor walkthrough, a
staff-recorded offline acceptance workflow is implemented on
`feat/proposal-offline-acceptance-audit` (draft PR pending review). It makes
the field-use case explicit: a customer may approve an already-finalized,
positive-price written proposal in person, by phone, or via signed copy,
without staff faking a `Send` action. The separate endpoint uses
`documents.manage`, org-scoped CAS, an actor/method/required-note audit
record, and no outgoing email or sent timestamp. Existing portal/customer
approval and normal `sent -> accepted` remain untouched. Authenticated
nonproduction acceptance, required CI and independent review are release
gates; do not interpret presence on a branch as deployed functionality.

## Offline approval privacy correction — proposed, awaiting review

The proposed staff-recorded offline acceptance audit is intentionally
internal. `CustomerPortalService.getProposal` and the portal project
proposal-list projection redact internal approval-channel/note metadata,
preserving only `staff_recorded_offline` so UI can label the customer-visible
milestone without misrepresenting email delivery. Backend audit history is
unaltered. Unit regression tests assert both portal paths cannot expose staff
notes. This is branch work, not a deployed or verified staging behavior.

## Codes & Permits jurisdiction matching and Estimate hints — 2026-11-09 (issue #946, TODO 4, PR pending)

Verified parcel/jurisdiction matching, tenant-scoped job assessments, and read-only Estimate Scope/Review hints are proposed in branch `feat/codes-permits-jurisdiction-matching-946`. The pure matcher (`app/modules/costbook/codes/jurisdiction.ts`) resolves governing jurisdictions only from reviewed, current records in the TODO 2 shape and fails closed to `needs_verification` whenever a required fact is missing, stale, or ambiguous — distinguishing legal parcel boundary vs road edge, right-of-way/easements, incorporated vs unincorporated areas, zoning overlays, and on-/off-premises sign categories. It never infers a setback, footing diameter/depth, wiring method, or permit fee. `codes_job_assessment` (migration `20261109220000_add_codes_job_assessment`) stores explicit Project/Estimate context, work type, citations with rationale, unknowns, needs-review statuses, and owner signoff under forced RLS, with live cross-tenant coverage in `app/tests/rls.integration.ts`. The Estimate hints disclosure (Scope and Review stages) is read-only and financially inert — the saved total is echoed verbatim with `financialEffect: "none"`, proven by `app/tests/costbook-codes-hints.test.ts`. The Route 63 acceptance case is an automated test, not a doc claim: the ~20 ft sign / ~250 ft electrical path / hand-mixed footing request resolves to `needs_verification` with all seven open-question topics and no inferred values.

Merge order: merge TODO 2's authority/jurisdiction/source tables first for live record resolution — this PR's migration has no foreign key to them and applies cleanly on its own, and the API's record store is empty (fail-closed) until a database-backed store replaces it. The pilot registry (PR #945) is not duplicated here. Hosted exact-head CI, staging migration application, and authenticated four-width acceptance remain unverified release gates; no production deployment is implied.
## Codes & Permits governed source ingestion — issue #946 TODO 3, draft PR (2026-11-09)

The official source/review pipeline for Codes & Permits is implemented as a draft, API-only slice on branch `feat/codes-permits-ingestion-946`, per `docs/architecture/COSTBOOK_CODES_INGESTION.md`. It fetches one allowlisted official URL per explicit owner/admin call (`POST /api/v1/costbook/codes/sources/ingest`, `costbook.manage`), hashes the bytes (sha256), and versions the TODO 2 `codes_source` table: unchanged content is an idempotent no-op, changed content creates a new `research` version and supersedes the old head, and nothing auto-publishes — only `POST /codes/sources/:id/approve` (or `:id/reject` with a required reason) flips `research` to `reviewed`/`superseded`, with a `codes_source_history` entry and an org-scoped `ActivityEvent` per decision. When changed content arrives while the current head is still in `research`, the ingest itself supersedes that research head — an ingest-driven supersede transition, distinct from a review decision; approve/reject never perform this ingest transition. Fetch is confined to `vigocounty.in.gov` and `in.gov` (including subdomains), https only, manual redirects re-validated (max 3), 15 s timeout per fetch hop, 5 MiB cap; fetched bytes are hashed and discarded, never stored. Reads (`GET /codes/sources`, `/review-queue`, `/:id`) require `costbook.read` and attach stale/superseded warnings. RLS is global-read with ingestion-only writes under a transaction-local `app.codes_ingestion` flag. There is no background fetch, scraper, or cron in this slice.

**Merge order and blockers:** this PR depends on TODO 2's tables and must merge after TODO 2 (merge chain #945 → #960 → this PR) — its migration (`20261109220000_add_codes_source_ingestion_rls`) fails hard if `codes_source`/`codes_source_history` are missing, and its live RLS integration tests cannot pass until TODO 2 lands. The TODO 2 contract was verified against PR #960 head `9cdea60d` (history is an event log, `reviewed_by` is TEXT, hash/label NULLABLE, version chain keyed by `(authority_id, code_family, citation)`); no contract assumption remains open. The migration shares timestamp `20261109220000` with TODO 2's migration — alphabetical ordering puts TODO 2's directory first. No production or staging migration, deployment, or browser acceptance is part of this PR; the review-queue UI is a later slice.

## Estimate customer materials checklist — proposed source, 2026-11-13

The independent feature branch `feat/estimate-materials-shopping-pdf-20261113` proposes a read-only customer materials panel and tenant-scoped PDF download based on saved explicit material Estimate lines. It omits all stored cost/sell fields, exposes preview/download through the existing authenticated documents proxy, and warns that assemblies are not decomposed. No schema, RLS, financial formulas, or lifecycle transitions change. This is **branch source only** until exact-head hosted CI, review and merge; no deployed four-width/authenticated acceptance or production delivery is claimed.

## Google Gemini model provider for Athena — 2026-11-23 (branch `feat/athena-gemini-provider`, PR pending)

The first real model provider behind the `AthenaProviderAdapter` seam: `GoogleGeminiAthenaProvider` (`app/modules/athena-kernel/provider.ts`), selected by `ATHENA_PROVIDER_MODE=google` with `GEMINI_API_KEY` and `ATHENA_GEMINI_MODEL` (default `gemini-3.5-flash-lite`). It calls the Google AI Studio API (`POST /v1beta/models/{model}:generateContent`) with global `fetch` and no new dependency; the key travels in the `x-goog-api-key` header only, never as a query parameter, and never appears in errors, logs, or telemetry. A real answer needs two flags, `ATHENA_KERNEL_ENABLED=true` and `ATHENA_DRAFT_RESPONSES_ENABLED=true`; `google` without a key fails closed to the disabled provider. The adapter is draft-only (one stateless call, no tools, no approval/write path — the DEV-17 S12 findings are unchanged), renders only the minimal A1 context into the prompt bounded by `ATHENA_CONTEXT_BUDGET`, and maps token counts from `usageMetadata` to `estimatedUsd` at the checked paid-tier rates ($0.30/1M input, $2.50/1M output, checked 2026-11-23). Known gap: `GET /api/v1/athena/capabilities` reports kernel state only, not provider health. This is branch source only until exact-head hosted CI, review, and merge; staging-first verification with a real Gemini call (API key supplied by the founder via the Secure Vault) is required before any production env change, and no production flag flip or env var is part of this PR.

## Quantity-extraction ReDoS fix — 2026-11-24 (CodeQL #33–#37, #39, branch `fix/codeql-quantity-redos`, PR pending)

The quantity regexes in the AI estimator (`knowledge-runtime/matcher.ts`, `ai-estimate-assist/structuredEstimator.ts`, `ai-estimate-assist/service.ts`) backtracked polynomially on digit runs: a 10,000-digit scope cost ~430ms per pattern. They are replaced by the shared linear-time scanner `app/modules/shared/quantityText.ts` (`findNumberUnitMatches`), which preserves the regexes' leftmost-match semantics with no backtracking (same 10,000-digit scope: ~2ms). Behavior is pinned by the differential test `app/tests/quantityText.test.ts` (curated corpus + 300 seeded pseudo-random fragments vs the original regexes). No API contract, quantity value, confidence score, or matched target changed. This is branch source only until exact-head hosted CI, review, and merge; no deployed or staging acceptance is claimed.

## Bearer-token extraction ReDoS fix — 2026-11-24 (CodeQL #19, #4, branch `fix/codeql-bearer-redos`, PR pending)

The `Authorization` header was parsed with `/^Bearer\s+(.+)$/i` in `requireAuth` (`app/backend/middleware/auth.ts`) and bootstrap (`app/backend/controllers/auth.controller.ts`); the overlapping `\s+` / `.+` quantifiers backtracked polynomially on whitespace-heavy headers (~490ms for a 10k-space / 10k-text header). Both sites now use the shared linear parser `extractBearerToken` (`app/backend/auth/bearer.ts`), which mirrors the regex exactly — case-insensitive "Bearer", ≥1 whitespace, non-empty token, no line terminators anywhere (`$` matches only at the absolute end of input, so a trailing terminator is rejected, not stripped). Equivalence is pinned by a differential test (`app/tests/bearer.test.ts`: curated cases + 300 seeded pseudo-random headers vs the original regex as oracle, plus a linear-time adversarial case). No header is accepted or rejected differently; no role, permission, membership, or RLS rule changes. Auth surface = protected category: the PR body carries the ADR-009 record citing the 2026-11-21 blanket authorization. This is branch source only until exact-head hosted CI, review, and merge; no deployed or staging acceptance is claimed.

## Tag slugify ReDoS fix — 2026-11-24 (CodeQL #38, branch `fix/codeql-slugify-redos`, PR pending)

The tag-name `slugify` helper trimmed edge dashes with `/^-+|-+$/g`, which backtracked polynomially on long interior dash runs (147ms for a 10k-dash run). The trim is now a linear index scan (`trimEdgeDashes` in `app/modules/intelligence/service.ts`); the `/[^a-z0-9]+/g` collapse step is already linear and is unchanged. `slugify` is exported and covered by behavior + timing tests in `app/tests/intelligence.service.test.ts`; generated slugs are byte-identical to before. This is branch source only until exact-head hosted CI, review, and merge; no deployed or staging acceptance is claimed.
