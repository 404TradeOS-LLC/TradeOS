# S068 change-order browser evidence

Status: PENDING DISPATCH. Tooling built; no run has executed. This file is
the capture contract, not certification that the journey has passed.

The staff change-order flow already exists on `main` and this sprint
certifies it; it does not build a new change-order model. Customer
approve/reject does not exist and is not certified here: see P1 below.

## Browser capture contract

Use the isolated non-production TEST Org (sanitized tenant) with synthetic
fixtures created at run time, at the exact deployed branch SHA, with an
authorized staff owner identity. Keep secrets only in process memory,
never in fixture files, command arguments, retained environment dumps, test
snapshots, trace/video/HAR/network exports, screenshots, console output, or
CI logs. The staff session lives in the Playwright storage state the
workflow creates under `/tmp` and deletes after the run.

### Journey steps

Each step records route/service, actor/role, and expected evidence. The
capture script is `app/scripts/s068-browser-evidence.mjs`; the offline
acceptance rules are `app/scripts/s068-evidence-contract.mjs`.

| Step | Route / service | Actor / role | Expected evidence |
| --- | --- | --- | --- |
| A. Fixtures | `POST /api/v1/customers`, `POST /api/v1/projects` via the staff `/api/proxy/*` surface | Staff owner (`billing.write`) | Synthetic customer + project ids in `report.json` fixtures |
| B1. Create draft CO-1 | Project workspace change-orders tab (`/projects/:id?tab=change-orders`, `ChangeOrderCreateForm` → `createChangeOrderAction` → `POST /api/v1/change-orders`) | Staff owner | `CO-1`, status `draft`, `change-order-draft-1440.png` |
| B2. Priced line item | `ChangeOrderLineItemForm` → `addChangeOrderLineItemAction` → `POST /api/v1/change-orders/:id/line-items` | Staff owner | Line `2 × $150 = $300`; order amount `$300` (`report.json` pricing) |
| B3. Draft render | Workspace change-orders tab | Staff owner | Tab truth-check passes at 1440 (no error shell, no overflow) |
| C1. Approve CO-1 | `Approve` form → `approveChangeOrderAction` → `POST /api/v1/change-orders/:id/approve` | Staff owner | `Approval history: Approved <date>`; API status `approved` + `approvedAt`; `change_order.approved` activity record (actor + occurredAt); `change-order-approved-<viewport>.png` at 1440/1024/768/390 |
| D1. Create draft CO-2 | Same as B1 | Staff owner | `CO-2`, status `draft` |
| D2. Reject CO-2 | `Reject` form → `rejectChangeOrderAction` → `POST /api/v1/change-orders/:id/reject` | Staff owner | `Approval history: Rejected <date>`; API status `rejected` + `rejectedAt`; `change_order.rejected` activity record; `change-order-rejected-<viewport>.png` at 1440/1024/768/390 |

UI is the preferred path for create, line-item add, approve, and reject;
each step falls back to the authenticated staff API when the UI step is
unavailable, and the path taken is recorded per step in
`report.json` (`stepPaths`). A fallback first re-reads live state so a UI
step that succeeded while its wait timed out never creates a duplicate
fixture or a second decision attempt.

The activity record is verified through
`GET /api/v1/intelligence/activity?entityId=<changeOrderId>&limit=10`
(the list endpoint also accepts `entityType` and `eventType` filters).
The query uses `entityId` only: the `entityType=change_order` list filter
is registered by this PR (`change_order` added to
`intelligenceEntityTypes`), so the filter answers 200; the script keeps
the `entityId`-only query because it is the narrowest proof of the exact
decision record. The query without `entityType` requires `crm.read`, which
the staff owner holds. Only attribute booleans are recorded (event type
present, actor present, occurredAt present); the actor user id is never
written to `report.json`.

### Negative matrix

For each denied attempt record case label, HTTP status, and redacted
outcome only. All cases run against the sanitized tenant.

| Case | Attempt | Expected |
| --- | --- | --- |
| N1 | Approve an already-approved order | 409 |
| N2 | Reject an already-approved order | 409 |
| N3 | Add a line item to an approved order (draft-only guard) | 409 |
| N4 | Create a change order as staff without `billing.write` | 403, or BLOCKED when no low-permission staff identity is provisioned (owner: Billy). The script verifies the provisioned identity's TEST Org role via `GET /api/proxy/auth/memberships` before mutating: only technician/viewer lack `billing.write` (`app/domain/contracts.ts`). NOT-APPLICABLE when the provisioned identity holds a role with `billing.write` (no mutation attempted); a 201 from a confirmed low-permission principal FAILs as an authorization regression (its probe draft is deleted first) |
| N5 | Read / approve a change order from another organization | 404 (requires `BETA_FOREIGN_CHANGE_ORDER_ID`; otherwise NOT-APPLICABLE) |
| N6 | Read / approve a change order unauthenticated | 401 |
| N7 | Approve an unknown change order id | 404 |
| N8 | Create a change order for an unknown project | 404 |
| N9 | Customer-portal change-order decision (`POST /api/customer-portal/change-orders/:id/approve`) | 405 — the portal proxy route exports only `GET`, so Next.js rejects the POST before any handler runs; that is the shipped proof no decision action exists on the portal surface. The portal project payload returns `changeOrders: []` |

### Blocked step (P1) — customer approve/reject, by design

Customer approve/reject of a change order is BLOCKED, not attempted. ADR-010
limits customer-originated writes to signing pending contracts; the portal
project payload returns `changeOrders: []` and no portal change-order
decision endpoint exists. Building customer approve/reject would change
authorization and needs a separately governed authorization decision; it
must NOT be built inside this certification scope. The capture script
records P1 as BLOCKED in every run's `report.json` and never a pass or a
failure.

### Bearer-material rules

1. The staff session exists only in process memory and the `/tmp` storage
   state file, which the workflow deletes after the run. It is never
   written to the artifact bundle, logs, or `report.json`.
2. Error text is redacted before logging or recording
   (`redactBearerMaterial`): Playwright navigation errors embed the full
   request URL.
3. Trace, video, and HAR are OFF for every context.
4. Screenshots start only after the clean
   `/projects/:id?tab=change-orders` URL loads; no URL in this journey
   carries bearer material.
5. The workflow scans the artifact bundle for credential material
   (`"cookies"`, `sb-*-auth-token`, `tradeos_access_token` /
   `tradeos_refresh_token`, `Bearer <token>`) and refuses upload on any
   hit. The HttpOnly session cookie itself is never written to the bundle,
   so its presence in the scan only guards against a script bug.
6. Fixtures remain in the sanitized tenant by design (synthetic customer,
   project, and change orders); nothing is deleted. The synthetic records
   are evidence, not production data.

### Dispatch prerequisites — PENDING DISPATCH

Do not dispatch until all of these hold:

1. The S068 implementation PR has merged to `main` (the `change_order.*`
   ActivityEvents and the attributable actor are part of that PR's backend
   lane; the capture script fails closed if the activity record is absent).
2. A staging deployment exists at the merged `main` SHA. Staging promotion
   happens only after the field-closeout run finishes, per Billy's 12A word
   — dispatch is not available in this run.
3. The dispatcher supplies `base_url` (approved non-production host),
   `expected_sha` (full merged `main` SHA), `smoke_org_id` (the TEST Org),
   and confirms `sanitized_tenant: true`.
4. `TEST_STAGING_EMAIL` / `TEST_STAGING_PASSWORD` are present for the
   staff owner sign-in. Optional: `BETA_RC_FOREIGN_CHANGE_ORDER_ID` for
   N5, `BETA_RC_S068_WRONG_ROLE_EMAIL` / `BETA_RC_S068_WRONG_ROLE_PASSWORD`
   for N4 (a TEST Org member in a role without `billing.write`,
   e.g. technician or viewer). In plain terms: N4 needs a second test
   sign-in for someone who cannot approve (the field technician's password
   is Billy's via the secure card, not a CI secret, so it cannot be used
   here); N5 needs one change order from a second fake org, which needs
   Billy's one-time foreign-admin sign-in (card sent ~03:40 EST 2026-11-24;
   still open at this writing). Both are staging-only synthetic test
   accounts, no real people, nothing in production.
5. Deployment identity is proven before capture (expected SHA via
   `/health` + Vercel metadata, via the shared
   `s059-deployment-identity.mjs` step) and re-verified after capture.
   The RC-target guards refuse production hosts, the Production alias,
   and `-git-main-` previews outright.

Dispatch with:

```text
gh workflow run s068-browser-evidence.yml \
  -f base_url=<approved staging or preview web URL> \
  -f expected_sha=<full merged main SHA> \
  -f smoke_org_id=<TEST Org id> \
  -f sanitized_tenant=true
```

### Artifact

One run uploads `s068-browser-evidence` (30-day retention):
`deployment-identity.json`, `deployment-identity-after.json`,
`report.json`, `change-order-draft-1440.png`,
`change-order-approved-{1440,1024,768,390}.png`,
`change-order-rejected-{1440,1024,768,390}.png`. `report.json` carries
the deployed SHA, fixture ids, per-step UI/API paths, pricing, activity
booleans, per-case outcomes, and the blocked list. A PASS requires every
viewport and every non-blocked case to pass; BLOCKED cases never pass or
fail the run.
