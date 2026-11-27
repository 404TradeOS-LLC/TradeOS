# ABC Supply sandbox catalog — read-only live evidence

**Issue:** [#735](https://github.com/404TradeOS-LLC/TradeOS/issues/735)
**Workflow:** [ABC Supply sandbox Product API evidence](../../.github/workflows/abc-sandbox-catalog-evidence.yml)
**Scope:** Live validation of the server-token Product API contract. **Not** catalog import or price approval.

## Provider and legal boundaries

- Official [Get All Items](https://apidocs.abcsupply.com/get-all-items/) and [Search Items](https://apidocs.abcsupply.com/search-items/) documentation: Third-Party Aggregator server token with `client_credentials` + `product.read`; fixed sandbox host only.
- [ABC Terms of Use](https://www.abcsupply.com/legal/) disallow constructing permanent copies/databases of ABC content without permission and limit cache retention. This workflow holds product attributes and identities in memory for at most two pages and reports only counts. It has **no** database credentials, network targets configurable by an operator, upload-artifact step, customer pricing grant, or Material/Estimate mutation.
- Running the proof does not authorize production provider endpoints or unattended customer-specific pricing.

## One-time authorized setup

The repository or dedicated GitHub **abc-sandbox** Environment must contain these protected, sandbox-only secrets, entered via GitHub rather than chat:

- `ABC_SUPPLY_SANDBOX_CLIENT_ID`
- `ABC_SUPPLY_SANDBOX_CLIENT_SECRET`

These secrets represent the ABC Supply Third-Party Aggregator sandbox application with **product.read** entitlement. Do not paste their values into an issue, PR, console, log, or this runbook. Existing Vercel environment variables are **not automatically available** to GitHub Actions; treat missing secrets as an external setup task, not a successful probe.

## Execute

1. Go to **Actions → ABC Supply sandbox Product API evidence** on the canonical repository; select branch **main**.
2. Click **Run workflow** and enter `VERIFY_ABC_SANDBOX_PRODUCT_READ`.
3. Start with **two_pages = false**; a first-page proof is sufficient for Gate A. Optionally repeat with two pages to validate cross-page count/identity behavior.
4. Review the **job conclusion** and its sanitized **GitHub Step Summary**. The report includes provider-reported totalItems/totalPages and the number of actual active products returned, **not** an imported-record count. Do not infer a full catalog was imported from these metadata totals.
5. Link the successful run URL and its deployed/source commit to issue #735. Do not claim a hosted UI pass, database import, customer quote, or production readiness from this result.

Failure exit codes contain no raw token or provider payload. Missing credentials, insufficient `product.read` entitlement, provider HTTP denial, empty sandbox catalog, invalid schema, pagination drift, or duplicated ABC identities must be investigated, not waived. Do not repeatedly retry arbitrary hardcoded SKUs.

## Phase 0 census (#735) — three 1000-item pages

Phase 0 ("prove the numbers") reuses this workflow with `phase0 = true`
(and the same `VERIFY_ABC_SANDBOX_PRODUCT_READ` confirmation). It runs
`scripts/probe-abc-sandbox-catalog.ts --phase0`, which fetches exactly three
pages at `itemsPerPage=1000` plus one hierarchy page at 50, times each page,
and records a field census over the sampled raw items — which response fields
are actually populated in sandbox, UOM roles, dimensional variations, and
hierarchy nesting order. `familyItems=true` is requested so the census measures
that field instead of the provider's null default; top-level `variations` is not
a Get All Items field and is not counted (dimensional variations are counted
under `dimensions.variations`). Phase 0 uses a 120 s per-request timeout with
2 attempts (the workflow allows 20 minutes) because 1000-item pages exceed
the 12 s interactive timeout — the first run (45901367450) failed with the
generic `provider_or_schema_failure` after ~43 s, consistent with repeated
12 s timeouts. If a later run still fails, the probe now reports a distinct
code instead (`provider_request_failed`, `provider_unavailable_http_*`, or
`schema_mismatch:<field-paths>`, never payload values). The hierarchy census
records shape deviations as findings (`<level>:missing-code`,
`<level>:missing-label`, `<level>:not-object:<kind>` with counts) instead of
failing the run: the second live run (45904451563, on the merged timeout fix)
ran ~51 s and failed with `catalog_probe_hierarchy_shape_mismatch` because
real sandbox hierarchy levels do not all carry `code`/`label` as the docs
describe, and failing closed discarded the main-page numbers along with the
finding. The probe still fails closed on pagination drift, duplicate
identities, and any price-like key — only hierarchy shape is census data.
The hierarchy page is read through the probe-only `listHierarchyRaw`
(no `hierarchyPath` mapping), because the strict `listHierarchy()` throws
on a level missing `code`/`label` and would abort the run on the same data
the census describes (CodeRabbit on #1129); the strict reader stays the
mapped path for product surfaces, and the raw page's hierarchies are
censused for findings too. The step summary is also echoed to the job log:
the summary markdown is only readable in the authenticated web UI, so the
log is the API-retrievable record of the run's numbers. It reports only counts, latencies, and population
tallies to the step summary (`totalItems`/`totalPages`, page latency p50/p95
nearest-rank over the 3 pages, census table, hierarchy totals and shape
findings, and an estimated full-catalog storage range at 2–5 KB/item before indexes). No item
numbers, names, descriptions, tokens, or payload content are logged or
uploaded, and nothing is stored: `storedProducts` is 0 and the probe fails
closed if any price-like key appears in a payload. Post the run's numbers to
issue #735; the storage estimate is a planning figure — confirm DB headroom
against the Supabase plan before Phase 1, since no plan/limit record exists
in the repo. The default (`phase0 = false`) one/two-page proof is unchanged.

## Beyond this gate

Persistent catalog replication, full-page ingestion, delta checkpoint retention, images, and supplier data re-display need written ABC permission for the intended rights model. Only after that permission should a separately governed storage/import/RLS change be merged and activated. Customer Ship-To/branch authorization and positive Price Items evidence use the existing independent **user-present** pricing lane.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c73c56a04fb8d8be0e96ff75f027acea1d844fbfc29b563ddd73c233ae860346 -->

### Phase 0 acceptance and follow-up risks (#1125, #1129)

A green CI run with mocked provider responses does **not** satisfy the live gate. PR #1129 fixed the abort on missing hierarchy code or label by separating the probe's raw reader from the mapped Costbook reader. The following checks still apply to [issue #735](https://github.com/404TradeOS-LLC/TradeOS/issues/735):

- **Verify that both provider responses exclude pricing.** The [probe](../../app/scripts/probe-abc-sandbox-catalog.ts) scans catalog items only, stops beyond depth 10, and does not scan the raw hierarchy entries introduced by #1129. The [client](../../app/modules/supplier-integration/abcCatalog.ts) also projects the parsed hierarchy response before returning it, so checking entries alone would leave envelope fields untested. Apply the price key check to both response bodies before projection, fail closed if the scan cannot finish, and add cases for deep catalog keys and hierarchy keys in entries and the envelope. Keep provider values out of output, artifacts, and product routes.
- **Distinguish hierarchy entries from usable paths.** The current report counts every returned hierarchy entry as a path, even when it lacks `productGroup`. The census skips non-object catalog item hierarchy roots and treats a missing first level as an absent next level. An empty hierarchy page can also pass with a positive provider total. Report returned entries separately from usable paths, distinguish absent optional hierarchy from malformed roots, and check returned counts against provider totals. Keep malformed levels as findings. Test malformed roots, legitimate partial paths, and an empty page with a positive total. Treat findings as sample observations; if Phase 1 needs complete hierarchy, confirm with ABC which missing fields are expected before relying on them for mapping.
- **Verify catalog rows returned, not just requests completed.** The probe accepts later empty or short pages with stable totals. Reconcile each returned row count with the provider pagination contract, including a valid partial final page. Add regression cases for empty later pages and inconsistent totals, and separate the requested page size from the actual rows returned per page.
- **Exercise the report step without credentials.** The [workflow](../../.github/workflows/abc-sandbox-catalog-evidence.yml) selects its validation branch from the reported status and accepts Phase 0 with fewer than three pages. It assumes the findings map exists and renders an empty map as “all sampled levels well-formed,” even when no hierarchy was observed. Bind the status to the requested mode, require three pages at a requested size of 1,000 with three latency samples, and validate the findings map before rendering. Exercise the actual report step with both modes, populated and empty findings, no hierarchy observed, a missing findings map, and mode or page count mismatches.
- **Record live evidence before accepting Phase 0.** The merge evidence contains no successful live Phase 0 run. An authorized operator should dispatch from `main` with `phase0 = true` and the confirmation above. Record the run URL and source SHA, provider totals, actual sample sizes, census highlights, hierarchy findings, p50/p95, and storage estimate on #735. If it fails, record the redacted failure code and leave acceptance open. The three sampled pages cannot establish full catalog field coverage; the reported p95 is the maximum of the three page timings.

Before Phase 1 changes any schema, record the available Supabase disk headroom and a capacity budget that includes indexes and room for refreshes. Reconcile the written shared-reference-copy permission recorded on #735 with the proposed retention, searchable display, images, and delta checkpoints before enabling those uses. Require migration rehearsal and database-backed access tests showing that shared reference reads grant no access to another tenant's data or pricing, and that ordinary tenant roles cannot write the shared catalog. PRs #1125 and #1129 add no persistence, tenant access, migrations, or RLS changes; these checks apply to the future importer.

<!-- /coderabbit-ai-generated:v1 -->

## Phase 1 — schema + RLS (issue #735)

Phase 1 (migration `20261127010000_add_abc_shared_catalog`) resolves the
Phase 1 gates listed above, except the Supabase headroom check, which stays
open (see below). No importer code exists yet; the four catalog tables are
empty after the migration and the Phase 2 importer fills them.

- **Migration rehearsal: done.** Rehearsed on a disposable local Postgres
  16 cluster (trust auth, no credentials): all 91 migrations applied
  cleanly via `prisma migrate deploy`; tables verified empty; the global
  supplier row seeded exactly once with an idempotent re-insert; RLS
  enabled + forced with all 17 policies present; live RLS behavior
  spot-checked as a non-superuser role (tenant read sees rows, tenant
  INSERT fails 42501, tenant UPDATE/DELETE affect 0 rows, flag-session
  INSERT/UPDATE succeed, DELETE still affects 0 rows). The rehearsal
  caught one real bug before the PR: the partial unique index predicate
  did not match the `ON CONFLICT` specification (`42P10`); the index
  predicate was simplified to `WHERE org_id IS NULL`.
- **Database-backed access tests: done.** `app/tests/rls.integration.ts`
  ("abc shared catalog RLS") proves against a live database: any org can
  read items, hierarchy, sync runs, sync state, and the global supplier
  row; no org can write any catalog table (INSERT 42501, UPDATE/DELETE 0
  rows) or update the global supplier row; the background session can
  write under the `app.abc_catalog_ingestion` flag; DELETE is denied even
  under the flag. `app/tests/abcCatalog.migration.test.ts` guards the
  migration shape (org-less tables, no price column, forced RLS,
  ingestion-only writes, global supplier seed).
- **Hierarchy decision: table, not view.** `abc_catalog_hierarchy` is a
  real table because hierarchy is seeded from its own endpoint
  (9,059 paths per Phase 0), a view over items would miss paths with no
  imported item yet, and hierarchy browse needs its own index
  (`path_key` PK + GIN on `levels`). Empty level nodes (8 per level in
  the Phase 0 sample) collapse to `''` in `path_key` and are preserved in
  `levels`; they do not fail the import. Phase 1 does not need complete
  hierarchy — it stores paths as returned and browse tolerates partial
  paths — so the #1130 question (confirm with ABC which missing fields
  are expected) is deferred to Phase 4 browse if it ever needs complete
  hierarchy, not answered here. The Penny questions about empty
  hierarchy nodes and 0-populated `branches` need no answer for Phase 1:
  the schema stores what the provider returns and Phase 2 does not use
  `branches` (availability is a live per-user check, never stored).
- **Global supplier row: migration-seeded.** One global (org-less) ABC
  Supply row, fixed id `73500001-0000-4000-8000-000000000001`,
  `apiIntegrationKey` `ABC_SUPPLY`, idempotent `ON CONFLICT`. A partial
  unique index guarantees at most one global row per integration key, and
  `suppliers_global_select_policy` makes org-less rows readable by any
  authenticated session. The per-org ABC rows and
  `ABC_SUPPLY_SANDBOX_SUPPLIER_ID` in the pricing lane are untouched
  until Phase 5 adoption switches to the global row.
- **Capacity headroom: still OPEN.** No Supabase connector exists in this
  environment and no plan/limit record exists in the repo, so no disk
  figure was guessed. Exact check before the Phase 2 import: in the
  Supabase dashboard for refs `kssaceuetdjwfqnbzhly` (prod) and
  `qfbgdkbamfaasmtjfyru` (staging), Settings → Database → disk usage vs
  the plan's included storage, confirming ≥ ~2 GB free for the 0.53–1.32
  GB catalog (Phase 0 estimate, before indexes) plus trigram/GIN indexes
  and refresh headroom. Record the numbers on #735 when the check runs.
- **Permission reconciliation:** the stored-field list is exactly the
  allowed reference fields (item number, description, manufacturer,
  hierarchy, UOMs, dimensions, plus the directly attached reference
  fields the Product API returns); no prices, no images (none served
  today), no availability/branches, no redistribution outside TradeOS.
  Retention is soft-deactivation only — rows are never hard-deleted, so a
  purge on ABC's direction (if ever required) is a deliberate Phase 6
  operation, not an automatic one.
