---
status: pending-dispatch
owner: platform
last_verified: 2026-11-24
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/RBAC_MATRIX.md
  - docs/API_REFERENCE.md
  - docs/DOMAIN_MODEL.md
  - docs/decisions/ADR-010-customer-magic-link-portal.md
  - docs/architecture/S073_RLS_COVERAGE_EVIDENCE.md
  - docs/testing/S073_RLS_COVERAGE_MATRIX.json
  - docs/testing/S069_CLOSEOUT_WARRANTY_EVIDENCE.md
related_code:
  - app/modules/closeout/service.ts
  - app/modules/closeout/types.ts
  - app/backend/controllers/closeout.controller.ts
  - app/backend/routes/closeout.routes.ts
  - app/modules/customer-portal/service.ts
  - app/tests/closeout.service.test.ts
  - app/tests/closeout.controller.test.ts
  - app/tests/customer-portal.service.test.ts
  - app/tests/rls.integration.ts
  - app/tests/s069.closeout.integration.ts
  - app/scripts/s069-browser-evidence.mjs
  - .github/workflows/s069-browser-evidence.yml
---

# S069 — Closeout and Warranty Workspace Certification Evidence

Status: **PENDING DISPATCH**. The backend half (closeout service,
controller, portal handoff, RLS integration coverage, snapshot-stability
integration test, S073 matrix entries, browser-evidence tooling) is built
on branch `feat/s069-closeout-warranty-workspace` (base main `a4144ff0`);
no authenticated browser run has been dispatched yet, so nothing in this
document certifies a deployment. Do not cite it as certification until a
`s069-browser-evidence` run passes and its run id, SHAs, and artifact are
recorded in §8. Dispatch happens from `main` after this PR merges — no
browser run is dispatched in this run because staging is mid
field-closeout.

## 1. What this certifies

The closeout and warranty workspace on the S069 branch: one closeout
record per project starting at field completion, the punch-item list
with the assigned-technician resolve carve-out, the computed readiness
checklist, the ready → handed-off transitions with attribution, warranty
records that quote only the source document, and the customer-portal
read-only handoff with the rendered closeout document. Certification
means retained authenticated browser evidence plus current-head
service/contract evidence that the journey preserves the Contract
snapshot, Invoice amount/status, and Proposal status/pricing
byte-identical, attributes every transition to its actor, and never
silently mutates historical snapshots — not a new financial model, not
a warranty promise, and not a new role or permission.

## 2. Scope discovery (traced from current code, 2026-11-24)

- **Module:** `app/modules/closeout/service.ts` (`CloseoutService`) +
  `app/modules/closeout/types.ts` — `PunchItem` (`punch_items`, status
  `open` / `in_progress` / `resolved` / `verified`, priority `low` /
  `medium` / `high`, optional `jobId`, optional `assignedUserId`),
  `ProjectCloseout` (`project_closeouts`, status `draft` / `ready` /
  `handed_off`, one row per project, links the most recently completed
  job), `WarrantyRecord` (`warranty_records`, `sourceType` `contract` /
  `invoice` / `other`, `coverageText` staff-supplied). Migration
  `20261124120000_add_closeout_warranty_workspace` is additive only: no
  existing table is altered and no existing row is touched.
- **Controller/routes:** `app/backend/controllers/closeout.controller.ts`
  + `app/backend/routes/closeout.routes.ts`, mounted at
  `/api/v1/closeout`. Reads and punch/warranty writes reuse `crm.read` /
  `crm.write` — no new permission. Resolve carries no permission-key
  gate (the service enforces manager-or-assigned-technician, the same
  reason JobsService field transitions carry no key); verify/reopen and
  ready/handoff are manager-only (`owner` / `admin` / `dispatcher`).
- **Checklist:** `computeChecklist` requires a completed job, a signed
  contract (a `Contract` with `signedAt` set — the stored status
  vocabulary keeps the legacy `pending_signature` value until `sign()`),
  a final invoice (any non-`draft` `Invoice`), an accepted proposal
  (`not_applicable` when the project has no proposal at all), and zero
  open punch items. Ready requires the checklist; handoff requires
  `ready`.
- **Closeout document:** `getCloseoutDocumentData` assembles the packet
  from real project records and renders it through the existing document
  templates; `getCloseoutDocumentHtml` serves it as one `text/html`
  document. Each warranty frame quotes the record's own `coverageText`;
  manufacturer coverage, exclusions, and the support process are stated
  as not recorded in this workspace ("see the source document"). When
  the project has no warranty record, the document says so explicitly.
  No PDF rendering exists for these frames.
- **Customer side:** `CustomerPortalService.getProject` returns the
  read-only handoff (`PortalCloseoutHandoff`: status, checklist,
  resolved/open punch counts, warranties exactly as stored,
  `documentHref`); `GET
  /api/v1/customer-portal/projects/:id/closeout/document` serves the
  rendered packet as `text/html` to the verified portal session. The
  portal exposes no closeout mutation; the web portal proxy route
  exports only `GET`. See GAP-2.
- **RLS:** all three tables carry a direct `org_id` with forced RLS
  (`20261124120000_add_closeout_warranty_workspace`). Reads are
  org-scoped for every role; writes are owner/admin/estimator (via
  `current_app_can_write()`) plus `dispatcher`, plus the assigned
  technician's punch update carve-out (update only, pinned to the same
  assignee by the `WITH CHECK`). The policies widen writes only to
  exactly the service-authorized actors; no new role or permission is
  introduced. `docs/testing/S073_RLS_COVERAGE_MATRIX.json` carries all
  three resources as `COVERED`, naming the real policy names, with the
  live test `enforces closeout and warranty tenant boundaries` as the
  same/cross-org/scope evidence (§6, F3).
- **Audit:** every create and transition records an `ActivityEvent`
  (`entityType` `punch_item` / `project_closeout` / `warranty_record`)
  with the acting user as actor. All three entity types are registered
  in the `IntelligenceEntityType` union
  (`app/modules/intelligence/types.ts`), so the events are queryable
  through the typed `ActivityFilters`
  (`GET /api/v1/intelligence/activity?entityType=punch_item`).

## 3. Gaps

- **GAP-1 (FIXED in this worktree, browser proof pending):** RLS
  integration coverage for the three new tables was missing — the
  backlog requires live-PostgreSQL proof, and mocked Prisma tests do not
  prove RLS correctness. `app/tests/rls.integration.ts` now carries
  `enforces closeout and warranty tenant boundaries`: same-org reads
  allowed and cross-org reads hidden for `punch_items`,
  `project_closeouts`, and `warranty_records`; cross-org writes denied;
  the assigned-technician punch-resolve carve-out works and an
  unassigned technician cannot update the item; dispatcher writes are
  allowed per the migration policies. All RLS assertions go through the
  request-scoped session, never through mocked Prisma.
- **GAP-2 (BY DESIGN — do not build):** customer-portal closeout
  mutation. ADR-010 limits customer-originated writes to signing pending
  contracts; the closeout controllers require staff `crm.write` (and
  manager roles for transitions); the portal service returns the handoff
  read-only and the portal page states it is read-only. Building
  customer closeout writes would change authorization and needs a
  separately governed authorization decision. The browser run proves the
  portal surface as read-only; no customer mutation is certified because
  none exists.
- **GAP-3 (FINDING — founder decision needed for any new warranty
  promise or financial model):** no warranty promise and no downstream
  roll-up. A `WarrantyRecord` quotes only staff-supplied coverage text
  from a named source; the workspace carries no manufacturer terms,
  exclusions, or support process, and states that plainly in the
  document. Nothing reads a handed-off closeout into estimate totals,
  invoice line construction, or contract amounts. Whether TradeOS should
  carry manufacturer warranty terms, or roll closeout state into
  financials, is a product decision for the founder — this sprint builds
  neither and records the gap.

## 4. Certification step list

Bearer material: no raw token, session, cookie, header, bearer value, or
customer-portal access token is retained in any evidence artifact.
Evidence locations: **BROWSER** = authenticated non-production browser
capture at 1440/1024/768/390 (`s069-browser-evidence` run); **LIVE-DB**
= disposable PostgreSQL integration evidence
(`app/tests/s069.closeout.integration.ts`,
`app/tests/rls.integration.ts`); **UNIT** = current-head test named.
Browser evidence is PENDING DISPATCH for every step below; the UNIT and
LIVE-DB columns record what is already proven on the branch.

### Phase A — closeout lifecycle with attribution

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| A1 | `POST /closeout/projects/:id/closeout` → `service.createCloseoutForProject` | Staff with `crm.write` | 201, status `draft`, linked to the completed job | Staff org + project | BROWSER + UNIT `closeout.service.test.ts` + LIVE-DB `s069.closeout.integration.ts` journey test |
| A2 | Same route/service, project with no completed job / second closeout | Staff with `crm.write` | 409; no row created | Staff org | UNIT 409 test + BROWSER N5 |
| A3 | `POST /closeout/projects/:id/punch-items` → `service.createPunchItem` | Staff with `crm.write` | 201, status `open`, assigned to the technician; exactly one `punch_item.created` event with the staff actor | Staff org | BROWSER + UNIT + LIVE-DB journey test |
| A4 | `POST /closeout/punch-items/:id/resolve` → `service.resolvePunchItem` | Assigned technician | 200, status `resolved`, `resolvedAt` + `resolvedById` = technician; exactly one `punch_item.resolved` event with the technician actor | Staff org | BROWSER (when a technician sign-in is provisioned; P1 BLOCKED otherwise, manager resolve is the certified path) + UNIT + LIVE-DB journey test |
| A5 | Same route/service | Unassigned technician / viewer | 403; service never transitions | Staff org | UNIT `closeout.controller.test.ts` + LIVE-DB RLS test (unassigned technician cannot update at the database boundary) |
| A6 | `POST /closeout/punch-items/:id/verify` → `service.verifyPunchItem` | Staff manager | 200, status `verified`; exactly one `punch_item.verified` event | Staff org | BROWSER + UNIT + LIVE-DB journey test |
| A7 | Verify from `open`, resolve from `verified`, edit a `verified` item | Staff manager | 409 for each; no write; no event | Staff org | UNIT 409 matrix test + BROWSER N3/N4 |
| A8 | `POST /closeout/projects/:id/warranties` → `service.createWarrantyRecord` | Staff with `crm.write` | 201, `coverageText` quoted as submitted, `sourceType` as declared; exactly one `warranty_record.created` event | Staff org | BROWSER + UNIT + LIVE-DB journey test |
| A9 | `POST /closeout/projects/:id/closeout/ready` → `service.markCloseoutReady` | Staff manager | 200, status `ready`, `completedAt` + `completedById`; checklist `ready: true`; exactly one `project_closeout.ready` event | Staff org | BROWSER + UNIT + LIVE-DB journey test |
| A10 | Ready with an open punch item / missing artifact | Staff manager | 409 naming the missing item; status stays `draft`; no event | Staff org | UNIT checklist test + BROWSER C1b (open punch returns the checklist to not-ready) |
| A11 | `POST /closeout/projects/:id/closeout/handoff` → `service.markCloseoutHandedOff` | Staff manager | 200, status `handed_off`, `handedOffAt` + `handedOffById`; exactly one `project_closeout.handed_off` event | Staff org | BROWSER + UNIT + LIVE-DB journey test |
| A12 | Handoff from `draft`, ready from `handed_off` | Staff manager | 409; status unchanged; no event | Staff org | UNIT 409 matrix test + BROWSER N1/N2 |
| A13 | Any closeout route for another org's project / punch item | Staff with `crm.write` | 404; no event recorded | Cross-org | UNIT cross-org test + LIVE-DB cross-org test + BROWSER N7 |
| A14 | Any closeout route without `crm.write` (technician/viewer) | Technician / viewer | 403; service never called | Staff org | UNIT `closeout.controller.test.ts` + BROWSER N6 |
| A15 | Any closeout route unauthenticated | Unauthenticated | 401; service never called | — | UNIT `closeout.controller.test.ts` + BROWSER N8 |

### Phase B — readiness checklist truth

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| B1 | `GET /closeout/projects/:id/closeout` → `service.computeChecklist` | Staff with `crm.read` | Completed job count/ids, signed contract present (via `signedAt`), final invoice present (non-`draft`), accepted proposal `present` / `missing` / `not_applicable`, open punch count, `missing[]`, `ready` | Staff org | UNIT checklist test + BROWSER (draft-ready, then not-ready with an open punch, then ready again) |
| B2 | Same, project with no proposal at all | Staff with `crm.read` | `acceptedProposal.status: "not_applicable"`, not a blocker | Staff org | UNIT checklist test |

### Phase C — closeout document

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| C1 | `GET /closeout/projects/:id/closeout/document` | Staff with `crm.read` | `text/html`, names the project, carries the closeout frame | Staff org | BROWSER E2 + UNIT document test |
| C2 | Same, project with a warranty record | Staff with `crm.read` | Warranty frame appended, quoting the record's own `coverageText`; manufacturer coverage / exclusions stated as not recorded | Staff org | UNIT document test |
| C3 | Same, project with no warranty record | Staff with `crm.read` | `warrantyHtml` empty; `warrantyMessage` states no warranty was given | Staff org | UNIT document test |

### Phase D — customer portal (read-only by design)

| # | Route / service | Actor | Expected | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| D1 | Portal project page | Customer session | `Closeout handoff` section, status `Handed off`, punch summary, `View closeout document` link, `Read-only` stated, no staff control | Own org+customer | BROWSER F1 |
| D2 | `GET /customer-portal/projects/:id/closeout/document` | Customer session | `text/html` naming the project, carrying the closeout frame | Own org+customer | BROWSER F2 |
| D3 | Portal closeout mutation attempt (if any route existed) | Customer session | No such route; the web portal proxy exports only `GET`, so the document POST is a 405 | — | BROWSER N10 — no portal mutation route exists; recorded here so a future route is not mistaken for certified |

### Phase E — downstream snapshot stability

| # | Evidence | Expected | Evidence |
| --- | --- | --- | --- |
| E1 | Complete the closeout journey on a project with an accepted proposal, a signed contract carrying `snapshot_json`, and a sent invoice | Contract `snapshot_json` byte-identical before/after; contract status and `signedAt` unchanged; invoice amount and status unchanged; proposal status and pricing (`finalPrice`, `priceLow`, `priceHigh`) unchanged | LIVE-DB `s069.closeout.integration.ts` journey test |
| E2 | Handed-off closeout visibility in estimates/invoices/contracts | No roll-up exists (GAP-3); the closeout is new attributable records only | Code trace (§2) — no test asserts a roll-up that does not exist |

### Phase F — live PostgreSQL / RLS evidence (re-verify on the exact head)

| # | Evidence | Expected | Evidence |
| --- | --- | --- | --- |
| F1 | `app/tests/s069.closeout.integration.ts` journey test | Real service, disposable DB, staff + technician sessions: draft → punch → resolve → verify → warranty → ready → handoff, exactly one attributable event per transition, snapshot stability | LIVE-DB (CI is authoritative — see §6 for the local disposable-DB run) |
| F2 | Same file, cross-org test | Cross-org punch resolve → 404, punch stays `open`, zero `punch_item.resolved` events | LIVE-DB (CI is authoritative — see §6) |
| F3 | `app/tests/rls.integration.ts` `enforces closeout and warranty tenant boundaries` | Forced RLS on `punch_items` / `project_closeouts` / `warranty_records`: same-org reads allowed, cross-org reads hidden, cross-org writes denied, assigned-technician carve-out works, unassigned technician cannot update, dispatcher writes allowed | LIVE-DB (CI is authoritative — see §6); S073 matrix names this test as the same/cross-org/scope evidence for all three resources |

## 5. Exclusions

- **Customer closeout mutation** — GAP-2, by design (ADR-010). Not built, not certified.
- **Warranty promises / manufacturer terms** — GAP-3, founder decision needed. Not built, not certified.
- **Downstream financial roll-up** — GAP-3, founder decision needed. Not built, not certified.
- **Closeout PDF rendering** — no PDF pipeline exists for these HTML frames; the packet is served as `text/html`. Not built, not certified.
- **New closeout model, migration, status value, role, permission, or RLS policy beyond this sprint's three tables** — none authorized by this sprint; none made.
- **Email delivery of closeout handoff** — no notification path exists for closeout transitions; out of scope.

## 6. Validation that ran (branch `feat/s069-closeout-warranty-workspace`)

All runs 2026-11-24, worktree `~/workspace/tradeos-sprint-s069`, base
`origin/main a4144ff0`. No test was disabled or deleted for green CI.

- `cd app && npm test` — **passed: 374 suites, 3572 tests, 0 failures**.
- `cd app && npm run lint` (`tsc --noEmit`) — **passed, exit 0, no errors**.
- `cd app && npm run build` — **passed, exit 0** (vendor-knowledge-engine
  copy + `tsc`; the build dirtied no tracked file).
- `npm run pr:preflight -- --base origin/main` — **exit 0** (advisory only:
  35 changed files; the "Missing required docs" list names 8 docs, of
  which the two this lane owns — `docs/API_REFERENCE.md`,
  `docs/DOMAIN_MODEL.md` — are updated; the rest belong to other lanes or
  to the forbidden files below).
- `npm run pr:test` — **passed: 499 tests, 0 failures**.
- `npm run docs:test` — **passed: 44 tests, 0 failures**.
- `npm run docs:check -- --base origin/main` — **FAIL, exit 1**, after this
  lane fixed everything it may fix. The S069 workflow
  (`.github/workflows/s069-browser-evidence.yml`) triggers the workflow
  rule, so `docs/README.md` and `docs/REPOSITORY_GOVERNANCE.md` were
  updated mirroring the S068 entries, and both now pass. The 6 remaining
  missing docs are not this lane's to fix: `docs/CURRENT_STATE.md` and
  `docs/ENGINEERING_COMMAND_CENTER.md` are forbidden files for this lane;
  `docs/ARCHITECTURE.md`, `docs/RBAC_MATRIX.md`,
  `docs/modules/auth-and-tenancy.md`, and
  `docs/modules/activity-and-intelligence.md` are required by the core
  lane's customer-portal / intelligence changes (and the schema rule's
  `CURRENT_STATE.md` requirement predates this lane). The branch-level
  FAIL stays open for the parent orchestrator to close when the lanes'
  doc updates land.
- `npm run s073:rls:check` — **passed** ("internally consistent with the
  current schema, migrations, test names, and source files"). No validator
  change was needed.
- `npm run s073:rls:test` — **passed: 5 tests, 0 failures**.
- `node --test app/scripts/s069-evidence-contract.test.mjs` — **passed:
  19 tests, 0 failures**.
- `npx prisma validate` (in `app/`, with `DATABASE_URL` set) — **schema is
  valid**. `npx prisma format --check` reports the schema unformatted,
  but the same check against the `origin/main` schema reports unformatted
  too, so it is pre-existing; `npx prisma format` was NOT run (it would
  reformat the whole schema file owned by another lane).
- Full integration suite — **passed: 36 suites, 269 tests, 0 failures**
  (54.271 s), including the 3 S069 tests (`tests/rls.integration.ts`
  S069 describe + both `tests/s069.closeout.integration.ts` tests).
  `npm run test:integration` as scripted needs Docker, which does not
  exist on the authoring VM, so the identical commands were run manually
  against a local disposable PostgreSQL 16 (`tradeos_test`, same
  `scripts/deploy-migrations.sh` path, scripted credentials): fresh
  database, migrations deployed, then
  `npx jest --config jest.integration.config.js --runInBand`. Two
  harness-only failures on the way there, neither a product defect: the
  first full run hit leftover RLS fixtures from the earlier narrow runs
  (that file's `afterAll` only disconnects; the scripted run always
  starts from a fresh container), and the invoice-key rehearsal suite
  requires the scripted admin password (`tradeos_test`). After a fresh
  database with the scripted credentials, the full suite is green.
- `git diff --check` — **clean** (re-run after all edits).

Defect found and fixed during validation (real defect, minimal fix, no
redesign): the S069 migration's write policies used
`current_app_can_write()`, documented as owner/admin/estimator only —
but migration `20260706120000_add_beta_backend_foundation` redefined the
deployed helper to include dispatcher AND technician, so a technician
INSERT into `punch_items` succeeded at the live boundary and the RLS
integration test failed on that expectation. The fix, confined to the
new tables' own coverage (no global function change, no other table
touched): all 12 S069 policy predicates now spell out the manager list
explicitly as `current_app_role() IN ('owner', 'admin', 'estimator',
'dispatcher')`, with a header comment recording why the helper must not
be "simplified" back in. The widened global helper is a pre-existing,
system-wide condition outside this sprint's scope — it is recorded here
so the parent can decide whether it ever gets narrowed, not fixed here.
After the fix, the RLS test passes in full, including technician-insert
denied, assigned-technician update allowed, unassigned-technician update
denied, and dispatcher writes allowed.

## 7. Bearer-material handling rules

Same rules as S059 §5 (tokens exist only in process memory; staff and
customer browser contexts never share storage state; screenshots start
only after the clean URL loads; session-cookie flags checked in memory
only; one portal context per customer; documents proven by status +
`Content-Type` + project-name content only; denials recorded by case
label, HTTP status, and redacted outcome; error text redacted before
logging; cleanup revokes every token the run created). The single-use
portal access token is bearer material too: it lives only in a
process-memory variable until redemption consumes it, is never logged,
and any error text carrying the `/customer-portal/access?token=…` URL is
redacted before logging. The browser run records its own run report;
this document records only the backend evidence.

## 8. Run record (fill in on dispatch)

| Field | Value |
| --- | --- |
| Workflow run | _pending_ |
| Workflow head SHA | _pending_ |
| Deployed SHA (Vercel + `/health`) | _pending_ |
| Target base URL | _pending_ |
| Data-plane project ref (`/ready`) | _pending_ |
| Smoke tenant (label / org id) | _pending_ |
| Artifact (`s069-browser-evidence`, 30 days) | _pending_ |
| Credential scan | _pending_ |
| Result | PENDING DISPATCH |

Dispatch (do not run from this document — the parent agent dispatches
after this PR merges, because GitHub only accepts a `workflow_dispatch`
for a workflow that exists on the default branch):

```text
gh workflow run s069-browser-evidence.yml \
  --ref main \
  -f base_url=https://<approved-preview>.vercel.app \
  -f expected_sha=<full 40-char deployed SHA> \
  -f smoke_org_id=<TEST Org or Beta Smoke UUID> \
  -f sanitized_tenant=true -f use_test_org=true \
  -f require_sha_correlation=true
```

Record the run id, workflow head SHA, deployed SHA, and artifact in the
table above in a follow-up PR. The implementation PR merges on the merge
bar before the browser run exists; S069 stays `IN_REVIEW` until the
browser evidence (or its named blocker) is recorded.
