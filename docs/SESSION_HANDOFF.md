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

S028 is DONE after implementation PR #338, completion-evidence PR #339, and PT-003 follow-up PR #342. S030 is the sole active numbered-sprint implementation lane through PR #341 after readiness PR #340. S027 remains independently BLOCKED only on authenticated rendered Costbook evidence.

## Current truth

- Main is reconciled through PT-003 merge `164fe63867dceb265d80a0a61098c4c99315a3f3`.
- PR #311 is merged as `80f5cd8ed5771f54f5c5f9f43823f81d9bbabd9d`; persisted paid invoices now present queue `balanceDue: 0` consistently with invoice detail without fabricating Payment rows.
- PR #332 is closed superseded; #338/#339/#342 are merged and no stale #332 implementation lane remains.
- S012 and S029 are DONE and satisfy S030 dependencies.
- S030 verifies the existing Dispatcher Workspace across scheduled/unscheduled work, assignment, unassignment, rescheduling, conflicts, canonical Job actions, dispatch-summary scope, and rendered states.
- Preserve Job/JobAssignment, named lifecycle routes, organization authorization, forced RLS, activity/audit attribution, and request-scoped transactions.
- No founder decision or external credential is required to begin repository work; production browser evidence must not be fabricated.

## Readiness contract

Read docs/architecture/S030_DISPATCHER_WORKSPACE_PLAN.md before editing. Preserve S012 lifecycle and existing role/assignment/conflict semantics. Do not add statuses, generic mutation, roles, RLS redesign, new persistence, unreviewed migrations, route optimization/GPS/notifications, billing/payment behavior, or later sprints.

## Next action

Reconcile PR #341 onto live main, repair deterministic assignment/conflict findings, complete governed RLS review, and keep authenticated browser evidence explicitly environment-blocked unless the authorized live-workspace proof can proceed.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S030 is IN_REVIEW through implementation PR #341 and readiness PR #340 is merged.
Dependencies: S030 depends on S012 and the S029 baseline; S027 remains independently BLOCKED.
Overlap check: PR #341 is the sole S030 implementation lane; no competing branch or PR exists.
Startup prompt: Preserve existing Job lifecycle and tenant boundaries while closing branch currency, governed RLS review, declined-assignment reactivation, conflict/concurrency, and evidence gates. Do not implement another numbered sprint concurrently.
