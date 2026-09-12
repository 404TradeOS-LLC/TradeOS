---
status: current
owner: platform
last_verified: 2026-09-10
source_of_truth: false
related_code:
  - app/modules/ai-estimate-assist
  - app/modules/knowledge-runtime
  - app/modules/costbook/provenance.ts
  - app/scripts/vendor-knowledge-engine.js
  - app/backend/routes/aiEstimateAssist.routes.ts
  - web/src/app/(app)/projects/[id]/estimates/[estimateId]/assist/page.tsx
  - web/src/components/estimate-assist
---

# AI Estimate Assist

## Purpose

Provide advisory estimate suggestions grounded in the tenant cost book and reviewed by a human before anything reaches the estimate.

The backend also exposes a structured AI estimating engine path for contractor-language scopes. It parses scope text, matches Knowledge Runtime candidates, resolves them to existing app-owned cost items or assemblies, retrieves pricing through the costbook and assembly services, and stages a structured draft for human review.

## Source code locations

- `app/modules/ai-estimate-assist/*`
- `app/modules/knowledge-runtime/*`
- `app/backend/routes/aiEstimateAssist.routes.ts`
- `web/src/app/(app)/projects/[id]/estimates/[estimateId]/assist/page.tsx`

## Core models

- this module produces suggestion DTOs rather than owning a separate persisted app model in the current repository

## Routes

- estimate-assist routes mounted under `/api/v1/estimates/*`
- `POST /api/v1/estimates/:id/ai-suggestions` — generate advisory suggestions; requires `crm.read`
- `POST /api/v1/estimates/:id/ai-suggestions/apply` — apply reviewed suggestions; requires `crm.write`
- `POST /api/v1/estimates/:id/ai-estimator/draft` — structured estimator draft; requires `billing.write`
- `POST /api/v1/estimates/:id/ai-estimator/apply` — structured estimator apply; requires `billing.write`
- knowledge-runtime routes mounted under `/api/v1/knowledge/*`

## Permissions

Route-level permission checks were added in `app/backend/controllers/aiEstimateAssist.controller.ts` (previously relied on org-membership alone). See [RBAC_MATRIX.md](../RBAC_MATRIX.md) for the full role/permission mapping.

## Lifecycle and statuses

- assist output is advisory only
- accepted suggestions still flow through the ordinary estimate line-item paths
- successful authenticated structured estimator draft generation also persists an addressable, tenant/actor-scoped metadata record without raw prompt or model content; it does not create estimate line items
- accepted reviewed lines call the existing Estimate Engine line-item path and never write estimate lines directly from generated output
- structured estimator draft lines with resolved targets include server-signed review tokens binding the estimate, organization, draft line, target kind, target ID, engine version, and issue time
- structured estimator apply validates accepted targets against org-scoped active cost items or assemblies before writing, requires accepted lines to present matching unexpired review tokens, skips fabricated or foreign targets with the same safe reason, serializes concurrent apply attempts per estimate, and uses server-built `sourceKey` values plus existing-line reconciliation for retry protection
- structured estimator apply accepts the draft generation ID and, for owner/admin reviewers, records append-only review provenance (reviewer, outcome, bounded apply counts) inside the existing transaction; signed review tokens still bind accepted lines to server-generated draft targets without storing the full contractor prompt

## Frontend surfaces

- `/projects/[id]/estimates/[estimateId]/assist`

## Tests

- `app/tests/ai-estimate-assist.service.test.ts`
- `app/tests/structured-ai-estimator.service.test.ts`
- `app/tests/ai-estimate-assist.controller.test.ts`
- `app/tests/knowledge-runtime.service.test.ts`
- `app/tests/knowledge-runtime.matcher.test.ts`
- `app/tests/knowledge-runtime.controller.test.ts`
- `app/tests/knowledge-runtime.provenance.test.ts`
- `app/tests/costbook-candidate-cost-item.schema.test.ts`
- `app/tests/knowledge-runtime.trade-inference.test.ts`
- `app/tests/costbook-candidate.service.test.ts`
- `app/tests/costbook-candidates.rls.integration.ts`
- `app/tests/costbook-research-candidates.migration.test.ts`
- `app/tests/knowledge-runtime.item-provenance.test.ts`
- `app/tests/knowledge-runtime.assembly-provenance.test.ts`

## Implementation notes

- `knowledge-runtime/repository.ts` now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining a duplicate private copy (cleanup only; matcher/scoring behavior unchanged)
- `StructuredAIEstimatorService` is the backend orchestration layer for contractor-language-to-estimate drafts. It is deterministic today, tool-run-oriented, and reuses `KnowledgeRuntimeService`, `CostDatabaseService`, `AssembliesDatabaseService`, and `EstimateEngineService`.
- Every Knowledge Runtime record, search result, matcher output, `AIEstimateSuggestion`, and `StructuredEstimateDraftLineItem` now carries a `provenanceStatus` field (`"documented" | "unverified-legacy" | "placeholder"`, defined once in `app/modules/costbook/provenance.ts` and re-exported from `knowledge-runtime/types.ts` and `ai-estimate-assist/types.ts`). It is resolved per-trade from `packages/knowledge-engine/knowledge/knowledge/trade-progress.json`'s new `provenanceStatus` field (`knowledge-runtime/repository.ts`'s `resolveTradeProvenanceStatus()`), defaulting to `"unverified-legacy"` for any trade the field is missing or unrecognized on, or whose trade could not be inferred at all — never silently to `"documented"`. Per the 2026-09-08 Costbook/Knowledge Engine audit (`docs/reports/COSTBOOK_KNOWLEDGE_ENGINE_AUDIT_2026-09-08.md`), all 24 legacy "Stable" trades are currently `"unverified-legacy"` (no per-item source/timestamp/confidence trail exists for them) and the Tree Service trade is `"placeholder"` (its own per-item files self-label `pricingStatus: "PLACEHOLDER"`); no trade is currently `"documented"`. `matchScopeDeterministically()` (`knowledge-runtime/matcher.ts`) also appends an explicit `reviewWarnings` entry naming the non-`"documented"` status whenever a match includes one, so this caution reaches `/api/v1/knowledge/match` and the structured estimator's aggregated `validation.warnings` without changing any pricing, confidence score, or matched-target behavior. This is additive to every response shape it touches; no existing field was removed or renamed.
- `app/modules/costbook/candidateCostItem.ts` defines the governed candidate contract, while `CostbookCandidateService` persists it through the Stage 6 reviewed queue. Creation starts every candidate at `"candidate"`; only an authenticated `costbook.manage` reviewer can approve/reject it, and promotion re-validates the human-review gate before writing new org-scoped Costbook component rows. See `docs/architecture/COSTBOOK_RESEARCH_INGESTION_DESIGN.md` for the full pipeline.
- `knowledge-runtime/repository.ts`'s `inferTrade()` was rewritten (2026-09-08) from raw substring matching plus array-order resolution to a deterministic, word-boundary/token-aware classifier that checks `category` before `name`, ranks matches by specificity instead of array position, and returns `null` on a genuine tie rather than guessing. This fixed a real defect (trade `"Trim"` matched inside the word `"trimming"`, misclassifying the sole Tree Service assembly-index record), corrected 152 other cost-item/assembly trade attributions to match their own curated `category` field, and left 89 genuinely multi-trade assemblies (`"Remodel – Kitchen/Bathroom/Exterior/Misc – N"`) reporting `null` instead of an arbitrary guess. Zero cost items lost classification; no pricing value or Costbook record changed. See `docs/reports/KNOWLEDGE_TRADE_INFERENCE_AUDIT_2026-09-08.md` for the full corpus audit and `app/tests/knowledge-runtime.trade-inference.test.ts` for the regression coverage.
- `packages/knowledge-engine/schemas/cost-item.schema.json` now defines nine optional per-item provenance/source fields (`provenanceStatus`, `sourceName`, `sourceUrl`, `sourceIdentifier`, `sourceDate`, `retrievedAt`, `confidence`, `reviewedBy`, `reviewedAt`), mirroring the relational Costbook's candidate-contract vocabulary. `knowledge-runtime/repository.ts`'s `resolveItemProvenance()` (2026-09-09) prefers an item's own well-formed `provenanceStatus` over its trade-level default when present, and surfaces the other fields on `KnowledgeCostItemRecord.metadata` only when present and non-blank; an unrecognized `provenanceStatus`/`confidence` value is treated as absent rather than trusted. This is a contract/validator addition only — no item in the canonical export currently carries any of these fields, so resolved output is byte-identical to before. A new deterministic, read-only audit (`npm run costbook:audit-provenance` at the repo root) reports missing/invalid provenance, source, confidence, timestamp, and structural (duplicate ID, non-numeric cost, dangling assembly reference) issues as counts with examples, never failing the run on a missing-metadata warning. See `docs/reports/COSTBOOK_ITEM_PROVENANCE_METADATA_2026-09-09.md`.
- The 2026-09-10 follow-up work closed four of the five next-slice items that report recommended: (1) `packages/knowledge-engine/schemas/assembly.schema.json` gained the same nine optional fields as `cost-item.schema.json`, with a matching `resolveAssemblyProvenance()` in `knowledge-runtime/repository.ts` — schema/contract symmetry only, no assembly in the canonical export carries any of these fields yet; (2) `packages/knowledge-engine/scripts/approve-batch.py` (the real batch-merge gate) and `scripts/validate_batch.py` now reject a newly submitted `cost-items` batch missing or misusing `provenanceStatus`/`sourceName`/`sourceDate`/`retrievedAt`/`confidence`, and `scripts/next-batch.py`'s generated prompt states the requirement up front — this only gates new submissions, never touches merged items; (3) `AIEstimateSuggestion` and `StructuredEstimateDraftLineItem` gained an optional `provenanceDetail` field (`extractProvenanceDetail()` in `ai-estimate-assist/types.ts`), populated from the matched Knowledge Runtime record's `metadata`, and the AI Estimate Assist UI now renders a provenance-status badge plus source/date/confidence text on every suggestion card, matched-assembly/cost-item panel, and knowledge search result; (4) `npm run costbook:audit-provenance` is now a required, blocking CI job (`Costbook provenance audit`, part of the `App lint, unit tests, and build` summary in `.github/workflows/verify-repository.yml`) — blocking only on structural corpus defects, never on missing-provenance warnings. The fifth item (populating real, cited provenance for a pilot item subset) remains open — see Deferred work below.

## Known limitations

- no autonomous estimate writes
- runtime is deterministic and read-only
- all generated drafts require human review before line items are applied
- live integration/RLS verification requires the Docker-backed `npm run test:integration` harness
- raw contractor prompts, generated output, tool arguments, and tool results are excluded from generation metadata; apply relies on review tokens, server-side org target validation, human review status, append-only review provenance, and source-key replay protection
- `packages/knowledge-engine/` (the actual data `knowledge-runtime` reads) lives outside `app/` at the repo root. Vercel's `tradeos-costbook` project deploys with Root Directory `app`, so that data is not present at runtime in production by default — `app/scripts/vendor-knowledge-engine.js` copies it into `app/vendor/knowledge-engine/` as a build step (`npm run build`), `app/vercel.json` explicitly includes `vendor/knowledge-engine/**` in the `index.ts` function bundle, and `resolveKnowledgeEnginePaths()` (`app/modules/knowledge-runtime/loader.ts`) checks the process-root vendored path plus source-layout and compiled-`dist` candidates before falling back to its original repo-root search for local development. This was previously broken in production — every knowledge-runtime route (including `GET /api/v1/knowledge/stats`, used by the dashboard and this page) threw `"Unable to locate the TradeOS repository root for Knowledge Engine loading"` — because JWT verification was itself broken until a separate fix, so no request had ever actually reached this code path in production before. `web/src/app/(app)/dashboard/page.tsx` and this page's `getKnowledgeStats`/`getKnowledgeTrades` calls are also now wrapped in `.catch()` fallbacks to their existing null/empty UI states, so a future knowledge-runtime failure degrades gracefully instead of crashing the whole page into the generic error boundary.

## Deferred work

- any broader learning loop or external-model expansion beyond the current advisory scope
- Stage 6 candidate persistence, review, and promotion are implemented; Stage 7 regeneration of the Knowledge Engine export from governed Costbook data remains future work.
- item-level and (as of 2026-09-10) assembly-level provenance are now schema-supported and resolved when present, but the canonical `packages/knowledge-engine/exports/json/costbook.json` export still carries zero items and zero assemblies with any of these fields populated. Populating a real pilot subset was attempted on 2026-09-10 and deliberately not completed: no genuinely authoritative, freely-licensed source exists at this corpus's granularity (state DOT bid-price data is public but civil/highway-scale; the corpus's one branded item's real-world pricing only turned up unverifiable contractor-marketing aggregator sites) — see `docs/CURRENT_STATE.md`'s "Costbook provenance follow-up slice (2026-09-10)" section for the full finding. This needs a licensed cost-data source or a qualified estimator's own verified rates, not open-web research.

## Last verified date

2026-09-10
