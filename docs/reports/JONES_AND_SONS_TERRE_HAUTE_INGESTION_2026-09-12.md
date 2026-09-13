# Jones & Sons Terre Haute material-pricing ingestion record

## Verified blocker: no live crawl was executed

The session that authored this ingestion had **no outbound network access to
jonesandsons.com**: `WebFetch` returned `EGRESS_BLOCKED`. To rule out a
site-specific block, a control request to an unrelated domain
(`www.bls.gov`) was attempted and failed identically, confirming a general
sandbox network-egress restriction rather than something specific to this
supplier. `WebSearch` (a separate backend) still worked and surfaced 4
additional real product URLs by indexed snippet, but returned no page
content or pricing — nothing beyond a title and a link.

As a direct consequence:

- **The target of "at least 100 high-value contractor material records" was
  not reached.** Only the 8 material records and 1 ready-mix availability
  note supplied as seed evidence in the task that requested this work are
  represented.
- **No systematic catalog crawl occurred.** `scripts/costbook-import-jones-and-sons.mjs`
  implements the discovery → fetch → parse → validate → checkpoint pipeline
  the task specified, but it has not been run against the live site. It
  requires an environment with real outbound access.
- Of the 8 imported records, only **2** carry independently-checkable Terre
  Haute branch evidence (an explicit product-page pickup statement plus a
  real source URL, both supplied in the task). The remaining **6** carry no
  source URL at all in the seed evidence and are recorded at low confidence
  with an explicit unconfirmed regional scope.

This report and the code it describes should be read as **infrastructure
for the Jones & Sons pricing source**, proven correct against real (if
few) records, not as a completed 100-record catalog import.

## Source

- Supplier: Jones & Sons, Inc.
- Branch of interest: Terre Haute, IN (3527 Erie Canal Road)
- Other known branches: Vincennes, Washington, Bloomfield — pricing and
  availability are branch-dependent, so a bare Jones & Sons web price is
  never assumed to be Terre Haute pricing.
- Platform: Shopify (public per-product JSON confirmed available via the
  standard `<handle>.json` endpoint convention, used by the unexecuted
  crawl script).

## Imported records

| Item | SKU | Price | Unit | Terre Haute verified? | Confidence |
| --- | --- | ---: | --- | --- | --- |
| Crushed Limestone #8 / CA-11 | XX8.07 | $29.75 | ton | Yes — explicit pickup statement + source URL | high |
| Crushed Limestone #11 / CA-16 | XX11.07 | $30.95 | ton | Yes — explicit pickup statement + source URL | high |
| Crushed Limestone #53 | XX53.01 | $23.95 | ton (assumed) | No — no source URL captured | low |
| Crushed Limestone #11 | XX11.01 | $31.95 | ton (assumed) | No — no source URL captured | low |
| Crushed Limestone #5 | XX5.01 | $29.50 | ton (assumed) | No — no source URL captured | low |
| Washed Sand (Coarse) #23 | XXWS.01 | $16.95 | ton (assumed) | No — no source URL captured | low |
| Pea Gravel | XXPG.01 | $24.75 | ton (assumed) | No — no source URL captured | low |
| Mortar Sand (Fine) | XXMS.01 | $37.00 | ton (assumed) | No — no source URL captured | low |

Ready Mixed Concrete is deliberately **not** in this table: Jones & Sons
prices it per yard through dispatch at order time, and the governed
candidate schema requires a real positive price. Fabricating one would
misrepresent a quote-only material, so it is represented only as
non-priced availability metadata
(`JONES_AND_SONS_READY_MIX_AVAILABILITY` in the TS module).

## Governance boundary

Identical to the BLS OEWS ingestion (`docs/reports/BLS_OEWS_TERRE_HAUTE_2025_INGESTION.md`)
and reusing the same existing pipeline rather than a second one:

```text
Jones & Sons product page evidence
  -> TradeOS Costbook research candidate
  -> named-human review
  -> explicit organization promotion
  -> existing Costbook Material/CostItem service boundary
```

- candidate creation does not imply approval;
- `provenanceStatus` is `documented` for every record — a traceable
  source (URL or SKU) and retrieval timestamp exist — but `documented`
  is explicitly not a claim of current, local, or verified pricing
  (see `app/modules/costbook/provenance.ts`);
- the Terre Haute vs. unconfirmed distinction lives in `confidence` and
  `regionalBasis`, not a new provenance-status value — the existing
  vocabulary (`documented` / `unverified-legacy` / `placeholder`) is
  reused rather than extended, since the branch/verification distinction
  is orthogonal to whether a source is traceable at all;
- no Athena or other automated actor may approve/promote these candidates
  autonomously;
- nothing in this PR writes to a tenant's live `Material`/`CostItem`
  catalog — persisting a candidate still requires an authenticated,
  organization-scoped call through the existing candidate intake path.

## Why no parallel architecture was built

The task that requested this work also asked for a from-scratch regional
trust model, price-history structure, and source-ranking precedence list.
Before building any of that, this session inspected the existing Costbook
architecture and found it already exists and had just landed in this same
lineage:

- `app/modules/costbook/candidateCostItem.ts` (Stage 2/4/5 contract) —
  already defines `confidence`, `provenanceStatus`, `regionalBasis`,
  `sourceUrl`/`sourceIdentifier`, and the review/promotion gate.
- `app/modules/costbook/candidateCostItemService.ts` (Stage 6) — already
  the sole persistence + promotion boundary, with RLS, an advisory lock,
  and reuse of existing `CostbookService` writers (never a second pricing
  store).
- `app/modules/costbook/blsOewsTerreHaute.ts` (open PR #492, same day) —
  already establishes the exact "vetted static source adapter → candidate
  contract" pattern this ingestion follows.
- PR #493 (open, same day) explicitly lists "no scraping" as a non-goal
  for the Stage 3 normalization/matching/review-UI work it adds, leaving a
  scraped external source exactly the kind of follow-up this PR is.

Building a second, parallel provenance/trust/price-history system would
have duplicated all of this and fragmented Costbook's trust model across
two incompatible schemes — explicitly against `AGENTS.md`'s "do not create
parallel implementations when an established module already owns the
behavior" and the Costbook S027 sprint's own forbidden-paths list
("unreviewed supplier ingestion"). This PR instead extends the existing
system with one more source adapter, in the same shape as PR #492's BLS
adapter, with zero shared files with either #492 or #493.

## Implementation

- `app/modules/costbook/jonesAndSonsTerreHaute.ts` — the vetted seed
  records and their mapping into `CreateCandidateInput`.
- `app/tests/costbook-jones-and-sons.test.ts` — 18 tests covering branch
  verification, schema/provenance completeness, price validation,
  unit-assumption disclosure, deduplication, ready-mix exclusion, and
  trade/category normalization.
- `data/supplier-imports/jones-and-sons/` — the raw/normalized audit trail
  and a progress-tracking file, per the task's reproducibility
  requirements.
- `scripts/costbook-import-jones-and-sons.mjs` — the discovery/fetch/parse
  pipeline for a future run with real outbound access. Not executed.

## Explicit limitation

Same shape as the BLS OEWS report: this PR prepares source-backed
candidates but does not mutate a live tenant database by itself.
Persisting them requires an authenticated organization-scoped call through
the existing Costbook candidate intake path, after which the ordinary
human review/promotion workflow applies — and, additionally here, a human
should re-verify current pricing before approving any of these
candidates, since none were re-fetched live in this session.

## Follow-up work

See the "Next five TODO items" in this PR's description/final report.
