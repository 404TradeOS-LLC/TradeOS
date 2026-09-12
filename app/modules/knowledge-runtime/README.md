# Knowledge Runtime

This module is the read-only runtime bridge between the migrated Knowledge Engine package in `packages/knowledge-engine/` and the live TradeOS backend.

## Files

- `loader.ts`: resolves package paths and loads exports, knowledge files, schemas, taxonomy, assemblies, and cost items from disk
- `cache.ts`: in-memory repository snapshot cache for runtime reads
- `repository.ts`: normalizes loaded records into searchable trades, assemblies, and cost items
- `matcher.ts`: deterministic plain-English scope matching with confidence, assumptions, missing information, and review warnings
- `service.ts`: thin application-facing read-only service used by controllers and other modules
- `types.ts`: shared runtime types

Compatibility shims remain in:

- `knowledgeEngineLoader.ts`
- `knowledgeEngineRepository.ts`
- `deterministicMatcher.ts`

Those simply re-export the new module entrypoints so existing imports keep working.

## What it does

- Loads Knowledge Engine source material directly from disk
- Exposes read-only runtime services for:
  - knowledge stats
  - trade listing
  - unified search
  - deterministic scope matching
- Reuses existing TradeOS intake classification to keep trade detection aligned with the current app

## What it does not do

- It does not write to Prisma or Supabase
- It does not create cost items or assemblies
- It does not mutate Knowledge Engine source files
- It does not call external AI APIs
- It does not replace the existing cost database or estimate engine

## Data sources

- `packages/knowledge-engine/exports/json/costbook.json`
- `packages/knowledge-engine/knowledge/knowledge/assembly-index.json`
- `packages/knowledge-engine/knowledge/knowledge/trade-progress.json` — now also the source of each trade's `provenanceStatus` (see "Provenance status" below)
- `packages/knowledge-engine/knowledge/knowledge/trade-taxonomy/taxonomy.md`
- `packages/knowledge-engine/knowledge/knowledge/assemblies/*.json`
- `packages/knowledge-engine/knowledge/knowledge/cost-items/*.json`
- `packages/knowledge-engine/schemas/*.json`

## Provenance status

Every trade, cost item, assembly, and search result carries a `provenanceStatus`
(`"documented" | "unverified-legacy" | "placeholder"`, defined in
`app/modules/costbook/provenance.ts`). `repository.ts` resolves it per-trade from
`trade-progress.json`'s `provenanceStatus` field, defaulting to `"unverified-legacy"`
when that field is missing, unrecognized, or the record's trade could not be
inferred at all — never silently defaulting to `"documented"`. `matcher.ts`
appends an explicit review warning to `reviewWarnings` whenever a match
includes non-`"documented"` pricing. As of 2026-09-08, all 24 legacy "Stable"
trades resolve to `"unverified-legacy"` and Tree Service resolves to
`"placeholder"`; no trade is `"documented"` yet. See
`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md` for the evidence
behind that classification and
`packages/knowledge-engine/README.md`'s "Provenance status" section for the
package-level record.

### Item-level provenance/source metadata (2026-09-09)

`cost-item.schema.json` now also defines nine **optional** per-item fields —
`provenanceStatus`, `sourceName`, `sourceUrl`, `sourceIdentifier`,
`sourceDate`, `retrievedAt`, `confidence`, `reviewedBy`, `reviewedAt` —
mirroring the same vocabulary the relational Costbook's research-candidate
contract already uses (`app/modules/costbook/candidateCostItem.ts`,
`provenance.ts`), so a future ingestion pipeline speaks one dialect instead of
two. `repository.ts`'s `resolveItemProvenance()` reads them off the raw item
when present and well-formed (an unrecognized `provenanceStatus`/`confidence`
value, or a blank source/reviewer string, is treated as absent rather than
trusted), and otherwise falls back to the item's existing trade-level
`provenanceStatus` exactly as before. **No item in the canonical 1,795-item
export carries any of these fields today** — this is a type/schema contract
and validator addition only, not a data-fabrication pass. See
`docs/reports/COSTBOOK_ITEM_PROVENANCE_METADATA_2026-09-09.md` for the full
before/after coverage report, and run `npm run costbook:audit-provenance`
(repo root) for a live report against the current corpus.

### Assembly-level provenance/source metadata (2026-09-10)

`assembly.schema.json` now defines the same nine optional fields as
`cost-item.schema.json`, and `repository.ts`'s `resolveAssemblyProvenance()`
mirrors `resolveItemProvenance()` exactly (own well-formed value wins, blank
strings and unrecognized enum values are treated as absent, otherwise falls
back to the assembly's trade-level `provenanceStatus`). **No assembly in the
canonical 289-assembly export carries any of these fields today** — this
closes the schema-symmetry gap between items and assemblies noted as
follow-up work in `docs/reports/COSTBOOK_ITEM_PROVENANCE_METADATA_2026-09-09.md`,
without fabricating any assembly's pricing or provenance.
`npm run costbook:audit-provenance` now also reports the assembly-level
counterparts of the item warnings (missing provenanceStatus/source
citation/confidence/retrievedAt), all as non-blocking warnings.

### Suggestion/draft-line provenance surfacing (2026-09-10)

`AIEstimateSuggestion` and `StructuredEstimateDraftLineItem`
(`app/modules/ai-estimate-assist/types.ts`) now carry an optional
`provenanceDetail` field (`sourceName`, `sourceUrl`, `sourceIdentifier`,
`sourceDate`, `retrievedAt`, `confidence`, `reviewedBy`, `reviewedAt`),
populated by `extractProvenanceDetail()` from the matched Knowledge Runtime
record's `metadata` whenever those fields are present. This is additive next
to the existing flat `provenanceStatus` field (not a rename or replacement),
and is deliberately not named `confidence` to avoid colliding with the
existing 0-100 match-confidence score on the same object. The AI Estimate
Assist UI (`web/src/components/estimate-assist/ai-estimate-assist.tsx`) now
renders a provenance-status badge plus, when present, a source/date/confidence
line on every suggestion card, matched-assembly/cost-item panel, and knowledge
search result. `/api/v1/knowledge/*` responses were already a raw passthrough
of each record's full `metadata` object, so no controller change was needed
there.

### Generation-pipeline provenance gate (2026-09-10)

`packages/knowledge-engine/scripts/approve-batch.py` — the script that
actually merges a newly generated batch into the master/export
costbook — now rejects (does not merge) any `cost-items` batch where an item
is missing or misuses `provenanceStatus`/`sourceName`/`sourceDate`/
`retrievedAt`/`confidence`. `scripts/validate_batch.py`'s older parallel
`review/pending` validator gained the same checks, and
`scripts/next-batch.py`'s generated worker-agent prompt now states the
requirement up front for cost-item batches. This only gates newly submitted
items; it does not retroactively touch anything already merged.

## Runtime behavior

- File-based loading only
- In-memory cached snapshot
- Deterministic keyword and metadata scoring
- Human-review-first match output

## Future work

- Import/version the Knowledge Engine into app-managed tables
- Add historical estimate retrieval
- Add richer quantity extraction
- Add feedback logging for accepted/rejected suggestions
