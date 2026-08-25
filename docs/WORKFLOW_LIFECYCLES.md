---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/modules/estimate-engine/service.ts
  - app/modules/proposals/service.ts
  - app/modules/contracts/service.ts
  - app/modules/invoices/service.ts
  - app/modules/jobs/service.ts
  - app/modules/jobs/lifecycle.ts
  - app/modules/athena-events/transactionalContext.ts
  - app/modules/athena-events/transactionalPublishers.ts
  - app/tests/estimate-costbook-snapshot.test.ts
---

# Workflow Lifecycles

This file defines canonical display states and the current compatibility layer for persisted values.

## Current operational relationship

Current workflow relationship:

`Customer -> Project -> Job -> Schedule/Assignment -> Field Work -> Completion -> Invoice readiness`

Important scope note:

- estimates, proposals, and contracts may feed project and job execution, but the current repository does not enforce one rigid automatic chain where every job must pass through the same commercial sequence before field work begins
- scheduling, technician assignment, dispatcher coordination, and field-status progression are already part of the implemented product surface

## Projects

Canonical display states:

- `lead`
- `estimating`
- `awarded`
- `active`
- `on_hold`
- `completed`
- `archived`

Compatibility persistence:

- older project values such as `proposal_sent`, `accepted`, `proposal_draft`, `site_visit`, and `in_production` are normalized through `legacyProjectStatusMap`
- new project writes use canonical values only; proposal draft creation/duplication/decline and send/resend side effects persist `estimating`, while proposal acceptance persists `awarded`

Current transition posture:

- project status is partly direct and partly side-effect-driven from proposal and job workflows
- proposal send/resend currently pushes persisted project status toward canonical `estimating`
- proposal accept currently pushes persisted project status toward canonical `awarded`
- proposal draft creation/duplication and decline currently push persisted project status toward canonical `estimating`
- full canonical project transition enforcement remains a compatibility layer, not a single dedicated state machine

## Estimates

Canonical states:

- `draft`
- `ready`
- `sent`
- `viewed`
- `approved`
- `declined`
- `expired`
- `superseded`

Current enforced transitions:

- `draft -> ready` is enforced by `EstimateEngineService.finalize`
- draft-only mutations are blocked after an estimate leaves `draft`

Compatibility persistence:

- persisted values such as `rejected` normalize to canonical `declined`
- proposal-linked downstream statuses are normalized for display through `legacyEstimateStatusMap`
- `sent` is a canonical estimate state and remains `sent` when persisted or returned; it is not an alias for `ready`

Pricing snapshot invariant:

- Costbook-backed estimate lines persist `costItemId` or `assemblyId` provenance plus `unitCost` and `lineCost` at line creation time
- subsequent Costbook price changes do not transition or silently reprice an existing Estimate line
- estimate recalculation uses persisted line costs; it does not re-fetch current CostItem/Assembly pricing for existing lines
- a newly added CostItem or Assembly line captures the current Costbook cost at creation time
- duplication/versioning preserves the persisted source and pricing snapshot values

Implementation notes:

- `EstimateEngineService`'s cost/price rounding now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining its own private copy (a duplication cleanup with no change to rounding behavior or transition rules).
- Structured AI estimator replay protection adds optional line-item `sourceKey` handling but does not change estimate lifecycle states or the draft-only mutation rule.
- `removeLineItem` now returns the affected line item's estimate id (for accurate activity-log attribution — see `docs/modules/estimating.md`) but its draft-only enforcement and org-scoping checks are unchanged.
- A12.1: `EstimateEngineService.create()` requires durable `EstimateStarted` persistence in the same database transaction as estimate creation, and `finalize()` requires durable `EstimateCompleted` persistence in the same transaction as `draft -> ready`. If either required event cannot be persisted, the enclosing estimate mutation/transition rolls back. This does not add an estimate state or alter the allowed transition graph; subscriber delivery remains outside the lifecycle transaction.

Organization work-queue reads (`GET /api/v1/estimates`, see `docs/modules/estimating.md`):

- the queue includes every non-deleted estimate; the current Estimate model has no soft-delete/archive flag, so this is unconditionally true today and no status is treated as an implicit default-view exclusion
- a `status` filter (or comma-separated multiple statuses) is matched against the canonical value; matching also expands to any legacy raw stored value that normalizes to it, so callers never have to know the compatibility mapping
- `sent` is accepted as its own canonical queue filter and does not match `ready`
- this is a read-only aggregate; it introduces no new estimate state or transition

## Costbook Workspace

Foundation states:

- `foundation`
- `active`
- `archived`

Current transition posture:

- C001 creates the database and API foundation for Costbook workspace state, but no user-facing workflow currently transitions these states
- `GET /api/v1/costbook/workspace` reports `foundation` when no organization workspace record has been initialized
- the practical pricing preview and price-history views do not mutate Costbook workspace state
- supplier feed ingestion queues review proposals only and does not represent a workspace-state transition or automatic catalog-price transition
- future saved pricing-policy or import/review workflows must document their transition rules before mutating workspace state

## Proposals

Canonical display states:

- `draft`
- `generated`
- `sent`
- `viewed`
- `accepted`
- `declined`
- `expired`

Current persisted values:

- new service writes persist `draft`, `sent`, `viewed`, `accepted`, and canonical `declined`
- historical `rejected` rows remain accepted by the database constraint and are displayed canonically as `declined`

Current enforced transitions:

- `draft -> sent`
- `sent -> viewed`
- `sent|viewed -> accepted`
- `sent|viewed -> declined`
- `sent|viewed -> sent` through resend

View, accept, and decline writes use organization-scoped conditional updates
inside the existing request transaction. A competing transition can produce
only one winning terminal result; the losing request fails closed without a
second delivery/activity event or project-side-effect overwrite. Repeated
terminal approval/decline remains an invalid transition.

Compatibility note:

- the `/reject` route and service method remain for API compatibility, but the mutation writes canonical `declined` and records `proposal.declined`; historical `rejected` values remain read-compatible
- `generated` and `expired` are canonical states without a current proposal-service mutation path

Athena event integration:

- A12.1 makes the `draft -> sent` transition and required `ProposalSent` persistence atomic: both commit together or both roll back. No other proposal transition publishes a canonical event yet. Subscriber delivery remains pull-based/asynchronous and is not part of the proposal lifecycle transaction.

Organization work-queue reads (`GET /api/v1/proposals`, see `docs/modules/proposals.md`):

- `sent` / `viewed` filter on `sentAt`/`viewedAt` being non-null
- `unsigned` means no `Contract` row references the proposal yet — conversion is the Contract row's existence, independent of that contract's own `pending_signature`/`signed`/`voided` state
- `stale` has no fixed age; the caller supplies `staleBefore` and the queue matches proposals whose `sentAt <= staleBefore`
- the product spec for this queue calls for cancelled/voided proposals to be excluded from `unsigned`/`stale`, but the current domain has no canonical cancelled/voided proposal status (only `declined`/`expired` exist as terminal states) — there is nothing for that exclusion rule to apply to today; it is not implemented as a status value that does not exist in this domain
- this is a read-only aggregate; it introduces no new proposal state or transition

Proposal, invoice, and contract PDF generation preserves each workflow's
existing lifecycle and binary route contract while applying server-derived
organization branding. Branding is presentation-only and does not alter
pricing, payment, signature, status, or document authorization semantics.

## Contracts

Canonical display states:

- `draft`
- `sent`
- `viewed`
- `signed`
- `voided`

Current persisted values:

- the database currently defaults to `pending_signature`; the `contracts.status` check constraint accepts only `pending_signature`, `signed`, `voided` — canonical `draft`/`sent`/`viewed` are not DB-legal
- `pending_signature` is the compatibility storage value for the pre-signature contract phase

Current enforced transitions:

- accepted proposal required before contract creation
- `pending_signature -> signed`
- `pending_signature -> voided`
- signed contracts cannot be voided

Compatibility note:

- PR #276 (S010, merged 2026-08-23 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`) normalizes the API surface: `toDTO()` in `app/modules/contracts/service.ts` returns canonical `sent` for a stored `pending_signature` row. Persistence, the check constraint, and the `sign()`/`void()` guards are unchanged and still operate on raw `pending_signature`.
- S020 hardening adds optimistic concurrency at both contract mutation
  boundaries: sign requires the row to remain `pending_signature`, void requires
  the previously read status to remain unchanged, and a competing mutation
  fails closed without a duplicate event. Already-voided contracts are rejected.

## Jobs

Canonical states:

- `unscheduled`
- `scheduled`
- `dispatched`
- `traveling`
- `on_site`
- `paused`
- `completed`
- `cancelled`

Current enforced transitions:

- create without schedule: `unscheduled`
- create with schedule: `scheduled`
- `unscheduled|scheduled|dispatched` can be scheduled or rescheduled subject to conflict rules
- `scheduled -> dispatched`
- `dispatched -> traveling`
- `traveling -> on_site`
- `on_site -> paused`
- `paused -> on_site`
- `on_site -> completed`; `traveling` and `paused` must return to `on_site` before completion
- `scheduled|dispatched|paused -> cancelled`
- `completed -> unscheduled|scheduled` through owner/admin reopen

Privileged override actions:

- only owners and admins may override schedule conflicts
- only owners and admins may reopen completed jobs
- manager roles can archive jobs

Operational role note:

- dispatchers coordinate assignment, schedule changes, and permitted job-state progression within the current RBAC model, but current docs do not claim automated routing or optimization behavior
- the Dispatcher Workspace (`/dispatch`) is a read-mostly overview surface built on the existing job list/status model above — it introduces no new canonical status, no new transition, and no new privileged action; "needs attention" is a derived, non-persisted view computed from existing status/schedule/assignment fields (see `app/modules/jobs/dispatchRules.ts`), not a new lifecycle state
- A12.1: `JobsService.schedule()` + `JobScheduled`, `addAssignment()` + `TechnicianAssigned`, and `complete()` + `WorkCompleted` each commit atomically. Required canonical event-persistence failure rolls back the corresponding schedule/assignment/completion mutation, leaving the prior lifecycle state intact. `reschedule()` and every other transition above remain unchanged. Subscriber delivery is not part of the transaction.
- S012: `app/modules/jobs/lifecycle.ts` is the backend transition source of truth for the existing Job actions. It preserves the eight persisted statuses, current role/assignment checks, schedule/conflict validation, activity events, completion/readiness metadata, request-scoped transactions, and tenant/RLS boundaries. Dispatch attention remains derived and no schema migration is introduced.

## Invoices

Canonical display states:

- `draft`
- `sent`
- `viewed`
- `partially_paid`
- `paid`
- `overdue`
- `voided`

Current enforced transitions:

- `draft -> sent`
- `sent|overdue -> paid`
- a recorded-payment reconciliation may transition an eligible `sent` invoice, or an existing raw `overdue` invoice for historical compatibility, to persisted `paid` when recorded payments fully cover the invoice
- non-paid invoices may be voided

Compatibility persistence:

- raw `void` normalizes to canonical `voided`
- `InvoicesService.void()` persists raw `void` so the transition satisfies the live `invoices_status_check` constraint; delivery/activity metadata still records canonical `invoice.voided` / `newStatus: "voided"`
- `cancelled` remains a defensive legacy normalization synonym, although the live constraint has never permitted that value
- `partially_paid` and `overdue` remain derived read/reporting states; they are not persisted by the current Invoice payment path
- `viewed` remains canonical vocabulary without a current Invoice persistence or tracking path

Organization work-queue reads (`GET /api/v1/invoices`, see `docs/modules/invoices-and-payments.md`):

- `paidAmount`/`balanceDue` are not stored columns; the queue derives them per invoice from the sum of that invoice's `Payment` rows with `status = "recorded"` (pending/failed payments do not count), then `balanceDue = amount - paidAmount`, computed in the database so filtering and pagination stay exact
- `overdue` = `dueDate` has passed AND `balanceDue > 0` AND status is neither persisted `paid` nor voided
- `partiallyPaid` = `paidAmount > 0` AND `balanceDue > 0` AND status is neither persisted `paid` nor voided
- `unpaid` = `balanceDue > 0` AND status is neither persisted `paid` nor voided — this includes partially-paid invoices, per the locked product decision that a partial payment does not make an invoice "paid"
- the voided exclusion above checks the actual persisted raw value the live `invoices_status_check` database constraint allows (`void`); canonical display/activity semantics remain `voided`. It also checks `cancelled` as a defensive legacy synonym (`legacyInvoiceStatusMap` maps it to canonical `voided` too), even though the live constraint has never allowed that value either
- this is a read-only aggregate; it introduces no new invoice state or transition

Invoice detail and project invoice reads use the same source-of-truth rules:
the API returns only `recorded` payment rows, derives `paidAmount` and
`balanceDue` on the server, and leaves partial-payment and overdue status as
display/reporting derivations. Persisted `paid` remains authoritative for the
displayed zero balance even when manual `mark-paid` created no Payment row.

Payment reconciliation:

- `POST /api/v1/invoices/:id/payments` serializes reconciliation on the target Invoice row inside the existing request-scoped transaction, inserts the Payment, and recomputes the recorded-payment total from the database
- only an eligible persisted `sent` Invoice, or an existing raw `overdue` Invoice for historical compatibility, transitions automatically to `paid`; partial payments remain derived and non-recorded payments do not count
- the payment, persisted status change, and `invoice.paid` delivery/activity event commit together; a concurrent final payment observes the serialized status and does not emit a duplicate transition event
- the existing manual `mark-paid` action remains compatible: it can persist `paid` without a Payment row, and persisted `paid` is authoritative for follow-up exclusion

## Transactional canonical-event invariant (A12.1)

For the six required A12 canonical mutation events — `EstimateStarted`, `EstimateCompleted`, `JobScheduled`, `TechnicianAssigned`, `WorkCompleted`, and `ProposalSent` — the business mutation and durable canonical-event persistence share one database transaction. A required event-persistence failure therefore leaves the corresponding business/lifecycle mutation uncommitted. This atomicity applies to persistence only; event delivery, subscribers, retries, dead-lettering, and replay remain separate asynchronous A8 concerns.

## Privileged overrides summary

- owner/admin schedule conflict override for jobs
- owner/admin reopen completed jobs
- compatibility normalization for legacy role and status values remains active until persisted values are cleaned up in a dedicated migration plan

## Document rendering lifecycle evidence

S022 rendering is presentation-only: proposal, contract, and invoice lifecycle values remain server-derived and are not persisted or reinterpreted by renderers. The current slice emits deterministic UTC dates, safe finite-number fallbacks, canonical HTML status labels, and explicit empty line-item states while preserving authorization and tenant boundaries.


## Estimate line-item ordering concurrency

Estimate line-item append order is persisted and remains deterministic under concurrent manual or AI/replay-shaped inserts. The implementation serializes allocation on the parent Estimate row without changing estimate lifecycle states.
