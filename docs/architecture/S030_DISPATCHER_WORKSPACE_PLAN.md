---
status: READY
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_code:
  - app/modules/jobs/service.ts
  - app/modules/jobs/dispatchRules.ts
  - app/backend/routes/jobs.routes.ts
  - web/src/app/(app)/dispatch
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/architecture/S012_JOB_LIFECYCLE_PLAN.md
  - docs/modules/jobs-and-scheduling.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/CURRENT_STATE.md
---

# S030 — Dispatcher workspace end-to-end verification plan

Status: READY
Dependencies: S012 DONE; S029 DONE
Founder decision required: NO

## Objective

Verify and narrowly repair the existing Dispatcher Workspace critical path across scheduled and unscheduled work, assignment, unassignment, rescheduling, conflicts, and canonical Job lifecycle actions. Align existing UI, API, and persistence behavior without creating a second dispatch system.

## Contract

The implementation must revalidate the existing /dispatch surface, organization-scoped /api/v1/jobs routes, named lifecycle actions, dispatch-summary scope, Job/JobAssignment persistence, request-scoped transactions, activity/audit behavior, and S012 transition graph.

Acceptance requires discoverable scheduled/unscheduled work; correct assignment and rescheduling; deterministic conflict and invalid-state outcomes; rendered refresh consistency; honest dispatch-summary scope; same-org success; unauthenticated, unauthorized, malformed-ID, cross-org, and RLS denial; supported loading/empty/error/partial-data and responsive states; focused tests; PostgreSQL/RLS integration; typecheck, lint, builds, docs checks, and exact-head CI.

## Security and founder boundary

Retain verified authentication, organization-membership authorization, and forced PostgreSQL RLS. Verify direct-object, cross-org, malformed-ID, unauthorized-role, assignment-ownership, and conflicting-mutation paths. Founder decision required: NO under the existing lifecycle, route, role, and workspace semantics.

## Non-goals and stop conditions

No new Job status, alias, generic status patch, dispatch persistence model, role, permission, RBAC/RLS redesign, route optimization, GPS, notifications, automatic invoice creation, billing/payment change, broad UI rewrite, unrelated concurrency/idempotency repair, unreviewed migration, or S031/S032/S034/S035 work. Stop at the reviewable boundary if a new policy, security model, destructive behavior, materially different persistence architecture, or production trust-boundary change is required.

## Required validation

git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
(cd app && npm test && npm run lint && npm run build && npm run test:integration)
(cd web && npm test && npm run lint && npm run build)

For UI changes use stable semantic locators and repository-required desktop/tablet/mobile viewports. Production browser evidence requires an authorized session and must not be fabricated.

## Readiness evidence

S012 and S029 are DONE; S028 is DONE and non-overlapping; no open or draft S030 PR, branch, or worktree was found; S027 is independently blocked on authenticated rendered Costbook evidence; no external credential or founder decision is required to begin repository verification. Implementation status is NOT STARTED until this governance-only promotion lands.
