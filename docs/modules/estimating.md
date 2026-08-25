---
status: current
owner: platform
last_verified: 2026-08-15
source_of_truth: false
related_code:
  - app/modules/estimate-engine
  - app/backend/routes/estimateEngine.routes.ts
  - web/src/app/(app)/projects/[id]/estimates
  - web/src/lib/estimate-compare.ts
  - app/modules/athena-tools/estimator
  - app/tests/estimate-costbook-snapshot.test.ts
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
- `GET /api/v1/estimates` — organization-scoped work-queue read (see below)

## Organization work-queue read

`GET /api/v1/estimates` (`EstimateEngineService.listOrganizationQueue`) returns every non-deleted estimate in the caller's organization, newest-activity-first, for dashboard/reporting/future-Athena-tool consumers that need a company-wide view rather than a single project's estimates.

- **Scope:** organization-wide; every authenticated organization member with `crm.read` may call it (every canonical/legacy role has that permission — see [RBAC_MATRIX.md](../RBAC_MATRIX.md)). Organization scope is derived from the authenticated request context, never a caller-supplied id, and is enforced both in the query (`orgId` predicate) and by forced RLS on the `estimates` table.
- **Filters:** `status` (comma-separated, accepts multiple canonical statuses in one request and transparently matches legacy raw synonyms — see `docs/WORKFLOW_LIFECYCLES.md`), `updatedAfter`, `updatedBefore`.
- **Pagination:** opaque cursor, default page size 25, maximum 50, ordered by `updatedAt desc, id desc` with the id as a stable tie-breaker; an invalid cursor returns `400` rather than silently restarting from page 1. Response is `{ items, total, nextCursor }` with an exact filtered `total`.
- **Response fields:** `id`, `projectId`, `projectName`, `customerName`, `status`, `amount` (`totalPrice`), `revision` (the existing `version` field — Estimate has no separate document-number field), `createdAt`, `updatedAt`. No `orgId` on individual items.
- Shares the cursor/limit helpers in `app/modules/shared/pagination.ts` and the legacy-status expansion helper in `app/modules/shared/statusFilter.ts` with the equivalent Proposals and Invoices queue reads, so all three resources use one consistent pagination/filter strategy.

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md).

Current enforced rule:

- estimate mutations are draft-only until the estimate is finalized to `ready`
- `ready` is the internally finalized state; this slice does not add customer delivery, viewing, or approval endpoints

## Costbook provenance and pricing snapshots

Estimate line items preserve the Costbook source and price that existed when the line was created. `costItemId` or `assemblyId` identifies the source, while persisted `unitCost` and `lineCost` are historical pricing snapshots rather than live pointers to current Costbook pricing.

- recalculation of an existing Estimate uses persisted line costs and does not re-fetch current CostItem or Assembly unit cost
- changing later Costbook pricing does not silently mutate an already-created Estimate line
- a newly added CostItem or Assembly line resolves the current source cost at creation time and persists that value on the line
- estimate duplication/versioning copies the persisted source IDs and pricing values, preserving historical pricing context
- this verification does not add a second Estimate/Costbook integration path and does not introduce Athena Estimate writes

Focused regression coverage lives in `app/tests/estimate-costbook-snapshot.test.ts`.

## Frontend surfaces

- `/projects/[id]/estimates/[estimateId]`
- `/projects/[id]/estimates/compare`
- `/projects/[id]/estimates/[estimateId]/assist`

## Tests

- `app/tests/estimate-engine.service.test.ts`
- `app/tests/estimate-engine.formulas.test.ts`
- `app/tests/estimate-costbook-snapshot.test.ts`
- `app/tests/athena-tools.estimator.create-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.update-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.analyze-estimate.contracts.test.ts`
- `app/tests/athena-tools.estimator.compare-estimates.contracts.test.ts`
- `app/tests/estimate-engine.queue.test.ts`, `app/tests/estimate-engine.controller.queue.test.ts` — organization work-queue filters, pagination, and authorization
- `app/tests/rls.integration.ts` (`organization work-queue reads` describe block) — live tenant isolation for the queue read
- `app/tests/rls.integration.ts` (S040 core service boundary case) — same-org CRM/estimate/invoice/job access, cross-org 404 denial, and denied-estimate-write immutability

## Implementation notes

- A12 (`app/modules/athena-tools/estimator/*`): four Athena tools (`estimator.create-estimate`, `estimator.update-estimate`, `estimator.analyze-estimate`, `estimator.compare-estimates`) call `EstimateEngineService` directly, never Prisma. `EstimateEngineService.create()` now publishes the canonical `EstimateStarted` A8 event and `finalize()` publishes `EstimateCompleted`, both after the mutation commits and both non-blocking on publish failure (same posture as `ProposalsService.send()`'s existing `ProposalSent` publish). Both methods' return types gained an additive, optional `athenaEvent?: { type, id }` field so a calling Athena tool can wrap the real published event with `eventRef()` - existing callers (the estimate controller) are unaffected. A new read-only `EstimateEngineService.compareEstimates(baseEstimateId, candidateEstimateId, orgId?)` method computes a cost/price/margin/line-item-count delta between two estimates; this is distinct from the existing UI-only `web/src/lib/estimate-compare.ts` comparison helper behind `/projects/[id]/estimates/compare`. See `docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md` for the full tool catalog and permission mapping.
- `EstimateEngineService` now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining a duplicate private copy (cleanup only; no change to pricing behavior)
- Estimate mutation locking binds the authenticated organization as UUID before the parent-row lock, preserving the existing draft-only and tenant-scoped behavior without changing any route or DTO contract. S040 live RLS coverage proves same-org success, cross-org 404 denial, and no mutation after a denied update.
- `EstimateLineItem.sourceKey` is optional and is used for backend-generated idempotency/replay protection on reviewed structured-AI apply calls. Manual line-item creation remains unrestricted by source key.
- `EstimateEngineService.removeLineItem(lineItemId, orgId)` resolves the target line item's estimate by `lineItemId` alone (plus org scope and the existing draft-only check); it does not separately validate against the `:id` route param. It now returns `{ estimateId }` (was `void`) so the controller's activity-log entry is recorded against the line item's actual estimate rather than trusting the URL, which could otherwise misattribute the audit entry if a caller passed a `lineItemId` belonging to a different draft estimate. No lifecycle or authorization behavior changed — draft-only enforcement and org scoping are unchanged.

## Known limitations

- downstream commercial workflows still rely on compatibility status normalization in some paths
- Costbook pricing preview remains calculation-only; it is not a saved organization pricing-policy system
- S008 closes the prior `sent -> ready` normalization defect. `sent` now remains `sent` in API/DTO/UI normalization and is independently accepted by the organization queue filter. Historical `rejected -> declined` compatibility remains. Customer delivery, viewing, approval, expiration, and supersession workflows remain outside this bounded normalization slice.

## Deferred work

- customer-facing estimate delivery and review transitions beyond the current finalize step
- richer historical pricing comparison/reporting may build on the persisted snapshot semantics without repricing historical lines

## Last verified date

2026-08-21


## S026 ordering concurrency

Estimate line-item append allocation remains persisted through `EstimateLineItem.sortOrder`. The S026 implementation serializes next-order allocation on the organization-scoped parent Estimate row inside the existing request-aware transaction, preserving append order, pricing snapshots, source-key idempotency, and draft-only writes.


## S028 estimate deliverability

PR #338 verifies draft persistence/reload for custom and Costbook-backed lines, sections and cost types, taxable flags, deterministic overhead/tax totals, revision-safe updates, and finalized-estimate immutability. The additive migration does not rewrite existing data.
