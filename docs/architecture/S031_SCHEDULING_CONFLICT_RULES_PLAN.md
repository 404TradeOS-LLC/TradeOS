# S031 — Scheduling Conflict Rules

## Readiness decision

S031 is READY for one bounded implementation lane. S030 established the Dispatcher Workspace and the repository already contains the scheduling conflict seam. S031 will make the existing rules explicit, deterministic, fail-closed, and regression-tested across creation, assignment, scheduling, rescheduling, and conflict preview.

## Objective

Prevent a technician from being assigned overlapping active scheduled work unless an authorized owner/admin override includes a non-empty reason. Make time-range validation and conflict visibility consistent across API and service entry points while preserving the existing Job lifecycle, assignment model, organization scoping, forced RLS, and dispatcher UI contract.

## In scope

- Existing `JobsService` schedule conflict collection and enforcement.
- Existing create, schedule, reschedule, add-assignment, and update-assignment paths.
- Existing `GET /api/v1/schedule/conflicts` preview behavior.
- Deterministic half-open interval semantics: a job ending exactly when another begins is not an overlap; any positive intersection is an overlap.
- Validation of paired start/end timestamps, strictly positive duration, arrival-window ordering/date compatibility, and invalid direct-service dates.
- Exclusion of the current job during rescheduling, plus exclusion of archived, cancelled, removed, and declined assignment records from active conflicts.
- Server-derived organization scoping and authorization for conflict reads and override mutations.
- Focused unit, controller, integration/RLS, and concurrency regression tests where the existing test harness supports them.

## Explicit non-goals

- No new Job statuses, scheduling tables, booking/calendar provider, route optimization, GPS, notifications, or automatic dispatch.
- No schema or migration changes unless a verified concurrency defect cannot be safely closed within the existing transaction/advisory-lock architecture; any such need is a stop-and-reassess boundary.
- No changes to lifecycle transitions, assignment roles, billing/invoicing, project/customer identity, S027 browser evidence, S032 field workflow, S034 observability, or S037 observability.
- No broad Dispatcher Workspace redesign or new customer-facing scheduling policy.

## Required invariants

1. Conflict queries are organization-scoped and never trust a caller-supplied organization identifier for authorization.
2. Only active assignments on non-archived, active-schedule-status jobs participate in conflict detection.
3. Boundary-touching intervals do not conflict; positive overlap does.
4. A conflict blocks ordinary mutations with a clear 409 response and structured conflict details.
5. Only owner/admin actors may override, and override requires a trimmed reason; dispatcher/technician callers cannot escalate through payload flags.
6. Rescheduling a job never conflicts with the job itself.
7. Malformed, non-finite, reversed, or incomplete time ranges fail before persistence.
8. Existing forced RLS, organization membership, request-scoped transactions, activity/audit events, and canonical Job statuses remain unchanged.

## Implementation surface

- `app/modules/jobs/service.ts`
- `app/modules/jobs/types.ts` only if the existing DTO needs a bounded additive rule representation
- `app/backend/controllers/jobs.controller.ts` and/or `app/backend/controllers/jobsTransactional.controller.ts` only for validation parity
- `app/tests/jobs.service.test.ts`
- `app/tests/jobs.controller.test.ts`
- `app/tests/dispatchRules.test.ts`
- existing PostgreSQL/RLS scheduling test coverage when available
- `web/src/components/dispatch/dispatch-job-actions.tsx` only if a verified API contract gap requires it; otherwise preserve the existing UI

## Required verification

- Focused service tests for touching/non-touching intervals, same-job exclusion, active-status filtering, removed/declined/archived exclusion, override role/reason enforcement, and malformed direct-service dates.
- Controller tests for strict datetime and UUID/organization parsing, conflict preview authorization, and safe error responses.
- PostgreSQL/RLS evidence for same-organization visibility and cross-organization denial if database paths are changed.
- `git diff --check`, `npm run pr:preflight -- --base origin/main`, `npm run pr:test`, `npm run docs:test`, and `npm run docs:check -- --base origin/main`.
- `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`.
- `(cd web && npm test && npm run lint && npm run build)` if the existing dispatcher client changes.

## Completion evidence

Record readiness and implementation PR numbers, exact heads and merge commits, focused conflict/security tests, CI, RLS/tenant evidence, review findings, non-goals, and any environment-blocked browser evidence in `docs/architecture/S031_COMPLETION_EVIDENCE.md`. Mark S031 DONE only after implementation and completion-evidence PRs both report MERGED and their commits are on `origin/main`.

## Founder and external dependencies

None identified. Existing Job lifecycle, role, assignment, and forced-RLS doctrine determines this bounded contract. Authenticated rendered browser evidence remains separate and must not be fabricated or mixed into S031.
