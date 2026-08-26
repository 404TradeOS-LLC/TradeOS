---
status: archived
superseded_by: docs/DOMAIN_MODEL.md
do_not_use_for_implementation: true
---

# Domain Model Canonical

## Purpose

This document is the canonical beta vocabulary for TradeOS domain roles, lifecycle states, transitions, and activity naming. It exists to prevent backend, frontend, tests, and seed data from drifting.

Implementation source:
- shared contracts: `app/domain/contracts.ts`
- backend enforcement: service-layer transition checks and permission checks
- frontend rendering: imports from `@/domain` (`web/src/domain/index.ts` re-exports `app/domain`)

## Core hierarchy

Primary operating hierarchy:

`Customer -> Project -> Job/Work Order`

Current RC1 posture:
- `Customer` is fully implemented and company-scoped.
- `Project` is the operational workspace and current execution hub.
- `Job` is now a first-class model with scheduling, technician assignment, and dispatch lifecycle actions (`app/modules/jobs`).

## Canonical roles

Beta roles:
- `owner`
- `admin`
- `dispatcher`
- `technician`

Compatibility roles still tolerated in persisted data:
- `estimator` -> canonical role mapping: `dispatcher`
- `viewer` -> canonical role mapping: `technician`

Compatibility policy:
- existing legacy membership rows are not silently deleted or rewritten in this sprint
- auth/session resolution and admin/settings surfaces normalize legacy roles to canonical roles
- legacy source roles remain visible in admin/settings compatibility views where practical

## Permission model

Shared permission keys:
- `team.manage`
- `company.manage`
- `settings.manage`
- `crm.read`
- `crm.write`
- `dispatch.manage`
- `billing.read`
- `billing.write`
- `documents.manage`
- `notes.write`
- `activity.read`

Canonical intent:
- `owner`: full workspace control
- `admin`: broad company and team administration without ownership transfer semantics
- `dispatcher`: CRM, dispatch, billing support, notes, and document workflows
- `technician`: read-oriented field access plus notes/activity participation

Enforcement:
- API route guards call shared permission helpers
- service-level enforcement remains authoritative for lifecycle mutations

## Canonical lifecycle states

### Project
- `lead`
- `estimating`
- `awarded`
- `active`
- `on_hold`
- `completed`
- `archived`

### Job
- `unscheduled`
- `scheduled`
- `dispatched`
- `traveling`
- `on_site`
- `paused`
- `completed`
- `cancelled`

### Estimate
- `draft`
- `ready`
- `sent`
- `viewed`
- `approved`
- `declined`
- `expired`
- `superseded`

### Proposal
- `draft`
- `generated`
- `sent`
- `viewed`
- `accepted`
- `declined`
- `expired`

### Contract
- `draft`
- `sent`
- `viewed`
- `signed`
- `voided`

### Invoice
- `draft`
- `sent`
- `viewed`
- `partially_paid`
- `paid`
- `overdue`
- `voided`

### Change Order
- `draft`
- `approved`
- `rejected`

### Task
- `todo`
- `in_progress`
- `blocked`
- `completed`

### Site Visit
- `captured`

## Transition rules

TradeOS now enforces explicit service-level transition checks through shared contracts.

Important rules:
- approved estimates do not transition back to `draft`
- signed contracts do not transition back to `sent`
- paid invoices do not transition back to `partially_paid`
- archived projects do not transition back to active states through ordinary status updates
- proposal resend is a separate action from initial send

Project examples:
- `lead -> estimating`
- `estimating -> awarded`
- `awarded -> active`
- `active -> completed`
- `completed -> archived`

Compatibility normalization:
- older project values such as `opportunity`, `site_visit`, `proposal_sent`, `active_job`, `field_execution`, `closeout`, and `warranty` are normalized into the canonical project state model
- older contract status `pending_signature` normalizes to `sent`
- older invoice status `void` normalizes to `voided`
- older proposal/estimate status `rejected` normalizes to `declined`

## Activity and audit vocabulary

Canonical event naming format:
- `customer.created`
- `project.created`
- `project.status_changed`
- `job.assigned`
- `estimate.sent`
- `estimate.approved`
- `proposal.viewed`
- `proposal.accepted`
- `contract.signed`
- `invoice.payment_recorded`
- `change_order.approved`

Compatibility note:
- existing event names are not wholesale rewritten in this sprint
- the activity recorder now normalizes known legacy names at write time where a safe compatibility map exists

## CRM surface authority

Authoritative customer CRM surface:
- routes: `app/backend/routes/crm.routes.ts`
- controller: `app/backend/controllers/crm.controller.ts`
- service: `app/modules/crm/service.ts`

Deprecated compatibility surface:
- `app/backend/routes/projects.routes.ts` still contains the older customer CRUD router
- this router is currently unmounted in `app/backend/server.ts`
- removal should happen in a dedicated cleanup sprint after confirming no external callers remain

## Remaining normalization debt

Still deferred:
- live migration verification for any future persisted status rewrites
- migrating `contracts`/`invoices`/`proposals` services to write canonical status values directly instead of relying on read-time normalization (contracts still default to `pending_signature`, proposals still write `rejected` on reject)
- broader activity-event backfill for historical rows already stored with legacy names
- full doc cleanup across older historical planning notes
