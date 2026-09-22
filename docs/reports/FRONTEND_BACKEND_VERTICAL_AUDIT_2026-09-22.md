---
status: current
owner: platform
last_verified: 2026-09-22
source_of_truth: false
related_docs:
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/testing/BETA_EVIDENCE.md
  - docs/architecture/S047_COMPLETION_EVIDENCE.md
related_code:
  - app/backend/server.ts
  - app/scripts/beta-evidence/
  - app/scripts/rc-business-flow-smoke.mjs
  - web/src/lib/api.ts
  - web/src/lib/clientApi.ts
  - web/src/app/api/proxy/[...path]/route.ts
---

# Frontend/backend vertical workflow audit — 2026-09-22

## Verdict

TradeOS is **not beta-certified at the current `main` head**.

The repository is also not accurately described as having a wholly disconnected
frontend. The principal contractor seam is real: server-rendered frontend reads
use `web/src/lib/api.ts`, browser mutations use the authenticated same-origin
proxy and `web/src/lib/clientApi.ts`, and the Express application mounts the
corresponding organization-scoped API families behind JWT, membership, and
request-scoped database-session middleware.

The release gap is narrower and more actionable:

1. the retained September 5 evidence proves an older release-candidate workflow,
   not current-head certification;
2. several important workflows were outside that run or were exercised only at
   one role/viewport;
3. no maintained action-to-endpoint certification matrix prevents a frontend
   control, backend route, DTO, permission, or refresh contract from drifting;
4. the customer magic-link portal, Athena-assisted estimate path, assembly
   application, and latest command-board experience lack retained current-head
   end-to-end proof; and
5. production access gates from S039, S044, S045, and S046 remain unresolved.

The correct status is therefore **implemented in substantial part, historically
certified in a bounded RC path, but not current-head beta-certified**.

## Audit target and baseline

- Repository: `404TradeOS-LLC/TradeOS`
- Branch: `main`
- Audited SHA: `9a27682a575f6c8b13337a61e88cdd7b838dcfe2`
- Audited on: 2026-09-22
- Comparison baseline: the ten contractor journeys proposed after the first
  50-sprint review, plus the repository's existing beta-evidence contract
- Live overlap snapshot: 17 open pull requests; protected or material lanes
  include #532 (private project-file storage), #531 (regional supplier evidence,
  draft), #507 (financial intelligence, draft), #506 (trusted pricing pipeline,
  draft), and #491 (Stripe subscription billing)

## Evidence scale

| State | Meaning |
| --- | --- |
| `CONNECTED` | A reachable frontend read or mutation is mapped to an implemented backend route/service contract. |
| `PARTIAL` | Some required steps are connected, but a material step, role, failure path, or UI handoff is absent or unproved. |
| `HISTORICALLY_CERTIFIED` | Retained browser evidence passed, but not against the audited current `main` head. |
| `CURRENT_HEAD_CERTIFIED` | Retained authenticated browser evidence passed against the audited head. |
| `BLOCKED` | Completion requires an external environment, founder decision, or protected production operation. |

No workflow in this report is labeled `CURRENT_HEAD_CERTIFIED` because no
authenticated full-run artifact was collected against SHA `9a27682` during this
audit.

## Vertical workflow matrix

| Journey | Repository connection | Best retained evidence | Audit result | Gap that blocks certification |
| --- | --- | --- | --- | --- |
| Lead/customer → project | Customer and project pages/actions call mounted CRM/project APIs through the authenticated server client. | September 5 RC run created a tenant-scoped customer and project at 1440/1024/768/390. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | Re-run against current head; CRM lead/follow-up/pipeline behavior is not part of the certified path. |
| Scope → Athena → assemblies/Costbook → estimate lines | Scope intake, knowledge matching, AI suggestions, Costbook search, starter assemblies, and explicit suggestion application routes exist. | The RC run created custom estimate lines; it did not generate Athena suggestions, choose/install an assembly, or apply reviewed suggestions. | `PARTIAL` | One browser flow must prove scope interpretation, provenance display, explicit review, assembly/Costbook selection, estimate-line creation, persistence, and no silent AI write. |
| Estimate → proposal → acceptance | Estimate finalization, proposal creation/send, and staff acceptance are connected. | September 5 RC run asserted exact `$7,105.07` value transfer into the proposal. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | Customer-side proposal acceptance through the current portal access model is not certified. |
| Accepted proposal → contract → signature | Contract creation and internal/portal signature endpoints and UI exist. | RC evidence created a contract; it did not prove current magic-link redemption, customer signature attribution, replay denial, or expiry. | `PARTIAL` | Certify real customer portal identity, signing, audit attribution, replay/expiry, and immutable rendered output. |
| Project → job → schedule → dispatch | Project job creation, assignment, conflict preview, schedule/reschedule, and dispatch controls call mounted Jobs/Schedule APIs. | The downstream RC business-flow script created, assigned, scheduled, and dispatched a job. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | Re-run against current head and retain mobile evidence for the handoff. |
| Field execution → completion | Field day UI calls named Job lifecycle endpoints and notes. | Downstream smoke used a distinct technician and reached traveling → on-site → completed. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | The downstream lifecycle is 1440-only; certify 390/768 field usability, failure recovery, notes/photos, and role denial. |
| Completion → invoice → payment | Invoice create/send/payment/void actions and reconciliation routes exist; the downstream script records full payment. | RC evidence created the invoice at the exact sell price; downstream smoke reached paid/zero balance. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | Prove completion-to-invoice readiness, partial payment, overdue, void, and permission failure at supported viewports against current head. |
| Customer portal end-to-end | Staff issuance, single-use token redemption, customer session scoping, document reads, and portal mutations exist. | Repository tests cover the boundary, but `docs/testing/BETA_EVIDENCE.md` explicitly excludes the magic-link portal. | `PARTIAL` | No retained browser proof for issuance → delivery/copy → redemption → proposal/contract/invoice actions → replay/expiry/revocation/cross-tenant denial. |
| Athena read/action workflows | Athena UI, observability, approvals, tools, context providers, and permissioned action contracts are mounted and heavily unit/contract tested. | No retained authenticated browser workflow proves a recommendation through approval and resulting domain action. | `PARTIAL` | Certify explainability, approval, idempotency, audit event, result refresh, denial, and rollback behavior. |
| Owner dashboard from live backend data | Dashboard loaders consume live project, estimate, proposal, invoice, task, activity, payment, Job, and knowledge routes; Today command board is on `main`. | Older RC evidence rendered the dashboard at four viewports before later command-board changes. | `CONNECTED`, `HISTORICALLY_CERTIFIED` | Re-certify latest Today layout, degraded states, counts, destinations, and current financial-intelligence decision after #507. |

## Frontend/backend seam findings

### What is connected

- `app/backend/server.ts` mounts the major domains used by the frontend:
  customers, projects, estimates, proposals, contracts, invoices, payments,
  jobs, schedule, Costbook, Knowledge Runtime, Athena, settings, Brand Studio,
  intelligence, and customer portal.
- Server Components and Server Actions attach the bearer token through
  `apiFetch`; Client Components use the same-origin proxy, which obtains the
  HttpOnly session server-side and normalizes `/api/v1` paths.
- A static review found 174 frontend API call sites representing 145 distinct
  literal/dynamic path templates. No whole-domain mount mismatch was found in
  the reviewed route families. That is implementation evidence, not runtime
  proof of every call shape or DTO.
- Existing tests cover many service, controller, lifecycle, permission, RLS,
  and frontend action/model boundaries. The audited tree contains 308 TypeScript
  test files across `app/tests` and `web/src`.

### P0 release findings

1. **No current-head vertical certification.** The latest successful retained
   full evidence is historical. Since then, customer portal issuance, Today,
   Universal Create, Estimates navigation/workbench, mobile estimate stages,
   contextual Athena, and assembly preview changed.
2. **The canonical signature workflow is unproved.** Contract creation is not
   equivalent to customer identity, portal redemption, signature attribution,
   or replay-safe acceptance.
3. **The product-defining AI estimating path is unproved.** Current evidence
   bypasses Athena and assemblies by entering custom line items manually.
4. **There is no executable integration inventory.** The repository lacks one
   governed matrix tying each user action to route, method, DTO, permission,
   organization/RLS expectation, UI refresh, automated check, and browser
   checkpoint.

### P1 release findings

- Field and downstream payment lifecycle evidence is not multi-viewport.
- The latest dashboard command board has no retained authenticated evidence.
- Portal email delivery is still follow-up; link copying is implemented, but a
  production-worthy delivery/retry contract is not certified.
- Proposal collapses estimate pricing into `finalPrice`; proposal-level
  `subtotal`, `taxAmount`, and `taxPct` fidelity remains absent.
- All 1,795 canonical Knowledge Engine cost items lack item-level source
  provenance; the UI warns rather than silently treating them as trusted.
- Production backup/restore, secrets/environment posture, environment inventory,
  and migration deployment gates remain blocked or planned in S039/S044-S046.

## Evidence inspected

- Live `main` metadata and source at SHA `9a27682`
- `AGENTS.md`, TradeOS Bible, Next Sprint Protocol, repository governance,
  current state, current backlog, session handoff, module docs, and beta evidence
- Frontend pages, actions, API clients, authenticated proxy, backend mounts,
  route families, test inventory, and browser scripts
- GitHub Actions for current `main`: `Verify repository`, `Push on main`, Code
  Quality, and Merge readiness completed successfully for the audited head
- Historical Beta Evidence Final Ops run `33945411532`: completed successfully
  on 2026-09-05 with retained artifact metadata and one successful full job
- Focused repository-native evidence-contract tests executed during this audit:
  `node --test scripts/__tests__/beta-evidence.test.mjs scripts/__tests__/rc-smoke-contract.test.mjs`
  — 40 passed, 0 failed

## Verification limitations

- Dependencies were not installed in the clean audit clone, so full App/Web
  unit, integration, lint, and build suites were not rerun locally. The current
  head's successful GitHub `Verify repository` run is recorded as hosted
  evidence, not represented as a local run.
- No deployment, production configuration, database, secret, migration, email,
  Stripe, or Supabase policy was changed.
- No authenticated browser run was performed because this audit did not possess
  or request the protected RC identities and environment configuration.
- Static endpoint mapping cannot prove DTO compatibility, real authorization,
  database state, or browser behavior. Those remain certification work.

## Backlog consequence

S051-S100 in `docs/SPRINT_BACKLOG.md` convert these findings into dependency-
ordered integration, contractor UX, security/reliability, intelligence/
financial, and beta-certification work. A contractor-facing sprint may not be
marked `DONE` from merge evidence alone: its acceptance must include the
frontend/backend connection, negative authorization/tenant evidence where
applicable, state-refresh behavior, and retained browser evidence for the
workflow and supported viewport/role set it owns.

## Follow-up risks (post-merge review, 2026-09-22)

Concrete risks introduced or left unresolved by this audit/backlog PR, found
by inspecting the merged governance tooling rather than by restating the
report's own findings above:

1. **`BLOCKED` sprint PR gates have no live-reconciliation check.**
   `scripts/live-sprint-evidence-check.mjs` only fetches live GitHub state for
   sprint blocks with `Status: DONE`, verifying that the PR named in their
   `Evidence:` field is merged. S064, S075, S082, S088, and S090 gate on
   `Blocked by:` references to open PRs #520, #532, #531, #507, and #491
   respectively, but no script queries GitHub to confirm those PRs are still
   open. If any of them merges, closes, or is superseded before
   `docs/SPRINT_BACKLOG.md` is hand-updated, the `BLOCKED` status and its gate
   description will silently go stale, undetected by `sprint-governance.yml`
   or `docs-reconciliation.yml`.
2. **Cross-document READY-sprint consistency is only enforced for one file
   pair.** `scripts/__tests__/sprint-backlog.test.mjs` cross-checks
   `docs/SPRINT_BACKLOG.md` against the terminal `## Next Eligible Sprint`
   block in `docs/SESSION_HANDOFF.md` only. `docs/ENGINEERING_COMMAND_CENTER.md`
   and `docs/TRADEOS_BIBLE.md` independently assert "S051 is READY" and the
   audit SHA `9a27682a575f6c8b13337a61e88cdd7b838dcfe2` in free text with no
   automated check. A future PR that promotes a different sprint in
   `docs/SPRINT_BACKLOG.md` without touching those two files would pass all
   existing CI while leaving contradictory source-of-truth claims live.
3. **Dependency-backed governance checks ran only on hosted CI for this PR.**
   `npm run pr:test`, `npm run docs:check`, and `npm run docs:test` could not
   run in the local audit clone because `minimatch` (declared in
   `package.json`) was not installed, so hosted CI was the only place the new
   100-sprint inventory, the raised `scripts/sprint-state-check.mjs` threshold,
   and `DOC_OWNERSHIP.yml` compliance were actually exercised end-to-end.
4. **S051's drift validator does not exist yet.** The connection-matrix claims
   in this report (174 frontend call sites, 145 path templates, mounted route
   families) are a one-time snapshot at `9a27682a575f6c8b13337a61e88cdd7b838dcfe2`.
   Until S051 is implemented, no automated check will detect a subsequent PR
   changing a route, DTO, or permission out from under this snapshot.
5. **Tenant-isolation and RLS regression coverage remains open.** The workflow
   matrix above classifies the customer portal, Athena action execution, and
   RLS-backed resources as `PARTIAL`/not current-head certified, and S073 (RLS
   coverage matrix) and S059 (portal certification) remain `PLANNED`. No new
   automated regression gate was added by this PR, so a forced-RLS or
   portal-isolation regression introduced before S073/S059 land would not be
   caught by existing CI.
6. **Backup/restore and production-migration rehearsal remain unverified.**
   S078 and S080 stay `BLOCKED` on S039/S044/S045 production access; this PR
   does not reduce that exposure, and no RPO/RTO restore has been rehearsed
   against the current schema.
