---
status: current
owner: platform
last_verified: 2026-08-11
source_of_truth: false
related_code:
  - app/modules/estimate-engine
  - app/backend/routes/estimateEngine.routes.ts
  - web/src/app/(app)/projects/[id]/estimates
  - web/src/lib/estimate-compare.ts
  - app/modules/athena-tools/estimator
---

# Estimating

## Purpose

Own estimate creation, line-item pricing, pricing mode changes, duplication, comparison, and finalize-to-ready behavior.

## Source code locations

- `app/modules/estimate-engine/*`
- `app/backend/routes/estimateEngine.routes.ts`
- `web/src/app/(app)/projects/[id]/estimates/**`

## Core models

- `Estimate`
- `EstimateLineItem`

## Routes

- `/api/v1/estimates/*`

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

Current enforced rule:

- estimate mutations are draft-only until the estimate is finalized to `ready`

## Frontend surfaces

- `/projects/[id]/estimates/[estimateId]`
- `/projects/[id]/estimates/compare`
- `/projects/[id]/estimates/[estimateId]/assist`

## Tests

- `app/tests/estimate-engine.service.test.ts`
- `app/tests/estimate-engine.formulas.test.ts`
- `app/tests/athena-tools.estimator.create-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.update-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.analyze-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.compare-estimates.contracts.test.ts`

## Implementation notes

- A12 (`app/modules/athena-tools/estimator/*`): four Athena tools (`estimator.create-estimate`, `estimator.update-estimate`, `estimator.analyze-estimate`, `estimator.compare-estimates`) call `EstimateEngineService` directly, never Prisma. `EstimateEngineService.create()` now publishes the canonical `EstimateStarted` A8 event and `finalize()` publishes `EstimateCompleted`, both after the mutation commits and both non-blocking on publish failure (same posture as `ProposalsService.send()`'s existing `ProposalSent` publish). Both methods' return types gained an additive, optional `athenaEvent?: { type, id }` field so a calling Athena tool can wrap the real published event with `eventRef()` - existing callers (the estimate controller) are unaffected. A new read-only `EstimateEngineService.compareEstimates(baseEstimateId, candidateEstimateId, orgId?)` method computes a cost/price/margin/line-item-count delta between two estimates; this is distinct from the existing UI-only `web/src/lib/estimate-compare.ts` comparison helper behind `/projects/[id]/estimates/compare`. See `docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md` for the full tool catalog and permission mapping.
- `EstimateEngineService` now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining a duplicate private copy (cleanup only; no change to pricing behavior)
- `EstimateLineItem.sourceKey` is optional and is used for backend-generated idempotency/replay protection on reviewed structured-AI apply calls. Manual line-item creation remains unrestricted by source key.
- `EstimateEngineService.removeLineItem(lineItemId, orgId)` resolves the target line item's estimate by `lineItemId` alone (plus org scope and the existing draft-only check); it does not separately validate against the `:id` route param. It now returns `{ estimateId }` (was `void`) so the controller's activity-log entry is recorded against the line item's actual estimate rather than trusting the URL, which could otherwise misattribute the audit entry if a caller passed a `lineItemId` belonging to a different draft estimate. No lifecycle or authorization behavior changed — draft-only enforcement and org scoping are unchanged.

## Known limitations

- downstream commercial workflows still rely on compatibility status normalization in some paths

## Deferred work

- fuller estimate lifecycle normalization beyond the current finalize step

## Last verified date

2026-08-11
