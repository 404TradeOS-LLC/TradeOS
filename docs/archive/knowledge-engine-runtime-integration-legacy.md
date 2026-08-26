---
status: archived
superseded_by: docs/modules/ai-estimate-assist.md
do_not_use_for_implementation: true
---

# Knowledge Engine Runtime Integration

## Summary

TradeOS now has a read-only runtime bridge from the live backend into the migrated Knowledge Engine package at `packages/knowledge-engine/`.

The runtime loads source files directly from disk and exposes deterministic read APIs for search and scope matching without writing to Prisma, Supabase, or the Knowledge Engine package.

## What is integrated

Backend module:

- `app/modules/knowledge-runtime/loader.ts`
- `app/modules/knowledge-runtime/cache.ts`
- `app/modules/knowledge-runtime/repository.ts`
- `app/modules/knowledge-runtime/matcher.ts`
- `app/modules/knowledge-runtime/service.ts`

Loaded package sources:

- `packages/knowledge-engine/exports/json/costbook.json`
- `packages/knowledge-engine/knowledge/knowledge/assembly-index.json`
- `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`
- `packages/knowledge-engine/knowledge/knowledge/trade-taxonomy/taxonomy.md`
- `packages/knowledge-engine/knowledge/knowledge/assemblies/*.json`
- `packages/knowledge-engine/knowledge/knowledge/cost-items/*.json`
- `packages/knowledge-engine/schemas/*.json`

Read-only API surface:

- `GET /api/v1/knowledge/stats`
- `GET /api/v1/knowledge/trades`
- `GET /api/v1/knowledge/search`
- `POST /api/v1/knowledge/match`

Compatibility aliases retained:

- `GET /api/v1/knowledge/assemblies/search`
- `GET /api/v1/knowledge/cost-items/search`
- `POST /api/v1/knowledge/match-scope`

Frontend wiring:

- `web/src/app/(app)/projects/[id]/estimates/[estimateId]/assist/page.tsx`
- `web/src/components/estimate-assist/ai-estimate-assist.tsx`
- `web/src/lib/api.ts`

The assist page now uses live runtime data for:

- trade count
- assembly count
- cost item count
- trade list
- search
- deterministic scope matching
- confidence
- assumptions
- missing information
- review warnings

## Deterministic match output

Given plain-English scope text, the matcher returns:

- detected trade
- matching assemblies
- matching cost items
- confidence score
- assumptions
- missing information
- review warnings
- rationale

Trade detection stays aligned with the existing `project-intake` classifier so the runtime does not fork TradeOS decision logic.

## Read-only guarantees

- No Prisma schema changes
- No Knowledge Engine package mutation
- No Supabase import
- No vector search, pgvector, or RAG
- No external AI calls
- No automatic estimate writes

## What remains disconnected

The Knowledge Engine is still a file-backed runtime source, not an application-managed database domain.

Still intentionally disconnected:

- versioned import pipeline into app-managed tables
- write-path feedback logging for accepted or rejected matches
- estimate line-item creation from approved runtime matches
- historical estimate retrieval or cross-project pattern mining
- proposal/prose generation from runtime assumptions

## Known limitations

- Matching is deterministic and keyword-heavy, so ambiguous scopes still require human review.
- Quantity extraction is shallow and only looks for obvious measurements and count cues in free text.
- The runtime is process-memory cached, so file changes require process restart or cache reset in tests.
- Some trades have stronger assembly coverage than others because the migrated package is still uneven across categories.

## Recommended next roadmap

1. Add an explicit cache-refresh strategy for long-running backend processes.
2. Log estimator acceptance and rejection decisions without enabling any write path into the Knowledge Engine itself.
3. Design a versioned import boundary before any database-backed knowledge workflow is introduced.
4. Connect approved runtime matches to existing estimate line-item add flows as a separate reviewed action.
