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

## Sprint implementation — 2026-11-24: S069 implemented (merged)

- Implementation merged as PR #1073 (squash `eb3c2f9e`); S069 is `IN_REVIEW` with full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).
- Base: `main` at `efcaa8f2` (rebased from `a4144ff0` after CodeQL warning fixes #1070–#1072 merged). Branch `feat/s069-closeout-warranty-workspace`.
- Built: three new models with forced RLS (`PunchItem`, `ProjectCloseout`, `WarrantyRecord`, migration `20261124120000_add_closeout_warranty_workspace`); closeout service/controller/routes at `/api/v1/closeout` (`crm.read`/`crm.write`; manager-only ready/verify/handoff; manager-or-assigned-technician punch resolve); project-workspace Closeout tab; read-only portal handoff (closeout in `CustomerPortalService.getProject` + portal document route); closeout document served as HTML (no HTML→PDF converter in the pipeline).
- Tests: focused service/controller tests; live-PostgreSQL RLS integration coverage (`app/tests/rls.integration.ts`, same-org allowed / cross-org denied / assigned-technician carve-out); snapshot-stability integration test (`app/tests/s069.closeout.integration.ts` — contract/proposal/invoice byte-stable after closeout); S073 matrix extended for the three tables (validator green); S069 browser-evidence workflow + capture script + contract test (19/19).
- Defect caught by the RLS test before merge: the deployed `current_app_can_write()` helper includes technician, so a technician INSERT into `punch_items` succeeded at the live boundary — all 12 S069 policy predicates now spell out the manager roles explicitly. The widened global helper is a pre-existing system-wide condition left as-is (S069 immune, other tables not — owner decision).
- No warranty-promise language, no new financial model, no new role/permission, no production change. Known limitations: a project with no contract at all cannot reach `ready` (signed contract + final invoice required); the document is HTML, not PDF.
- Browser evidence: S069 workflow + capture script + contract test written; PENDING DISPATCH from `main` after merge.
- S069 is `IN_REVIEW` on merge; full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).

## Sprint implementation — 2026-11-24: S071 promoted to READY

- S071 — Deployment identity and data-plane proof — promoted to `READY` by a governance-only readiness PR from current `main` `0d2ec04b` on the founder's word ("promote every sprint that is ready"). Dependencies satisfied (S051 `DONE`); `/health` commitSha + `/ready` projectRef already exist on main; the sprint replaces operator-attested RC identity (`BETA_RC_DEPLOYMENT_SHA` / `S059_EXPECTED_SHA`) with a runtime build/environment identity contract (commit, environment, backend host, non-secret data-plane identifier, fail-closed on mismatch). See `docs/architecture/S071_DEPLOYMENT_IDENTITY_PLAN.md`. S071 is the next eligible sprint for the 03:00 sprint runner.

## Sprint implementation — 2026-11-24: S068 implemented (merged)

- Implementation merged as PR #1067 (squash `1388baae`); S068 is `IN_REVIEW` with full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).
- GAP-1 fixed: attributable `change_order.approved` / `change_order.rejected` activity events. GAP-2 BLOCKED by design (customer portal approve/reject, ADR-010). GAP-3 finding: no downstream roll-up of approved change orders — founder decision.

## Next Eligible Sprint

Sprint ID: S071
Eligibility: S071 is `READY` (promoted 2026-11-24; dependencies satisfied — S051 is `DONE`). S069 is `IN_REVIEW` (implementation merged as PR #1073, `eb3c2f9e`, 2026-11-24; browser evidence pending). S068 is `IN_REVIEW` (implementation merged as PR #1067, `1388baae`, 2026-11-24; browser evidence pending). S059 is `IN_REVIEW` (browser evidence pending). Do not start implementation on a `PLANNED` sprint without its own promotion.
Dependencies: S071 depends on S051 (DONE).
Overlap check: Live open PRs rechecked 2026-11-24 (main `0d2ec04b`): none open. No competing S071 lane exists. The F7 public-portal approval/signature lane owns disjoint customer-portal/proposal files.
Startup prompt: S071 is the next eligible sprint — the 03:00 sprint runner selects it next.
