# S069 closeout and warranty browser evidence

Status: PENDING DISPATCH. Tooling built; no run has executed. This file is
the capture contract, not certification that the journey has passed.

The staff closeout and warranty flow already exists on the S069 branch and
this sprint certifies it; it does not build a new closeout model. The
closeout journey never mutates the Contract snapshot, the Invoice
amount/status, or the Proposal status — that proof lives in the live
integration test (`app/tests/s069.closeout.integration.ts`), not in the
browser run.

## Browser capture contract

Use the isolated non-production TEST Org (sanitized tenant) with synthetic
fixtures created at run time, at the exact deployed branch SHA, with an
authorized staff owner identity. Keep secrets only in process memory,
never in fixture files, command arguments, retained environment dumps, test
snapshots, trace/video/HAR/network exports, screenshots, console output, or
CI logs. The staff session lives in the Playwright storage state the
workflow creates under `/tmp` and deletes after the run. The single-use
customer-portal access token lives only in a process-memory variable
until redemption consumes it.

### Journey steps

Each step records route/service, actor/role, and expected evidence. The
capture script is `app/scripts/s069-browser-evidence.mjs`; the offline
acceptance rules are `app/scripts/s069-evidence-contract.mjs`.

| Step | Route / service | Actor / role | Expected evidence |
| --- | --- | --- | --- |
| A. Prerequisites | `POST /api/v1/customers`, `POST /api/v1/customers/:id/service-addresses`, `POST /api/v1/projects`, `POST /api/v1/proposals` + `accept-offline`, `POST /api/v1/contracts` + `sign`, `POST /api/v1/invoices` + `send`, `POST /api/v1/jobs` + `dispatch` / `start-travel` / `arrive` / `complete` via the staff `/api/proxy/*` surface | Staff owner | Synthetic customer + project + accepted proposal + signed contract + sent invoice + completed job ids in `report.json` fixtures |
| B1. Create closeout | Project workspace closeout tab (`/projects/:id?tab=closeout`, `CloseoutStartForm` → `createCloseoutAction` → `POST /api/v1/closeout/projects/:id/closeout`) | Staff owner | Closeout status `draft`, `closeout-draft-1440.png` |
| B2. Draft render | Workspace closeout tab | Staff owner | Tab truth-check passes at 1440 (no error shell, no overflow); checklist already `ready` — every prerequisite is present and no punch item is open yet |
| C1. Punch item | `PunchItemCreateForm` → `createPunchItemAction` → `POST /api/v1/closeout/projects/:id/punch-items` | Staff owner | Punch item `open`, assigned to the technician; checklist returns to not-ready |
| C2. Resolve | `Resolve` form → `resolvePunchItemAction` → `POST /api/v1/closeout/punch-items/:id/resolve` | Assigned technician when a technician sign-in is provisioned (P1 BLOCKED otherwise; owner resolve is the certified path) | Status `resolved`, `resolvedAt` + `resolvedById` = technician, `punch_item.resolved` activity record (actor + occurredAt) |
| C3. Verify | `Verify` form → `verifyPunchItemAction` → `POST /api/v1/closeout/punch-items/:id/verify` | Staff owner (manager) | Status `verified`, `punch_item.verified` activity record |
| C4. Warranty | `WarrantyCreateForm` → `createWarrantyAction` → `POST /api/v1/closeout/projects/:id/warranties` | Staff owner | Warranty quoting the signed contract verbatim, `warranty_record.created` activity record; `project_closeout.created` + `punch_item.created` records verified |
| D1. Mark ready | `Mark ready` form → `markCloseoutReadyAction` → `POST /api/v1/closeout/projects/:id/closeout/ready` | Staff owner (manager) | `Ready for handoff`; API status `ready` + `completedAt`; checklist verdict `ready`; `project_closeout.ready` activity record; `closeout-ready-<viewport>.png` at 1440/1024/768/390 |
| E1. Handoff | `Record handoff` form → `recordCloseoutHandoffAction` → `POST /api/v1/closeout/projects/:id/closeout/handoff` | Staff owner (manager) | `Handed off`; API status `handed_off` + `handedOffAt`; `project_closeout.handed_off` activity record; `closeout-handed-off-<viewport>.png` at 1440/1024/768/390 |
| E2. Staff document | `GET /api/v1/closeout/projects/:id/closeout/document` | Staff owner | `text/html` naming the project, carrying the closeout frame |
| F1. Portal handoff | Staff issues a single-use access token (`POST /api/v1/customer-portal/access-tokens`), customer redeems it (`/customer-portal/access?token=…` → confirm → `/customer-portal/projects/:id`) | Customer (portal session) | `Closeout handoff` section, status `Handed off`, `Punch items: 1 resolved · 0 open`, `View closeout document` link, `Read-only` stated, no staff control; `portal-handoff-<viewport>.png` at 1440/1024/768/390 |
| F2. Portal document | `GET /api/v1/customer-portal/projects/:id/closeout/document` via the portal proxy | Customer (portal session) | `text/html` naming the project, carrying the closeout frame |

UI is the preferred path for closeout create, punch create, resolve,
verify, warranty create, mark ready, and handoff; each step falls back
to the authenticated staff API when the UI step is unavailable, and the
path taken is recorded per step in `report.json` (`stepPaths`). A
fallback first re-reads live state so a UI step that succeeded while its
wait timed out never creates a duplicate fixture or a second decision
attempt.

The activity record is verified through
`GET /api/v1/intelligence/activity?entityId=<entityId>&limit=10`
(the list endpoint also accepts `entityType` and `eventType` filters).
The query uses `entityId` only. Only attribute booleans are recorded
(event type present, actor present, occurredAt present); the actor user
id is never written to `report.json`.

The job is completed through the shipped lifecycle (`dispatch` →
`start-travel` → `arrive` → `complete`) as the staff owner, with the
provisioned technician assigned at job creation. Dispatch requires an
active technician assignment, so the run fails closed with a named
provisioning reason when the TEST Org has no active technician member —
see dispatch prerequisite 4.

### Negative matrix

For each denied attempt record case label, HTTP status, and redacted
outcome only. All cases run against the sanitized tenant.

| Case | Attempt | Expected |
| --- | --- | --- |
| N1 | Mark ready on a handed-off closeout | 409 |
| N2 | Hand off a draft closeout | 409 |
| N3 | Verify an open punch item | 409 |
| N4 | Resolve a verified punch item | 409 |
| N5 | Create a second closeout for the same project | 409 |
| N6 | Create a punch item as staff without `crm.write` | 403, or BLOCKED when no low-permission staff identity is provisioned (owner: Billy). The script verifies the provisioned identity's TEST Org role via `GET /api/proxy/auth/memberships` before mutating: only technician/viewer lack `crm.write` (`app/domain/contracts.ts`). NOT-APPLICABLE when the provisioned identity holds a role with `crm.write` (no mutation attempted); a 201 from a confirmed low-permission principal FAILs as an authorization regression (no punch-item delete route exists, so the probe row remains in the sanitized tenant as evidence) |
| N7 | Read a closeout from another organization | 404 (requires `BETA_FOREIGN_PROJECT_ID`; otherwise NOT-APPLICABLE) |
| N8 | Read / create a closeout unauthenticated | 401 |
| N9 | Resolve an unknown punch item id; create a punch item for an unknown project | 404 |
| N10 | Customer-portal closeout document (`POST /api/customer-portal/projects/:id/closeout/document`) | 405 — the portal proxy route exports only `GET`, so Next.js rejects the POST before any handler runs; that is the shipped proof no mutation action exists on the portal surface. An unauthenticated portal project read must 401 (portal session required) |

### Blocked step (P1) — technician-session punch resolve, by provisioning

The assigned-technician punch resolve through a technician browser
session is BLOCKED when no technician sign-in is provisioned, not
attempted. The owner (manager) resolve is the certified path in that
case, and the technician carve-out itself is proven at the database
boundary in `app/tests/rls.integration.ts` (assigned technician updates
only their assigned punch item; an unassigned technician cannot). The
capture script records P1 as BLOCKED in every run's `report.json` and
never a pass or a failure. Provisioning the technician sign-in is
Billy's (the field technician's password is his via the secure card, not
a CI secret, so it cannot be used here).

### Bearer-material rules

1. The staff session exists only in process memory and the `/tmp` storage
   state file, which the workflow deletes after the run. It is never
   written to the artifact bundle, logs, or `report.json`.
2. The single-use portal access token exists only in a process-memory
   variable until redemption consumes it. It is never logged, never
   written to `report.json`, and any error text carrying the
   `/customer-portal/access?token=…` URL is redacted before logging.
3. Error text is redacted before logging or recording
   (`redactBearerMaterial`): Playwright navigation errors embed the full
   request URL.
4. Trace, video, and HAR are OFF for every context.
5. Screenshots start only after a clean URL loads — the staff workspace
   URL and the portal project URL carry no bearer material. The
   `/customer-portal/access?token=…` URL is never screenshotted.
6. The workflow scans the artifact bundle for credential material
   (`"cookies"`, `sb-*-auth-token`, `tradeos_access_token` /
   `tradeos_refresh_token`, `tradeos_customer_portal_session` /
   `tradeos_customer_portal_pending_access`, `Bearer <token>`) and
   refuses upload on any hit. The HttpOnly session cookies themselves are
   never written to the bundle, so their presence in the scan only guards
   against a script bug.
7. Fixtures remain in the sanitized tenant by design (synthetic customer,
   project, proposal, contract, invoice, job, closeout, punch item, and
   warranty); nothing is deleted. The synthetic records are evidence, not
   production data.

### Dispatch prerequisites — PENDING DISPATCH

Do not dispatch until all of these hold:

1. The S069 implementation PR has merged to `main` (the closeout
   ActivityEvents and the attributable actor are part of that PR's backend
   lane; the capture script fails closed if the activity record is absent).
2. A staging deployment exists at the merged `main` SHA. Staging promotion
   happens only after the field-closeout run finishes, per Billy's 12A word
   — dispatch is not available in this run.
3. The dispatcher supplies `base_url` (approved non-production host),
   `expected_sha` (full merged `main` SHA), `smoke_org_id` (the TEST Org),
   and confirms `sanitized_tenant: true`.
4. The TEST Org has an active technician member: dispatch requires an
   active technician assignment, so without one no job can reach
   `completed` and no closeout can start — the run fails closed naming
   this. The technician member is discovered at run time via
   `GET /api/v1/admin/organizations/:orgId/members`; provisioning the
   member is Billy's. Optional: `BETA_S069_WRONG_ROLE_EMAIL` /
   `BETA_S069_WRONG_ROLE_PASSWORD` for the technician-session resolve
   (P1) and the wrong-role probe (N6) — a TEST Org technician sign-in.
   These are new secrets for this workflow; the run works without them,
   with P1 and N6 BLOCKED. Optional: `BETA_FOREIGN_PROJECT_ID` for N7, a
   project id from a second fake org (also a new secret; without it N7 is
   NOT-APPLICABLE).
5. `TEST_STAGING_EMAIL` / `TEST_STAGING_PASSWORD` are present for the
   staff owner sign-in.
6. Deployment identity is proven before capture (expected SHA via
   `/health` + Vercel metadata, via the shared
   `s059-deployment-identity.mjs` step) and re-verified after capture.
   The RC-target guards refuse production hosts, the Production alias,
   and `-git-main-` previews outright.

Dispatch with:

```text
gh workflow run s069-browser-evidence.yml \
  -f base_url=<approved staging or preview web URL> \
  -f expected_sha=<full merged main SHA> \
  -f smoke_org_id=<TEST Org id> \
  -f sanitized_tenant=true
```

### Artifact

One run uploads `s069-browser-evidence` (30-day retention):
`deployment-identity.json`, `deployment-identity-after.json`,
`report.json`, `closeout-draft-1440.png`,
`closeout-ready-{1440,1024,768,390}.png`,
`closeout-handed-off-{1440,1024,768,390}.png`,
`portal-handoff-{1440,1024,768,390}.png`. `report.json` carries
the deployed SHA, fixture ids, per-step UI/API paths, activity
booleans, per-case outcomes, and the blocked list. A PASS requires every
viewport and every non-blocked case to pass; BLOCKED cases never pass or
fail the run.
