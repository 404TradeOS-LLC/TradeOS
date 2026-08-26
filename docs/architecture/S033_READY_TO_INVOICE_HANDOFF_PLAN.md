---
status: READY
owner: platform
last_verified: 2026-08-26
source_of_truth: true
related_code:
  - app/modules/jobs/service.ts
  - app/modules/jobs/lifecycle.ts
  - app/backend/routes/jobs.routes.ts
  - app/modules/athena-events/transactionalContext.ts
  - web/src/app/(app)/dispatch
  - web/src/components/dispatch
  - web/src/lib/api.ts
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/modules/jobs-and-scheduling.md
  - docs/modules/invoices-and-payments.md
  - docs/API_REFERENCE.md
  - docs/RBAC_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/CURRENT_STATE.md
---

# S033 — Ready-to-invoice handoff

Status: READY  
Dependencies: S011 DONE; S012 DONE; S032 DONE  
Founder decision required: NO under the existing Job, RBAC, RLS, activity,
invoice-readiness, and invoice-creation boundaries.

## Objective

Make completed field work visibly and reliably hand off to office billing
preparation. A manager must be able to find completed jobs that have not yet
been marked ready for invoice, review the existing job context, and explicitly
acknowledge invoice readiness with attributable audit evidence.

## Existing foundation verified

- `JobsService.complete()` records completion timestamps, actor metadata, the
  `WorkCompleted` canonical event, and preserves the completed Job status.
- `JobsService.readyForInvoice()` already requires a manager role, requires the
  Job to be completed, scopes the lookup by organization and existing RLS
  context, records `readyForInvoiceAt`, and writes `job.ready_for_invoice`
  activity with the acting user.
- `POST /api/v1/jobs/:jobId/ready-for-invoice` is already routed through the
  authenticated Jobs controller and UUID path validation.
- The existing dispatcher list/detail contracts already expose job context;
  the missing UI contract is a visible completed-not-ready queue and an
  explicit manager action over the named route.
- S011, S012, and S032 are DONE with merged evidence. S027 remains an
  independent authenticated browser-evidence block.

## Bounded implementation contract

In scope:

- Add a server-side filter/response field sufficient to identify completed
  Jobs with `readyForInvoiceAt = null`, while preserving organization/RLS
  scoping and pagination.
- Add a manager-facing invoice-readiness queue or bounded section of the
  existing authenticated dispatch workspace showing completed-but-not-ready
  Jobs, their customer/project/job context, completion time, and current
  readiness state.
- Add an explicit manager action that calls the existing
  `ready-for-invoice` route, refreshes the queue, and surfaces deterministic
  success/error/empty states.
- Preserve the existing job activity/audit event and actor attribution; add
  focused coverage for visibility, authorization, tenant boundaries, repeated
  acknowledgement behavior, stale/ineligible status, and refresh/error paths.
- Update the Jobs/API/module documentation and completion evidence after merge.

## Security and lifecycle invariants

- Only existing manager roles may acknowledge invoice readiness. Technicians
  must not receive this action.
- Completed-but-not-ready reads and mutations remain organization-scoped and
  forced-RLS protected. Forged IDs, wrong-organization Jobs, and unauthorized
  roles fail closed.
- Only `completed` Jobs qualify. The existing eight persisted Job statuses do
  not change; invoice readiness remains a separate marker, not a Job status.
- Completion and `WorkCompleted` remain separate from readiness acknowledgement.
  Required canonical-event and activity transaction behavior is preserved.
- Reopen continues to clear completion/readiness metadata through the existing
  owner/admin path.

## Explicit non-goals

- No automatic invoice creation, invoice sending, payment processing, ledger,
  pricing, tax, balance, or billing-policy change.
- No new Job status, role, permission, table, column, migration, RLS policy,
  or generic status mutation.
- No technician permission widening, customer portal behavior, GPS/routing,
  offline workflow, messaging, photo/voice capture, or S034/S037/S047 work.
- No S027 browser evidence is claimed or mixed into S033.

## Required validation

- `git diff --check`
- `npm run pr:preflight -- --base origin/main`
- `npm run pr:test`
- `npm run docs:test`
- `npm run docs:check -- --base origin/main`
- Jobs service/controller unit and contract tests
- PostgreSQL/RLS tenant and authorization coverage where applicable
- Web dispatch/queue contract tests, lint, and build
- Adversarial wrong-org, forged-ID, technician-role, incomplete-status,
  repeated-action, stale-state, and API-failure tests
- Exact-head GitHub CI and review evidence

## Completion evidence

Record the implementation head, merge commit, shipped queue/action behavior,
tenant/RLS and audit evidence, CI/review results, non-goals, and unavailable
browser evidence in `docs/architecture/S033_COMPLETION_EVIDENCE.md` before
marking S033 DONE.
