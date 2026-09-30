---
status: current
owner: platform
last_verified: 2026-09-09
source_of_truth: true
related_code:
  - packages/knowledge-engine/schemas/cost-item.schema.json
  - app/modules/knowledge-runtime/repository.ts
  - app/modules/knowledge-runtime/types.ts
  - app/modules/costbook/provenance.ts
  - app/modules/costbook/candidateCostItem.ts
  - scripts/costbook-provenance-audit.mjs
  - app/tests/knowledge-runtime.item-provenance.test.ts
  - scripts/__tests__/costbook-provenance-audit.test.mjs
  - docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md
  - docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md
---

# Costbook Item-Level Provenance Metadata Contract

## 1. Why this slice

The 2026-09-08 audit (`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md`) found that
1,770 of the Knowledge Engine's 1,795 canonical cost items carry no provenance, timestamp, or
confidence metadata, despite the corpus's own `cost-item.schema.json` implying it should
(`confidenceScore`, `pricingStatus`, and required `version`/`created`/`updated` fields already
existed in the schema but were absent from nearly every real item). A follow-up slice
(2026-09-08, PR #472/#474) added trade-level `provenanceStatus` via `trade-progress.json` and the
Stage 5/6 candidate-ingestion contract, but explicitly deferred item-level provenance as future
work.

This slice closes that specific gap: it establishes the **contract** (schema fields, types,
resolution/fallback logic) and a **validator** for item-level provenance, source, and confidence
metadata. It does not fabricate data for any of the 1,795 existing items, and it does not change
any price, category, unit, or existing field.

## 2. Exact current data flow (re-verified 2026-09-09)

1. `packages/knowledge-engine/exports/json/costbook.json` is the canonical export: `{ items: [...], assemblies: [...] }`.
2. Every item today carries exactly 8 fields: `id, name, category, unit, laborCost, materialCost, equipmentCost, notes`. Confirmed by exhaustively enumerating every key across all 1,795 items - no item carries `version`, `created`, `updated`, `confidenceScore`, `pricingStatus`, or any source/provenance field.
3. `app/modules/knowledge-runtime/loader.ts` reads this file directly (`readRequiredJsonFile`) with no field stripping - any field present on an item flows through untouched.
4. `app/modules/knowledge-runtime/repository.ts`'s `toCostItemRecord()` builds the runtime `KnowledgeCostItemRecord`. Before this slice, `metadata.provenanceStatus` was resolved *only* from the item's inferred trade (`resolveTradeProvenanceStatus`); no other provenance/source field existed on the record at all.
5. Consumers (`/api/v1/knowledge/*` routes, `searchKnowledge()`, `matchScopeDeterministically()`, AI Estimate Assist suggestions/draft line items) all read `metadata.provenanceStatus` and nothing else provenance-related.

## 3. What this slice adds

### 3a. Schema contract (`packages/knowledge-engine/schemas/cost-item.schema.json`)

Nine new **optional** properties, added to `properties` (the schema's `additionalProperties: false`
made this a required change - without it, no per-item metadata could ever be added without either
loosening that constraint or breaking schema validation):

| Field | Type | Notes |
|---|---|---|
| `provenanceStatus` | enum | `"documented" \| "unverified-legacy" \| "placeholder"` - same vocabulary as `app/modules/costbook/provenance.ts` |
| `sourceName` | string | Human-readable source name |
| `sourceUrl` | string (uri) | Source URL, when it has one |
| `sourceIdentifier` | string | Non-URL source reference |
| `sourceDate` | string (`YYYY-MM-DD`) | Date the source itself states |
| `retrievedAt` | string (date-time) | When the value was collected/generated |
| `confidence` | enum | `"low" \| "medium" \| "high"` - qualitative, distinct from the pre-existing numeric `confidenceScore` |
| `reviewedBy` | string | Named human reviewer - never a synthetic identity |
| `reviewedAt` | string (date-time) | When `reviewedBy` reviewed it |

None are `required`. This exactly mirrors the vocabulary already established by
`app/modules/costbook/candidateCostItem.ts` (Stage 5/6), so the relational Costbook's
research-candidate pipeline and the Knowledge Engine's static corpus now share one provenance
dialect instead of two.

### 3b. Runtime resolution (`app/modules/knowledge-runtime/repository.ts`)

`resolveItemProvenance()` (new, exported for direct testing):

- Prefers the raw item's own `provenanceStatus` when it is a recognized value; otherwise falls back
  to the item's existing trade-level `provenanceStatus` exactly as before.
- Surfaces `sourceName`/`sourceUrl`/`sourceIdentifier`/`sourceDate`/`retrievedAt`/`reviewedBy`/`reviewedAt`
  on `KnowledgeCostItemRecord.metadata` only when the raw value is present and non-blank after
  trimming (a blank/whitespace-only field is treated as absent, not as an asserted empty value).
- Surfaces `confidence` only when it is one of `"low"|"medium"|"high"`; an unrecognized value (e.g.
  a typo) is silently treated as absent rather than passed through, so a malformed value cannot leak
  into consumer-facing output as if it were valid.
- An unrecognized `provenanceStatus` value is likewise never trusted - it falls back to the
  trade-level default, the same fail-safe behavior `normalizeCostDataProvenanceStatus()` already
  applies elsewhere.

This is purely additive: because zero items in the canonical export carry any of these fields
today, `resolveItemProvenance()` currently resolves to exactly the same `provenanceStatus` the
trade-level logic already produced, with no other metadata fields set - verified by a dedicated
regression test asserting the real corpus's resolved output is unchanged (see §6).

### 3c. Validator (`scripts/costbook-provenance-audit.mjs`, `npm run costbook:audit-provenance`)

A deterministic, read-only Node script (no build step, no TypeScript compile required) that loads
the canonical export plus `trade-progress.json` and reports:

**Structural** (fails the run, exit code 1, only if any are present):
- Duplicate cost-item IDs
- Missing `id`/`name`/`category`
- Non-numeric `laborCost`/`materialCost`/`equipmentCost`
- Duplicate assembly IDs
- Assembly line items referencing a nonexistent cost item (dangling reference)

**Data-quality warnings** (reported only, never fail the run):
- Units outside the known `SF/LF/EA/HR/CY/SQ/CF` set
- Categories with no matching trade in `trade-progress.json` and no known alias (`Flatwork`→`Concrete`,
  `Hvac`→`HVAC` - the same normalizations `knowledge-runtime` already applies at runtime, so this
  audit does not re-flag a gap the app already closes)
- Invalid `provenanceStatus`/`confidence` values (present but not a recognized enum value)
- Missing item-level `provenanceStatus`, source citation, `confidence`, and `retrievedAt`

Every finding reports a count plus up to 5 examples. The script exits `0` unless a structural
defect exists, matching this repository's existing "warnings over destructive/blocking checks"
convention for this corpus.

## 4. Coverage report - before and after

| Metric | Before this slice | After this slice |
|---|---:|---:|
| Total canonical cost items | 1,795 | 1,795 |
| Items with a schema field to carry provenance/source/confidence at all | 0 (schema had no such fields; `additionalProperties: false` blocked adding any) | 1,795 (all now schema-eligible) |
| Items with `provenanceStatus` actually populated | 0 | **0** |
| Items with any source citation (`sourceName`/`sourceUrl`/`sourceIdentifier`) | 0 | **0** |
| Items with `confidence` populated | 0 | **0** |
| Items with `retrievedAt` populated | 0 | **0** |
| Structural defects (duplicate IDs, non-numeric costs, dangling references) | 0 | 0 |
| Category/trade mapping gaps (excluding known aliases) | 0 | 0 |

**The populated-metadata numbers are identical before and after, by design.** This slice's job was
to build the contract and the validator, not to invent sources for 1,795 items. Live validator
output (`npm run costbook:audit-provenance`, 2026-09-09):

```text
Costbook Knowledge Engine provenance/data-quality audit
Corpus: 1795 cost items, 289 assemblies

Structural (would fail the run if any are present):
  [ok] Duplicate cost-item IDs: 0
  [ok] Missing id/name/category: 0
  [ok] Non-numeric cost fields: 0
  [ok] Duplicate assembly IDs: 0
  [ok] Dangling assembly line-item references: 0

Data-quality warnings (reported only, never fail the run):
  [ok] Units outside the known SF/LF/EA/HR/CY/SQ/CF set: 0
  [ok] Categories not in trade-progress.json (and not a known alias): 0
  [ok] Items with an invalid provenanceStatus value: 0
  [ok] Items with an invalid confidence value: 0
  [warn] Missing item-level provenanceStatus (falls back to trade-level): 1795
  [warn] Missing any source citation (sourceName/sourceUrl/sourceIdentifier): 1795
  [warn] Missing confidence: 1795
  [warn] Missing retrievedAt: 1795

Result: PASS (no structural defects found)
```

(Example ID lists truncated here; the real output lists the first 5 IDs per finding.)

## 5. Verified vs. inferred vs. unverified vs. needs-review

Per this task's instruction not to claim public/government data is automatically accurate, and to
distinguish these categories honestly:

- **Verified facts**: the corpus is structurally sound - 0 duplicate IDs, 0 non-numeric costs, 0
  dangling assembly references, 0 missing identity fields, all units within the known set, all
  categories mapped to a known trade (directly or via a known alias). These are confirmed by
  exhaustive programmatic check against all 1,795 items and 289 assemblies, not sampled.
- **Inferred values**: every item's `trade` (via `inferTrade()`) and every item/assembly's
  `provenanceStatus` (via trade-level fallback) are *inferred* from the corpus's own structure, not
  independently verified against an external pricing source.
- **Unverified/generated values**: all 1,795 items' `laborCost`/`materialCost`/`equipmentCost`
  values themselves remain unverified against any external source - this slice does not change
  that, and does not claim otherwise. `provenanceStatus` for every real item today is, and remains,
  `"unverified-legacy"`.
- **Items requiring human review before any `"documented"` claim**: all 1,795. None should be
  marked `"documented"` without a human recording a real `sourceName`/`sourceUrl`/`sourceIdentifier`,
  `sourceDate`, and `reviewedBy`/`reviewedAt` - the schema now supports that, but nothing in this
  slice sets it automatically, and nothing should.

No website was scraped, no paywall was bypassed, and no RSMeans or other licensed dataset content
was reproduced to produce this report or this slice's code.

## 6. Tests and verification run

```text
$ cd app && npx tsc --noEmit                                          -> clean, exit 0
$ cd app && npx jest --runInBand                                      -> 240 suites / 2105 tests passed, 0 failed
$ cd app && npm run build                                             -> vendor-knowledge-engine + tsc succeeded
$ cd app && npm run lint                                              -> clean (tsc --noEmit)
$ npm run costbook:audit-provenance                                    -> PASS, see §4
$ npm run costbook:audit-provenance:test                               -> 15/15 node:test passed
$ node --test scripts/__tests__/docs-check.test.mjs scripts/__tests__/pr-preflight.test.mjs -> 45/45 passed
$ npm run docs:check                                                  -> PASS (all 6 required docs present)
$ git diff --check                                                    -> exit 0, no whitespace errors
```

New/updated tests:
- `app/tests/knowledge-runtime.item-provenance.test.ts` (new, 11 tests) - unit tests for
  `resolveItemProvenance()` (fallback, override, unrecognized-value rejection, blank-string
  handling) plus real-corpus regression tests asserting today's resolved `provenanceStatus` values
  and derived pricing are byte-identical to before this change, and that zero real items carry any
  new metadata field yet.
- `scripts/__tests__/costbook-provenance-audit.test.mjs` (new, 15 tests) - fixture-based coverage of
  every structural/warning finding category plus a real-corpus regression test.

No existing test was modified. The full existing suite passed unmodified.

## 7. Compatibility impact

- **API/response shape**: additive only. `KnowledgeCostItemRecord.metadata` gained 8 new optional
  fields; no field was removed or renamed. `/api/v1/knowledge/*` responses are unaffected unless an
  item populates a new field (none currently do).
- **Pricing**: no `laborCost`/`materialCost`/`equipmentCost`/`totalUnitCost` value changed for any
  item, verified both by the validator (0 non-numeric costs) and by a dedicated regression test
  pinning a specific item's derived costs.
- **Trade classification / matching**: unaffected - `inferTrade()` was not touched.
- **Database / Prisma**: no schema, migration, or Prisma model touched. This slice is entirely
  within `packages/knowledge-engine/` (JSON Schema only, no data file changed) and
  `app/modules/knowledge-runtime/` (TypeScript types/logic only).
- **AI Estimate Assist / structured estimator**: unaffected - `provenanceStatus` continues to
  resolve to the same values it already did; no new field is surfaced there yet (that would be a
  follow-up, not part of this slice's scope).

## 8. What remains unverified / deferred

- No item in the canonical export has real, cited provenance yet - this slice makes that possible
  to record, it does not record any.
- `confidenceScore` (the pre-existing numeric field) and the new qualitative `confidence` field are
  intentionally distinct; no code currently derives one from the other.
- Assemblies (`packages/knowledge-engine/exports/json/costbook.json`'s `assemblies` array,
  `assembly.schema.json`) were not given the same per-item field set in this slice - out of scope
  per the audit's original 1,795-cost-item finding; a follow-up should decide whether assemblies
  need the same contract.
- The generation pipeline (`packages/knowledge-engine/pipelines/generation/seeds/**`) was not
  modified - new/regenerated items are not required to populate the new fields, so future generator
  output could still land with zero provenance unless the pipeline itself is updated to require it.
- Regenerating `trade-progress.json`'s per-trade rollup from item-level data (once items have real
  per-item provenance) is not implemented.

## 9. Recommended next production-trust slice

Ranked by leverage and risk:

1. **Pick one small, well-bounded trade or item subset and populate real, cited provenance by
   hand** (e.g. 20-50 items in one trade, sourced from a manufacturer price sheet or a public,
   citable cost index this project has the right to reference) - proves the contract end-to-end with
   real data rather than a synthetic example, without attempting all 1,795 items at once.
2. **Wire the generation pipeline** (`packages/knowledge-engine/pipelines/generation/seeds/**`) to
   require `sourceName`+`sourceDate`+`retrievedAt`+`confidence` on any *newly generated* item going
   forward, so the "1,795 legacy items with no provenance" number stops growing.
3. **Surface `provenanceStatus`/`confidence`/source fields in `/api/v1/knowledge/*` responses and
   the AI Estimate Assist UI** wherever pricing is shown to a contractor, so "unverified-legacy" is
   visible to the person deciding whether to trust a suggested number - not just present in the API
   payload.
4. **Add `npm run costbook:audit-provenance` to CI** (a new non-blocking reporting step, or a
   blocking one scoped to the structural checks only) so a future regression (a duplicate ID, a
   non-numeric cost, a dangling assembly reference) is caught automatically.
5. **Extend the same contract to assemblies** once cost items have real coverage data to justify
   prioritizing that work.

## 10. Explicit limitations of this audit

- This report's "before/after" comparison covers the canonical `exports/json/costbook.json` file
  only; it does not re-verify every Python seed-generator source file individually (that remains
  the 2026-09-08 audit's documented limitation too).
- No live server or `/api/v1/knowledge/*` request was executed; all findings are static-analysis
  results from the JSON export, schema, and TypeScript source.
- `npm run test:integration` was not run: this sandbox's `docker` CLI has no reachable daemon. This
  slice touches no Prisma schema, migration, RLS policy, or request-session code, so no
  integration-test-only behavior is at risk.
