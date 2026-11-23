---
status: ready
owner: platform
last_verified: 2026-11-23
source_of_truth: true
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/TRADEOS_BIBLE.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/RBAC_MATRIX.md
  - docs/ARCHITECTURE.md
  - docs/testing/S073_RLS_COVERAGE_MATRIX.json
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
related_code:
  - app/modules/change-orders/service.ts
  - app/modules/change-orders/types.ts
  - app/backend/controllers/changeOrders.controller.ts
  - app/backend/routes/changeOrders.routes.ts
  - web/src/components/projects/change-order-forms.tsx
  - app/tests/change-orders.service.test.ts
---

# S068 — Change-Order Customer Workflow Certification Plan

## Outcome

S068 must certify the change-order workflow already implemented on current
`main`: change-order draft, pricing, customer review/approval/rejection,
audit, and downstream financial visibility. Certification means retained
authenticated browser evidence plus current-head service/contract evidence
that the workflow preserves original contract/invoice truth, attributes
customer decisions, and never silently mutates historical snapshots — not a
new change-order model.

This sprint is proof work over an implemented contract. It does **not**
authorize a new change-order model, a migration, or a new financial
correctness rule.

## Readiness reconciliation

- Dependencies: none. There is no implementation dependency to satisfy.
- Current `main` at readiness start is
  `bf23a3f5c6d693f5877d72e54b79f7565f3ce0a4` (Gemini provider adapter #1051
  merged 2026-11-23).
- Live GitHub overlap rechecked 2026-11-23: open PRs #1044 (DES-10-F3 price
  signals), #1045 (DES-7 invoice decisions), #1048 (DES-10-F5 estimate
  header), #1049 (dependabot api-runtime), #1052 (add-member form), #1053
  (dependabot web-runtime). None owns change-order scope. No remote branch
  implements S068; no live S068 lane exists.
- The change-order contract is implemented on current `main`:
  `ChangeOrder` (`change_orders`, `coNumber` unique per project, `status`
  default `draft`, `amount`, `scheduleImpactDays`, `approvedAt`,
  `rejectedAt`, optional `estimateId`) plus `ChangeOrderLineItem`
  (quantity, unit cost, line cost, optional `costItemId` link);
  `app/modules/change-orders/service.ts` enforces draft-only edits through
  `assertDraft` and approve/reject transitions through
  `canTransitionChangeOrderStatus` in `app/domain`; the controller and
  routes (`app/backend/routes/changeOrders.routes.ts`) expose the workflow;
  the web project workspace ships change-order forms
  (`web/src/components/projects/change-order-forms.tsx`); the customer
  portal project page references change orders.
- Release certification prerequisites S054 (`PLANNED`) and S059
  (`IN_REVIEW`, implementation merged as #1032) are reference-validated
  only: per the Bible, `Release certification prerequisites:` do not block
  `READY` and must not be treated as implementation dependencies. They
  remain release-certification constraints — no release or beta
  certification claim depending on S054/S059 may be made until those
  sprints reach `DONE`.
- What S068 still must prove: the customer review/approval/rejection path
  end to end with attribution (who decided, when, on what version); the
  audit trail for every status transition (verify whether approve/reject
  emits an auditable event beyond the `approvedAt`/`rejectedAt`
  timestamps — if it does not, add one inside the existing contract);
  pricing fidelity (line-item math, cost-item linkage, amount totals);
  and downstream financial visibility (how an approved change reaches
  estimates, invoices, and contracts) without mutating historical
  snapshots (`contracts.snapshot_json`, proposal pricing) after approval.

## Authoritative scope discovery

The implementation must derive the certification set from current code, not
memory:

1. Start with the change-order module (`app/modules/change-orders/`),
   the controller/routes, and the web forms. Trace every route the
   workflow exposes and every table it reads or writes.
2. Trace the status machine (`canTransitionChangeOrderStatus`,
   `assertDraft`) through draft → approved / draft → rejected, including
   every 409 path and the permission gate on each transition.
3. Trace the customer side: the portal project page's change-order
   surface, who may view it, and which action (if any) lets a customer
   approve or reject. If the portal exposes review without a decision
   action, record that as the gap and build the decision action inside
   the existing portal contract — do not invent a second approval model.
4. Trace pricing: line-item quantity × unit cost → line cost → order
   amount, cost-item linkage, and the optional `estimateId` relationship.
   Verify the amount a customer approves is the amount the system records.
5. Trace downstream visibility: approved change orders into estimate
   totals, invoice line construction, and contract amounts. Verify an
   approved change never rewrites a historical snapshot: the contract and
   proposal records as signed must stay byte-stable; the change must
   appear as a new, attributable record.
6. Trace audit: every transition must leave a durable, attributable
   record (actor, timestamp, before/after status, amount). Timestamps
   alone are not an audit trail unless the actor is recorded with them.

## Required evidence fields

Each certification step must record:

- journey step and owning route/service;
- actor role and organization scope;
- input (draft content, line items, amount) and resulting status;
- customer decision attribution (who, when, which version);
- audit record produced by the transition;
- downstream record affected (estimate/invoice/contract) and proof the
  historical snapshot did not mutate;
- viewport (1440/1024/768/390 for browser steps) and tenant-negative
  result (cross-tenant read/decision denied).

## Bounds

- No new change-order model, migration, or status value. The
  draft/approved/rejected machine is the contract; a gap that needs a
  schema change is a separate governed change — record it and stop before
  authoring a migration.
- No silent mutation of historical snapshots. Approved changes are new
  attributable records, never edits to signed contracts or proposals.
- No broadening of who may approve, reject, or edit. The existing
  permission gates are the contract; a gap is a defect to record, not a
  permission to widen.
- No new role, permission, auth/RBAC/RLS policy, or production data
  change is authorized by this promotion.

## Founder-decision boundary

NO for the bounded certification above. YES before any new financial
model, migration, role/permission, auth/RBAC/RLS policy, or production
database change. S054's and S059's separate certification decisions are
not dependencies of S068 and are not decided by this promotion.

## Required validation

- Focused change-order service/controller tests, including the draft-only
  edit guard, approve/reject transitions, and every 409 path.
- Portal review/decision browser evidence at 1440/1024/768/390 with
  tenant-negative and wrong-role cases.
- Current-head evidence that approved changes do not mutate historical
  snapshots (contract/proposal records byte-stable after approval).
- `git diff --check`; `npm run pr:preflight -- --base origin/main`;
  `npm run pr:test`; `npm run docs:test`;
  `npm run docs:check -- --base origin/main`;
  `(cd app && npm test && npm run lint && npm run build && npm run test:integration)`;
  applicable web test/lint/build lanes where touched; exact-head CI.
