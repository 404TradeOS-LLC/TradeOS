---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: false
related_code:
  - app/modules/jobs
  - app/modules/jobs/lifecycle.ts
  - app/backend/routes/jobs.routes.ts
  - app/prisma/schema.prisma
  - web/src/app/(app)/projects/[id]/page.tsx
  - web/src/app/(app)/dispatch/page.tsx
  - web/src/components/dispatch
  - app/modules/athena-tools/dispatcher
  - app/modules/athena-tools/field
  - app/modules/athena-events/transactionalContext.ts
  - app/modules/athena-events/transactionalPublishers.ts
---

# Jobs and Scheduling

## Purpose

Own first-class field-execution jobs, technician assignments, scheduling and rescheduling, dispatcher coordination, dispatch transitions, schedule conflict detection, and ready-for-invoice signaling.

## Source code locations

- `app/modules/jobs/*`
- `app/backend/routes/jobs.routes.ts`

## Core models

- `Job`
- `JobAssignment`
- `JobEquipment`

## Routes

- `/api/v1/jobs`
- `/api/v1/jobs/dispatch-summary`
- `/api/v1/jobs/:jobId/*`
- `/api/v1/schedule`
- `/api/v1/schedule/conflicts`

`GET /api/v1/jobs/dispatch-summary` is a read-only, count()-only aggregate (never `findMany`) of org-wide dispatch-attention metrics: active/unscheduled/scheduled-today/overdue/needs-attention job counts, plus the organization-timezone-aware `today`/`this week` UTC boundaries the frontend uses to build its own `scheduledFrom`/`scheduledTo` filters (never computed client-side). It requires authentication but no elevated role — the existing `jobs_select_policy` RLS policy already narrows every count to only the caller's assigned jobs for non-manager roles, and the response's `scope` field labels that narrowing honestly rather than presenting a role-scoped count as an org-wide total. `GET /api/v1/jobs` also gained an `unassigned` boolean filter and now returns additive `project`/`customer`/`assignedTechnicians`/`isOverdue`/`isUnassigned`/`needsAttention` fields per job. `unassigned`/`needsAttention` are parsed strictly (only the literal query strings `"true"`/`"false"`; anything else fails validation) rather than via a naive truthy-string coercion, since `unassigned=false` is a real, distinct "assigned-only" request, not the same as the filter being omitted. `GET /api/v1/jobs` also gained a `needsAttention` boolean filter, expressed server-side by the same shared OR clause `getDispatchSummary`'s own `needsAttention` count uses (`app/modules/jobs/service.ts`'s `buildNeedsAttentionWhere`), so the work-queue list and the summary count can never define "needs attention" differently.

Current supported operational scope:

- job creation and update
- technician assignment and reassignment
- scheduling and rescheduling
- schedule-conflict review
- dispatcher-coordinated job-state progression within current RBAC limits
- field-work coordination through completion and invoice readiness

## Permissions

See [RBAC_MATRIX.md](../RBAC_MATRIX.md).

Important job-specific rules:

- manager roles are `owner`, `admin`, and `dispatcher`
- technician field access is scoped to active assignments
- schedule conflict overrides are owner/admin only
- dispatcher workflows are in scope today; only advanced optimization and route-planning features remain deferred

## Scheduling conflict rules

The existing schedule, reschedule, and assignment paths enforce technician
availability within the authenticated organization. A candidate interval
overlaps an active scheduled job only when the existing start is before the
candidate end and the existing end is after the candidate start. The intervals
are therefore half-open: adjacent appointments with equal end/start times are
allowed. The current job is excluded during rescheduling, and archived jobs plus
removed or declined assignments do not create conflicts.

`GET /api/v1/schedule/conflicts` provides a conflict preview for a technician and
time window. Mutation paths reject conflicts with `409` unless an owner or admin
supplies an explicit nonempty override reason. Dispatchers retain ordinary
schedule and assignment management but cannot override; technicians retain only
their existing field-scoped access. Dates must be valid and supplied durations
must be positive integers before any write occurs.

Conflict reads and their subsequent writes use transaction-scoped PostgreSQL
advisory locks keyed by organization and technician. This closes the race where
two concurrent requests could both observe a free interval, while preserving
request authentication, forced RLS, activity attribution, and the existing
schema. No scheduling table, status, role, provider integration, or route
optimization behavior is added.

## Lifecycle and statuses

See [WORKFLOW_LIFECYCLES.md](../WORKFLOW_LIFECYCLES.md). The backend transition
contract is centralized in `app/modules/jobs/lifecycle.ts`: scheduling and
rescheduling remain limited to `unscheduled|scheduled|dispatched`, field work
progresses `scheduled -> dispatched -> traveling -> on_site`, pause/resume is
`on_site <-> paused`, completion is `on_site -> completed`, cancellation is
limited to `scheduled|dispatched|paused`, and owner/admin reopen is
`completed -> unscheduled|scheduled`. Dispatch attention remains derived.

## Emitted activity events

- job scheduling, rescheduling, dispatch, movement through field states, assignment changes, conflict overrides, reopening, and archiving write activity records
- separately, A12 publishes three canonical A8 business events from Jobs: `JobsService.schedule()` → `JobScheduled`, `addAssignment()` → `TechnicianAssigned`, and `complete()` → `WorkCompleted`. A12.1 makes these three canonical event writes part of the same database transaction as the corresponding business mutation. A required event-persistence failure now aborts and rolls back the enclosing schedule/assignment/completion mutation instead of being logged-and-ignored. The returned optional `athenaEvent?: { type, id }` reference remains additive for Athena tool wrappers. `reschedule()`, `updateAssignment()`, and the other field-state transitions (`startTravel`, `arrive`, `pause`, `resume`, `cancel`, `reopen`) do not publish a canonical event.

## Athena business tools (A12)

Four `app/modules/athena-tools/dispatcher/*` tools (`dispatcher.schedule-job`, `dispatcher.assign-technician`, `dispatcher.optimize-day`, `dispatcher.weather-impact`) and four `app/modules/athena-tools/field/*` tools (`field.job-context`, `field.update-job-status`, `field.add-note`, `field.create-recommendation`) call `JobsService`/`CrmService` directly, never Prisma. `field.update-job-status`'s A4 `permissions` is deliberately empty - `JobsService`'s own `assertFieldWorker`/`assertManager` and technician-assignment checks remain the real authorization boundary for who can transition a job, not an A4 `DomainPermission`. See `docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md` for the full tool catalog and permission mapping.

## Frontend surfaces

- jobs currently surface through the project workspace and related project detail pages
- a dedicated Dispatcher Workspace now exists at `web/src/app/(app)/dispatch/page.tsx` (`/dispatch`, linked from the authenticated nav): an org-wide, filterable work queue plus the dispatch-attention summary strip above, both consuming only the routes documented here — no new backend module, no fabricated data, no drag-and-drop/GPS/route-optimization/map/notification features
- the workspace defaults to `needsAttention=true` (a "Needs attention" vs. "All jobs" View filter, shareable/refresh-safe via `?view=`) rather than every unarchived job, since surfacing jobs that actually need dispatcher action is the workspace's purpose — the default is a visible, changeable filter-bar control, not a hidden constraint, and every empty state offers a working path back to the unfiltered `?view=all` queue
- schedule times in the work-queue table render in the organization's timezone (or the UTC fallback), matching the summary strip's own caption — not the Next.js server process's local timezone, which the shared `formatDateTime` helper used elsewhere in this app does not account for
- the work queue paginates with Previous/Next controls that preserve every active filter/search param

## Tests

- `app/tests/jobs.service.test.ts`
- `app/tests/jobs.lifecycle.test.ts`
- `app/tests/jobs.controller.test.ts`
- `app/tests/jobs.migration.test.ts`
- `app/tests/dispatchRules.test.ts`
- `app/tests/rls.integration.ts`
- `app/tests/athena-events.transactional-rollback.integration.ts`
- `app/tests/athena-tools.dispatcher.schedule-job.contracts.test.ts`
- `app/tests/athena-tools.dispatcher.assign-technician.contracts.test.ts`
- `app/tests/athena-tools.dispatcher.optimize-day.contracts.test.ts`
- `app/tests/athena-tools.dispatcher.weather-impact.contracts.test.ts`
- `app/tests/athena-tools.field.job-context.contracts.test.ts`
- `app/tests/athena-tools.field.update-job-status.contracts.test.ts`
- `app/tests/athena-tools.field.add-note.contracts.test.ts`
- `app/tests/athena-tools.field.create-recommendation.contracts.test.ts`

## Known limitations

- richer dispatcher board UX remains separate from the core backend engine

## Deferred work

- advanced dispatch optimization and route planning

## Last verified date

2026-08-12


## S030 dispatcher verification (active)

The `/dispatch` workspace now exposes the existing organization-scoped assignment, schedule/reschedule, conflict-check, and named lifecycle endpoints through a same-origin authenticated client proxy. Active assignments exclude both removed and declined rows in application predicates and detail/list includes, matching technician visibility policy. Job creation also requires assigned users to hold the canonical `technician` membership role; no new status, role, permission, migration, or RLS policy was introduced.
