---
status: current
owner: platform
last_verified: 2026-08-25
source_of_truth: false
related_code:
  - app/modules/jobs/service.ts
  - app/modules/jobs/dispatchRules.ts
  - app/backend/routes/jobs.routes.ts
  - web/src/app/(app)/dispatch
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S030_DISPATCHER_WORKSPACE_PLAN.md
  - docs/architecture/S012_JOB_LIFECYCLE_PLAN.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Mission

S028 is DONE after implementation PR #338, completion-evidence PR #339, and PT-003 follow-up PR #342. S030 is DONE after implementation PR #341 and completion reconciliation. S027 remains independently BLOCKED only on authenticated rendered Costbook evidence.

## Current truth

- Main is reconciled through S040 implementation merge `6fb0596c6a865923627e621c0933033dad3c636b`; S030 implementation merge is `d8e07606737de561b7cbed4e0be72ce875fae73c` and completion evidence is recorded in `docs/architecture/S030_COMPLETION_EVIDENCE.md`. S040 completion evidence is recorded in `docs/architecture/S040_COMPLETION_EVIDENCE.md`. S041 implementation PR #351 and completion evidence are merged; evidence is recorded in `docs/architecture/S041_COMPLETION_EVIDENCE.md`.
- PR #311 is merged as `80f5cd8ed5771f54f5c5f9f43823f81d9bbabd9d`; persisted paid invoices now present queue `balanceDue: 0` consistently with invoice detail without fabricating Payment rows.
- PR #332 is closed superseded; #338/#339/#342 are merged and no stale #332 implementation lane remains.
- S012 and S029 are DONE and satisfy S030 dependencies.
- S030 verified the existing Dispatcher Workspace across scheduled/unscheduled work, assignment, unassignment, rescheduling, conflicts, canonical Job actions, dispatch-summary scope, rendered states, and tenant boundaries.
- Preserve Job/JobAssignment, named lifecycle routes, organization authorization, forced RLS, activity/audit attribution, and request-scoped transactions.
- No founder decision or external credential is required to begin repository work; production browser evidence must not be fabricated.

## Readiness contract — S041

Read `docs/architecture/S041_RLS_POLICY_COVERAGE_PLAN.md` before editing. Preserve forced RLS as the tenant floor and the existing application permission model. Add only the approved `billing.write` change-order gate, `costbook.manage` supplier gate, preserved raw SQL session role semantics, and focused audit/regression evidence. Do not add schema, migrations, RLS-policy redesign, new roles/permissions, production data operations, or S027/S042+ scope.

### Historical S040 contract

Read `docs/architecture/S040_TENANT_BOUNDARY_REGRESSION_PLAN.md` before editing. Preserve existing organization-membership authorization, request-scoped sessions, and forced RLS. Add only focused tenant-boundary regression coverage; do not add schema, migrations, RLS-policy redesign, auth/RBAC changes, production data operations, or S041+ scope.

### Historical S030 contract

Read docs/architecture/S030_DISPATCHER_WORKSPACE_PLAN.md before editing. Preserve S012 lifecycle and existing role/assignment/conflict semantics. Do not add statuses, generic mutation, roles, RLS redesign, new persistence, unreviewed migrations, route optimization/GPS/notifications, billing/payment behavior, or later sprints.

## Readiness contract — S031

Read `docs/architecture/S031_SCHEDULING_CONFLICT_RULES_PLAN.md` before editing. Preserve the existing Job lifecycle, assignment roles, request-scoped transactions, organization authorization, and forced RLS. Implement only deterministic scheduling conflict validation/enforcement and focused regression evidence. Do not add statuses, scheduling persistence, providers, route optimization, notifications, billing, S027 browser evidence, or S032/S034/S037 scope.

## S031 completion

S031 implementation PR #358 merged as `aa421606968f8a83fe0932ab0010131ea9625940`; completion evidence is recorded in `docs/architecture/S031_COMPLETION_EVIDENCE.md`. The scheduling conflict contract, tests, CI, and security boundaries are reconciled. S027 remains separate and authenticated browser evidence remains explicitly environment-blocked.

## Readiness contract — S032

Read `docs/architecture/S032_FIELD_TECHNICIAN_DAILY_WORKFLOW_PLAN.md` before editing. Preserve the existing Job lifecycle, technician assignment scoping, request-scoped transactions, organization authorization, forced RLS, activity/events, and dispatcher contracts. Implement only the responsive technician daily workspace, assigned-job detail/context, permitted field status actions, and job notes. Do not add statuses, roles, permissions, persistence, GPS/routing, offline sync, messaging, voice/photo workflows, billing, S027 browser evidence, or S033/S034/S037 scope.

## S032 completion

S032 implementation PR #361 merged as `f10fe02bd8e1161476b530b6cfb5c5a45facfd05`; completion evidence is recorded in `docs/architecture/S032_COMPLETION_EVIDENCE.md`. The technician workspace preserves existing assignment, organization/RLS, lifecycle, note, and activity boundaries. No production/browser evidence is claimed.

## Next Eligible Sprint

## S033 completion

S033 is DONE after readiness PR #363, implementation PR #365, and completion-evidence PR #366 merged. The shipped handoff preserves completed-only readiness, manager authorization, organization/RLS scoping, readiness activity, WorkCompleted separation, and existing invoice semantics. Evidence is recorded in `docs/architecture/S033_COMPLETION_EVIDENCE.md`; no production/browser evidence is claimed.

## S034 completion

S034 is DONE under `docs/architecture/S034_COMPLETION_EVIDENCE.md` after
readiness PR #372 and implementation PR #373 merged. The shipped panel uses
existing organization-scoped dispatch summary and job activity routes, with
truthful scope labels and explicit activity empty/error states.
S030 and S031 are DONE, and no competing S034 implementation lane or open
S034 PR was found during reconciliation. The bounded contract was a read-only
Dispatch observability surface over existing attention counts, conflict
preview/override behavior, attributed job activity, queue filters, and
organization/RLS scope. Durable failed-attempt history, alerting,
notifications, new statuses/roles/permissions, schema/migrations, RLS
redesign, S027 browser evidence, and S035/S037 work remain out of scope.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: S034 and S035 are DONE; S036 remains PLANNED and blocked by S027.
Dependencies: S030 and S031 are DONE with merged evidence.
Overlap check: No open S034 PR remains; implementation PR #373 is merged and no authoritative S034 implementation lane remains after cleanup.
Startup prompt: Do not start S036 until S027 is complete and S036 is promoted through readiness. Keep S027 browser evidence independent.

## S035 completion

S035 is DONE after representative isolated staging plans were captured against a synthetic fixture and deleted afterward. Inventory and completion evidence are recorded in `docs/performance/S035_QUERY_PERFORMANCE_INVENTORY.md` and `docs/architecture/S035_COMPLETION_EVIDENCE.md`.
S036 remains blocked by S027's authenticated rendered Costbook browser evidence.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S036 is PLANNED but blocked by S027.
Dependencies: S035 is DONE with representative plan evidence; S027 is independently BLOCKED on authenticated rendered Costbook evidence.
Overlap check: No open S035 PR remains; completion evidence is being reconciled in the current governance lane. Do not create an S036 implementation lane.
Startup prompt: Resolve S027, then promote S036 through the readiness protocol before creating its single implementation lane.
