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

S028 is DONE after implementation PR #338 and completion-evidence PR #339. S030 is now the sole READY numbered-sprint implementation lane. S027 remains independently BLOCKED only on authenticated rendered Costbook evidence.

## Current truth

- Main is reconciled through completion-evidence merge cc2d6371aa29520dffc1f83bf86118c17f7b840c.
- S012 and S029 are DONE and satisfy S030 dependencies.
- S030 verifies the existing Dispatcher Workspace across scheduled/unscheduled work, assignment, unassignment, rescheduling, conflicts, canonical Job actions, dispatch-summary scope, and rendered states.
- Preserve Job/JobAssignment, named lifecycle routes, organization authorization, forced RLS, activity/audit attribution, and request-scoped transactions.
- No founder decision or external credential is required to begin repository work; production browser evidence must not be fabricated.

## Readiness contract

Read docs/architecture/S030_DISPATCHER_WORKSPACE_PLAN.md before editing. Preserve S012 lifecycle and existing role/assignment/conflict semantics. Do not add statuses, generic mutation, roles, RLS redesign, new persistence, unreviewed migrations, route optimization/GPS/notifications, billing/payment behavior, or later sprints.

## Next action

Create or reconcile the sole S030 implementation branch/worktree after overlap checks, dispatch read-only backend/RLS/frontend/test/security audits, and implement only the S030 READY contract.

## Next Eligible Sprint

Sprint ID: S030
Eligibility: S030 is READY through this governance-only promotion; S012 and S029 are DONE and no competing S030 implementation exists.
Dependencies: S030 depends on S012 and the S029 baseline; S027 remains independently BLOCKED.
Overlap check: No competing S030 implementation/readiness branch or PR was found.
Startup prompt: Create/reconcile the sole S030 implementation branch/worktree and verify the Dispatcher Workspace contract. Do not implement another numbered sprint concurrently.
