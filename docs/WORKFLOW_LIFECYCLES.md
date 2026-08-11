---
status: current
owner: platform
last_verified: 2026-07-28
source_of_truth: true
related_code:
  - app/domain/contracts.ts
  - app/modules/estimate-engine/service.ts
  - app/modules/proposals/service.ts
  - app/modules/contracts/service.ts
  - app/modules/invoices/service.ts
  - app/modules/jobs/service.ts
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

Current transition posture:

- project status is partly direct and partly side-effect-driven from proposal and job workflows
- proposal send currently pushes persisted project status toward `proposal_sent`
- proposal accept currently pushes persisted project status toward `accepted`
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

Implementation notes:

- `EstimateEngineService`'s cost/price rounding now imports the shared `round2()` helper from `estimate-engine/formulas.ts` instead of defining its own private copy (a duplication cleanup with no change to rounding behavior or transition rules).
- Structured AI estimator replay protection adds optional line-item `sourceKey` handling but does not change estimate lifecycle states or the draft-only mutation rule.
- `removeLineItem` now returns the affected line item's estimate id (for accurate activity-log attribution — see `docs/modules/estimating.md`) but its draft-only enforcement and org-scoping checks are unchanged.

## Costbook Workspace

Foundation states:

- `foundation`
- `active`
- `archived`

Current transition posture:

- C001 creates the database and API foundation for Costbook workspace state, but no user-facing workflow currently transitions these states
- `GET /api/v1/costbook/workspace` reports `foundation` when no organization workspace record has been initialized
- future Costbook setup, import, pricing-rule, or review workflows must document their transition rules before mutating this state

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

- the service persists `draft`, `sent`, `viewed`, `accepted`, and `rejected`
- `rejected` is displayed canonically as `declined`

Current enforced transitions:

- `draft -> sent`
- `sent -> viewed`
- `sent|viewed -> accepted`
- `sent|viewed -> declined`
- `sent|viewed -> sent` through resend

Compatibility note:

- canonical documentation uses `declined`, but storage and service internals still use `rejected` in some paths

## Contracts

Canonical display states:

- `draft`
- `sent`
- `viewed`
- `signed`
- `voided`

Current persisted values:

- the database currently defaults to `pending_signature`
- `pending_signature` is the compatibility storage value for the pre-signature contract phase

Current enforced transitions:

- accepted proposal required before contract creation
- `pending_signature -> signed`
- `pending_signature -> voided`
- signed contracts cannot be voided

Compatibility note:

- the repository has event history for contracts, but the canonical display state names are ahead of the stored default name

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
- `traveling|on_site|paused -> completed`
- `scheduled|dispatched|paused -> cancelled`
- `completed -> unscheduled|scheduled` through owner/admin reopen

Privileged override actions:

- only owners and admins may override schedule conflicts
- only owners and admins may reopen completed jobs
- manager roles can archive jobs

Operational role note:

- dispatchers coordinate assignment, schedule changes, and permitted job-state progression within the current RBAC model, but current docs do not claim automated routing or optimization behavior
- the Dispatcher Workspace (`/dispatch`) is a read-mostly overview surface built on the existing job list/status model above — it introduces no new canonical status, no new transition, and no new privileged action; "needs attention" is a derived, non-persisted view computed from existing status/schedule/assignment fields (see `app/modules/jobs/dispatchRules.ts`), not a new lifecycle state

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
- non-paid invoices may be voided

Compatibility persistence:

- legacy values such as `void` and `cancelled` normalize to canonical `voided`

## Privileged overrides summary

- owner/admin schedule conflict override for jobs
- owner/admin reopen completed jobs
- compatibility normalization for legacy role and status values remains active until persisted values are cleaned up in a dedicated migration plan
