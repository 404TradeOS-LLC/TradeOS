---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: false
related_code:
  - app/modules/ai-estimate-assist
  - app/modules/knowledge-runtime
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
- structured estimator draft generation records only a non-sensitive activity event; it does not create estimate line items
- accepted reviewed lines call the existing Estimate Engine line-item path and never write estimate lines directly from generated output
- structured estimator draft lines with resolved targets include server-signed review tokens binding the estimate, organization, draft line, target kind, target ID, engine version, and issue time
- structured estimator apply validates accepted targets against org-scoped active cost items or assemblies before writing, requires accepted lines to present matching unexpired review tokens, skips fabricated or foreign targets with the same safe reason, serializes concurrent apply attempts per estimate, and uses server-built `sourceKey` values plus existing-line reconciliation for retry protection
- apply does not currently persist a draft-run record; signed review tokens bind accepted lines to server-generated draft targets without storing the full contractor prompt

## Frontend surfaces

- `/projects/[id]/estimates/[estimateId]/assist`

## Tests

- `app/tests/ai-estimate-assist.service.test.ts`
- `app/tests/structured-ai-estimator.service.test.ts`
- `app/tests/ai-estimate-assist.controller.test.ts`
- `app/tests/knowledge-runtime.service.test.ts`
- `app/tests/knowledge-runtime.matcher.test.ts`
- `app/tests/knowledge-runtime.controller.test.ts`

## Implementation notes

- `knowledge-runtime/repository.ts` now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining a duplicate private copy (cleanup only; matcher/scoring behavior unchanged)
- `StructuredAIEstimatorService` is the backend orchestration layer for contractor-language-to-estimate drafts. It is deterministic today, tool-run-oriented, and reuses `KnowledgeRuntimeService`, `CostDatabaseService`, `AssembliesDatabaseService`, and `EstimateEngineService`.

## Known limitations

- no autonomous estimate writes
- runtime is deterministic and read-only
- all generated drafts require human review before line items are applied
- live integration/RLS verification requires the Docker-backed `npm run test:integration` harness
- generated-draft provenance is tokenized per resolved line rather than persisted as a signed draft-run record; apply relies on review tokens, server-side org target validation, human review status, and source-key replay protection
- `packages/knowledge-engine/` (the actual data `knowledge-runtime` reads) lives outside `app/` at the repo root. Vercel's `tradeos-costbook` project deploys with Root Directory `app`, so that data is not present at runtime in production by default — `app/scripts/vendor-knowledge-engine.js` copies it into `app/vendor/knowledge-engine/` as a build step (`npm run build`), `app/vercel.json` explicitly includes `vendor/knowledge-engine/**` in the `index.ts` function bundle, and `resolveKnowledgeEnginePaths()` (`app/modules/knowledge-runtime/loader.ts`) checks the process-root vendored path plus source-layout and compiled-`dist` candidates before falling back to its original repo-root search for local development. This was previously broken in production — every knowledge-runtime route (including `GET /api/v1/knowledge/stats`, used by the dashboard and this page) threw `"Unable to locate the TradeOS repository root for Knowledge Engine loading"` — because JWT verification was itself broken until a separate fix, so no request had ever actually reached this code path in production before. `web/src/app/(app)/dashboard/page.tsx` and this page's `getKnowledgeStats`/`getKnowledgeTrades` calls are also now wrapped in `.catch()` fallbacks to their existing null/empty UI states, so a future knowledge-runtime failure degrades gracefully instead of crashing the whole page into the generic error boundary.

## Deferred work

- any broader learning loop or external-model expansion beyond the current advisory scope

## Last verified date

2026-08-08
