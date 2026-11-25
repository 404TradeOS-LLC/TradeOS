---
status: current
owner: platform
last_verified: 2026-11-24
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## Sprint implementation — 2026-11-25: S071 implemented (PR pending)

- S071 — Deployment identity and data-plane proof — implementation in branch `feat/s071-deployment-identity-contract` (base main `0ad368b6`), on Billy's word 2026-11-25 ~00:33 EST ("Start the next tasks that are not blocked"). Live overlap rechecked 2026-11-25: only open PRs are the lane-owned drafts #1090 (DES-10-F1) and #1091 (#518), disjoint scope; no S071 remote branch, no live S071 lane. Overlap classification: NEW_WORK_REQUIRED.
- Built: `/health` now reports `environment` from `VERCEL_ENV` (`resolveRuntimeEnvironment`, exact-match only, omitted when unrecognized); the web staging-runtime-identity endpoint now reports `environment: "preview"` in its 200 body; canonical contract `app/scripts/beta-evidence/lib/deployment-identity-contract.mjs` (`verifyDeploymentIdentity`, `collectRuntimeIdentity`, `verifyIdentityUnchanged`) verifying commit, environment, backend host, and non-secret data-plane identifier from the deployment, fail-closed, production refused, no secret or env inventory fetched. The S059/S068/S069 identity gate and the staging orchestrator correlation now verify through the contract; the s027 env-inventory script is untouched.
- Tests: contract test 33/33, correlation test updated with environment cases, health + web identity tests extended; new contract test wired into `npm run pr:test`.
- S071 is `IN_REVIEW` on merge; full acceptance still owed: live non-production evidence against a real preview/staging deployment plus a negative mismatched-SHA run, after merge + staging promotion (the new gate requires deployments built from this PR onward).
- No secret handling, no production deployment or data-plane acceptance, no new pipeline/hosting/trust boundary.

## Sprint implementation — 2026-11-24: S069 implemented (merged)

- Implementation merged as PR #1073 (squash `eb3c2f9e`); S069 is `IN_REVIEW` with full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).
- Base: `main` at `efcaa8f2` (rebased from `a4144ff0` after CodeQL warning fixes #1070–#1072 merged). Branch `feat/s069-closeout-warranty-workspace`.
- Built: three new models with forced RLS (`PunchItem`, `ProjectCloseout`, `WarrantyRecord`, migration `20261124120000_add_closeout_warranty_workspace`); closeout service/controller/routes at `/api/v1/closeout` (`crm.read`/`crm.write`; manager-only ready/verify/handoff; manager-or-assigned-technician punch resolve); project-workspace Closeout tab; read-only portal handoff (closeout in `CustomerPortalService.getProject` + portal document route); closeout document served as HTML (no HTML→PDF converter in the pipeline).
- Tests: focused service/controller tests; live-PostgreSQL RLS integration coverage (`app/tests/rls.integration.ts`, same-org allowed / cross-org denied / assigned-technician carve-out); snapshot-stability integration test (`app/tests/s069.closeout.integration.ts` — contract/proposal/invoice byte-stable after closeout); S073 matrix extended for the three tables (validator green); S069 browser-evidence workflow + capture script + contract test (19/19).
- Defect caught by the RLS test before merge: the deployed `current_app_can_write()` helper includes technician, so a technician INSERT into `punch_items` succeeded at the live boundary — all 12 S069 policy predicates now spell out the manager roles explicitly. The widened global helper is a pre-existing system-wide condition left as-is (S069 immune, other tables not — owner decision).
- No warranty-promise language, no new financial model, no new role/permission, no production change. Known limitations: a project with no contract at all cannot reach `ready` (signed contract + final invoice required); the document is HTML, not PDF.
- Browser evidence: S069 workflow + capture script + contract test written; PENDING DISPATCH from `main` after merge.
- S069 is `IN_REVIEW` on merge; full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).

## Sprint implementation — 2026-11-24: S068 implemented (merged)

- Implementation merged as PR #1067 (squash `1388baae`); S068 is `IN_REVIEW` with full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).
- GAP-1 fixed: attributable `change_order.approved` / `change_order.rejected` activity events. GAP-2 BLOCKED by design (customer portal approve/reject, ADR-010). GAP-3 finding: no downstream roll-up of approved change orders — founder decision.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: S071 is `IN_REVIEW` (implementation in branch `feat/s071-deployment-identity-contract`, PR pending; live evidence still owed after merge + staging promotion). S069 is `IN_REVIEW` (implementation merged as PR #1073, `eb3c2f9e`, 2026-11-24; browser evidence pending). S068 is `IN_REVIEW` (implementation merged as PR #1067, `1388baae`, 2026-11-24; browser evidence pending). S059 is `IN_REVIEW` (browser evidence pending). S072 depends on S071 and stays `PLANNED`. Do not start implementation on a `PLANNED` sprint without its own promotion.
Dependencies: S071 depends on S051 (DONE).
Overlap check: Live open PRs rechecked 2026-11-25 (main `0ad368b6`): only the lane-owned drafts #1090 (DES-10-F1) and #1091 (#518), disjoint scope. No competing S071 lane exists.
Startup prompt: No sprint is READY; the next eligible sprint is NONE until S071 leaves IN_REVIEW or another sprint is promoted.
