---
status: pending-dispatch
owner: platform
last_verified: 2026-11-24
source_of_truth: false
related_docs:
  - docs/architecture/S068_CHANGE_ORDER_CUSTOMER_WORKFLOW_PLAN.md
  - docs/SPRINT_BACKLOG.md
  - docs/RBAC_MATRIX.md
  - docs/API_REFERENCE.md
  - docs/decisions/ADR-010-customer-magic-link-portal.md
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
  - docs/testing/S073_RLS_COVERAGE_MATRIX.json
related_code:
  - app/modules/change-orders/service.ts
  - app/backend/controllers/changeOrders.controller.ts
  - app/backend/routes/changeOrders.routes.ts
  - app/modules/customer-portal/service.ts
  - app/tests/change-orders.service.test.ts
  - app/tests/change-orders.controller.test.ts
  - app/tests/s068.change-orders.integration.ts
  - app/scripts/s068-browser-evidence.mjs
  - .github/workflows/s068-browser-evidence.yml
---

# S068 — Change-Order Customer Workflow Certification Evidence

Status: **PENDING DISPATCH**. The backend half (audit-event fix,
service/controller unit tests, live-PostgreSQL integration test) is built
on branch `feat/s068-change-order-certification` (base main `c7717c69`);
no authenticated browser run has been dispatched yet, so nothing in this
document certifies a deployment. Do not cite it as certification until a
`s068-browser-evidence` run passes and its run id, SHAs, and artifact are
recorded in §8. Dispatch happens from `main` after this PR merges — no
browser run is dispatched in this run because staging is mid
field-closeout.

## 1. What this certifies

The existing change-order contract on current `main`: change-order draft,
pricing, staff approval/rejection with attribution, audit, and downstream
financial visibility. Certification means retained authenticated browser
evidence plus current-head service/contract evidence that the workflow
preserves original contract/invoice truth, attributes staff decisions,
and never silently mutates historical snapshots — not a new
change-order model, migration, or financial correctness rule.

## 2. Scope discovery (traced from current code, 2026-11-24)

- **Module:** `app/modules/change-orders/service.ts` — `ChangeOrder`
  (`change_orders`, `coNumber` unique per project, `status` default
  `draft`, `amount`, `scheduleImpactDays`, `approvedAt`, `rejectedAt`,
  optional `estimateId`) plus `ChangeOrderLineItem` (quantity, unit cost,
  line cost, optional `costItemId` link). Draft-only edits enforced by
  `assertDraft`; approve/reject transitions through
  `canTransitionChangeOrderStatus` in `app/domain`; project-scoped
  numbering serialized by a transaction-scoped advisory lock.
- **Controller/routes:** `app/backend/controllers/changeOrders.controller.ts`
  + `app/backend/routes/changeOrders.routes.ts`. Reads require
  `billing.read`; every mutation — create, update, line-item changes,
  delete, approve, reject — requires `billing.write`. No permission
  changed in this sprint.
- **Pricing:** line cost is `round2(unitCost * quantity)`; the order
  amount is the sum of line costs, recalculated on line-item changes and
  again inside `approve` before the status write, so the amount a staff
  approver sees is the amount the system records.
- **Customer side:** the portal project page references change orders, but
  the portal service returns `changeOrders: []`
  (`app/modules/customer-portal/service.ts:248`) and the portal page
  discloses that customer change-order approval is not a capability. See
  GAP-2.
- **Downstream visibility:** no code outside `app/modules/change-orders`
  reads approved change orders into estimates, invoices, or contracts.
  The only other consumer is the standalone document template
  (`app/modules/documents/templates.ts`, `renderChangeOrderFrameHtml`),
  which renders one change order as a document; `app/modules/settings/types.ts`
  holds only a `changeOrderTemplate` template-name field. See GAP-3.
- **RLS:** `change_orders` / `change_order_line_items` have forced RLS
  with org-scoped policies through `projects`
  (`20260623180000_enable_org_rls`); `activity_events` has forced RLS
  with org-scoped policies (`20260828120000_complete_tenant_rls`).
  `docs/testing/S073_RLS_COVERAGE_MATRIX.json` contains zero `change`
  matches — the change-order tables are **not** in the S073 matrix, so no
  S073 coverage is claimed for them. Org scoping is enforced in the
  service (`project: { orgId }` on every read) plus forced RLS, and the
  cross-org case is covered by the live integration test (§6).

## 3. Gaps

- **GAP-1 (FIXED in this worktree, browser proof pending):**
  `ChangeOrdersService.approve()` / `reject()` wrote only `status` plus
  the `approvedAt` / `rejectedAt` timestamp — no `ActivityEvent`, no actor
  recorded, and the service received no actor at all. Both methods now
  take an optional `actorUserId`, and after the successful status update
  they record an `ActivityEvent` via `ActivityTimelineService.record()`
  (same pattern as `app/modules/proposals/service.ts`):
  `entityType: "change_order"`, `entityId` = the change-order id,
  `eventType: "change_order.approved" | "change_order.rejected"`,
  title `Change order #N approved|rejected`, `actorUserId` from the
  parameter, metadata `{previousStatus, newStatus, coNumber, projectId,
  amount}`. The controller passes `requireAuthContext(req).userId` as the
  actor (same pattern as `proposals.controller.ts`). No permission change:
  `billing.write` stays. No schema/migration change: the
  `activity_events` table already exists. The event is recorded only
  when the caller supplies an organization scope (`orgId` is a required
  `activity_events` column); a scope-less service call still succeeds
  without an event.
  - Sub-finding fixed with GAP-1: `canTransitionChangeOrderStatus`
    returns true for same-status transitions (`from === to` in
    `app/domain/contracts.ts`), so approve-from-approved previously
    re-approved instead of 409ing — and would have recorded a duplicate
    event. `approve` / `reject` now guard explicitly on
    `status === "draft"` first, so every non-draft decision attempt is a
    409 with no event recorded. The domain helper itself is unchanged.
  - Type note: `"change_order"` is registered in the closed
    `IntelligenceEntityType` union (`app/modules/intelligence/types.ts`)
    by this PR, so these events are queryable through the typed
    `ActivityFilters` (`GET /api/v1/intelligence/activity?entityType=change_order`).
    The costbook modules (`candidateCostItemService.ts`, `codes/store.ts`) already
    record non-union entity types (`costbook_research_candidate`,
    `codes_source`) by writing `activityEvent.create` directly.
- **GAP-2 (BLOCKED BY DESIGN — do not build):** customer-portal
  approve/reject. ADR-010
  (`docs/decisions/ADR-010-customer-magic-link-portal.md`) limits
  customer-originated writes to signing the customer's pending contract;
  the change-order approve/reject controllers require staff
  `billing.write`; the portal service returns `changeOrders: []` and the
  portal page discloses that customer change-order approval is not a
  capability. Building customer approve/reject would change
  authorization and needs a separately governed authorization decision.
  The browser run proves the portal surface as read-only for change
  orders; no customer decision action is certified because none exists.
- **GAP-3 (FINDING — founder decision needed for any new financial
  model):** no downstream roll-up. Nothing reads an approved change
  order into estimate totals, invoice line construction, or contract
  amounts. An approved change order is visible only as its own record
  (and as a standalone rendered document). Whether approved changes
  should roll into estimates/invoices/contracts is a product decision
  for the founder — this sprint builds no roll-up and records the gap.

## 4. Certification step list

Bearer material: no raw token, session, cookie, header, or bearer value
is retained in any evidence artifact. Evidence locations:
**BROWSER** = authenticated non-production browser capture at
1440/1024/768/390 (`s068-browser-evidence` run); **LIVE-DB** =
disposable PostgreSQL integration evidence
(`app/tests/s068.change-orders.integration.ts`); **UNIT** =
current-head test named. Browser evidence is PENDING DISPATCH for every
step below; the UNIT and LIVE-DB columns record what is already proven
on the branch.

### Phase A — staff approve / reject with attribution

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| A1 | `POST /change-orders/:id/approve` → `service.approve` | Staff with `billing.write` | 200, status `approved`, `approvedAt` set, amount recalculated as the sum of line costs | Staff org + project | BROWSER + UNIT `change-orders.service.test.ts` approve test + LIVE-DB `s068.change-orders.integration.ts` approve test |
| A2 | Same route/service | Staff with `billing.write` | Exactly one `change_order.approved` activity event: `entityType "change_order"`, actor = authenticated staff user, metadata `{previousStatus: "draft", newStatus: "approved", coNumber, projectId, amount}` | Staff org | UNIT approve test + LIVE-DB approve test |
| A3 | `POST /change-orders/:id/reject` → `service.reject` | Staff with `billing.write` | 200, status `rejected`, `rejectedAt` set; exactly one `change_order.rejected` event with the same attribution shape | Staff org + project | BROWSER + UNIT reject test |
| A4 | Approve/reject from `approved` or `rejected` | Staff with `billing.write` | 409; status unchanged; **no** event recorded | Staff org | UNIT 409 matrix test (approve/reject × approved/rejected) |
| A5 | Approve/reject for another org's order | Staff with `billing.write` | 404; no event recorded | Cross-org | UNIT cross-org test + LIVE-DB cross-org test |
| A6 | Approve/reject without `billing.write` (technician) | Technician | 403; service never called | Staff org | UNIT `change-orders.controller.test.ts` |
| A7 | Approve/reject unauthenticated | Unauthenticated | 401; service never called | — | UNIT `change-orders.controller.test.ts` |
| A8 | Approve/reject with a staff role that holds `billing.write` | Owner / dispatcher | 200; the authenticated user id is passed through as the decision actor | Staff org | UNIT `change-orders.controller.test.ts` actor pass-through test |

### Phase B — draft-only edit guards

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| B1 | Update / add line item / remove line item / delete on a non-draft order | Staff with `billing.write` | 409 for each; no write; no event | Staff org | UNIT draft-guard test |
| B2 | Update / line-item changes on a draft order | Staff with `billing.write` | 200/201; amount recalculated | Staff org | UNIT existing tests (unchanged) |

### Phase C — pricing fidelity

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| C1 | Add line item | Staff with `billing.write` | `lineCost = round2(unitCost * quantity)`, including a rounding case (`0.125 × 1 → 0.13`; `12.345 × 2 → 24.69`) | Staff org | UNIT pricing test |
| C2 | Approve | Staff with `billing.write` | Amount = sum of line costs (`33.33 + 33.33 → 66.66`); the recalculated amount is the amount recorded in the approval event metadata | Staff org | UNIT recalc-on-approve test + LIVE-DB approve test (2 × 25 → 50) |

### Phase D — customer portal (read-only by design)

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| D1 | Portal project page | Customer session | Change orders shown as read-only / not a capability; no approve/reject control exists | Own org+customer | BROWSER (GAP-2 — no decision action to certify) |
| D2 | Portal approve/reject attempt (if any route existed) | Customer session | No such route; staff `billing.write` gate is the only path | — | NOT-APPLICABLE — no portal decision route exists; recorded here so a future route is not mistaken for certified |

### Phase E — downstream snapshot stability

| # | Evidence | Expected | Evidence |
| --- | --- | --- | --- |
| E1 | Approve a change order linked to a project with a sent proposal and a pending contract carrying `snapshot_json` | Contract `snapshot_json` byte-identical before/after approve; proposal pricing (`finalPrice`, `priceLow`, `priceHigh`) unchanged | LIVE-DB `s068.change-orders.integration.ts` approve test |
| E2 | Approved change order visibility in estimates/invoices/contracts | No roll-up exists (GAP-3); the approved change is a new attributable record only | Code trace (§2) — no test asserts a roll-up that does not exist |

### Phase F — live PostgreSQL / RLS evidence (re-verify on the exact head)

| # | Evidence | Expected | Evidence |
| --- | --- | --- | --- |
| F1 | `app/tests/s068.change-orders.integration.ts` approve test | Real service, disposable DB, staff session: status approved + exactly one attributable event + snapshot stability | LIVE-DB (CI is authoritative — no Docker on the authoring VM) |
| F2 | Same file, cross-org test | Cross-org approve → 404, order stays draft, zero events | LIVE-DB (CI) |
| F3 | Forced RLS on `change_orders` / `change_order_line_items` / `activity_events` | Org-scoped policies through `projects` / `org_id`; app-side `project: { orgId }` scoping is defense in depth | Migration source text (§2); **not** S073 — the change-order tables are absent from the S073 matrix and no S073 coverage is claimed |

## 5. Exclusions

- **Customer change-order approval/rejection** — GAP-2, blocked by
  design (ADR-010). Not built, not certified.
- **Downstream financial roll-up** — GAP-3, founder decision needed.
  Not built, not certified.
- **New change-order model, migration, status value, role, permission,
  or RLS policy** — none authorized by this sprint; none made.
- **Email delivery of change-order decisions** — no notification path
  exists for change-order approve/reject; out of scope.

## 6. Validation that ran (branch `feat/s068-change-order-certification`)

- `git diff --check` — **passed** (clean, re-run after all edits).
- Focused unit tests: `cd app && npx jest
  tests/change-orders.service.test.ts tests/change-orders.controller.test.ts
  --runInBand --silent` — **passed: 2 suites, 20 tests, 0 failures**
  (17 service + 3 controller; includes the 4 pre-existing service
  tests). Run 2026-11-24 after the final test-file edits.
- `cd app && npx tsc --noEmit` — **passed, exit 0, no errors** (full
  project, including the new integration test file). Run 2026-11-24.
- `cd app && npm run lint` — the lint script **is** `tsc --noEmit`, so
  the passing `tsc` run above is the lint result; no separate ESLint
  pass exists for `app/`.
- Environment repair during validation: the authoring VM's
  `app/node_modules` carried a stale zod 3.25.76 install against the
  lockfile's zod 4.6.7, which failed type-checking repo-wide
  (`z.guid()` does not exist in zod v3) in files this sprint never
  touched. `npm ci` (lockfile-conformant reinstall, no lockfile change)
  re-synced `node_modules` to zod 4.6.7; all validation above ran after
  that repair.
- `app/tests/s068.change-orders.integration.ts` — **CI-verified-only**:
  no Docker exists on the authoring VM, so `npm run test:integration`
  cannot provision the disposable database locally. The file is verified
  locally only by `tsc --noEmit` (it type-checks) and
  `jest --config jest.integration.config.js --listTests` (it is picked
  up); its live assertions are authoritative only when CI runs them.
  Never cite it as passed locally.
- `node --test app/scripts/s068-evidence-contract.test.mjs` — the other
  subagent's file (browser-evidence tooling); not run by this lane.
- Full `npm test` suite — not run in this lane (focused validation only);
  exact-head CI is authoritative.

## 7. Bearer-material handling rules

Same rules as S059 §5 (tokens exist only in process memory; staff and
customer browser contexts never share storage state; screenshots start
only after the clean URL loads; session-cookie flags checked in memory
only; one portal context per customer; PDFs proven by status +
`Content-Type` + SHA-256 only; denials recorded by case label, HTTP
status, and redacted outcome; error text redacted before logging;
cleanup revokes every token the run created). The browser run records
its own run report; this document records only the backend evidence.

## 8. Run record (fill in on dispatch)

| Field | Value |
| --- | --- |
| Workflow run | _pending_ |
| Workflow head SHA | _pending_ |
| Deployed SHA (Vercel + `/health`) | _pending_ |
| Target base URL | _pending_ |
| Data-plane project ref (`/ready`) | _pending_ |
| Smoke tenant (label / org id) | _pending_ |
| Artifact (`s068-browser-evidence`, 30 days) | _pending_ |
| Credential scan | _pending_ |
| Result | PENDING DISPATCH |

Dispatch (do not run from this document — the parent agent dispatches
after this PR merges, because GitHub only accepts a `workflow_dispatch`
for a workflow that exists on the default branch):

```text
gh workflow run s068-browser-evidence.yml \
  --ref main \
  -f base_url=https://<approved-preview>.vercel.app \
  -f expected_sha=<full 40-char deployed SHA> \
  -f smoke_org_id=<TEST Org or Beta Smoke UUID> \
  -f sanitized_tenant=true -f use_test_org=true \
  -f require_sha_correlation=true
```

Record the run id, workflow head SHA, deployed SHA, and artifact in the
table above in a follow-up PR. The implementation PR merges on the merge
bar before the browser run exists; S068 stays `IN_REVIEW` until the
browser evidence (or its named blocker) is recorded.
