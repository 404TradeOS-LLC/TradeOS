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
It reports only counts, latencies, and population
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

<!-- coderabbit-ai-generated-section:v1:3b5e99c3817326c2a72daffd6488d1e4881a814ae29674f3916c0dc773b4df23 -->

A green CI run with mocked provider responses does **not** satisfy this live-provider gate. The dedicated manual action requires real sandbox client credentials and must finish successfully.

### Follow-up risks from PR #1125

Review these checks against the merged probe before accepting the census on [#735](https://github.com/404TradeOS-LLC/TradeOS/issues/735).

- **Verify rows returned, not just requests completed.** The [Phase 0 probe](../../app/scripts/probe-abc-sandbox-catalog.ts) requires a nonempty first page and stable pagination metadata, but it counts later empty or short pages as verified. With synthetic responses reporting 3,000 items across three pages, it reported success after sampling just one item. Reconcile each page's returned row count with the provider pagination contract, including a valid partial final page. Add regression cases for empty later pages and inconsistent totals, and report per-page row counts.
- **Make the price and hierarchy checks match the stated guarantees.** The price-key scan stops beyond depth 10 and runs only on catalog item objects, so it misses deeper keys and fields outside those objects. The [client](../../app/modules/supplier-integration/abcCatalog.ts) maps the separate hierarchy response before the probe sees it; a malformed nested node can be truncated into a partial path, and the probe can report success with zero paths despite a positive provider total. Validate the intended raw response boundaries before projection and fail closed if the scan cannot finish. Test deep price keys, malformed hierarchy roots and levels, and a positive hierarchy total with no paths. Keep failures redacted and raw data out of logs, artifacts, and product routes.
- **Exercise the workflow's report step without credentials.** The [workflow](../../.github/workflows/abc-sandbox-catalog-evidence.yml) chooses the validation branch from the summary status and accepts a Phase 0 summary with fewer than three pages. Bind the expected status to the requested mode and require three pages at 1,000 items per page and three latency samples for Phase 0. Run the actual report step against valid summaries for both modes, a status/mode mismatch, and an incomplete Phase 0 summary.
- **Record live evidence before accepting Phase 0.** The merge evidence contains no live Phase 0 result. Have an authorized operator run the workflow from `main` with `phase0 = true` and record the run URL, source SHA, provider totals, actual rows per page, census highlights, latency, and storage estimate on #735. If the run fails, record the redacted failure code and leave acceptance open. Label the requested page size separately from the returned rows. The first three pages cannot establish field completeness across the full catalog, and the reported p95 is the maximum of those three timings.

Before Phase 1 changes any schema, record the available Supabase disk headroom and a capacity budget that includes indexes and room for refreshes. Reconcile the written shared-reference-copy permission recorded on #735 with the proposed retention, searchable display, images, and delta checkpoints before enabling those uses. Require migration rehearsal and database-backed access tests showing that shared reference reads grant no access to another tenant's data or pricing, and that ordinary tenant roles cannot write the shared catalog. PR #1125 adds no persistence, tenant access, migrations, or RLS changes; these checks apply to the future importer.


<!-- /coderabbit-ai-generated:v1 -->
