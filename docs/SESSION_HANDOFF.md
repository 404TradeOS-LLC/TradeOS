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

## Staging sign-in ID display — 2026-11-24

- Classification: NEW_WORK_REQUIRED. The staging Add member form (#1060) cannot attach any existing user: it needs the person's Supabase Auth UUID, but Settings never displays the sign-in ID anywhere — the only UUID shown is the application user ID under Supplier workflow IDs, which the backend lookup does not match on (verified live 2026-11-23 ~23:44 EST: submit with the application ID failed with a duplicate-record error; the technician's own Settings page shows no sign-in ID field). No open PR or branch covers it.
- Scope: frontend-only — Settings page resolves the session subject via `getSession()` and passes it as `signInId` to `SettingsConsole`, which renders a "Your TradeOS sign-in ID" card under Team & Access (all signed-in users, not only owners/admins, since technicians must share their own ID); the Add member form placeholder becomes the RFC 4122 example UUID instead of a real account's application ID. No backend, schema, auth-policy, RLS, or invite-email change; the Supplier workflow IDs card is untouched.
- Founder authorized 2026-11-24 ~00:13 EST ("Build both fixes") — this fix plus the parallel ledger fix; the field-closeout run re-verifies against the new build.
- Validation: web tests + lint + build, docs:check PASS (base origin/staging). PR targets staging; see the PR for exact-head CI, merge, and landed-SHA proof. After merge: verify the staging redeploy at the new SHA, add the staging technician via the button, then run the field-closeout scenarios.

## Staging migration ledger fix — 2026-11-24

- Classification: NEW_WORK_REQUIRED. The staging orchestrator run 45327738142 (push of `d663c210`) failed preflight-db with `Prisma ledger mismatch: expected=72 applied=76 unfinished=0`: the staging branch tracked 72 migration files while the staging DB ledger held 76 (applied 2026-11-22 by deploy-staging-migrations run 44986340125). No open PR or remote branch covers the ledger gap.
- Scope: inventory-only port to the staging branch — the four #946 migration folders already applied to the staging DB, copied byte-identical from main (`c7717c69`): `20261109220000_add_codes_authority_jurisdiction_source`, `20261109220000_add_codes_job_assessment`, `20261109220000_add_codes_source_ingestion_rls`, `20261110000000_add_codes_permit_tasks_fee_reviews`. No migration SQL modified; no database change (a later `migrate deploy` skips all four as applied). The seven Nov 23 main-only folders are deliberately NOT included. Plus `docs/CURRENT_STATE.md` + `docs/DOMAIN_MODEL.md` entries for the four folders (docs:check ownership rule for `app/prisma/migrations/**`). No app/web code, schema, auth-policy, or workflow change.
- Evidence: the four names are log-confirmed, not inferred — run 44986340125's logs show `Applying migration` for exactly these four folders at 2026-11-22T04:44Z.
- Founder authorized 2026-11-24 ~00:13 EST ("Build both fixes") plus the 2026-11-21 blanket authorization for merges. ADR-009 record is in the PR body.
- Validation: migration.sql count 76 after the change; `docs:check` PASS (base origin/staging); `git diff --check` clean. No app/web test suites required (no code changed). PR targets staging; see the PR for exact-head CI, merge, and landed-SHA proof. After merge: verify the staging redeploy + binding at the new SHA and the orchestrator verdict, then the parallel attach-fix PR lands, the technician is added via the button, and the field-closeout scenarios run.

## Staging Add member button — 2026-11-23

- Classification: NEW_WORK_REQUIRED. Staging Settings had no usable add-member control (verified live in the staging UI), blocking the field-closeout technician attach. The add-member form exists on main (#1052) but not on the staging branch (7c428acd); no open staging PR or branch covers it.
- Scope: frontend-only port to the staging branch — `web/src/lib/add-member.ts` + `add-member.test.ts` (11 tests), `web/src/components/settings/add-member-form.tsx`, Team & Access integration in `settings-console.tsx`, `docs/CURRENT_STATE.md` note. No backend, schema, auth-policy, or invite-email change; the form calls the existing POST /organizations/:id/members admin endpoint through the authenticated proxy.
- Founder authorized 2026-11-23 ("Add the button to staging") after the tradeoff was stated: staging moves off the frozen 7c428acd candidate and the field-closeout run re-verifies against the new build.
- Validation: web tests 775 pass, lint + build pass, docs:check PASS (base origin/staging). PR targets staging; see the PR for exact-head CI, merge, and landed-SHA proof. After merge: verify the staging redeploy + binding at the new SHA, add the staging technician via the button, then run the field-closeout scenarios.

## Sprint implementation — 2026-11-24: S071 promoted to READY

- S071 — Deployment identity and data-plane proof — promoted to `READY` by a governance-only readiness PR from current `main` `0d2ec04b` on the founder's word ("promote every sprint that is ready"). Dependencies satisfied (S051 `DONE`); `/health` commitSha + `/ready` projectRef already exist on main; the sprint replaces operator-attested RC identity (`BETA_RC_DEPLOYMENT_SHA` / `S059_EXPECTED_SHA`) with a runtime build/environment identity contract (commit, environment, backend host, non-secret data-plane identifier, fail-closed on mismatch). See `docs/architecture/S071_DEPLOYMENT_IDENTITY_PLAN.md`. S071 is the next eligible sprint for the 03:00 sprint runner.

## Sprint implementation — 2026-11-24: S068 implemented (merged)

- Implementation merged as PR #1067 (squash `1388baae`); S068 is `IN_REVIEW` with full acceptance still owed (browser-evidence workflow dispatch + run record in a follow-up PR).
- GAP-1 fixed: attributable `change_order.approved` / `change_order.rejected` activity events. GAP-2 BLOCKED by design (customer portal approve/reject, ADR-010). GAP-3 finding: no downstream roll-up of approved change orders — founder decision.

## Administrative member provisioning — bounded beta repair, 2026-11-14

The existing member-upsert route failed under forced user RLS for both new users
and foreign existing identities. The service now verifies the actor's active
administrator membership from the database before scoped provisioning, preserves
foreign global profiles, and writes membership/audit atomically. Five real
restricted-role PostgreSQL regressions and fourteen focused unit tests pass;
current-source hosted checks and actual staging create/disable/reactivate evidence
remain pending. No schema, policy or database-role grants changed.

## Next Eligible Sprint

Sprint ID: S071
Eligibility: S071 is `READY` (promoted 2026-11-24; dependencies satisfied — S051 is `DONE`). S069 is `IN_REVIEW` (implementation merged as PR #1073, `eb3c2f9e`, 2026-11-24; browser evidence pending). S068 is `IN_REVIEW` (implementation merged as PR #1067, `1388baae`, 2026-11-24; browser evidence pending). S059 is `IN_REVIEW` (browser evidence pending). Do not start implementation on a `PLANNED` sprint without its own promotion.
Dependencies: S071 depends on S051 (DONE).
Overlap check: Live open PRs rechecked 2026-11-24 (main `0d2ec04b`): none open. No competing S071 lane exists. The F7 public-portal approval/signature lane owns disjoint customer-portal/proposal files.
Startup prompt: S071 is the next eligible sprint — the 03:00 sprint runner selects it next.
