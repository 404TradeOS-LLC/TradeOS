# Jones & Sons supplier import — raw crawl artifacts

Raw and normalized evidence for Jones & Sons (jonesandsons.com), a
branch-aware Shopify retailer with selectable branches including Terre
Haute, Vincennes, Washington, and Bloomfield, Indiana. Pricing and
availability depend on the selected branch — a price observed on a
product page is **not** automatically Terre Haute pricing.

This directory is the audit trail. The governed production path is
`app/modules/costbook/jonesAndSonsTerreHaute.ts`, which turns records here
into Costbook research candidates (see
`docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md`) — never a direct
write to a tenant's Material/CostItem catalog.

## Verified network-egress blocker (2026-09-12)

The session that authored this import could not reach jonesandsons.com at
all: `WebFetch` returned `EGRESS_BLOCKED` for `jonesandsons.com`. To rule
out a site-specific block, a control request to an unrelated domain
(`www.bls.gov`) was attempted and returned the identical `EGRESS_BLOCKED`
error — confirming a general sandbox network-egress restriction, not
something specific to this supplier. `WebSearch` (a separate backend) still
worked and surfaced a handful of additional real product URLs by indexed
snippet, but returned no page content or pricing.

As a direct result:

- **No live crawl was executed.** `raw/2026-09-12-seed.json` contains only
  the 8 material records and 1 ready-mix availability note supplied
  verbatim as seed evidence in the task that requested this ingestion, plus
  4 additional product URLs discovered via web search (recorded in
  `raw/progress.json`, never fetched).
- The target of "at least 100 high-value contractor material records" was
  **not reached** — it requires either running `scripts/costbook-import-jones-and-sons.mjs`
  from an environment with real outbound access, or another data-collection
  method.
- Only 2 of the 8 imported records carry explicit Terre Haute branch
  evidence (a source URL plus an explicit pickup-location statement on the
  product page, per the seed evidence). The remaining 6 carry no source URL
  at all and are recorded at `confidence: "low"` with an explicit
  "unconfirmed regional scope" — never labeled Terre Haute pricing.

## Directory structure

```text
data/supplier-imports/jones-and-sons/
  raw/
    2026-09-12-seed.json    # verbatim seed evidence, one entry per record
    progress.json           # discoveredProducts/attemptedProducts/.../lastRunAt
  normalized/
    2026-09-12-seed.json    # canonical name/trade/category/unit mirror of the TS module, for audit
  README.md                 # this file
```

## Re-running the crawl with real egress

`scripts/costbook-import-jones-and-sons.mjs` implements the discovery →
fetch → parse → validate → checkpoint pipeline described in the task this
import was built from (low concurrency, retry/backoff on HTTP 429,
resumable via `raw/progress.json`, dedup by SKU + URL). It has **not been
executed** from this session — there was nothing to execute it against.
Running it from an environment with outbound access to jonesandsons.com
will populate new dated files under `raw/` and `normalized/` without
overwriting these seed files; each run is a new dated snapshot, not a
mutation of prior evidence, so historical observations are preserved.

## Trust rules encoded here

- A record is Terre Haute-verified only when its source page explicitly
  proved Terre Haute applicability (an on-page pickup/branch statement).
  Everything else is `confidence: "low"`, explicitly unconfirmed regional
  scope, regardless of how plausible Terre Haute pricing might be.
- Ready-mix concrete is never assigned a fabricated per-yard price. Jones &
  Sons prices it through dispatch at order time; this import represents
  that as availability metadata only (see
  `JONES_AND_SONS_READY_MIX_AVAILABILITY` in the TS module), not a
  candidate.
- Every candidate this data can produce still requires a named-human
  review and explicit promotion through the existing
  `CostbookCandidateService` before it can affect any tenant's live
  Costbook — nothing here writes to `Material`/`CostItem` directly.
