---
status: readiness-promotion
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/modules/jobs/service.ts
  - app/modules/jobs/types.ts
  - app/modules/jobs/dispatchRules.ts
  - app/backend/controllers/jobs.controller.ts
  - app/backend/controllers/jobsTransactional.controller.ts
  - app/backend/routes/jobs.routes.ts
  - app/prisma/schema.prisma
related_docs:
  - docs/LIFECYCLE_COMPATIBILITY_MATRIX.md
  - docs/WORKFLOW_LIFECYCLES.md
  - docs/modules/jobs-and-scheduling.md
  - docs/RBAC_MATRIX.md
  - docs/SPRINT_BACKLOG.md
---

# S012 — Job lifecycle normalization plan

**This is a planning and readiness artifact only.** It does not implement Job
runtime behavior. S012 may begin only after the separate governance-only
readiness promotion merges and the implementation branch is created from the
refreshed `origin/main`.

## Mission

Normalize the existing backend Job lifecycle contract across scheduling,
dispatch, field work, completion, and invoice readiness. The goal is one
documented and enforced transition contract at the existing service boundary,
with current permissions, tenant isolation, activity history, and request
transaction behavior preserved.

## Current runtime inventory

- `app/domain/contracts.ts` already declares the canonical statuses:
  `unscheduled`, `scheduled`, `dispatched`, `traveling`, `on_site`, `paused`,
  `completed`, and `cancelled`.
- Job actions already use named service methods and routes rather than a
  generic client-controlled status patch: scheduling/rescheduling, dispatch,
  travel, arrival, pause/resume, completion, cancellation, reopen, and
  ready-for-invoice.
- `JobsService` contains action-specific transition guards, schedule/conflict
  validation, role checks, assignment checks, activity events, completion
  metadata, and the `readyForInvoiceAt` marker.
- Dispatch attention is derived from status, schedule, assignment, and archive
  fields. It is not a persisted lifecycle state.
- Job reads and writes are organization-scoped and operate through the
  existing request-scoped database/RLS architecture. The implementation must
  preserve that boundary and must not introduce a nested transaction on the
  request-scoped Prisma proxy.
- The current repository has no Job legacy-status map and no evidence that a
  Job schema migration is required. Historical data must not be rewritten
  destructively.

The implementation phase must revalidate this inventory against live runtime
code and tests. This plan does not assume that documentation and method-local
guards have remained identical since the S006 inventory.

## Authorized implementation contract

S012 is authorized to:

1. Define or consolidate the existing canonical Job transition table at the
   backend service boundary and make every existing lifecycle action enforce
   the permitted source states.
2. Preserve the documented scheduling and field-work graph:
   `unscheduled|scheduled|dispatched -> scheduled` for schedule/reschedule,
   `scheduled -> dispatched -> traveling -> on_site`,
   `on_site <-> paused`, `traveling|on_site|paused -> completed`,
   `scheduled|dispatched|paused -> cancelled`, and owner/admin-only
   `completed -> unscheduled|scheduled` reopen.
3. Preserve the existing invariants for schedule ranges, conflict overrides,
   assignment eligibility, cancellation reasons, completion timestamps and
   actor metadata, and clearing completion/readiness metadata on reopen.
4. Keep invoice readiness distinct from Invoice creation: only a completed Job
   may be marked ready for invoice, and the existing activity/audit behavior
   must remain attributable and tenant-scoped.
5. Keep status, activity, and required canonical-event behavior inside the
   existing request-scoped transaction architecture, without adding a nested
   transaction or a new persistence mechanism.
6. Keep dispatch/work-queue classifications derived from canonical terminal
   statuses and existing schedule/assignment fields; persisted statuses remain
   the current eight values.

## Explicitly not authorized

S012 does not:

- add a new Job status, alias map, schema constraint, or migration;
- add generic arbitrary-status mutation;
- redesign the Dispatcher Workspace, route optimization, GPS, notifications,
  or technician-assignment UX;
- create invoices automatically or redesign billing, payment processors, or
  invoice lifecycle semantics;
- redesign Project-to-Job orchestration or commercial workflow coupling;
- add broad optimistic-concurrency or idempotency repairs unrelated to the
  documented Job transition contract;
- change authentication, RBAC policy, forced RLS policy, or tenant boundaries;
- begin S018, S021, S027, S030, S032, or any other numbered sprint.

## Required implementation evidence

The implementation PR must include focused coverage for every permitted and
rejected transition, schedule/reschedule rules, role and assignment
boundaries, cancellation/reopen metadata, completion and invoice-readiness
gating, activity/event behavior, derived Dispatch classifications, and
cross-organization/RLS denial. PostgreSQL-backed integration is mandatory for
tenant and transaction claims.

Required repository validation is:

```text
git diff --check
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
(cd app && npm test && npm run lint && npm run build && npm run test:integration)
```

No frontend verification is required unless the implementation directly
changes an existing Job status display or classification surface.

## Readiness evidence

- Dependency S006 is `DONE` in merged PR #95.
- S007-S011 are complete with merged evidence; S011 completion evidence
  merged in PR #284 as `0c693a8e29884d29305160498c46e2af38b7e14b`.
- No open or draft S012 implementation/readiness PR or remote S012 branch was
  found during the live reconciliation before this promotion.
- PostgreSQL-backed CI is available for the required implementation evidence.
- No founder decision is marked required for S012 in the backlog, and this
  promotion does not create a new product-policy decision.

## Stop conditions

Stop and report if runtime revalidation proves that the bounded transition
contract requires a schema migration, a new status, an RBAC/RLS policy change,
automatic invoice creation, or a broader concurrency/architecture decision.
