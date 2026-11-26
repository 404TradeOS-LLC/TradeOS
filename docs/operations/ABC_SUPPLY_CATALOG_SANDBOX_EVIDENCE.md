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
hierarchy nesting order. It reports only counts, latencies, and population
tallies to the step summary (`totalItems`/`totalPages`, page latency p50/p95
nearest-rank over the 3 pages, census table, hierarchy totals, and an
estimated full-catalog storage range at 2–5 KB/item before indexes). No item
numbers, names, descriptions, tokens, or payload content are logged or
uploaded, and nothing is stored: `storedProducts` is 0 and the probe fails
closed if any price-like key appears in a payload. Post the run's numbers to
issue #735; the storage estimate is a planning figure — confirm DB headroom
against the Supabase plan before Phase 1, since no plan/limit record exists
in the repo. The default (`phase0 = false`) one/two-page proof is unchanged.

## Beyond this gate

Persistent catalog replication, full-page ingestion, delta checkpoint retention, images, and supplier data re-display need written ABC permission for the intended rights model. Only after that permission should a separately governed storage/import/RLS change be merged and activated. Customer Ship-To/branch authorization and positive Price Items evidence use the existing independent **user-present** pricing lane.

A green CI run with mocked provider responses does **not** satisfy this live-provider gate. The dedicated manual action requires real sandbox client credentials and must actually finish successfully.
