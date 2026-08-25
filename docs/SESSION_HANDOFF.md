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

- Main is reconciled through S040 implementation merge `6fb0596c6a865923627e621c0933033dad3c636b`; S030 implementation merge is `d8e07606737de561b7cbed4e0be72ce875fae73c` and completion evidence is recorded in `docs/architecture/S030_COMPLETION_EVIDENCE.md`. S040 completion evidence is recorded in `docs/architecture/S040_COMPLETION_EVIDENCE.md`.
- PR #311 is merged as `80f5cd8ed5771f54f5c5f9f43823f81d9bbabd9d`; persisted paid invoices now present queue `balanceDue: 0` consistently with invoice detail without fabricating Payment rows.
- PR #332 is closed superseded; #338/#339/#342 are merged and no stale #332 implementation lane remains.
- S012 and S029 are DONE and satisfy S030 dependencies.
- S030 verified the existing Dispatcher Workspace across scheduled/unscheduled work, assignment, unassignment, rescheduling, conflicts, canonical Job actions, dispatch-summary scope, rendered states, and tenant boundaries.
- Preserve Job/JobAssignment, named lifecycle routes, organization authorization, forced RLS, activity/audit attribution, and request-scoped transactions.
- No founder decision or external credential is required to begin repository work; production browser evidence must not be fabricated.

## Readiness contract — S040

Read `docs/architecture/S040_TENANT_BOUNDARY_REGRESSION_PLAN.md` before editing. Preserve existing organization-membership authorization, request-scoped sessions, and forced RLS. Add only focused tenant-boundary regression coverage; do not add schema, migrations, RLS-policy redesign, auth/RBAC changes, production data operations, or S041+ scope.

### Historical S030 contract

Read docs/architecture/S030_DISPATCHER_WORKSPACE_PLAN.md before editing. Preserve S012 lifecycle and existing role/assignment/conflict semantics. Do not add statuses, generic mutation, roles, RLS redesign, new persistence, unreviewed migrations, route optimization/GPS/notifications, billing/payment behavior, or later sprints.

## Next action

S040 is complete through PR #346 and its completion-evidence lane. Prepare S041 only through `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`; keep authenticated browser evidence explicitly environment-blocked unless an authorized proof can proceed. The estimate-to-proposal mutation proof is not fabricated.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S041 is the next security-leverage candidate but remains PLANNED pending its own governed readiness promotion.
Dependencies: S007, S008, S009, S010, S011, and S012 are DONE; S027 remains independently BLOCKED on authenticated rendered Costbook evidence.
Overlap check: S040 implementation PR #346 and completion evidence are merged; no competing S041 lane exists.
Startup prompt: Prepare S041 through the governed readiness flow only. Do not begin S041 implementation or combine S027 browser evidence with S041.
