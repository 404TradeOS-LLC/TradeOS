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

## Next action

Create exactly one S031 implementation lane from the merged readiness commit. S042 implementation PR #354 and completion evidence are merged; do not reopen its lane. Preserve existing Job lifecycle, assignment roles, request-scoped sessions, forced RLS, and auth boundaries. S027 remains separate and authenticated browser evidence remains explicitly environment-blocked.

## Next Eligible Sprint

Sprint ID: S031
Eligibility: S031 is READY with S030 DONE; no other numbered sprint may start while S031 is active. S027 remains independently BLOCKED on authenticated rendered Costbook evidence.
Dependencies: S042 is DONE with merged completion evidence.
Overlap check: No open S031 PR or competing S031 implementation lane exists at readiness promotion. Do not reopen S042 or begin S032/S034/S037.
Startup prompt: Follow NEXT_SPRINT_PROTOCOL.md and the S031 readiness plan. Keep one authoritative implementation writer and keep S027 browser evidence independent.
