---
status: current
owner: platform
last_verified: 2026-11-25
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## Sprint implementation — 2026-11-25: S071 merged (PR #1096); S048 promotion blocked

- S071 — Deployment identity and data-plane proof — implementation merged as PR #1096 (squash `f1cf85f0`, head `8a8fd229`, base main `0ad368b6`, merged 2026-11-25T06:39:25Z); the implementation branch was deleted after merge. Follow-up docs PRs #1099 (`820985dd`, post-merge follow-up risks) and #1100 (`d3054357`, merge validation) are also merged.
- Built: `/health` now reports `environment` from `VERCEL_ENV` (`resolveRuntimeEnvironment`, exact-match only, omitted when unrecognized); the web staging-runtime-identity endpoint now reports `environment: "preview"` in its 200 body; canonical contract `app/scripts/beta-evidence/lib/deployment-identity-contract.mjs` (`verifyDeploymentIdentity`, `collectRuntimeIdentity`, `verifyIdentityUnchanged`) verifying commit, environment, backend host, and non-secret data-plane identifier from the deployment, fail-closed, production refused, no secret or env inventory fetched. The S059/S068/S069 identity gate and the staging orchestrator correlation now verify through the contract; the s027 env-inventory script is untouched.
- Tests: contract test 33/33, correlation test updated with environment cases, health + web identity tests extended; new contract test wired into `npm run pr:test`.
- S071 is `IN_REVIEW` on merge; full acceptance still owed: live non-production evidence against a real preview/staging deployment plus a negative mismatched-SHA run, after merge + staging promotion (the new gate requires deployments built from this PR onward). Blocked on staging promotion: re-promotion 11 reached staging `e99b0c89` git-side, but Vercel created no deployments for it (parent-owned; staging still serves `6b1bc94f`).
- No secret handling, no production deployment or data-plane acceptance, no new pipeline/hosting/trust boundary.
- Readiness-promotion check for the next PLANNED sprint with satisfied dependencies, S048 (Beta tenant onboarding; S047 DONE): dependencies satisfied, overlap clear (only open PRs are lane-owned drafts #1090/#1091, disjoint scope; no S048 branch or lane), but promotion BLOCKED — the founder decision ("select beta tenants and rollout date") is unresolved, and the protocol stop condition bars promoting a sprint whose founder-decision field is YES while the decision is unresolved. S048 stays PLANNED until Billy decides. S046 stays PLANNED (dependencies S039/S045 both BLOCKED on production/live-deployment access); S072 stays PLANNED (depends on S071, IN_REVIEW, not DONE).

## Assembly Catalog recipe versions and reviewed upgrades — issue #518

- Implementation branch `feat/assembly-recipe-versions-518` started from live
  `origin/main` `2b547c975ae47f0221860307015c7f7d8b78755b` in an isolated
  worktree. No overlapping PR or branch was present at startup.
- Catalog version history captures structural changes. Installed templates
  show drift, support explicit per-template mapping review and confirmation,
  and expose tenant-scoped audit history.
- This branch is pending PR review. Hosted checks and the ADR-009 risk record
  belong to the PR. The numbered sprint queue remains governed by the backlog.

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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4d727bf5f30fcc7f5f8d76cb008446b91f0e7a28d0a3b7c6601176a3f49d8e35 -->

## Estimate Scope clarification — DES-10-F1

[PR #1090](https://github.com/404TradeOS-LLC/TradeOS/pull/1090) merged in `69a9d0ac`; staging acceptance remains pending. The next step is to verify the approved candidate's API and web identities and migration ledger, then run the [DES-10-F1 follow-up checks](CURRENT_STATE.md#estimate-scope-clarification--des-10-f1-merged-staging-acceptance-pending).

<!-- /coderabbit-ai-generated:v1 -->

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: S071 is `IN_REVIEW` (implementation merged as PR #1096, `f1cf85f0`, 2026-11-25; live evidence pending staging promotion). S048 promotion is blocked on the unresolved founder decision (beta tenants + rollout date). S046 dependencies (S039/S045) are BLOCKED; S072 depends on S071 (IN_REVIEW, not DONE). Do not start implementation on a `PLANNED` sprint without its own promotion.
Dependencies: S071 depends on S051 (DONE). S048 depends on S047 (DONE) with an unresolved founder decision.
Overlap check: Live open PRs rechecked 2026-11-25 (main `106f729e`): only the lane-owned drafts #1090 (DES-10-F1) and #1091 (#518), disjoint scope. No competing S048 or S071 lane exists.
Startup prompt: No sprint is READY; the next eligible sprint is NONE until S071 leaves IN_REVIEW, Billy decides S048's beta tenants and rollout date, or another sprint is promoted.
