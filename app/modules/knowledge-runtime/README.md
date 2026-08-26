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
- `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`
- `packages/knowledge-engine/knowledge/knowledge/trade-taxonomy/taxonomy.md`
- `packages/knowledge-engine/knowledge/knowledge/assemblies/*.json`
- `packages/knowledge-engine/knowledge/knowledge/cost-items/*.json`
- `packages/knowledge-engine/schemas/*.json`

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
