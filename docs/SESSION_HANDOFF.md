---
status: current
owner: platform
last_verified: 2026-10-02
source_of_truth: false
related_docs:
  - docs/SPRINT_BACKLOG.md
  - docs/CURRENT_STATE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

# Session Handoff

## Active S053 browser certification tooling — 2026-10-02

- Classification: `NEW_WORK_REQUIRED`; no open S053 PR/branch overlapped this certification-tooling gap when current main `8d6c8a838e8fcafe0de7049aaaed75b655d1e25f` was reconciled.
- Branch: `test/s053-browser-certification`.
- The existing Beta Evidence workflow gains an opt-in `s053` scenario. It keeps the canonical full workflow and adds Athena review checkpoints asserting visible confidence/provenance, no estimate-line write before explicit Apply, reviewed Estimate Engine persistence, pricing refresh, and reload persistence.
- The scenario uses only the approved non-production synthetic tenant and existing Beta smoke authentication/data-plane guards. It does not weaken auth/RLS, introduce product writes outside the existing Estimate Engine path, or claim the one-question clarification target exists.
- S053 remains incomplete until a full authenticated `s053` evidence run passes at the required viewports with retained artifacts. Its status is now `IN_REVIEW`; this evidence requirement remains a release gate, not a mutex on unrelated implementation.


## Design/backlog reconciliation — 2026-10-02

- Canonical Figma page enumeration is verified: all 21 documented pages exist in file `xImUa9CYUjx3Cb3zTrkfnY`; the earlier two-page metadata result was an incomplete listing path, not a file-structure defect.
- PR #520 is merged and PR #560's estimate-assist contract is landed. S064 is now `IN_REVIEW` in draft PR #624; S053 remains a separate release-certification prerequisite and does not block continued S064 implementation.
- S053 certification must follow its canonical backlog acceptance criteria. The one-question clarification interaction remains separate TARGET work because production lacks the persisted answer/regenerate contract needed to certify it.


## Nightly release repair — desktop estimate visibility, 2026-10-02

- Classification: `NEW_WORK_REQUIRED`; base main
  `9e53cde9c35396bf5d5b2bd22b154c9b37e3d9de`, Sprint ID: NONE.
- Production Dashboard and draft estimate access were verified read-only in an
  existing signed-in browser session. Desktop estimate editing was absent after
  reload: the mobile section hides at `lg`, and the desktop section never shows.
- Branch `fix/desktop-estimate-visibility` restores the existing desktop display
  at `lg` and adds a failing-before/passing-after visibility regression. No auth,
  data, pricing, lifecycle, schema, or design-system change is included.
- Production API is READY at current main; frontend is READY at parent `1c107830`.
  Their intervening commit changes CI/docs only. `/health` and `/ready` pass,
  including database/schema readiness. No runtime error clusters were returned.
- Exact-main repository verification passed, but authenticated full-flow evidence
  remains outstanding. Historical Sign out failure was repaired by merged #561;
  no new current-head smoke run was available. Do not reassert database-auth
  failure from old PR descriptions.
- This gate must not merge the repair. Next: independent exact-head CI/review,
  merge through PR Autopilot, verify desktop estimate controls after deployment,
  run sanitized Preview estimating/portal/payment certification, retain mobile
  viewport evidence.

## Active maintenance: native merge queue — 2026-10-01

- Classification: `NEW_WORK_REQUIRED`; current main verified as
  `89a79d29d399c922b023ae4392514cd09708aa0f`. No viable existing native queue
  implementation or competing open queue PR/branch was found. Work is on
  `ci/native-merge-queue`, Sprint ID: NONE.
- Adds guarded one-shot label consent, dry-run/apply, exact-head native enqueue,
  and disabled-by-default automatic wakeups. Required CI now supports
  `merge_group`, running all product lanes and checking docs against the event
  base SHA. Existing required check names and protections are preserved.
- Ruleset `18958081` has no queue rule in the observed snapshot. Import the
  additive template after CI support lands, configure the dedicated token, and
  record a live group-CI trial before enabling automatic entry. The connected
  GitHub app cannot administer rulesets/secrets; no live activation or enqueue
  is claimed. See `docs/testing/MERGE_QUEUE.md`.
- Thirty-five focused boundary/contract tests pass. Full local root regression
  and final-head hosted CI evidence are recorded in the PR; live enqueue and
  synthetic group execution remain unverified until activation.
- PR #604 separately containerizes browser evidence. Shared package/docs metadata
  must retain both changes when rebasing either PR; this queue lane changes no
  browser runners, application code, auth, RLS, schema, or sprint completion.
- Next five tasks: review/land CI support; activate the additive queue rule;
  provision the repository token/label; record one dry-run/apply/group-CI trial;
  enable automatic entry after success and monitor failure/ejection summaries.

## Staging fixture and evidence repair — 2026-10-01

- Existing PR #561 reconciled with main `6a2d921`; preserved canonical design
  authority, current tokens, dependency lockfiles and Customer-to-Project work.
- Production and immutable staging API readiness now pass. The latest RC smoke
  passed login/refresh but timed out on Sign out at the default 1280px viewport.
  The account control is under More below 1536px; the runner now opens that menu
  and clicks the visible Sign out button. Logout and protected-route denial
  assertions remain required; no authentication control was weakened.
- The credential-free fixture stays off by default; no Preview or Production
  bypass was enabled. Fresh CI and live browser certification remain required.

## Active S059 release repair — 2026-10-01

- Continue existing PR #564 on `feature/s059-customer-portal-session-certification`;
  reconciliation classification: `EXISTING_WORK_FOUND`. Main is `6a2d921`.
- Reproduced TS5097 with web TypeScript checking. Restored current-main compiler
  configuration and Customer-to-Project UI/test/docs rather than changing imports
  incompatibly with the Node test runner. Auth policy and RLS remain unchanged.
- Production web/API both identify `6a2d921`, and production plus immutable staging
  backend readiness returned HTTP 200 with database/schema `ok`. The old project
  named `tradeos` caused a false deployment-drift report.
- Local web build/lint passed and all 411 web tests passed after repair.
- Authenticated portal certification and fresh exact-head CI remain required.
  S059 stays incomplete.

## Current truth

- PR #597 merged as `3288f3c7a967b75b507b7544328c817a513fb835`.
  Production frontend `dpl_GmtT3say5KK8qY57PHU7QT1cWw2R` and backend
  `dpl_CRLBHggXh7zuJkUTBQioGVQH8HuZ` both identify that main commit.
- The production Supabase project was paused. It was restored on 2026-09-30;
  `/ready` returned HTTP 200 with database and schema checks `ok` at 23:52 UTC.
- Staging commit `9ca5876eef05daaa5e59ed6c39b2b52bbe6ce74e` retains both
  histories and uses the exact main tree `63d8faaa417f8dafebcc1e8aa68930fd1605c56b`.
  Repair run `36792529613` passed immutable backend identity/readiness and
  invalid-token auth initialization against `dpl_FX2x1wPMHzXYsfDcCRNB7WcipL7V`.
- RC smoke run `36793045095` first failed after successful Supabase login:
  frontend organization bootstrap called an obsolete API deployment (HTTP 410).
  A staging-only `BACKEND_API_URL` override now pins the verified backend
  `https://tradeos-costbook-6tij63lsx-billykshowalters.vercel.app`.
  Replacement frontend `dpl_46S63m9K9pebE3t1VV2niF3CP3Lb` is READY at the
  staging SHA. Attempt 2 reached dashboard and authenticated API HTTP 200, but the runner
  rejected a page-wide alert during navigation. Its credential-error locator is
  now scoped to the login form; a passing lifecycle/browser run is still required.
- S027 run `36792720050` failed before authentication because its Vercel
  branch-only environment query could not attest the effective Preview URL.
  `fix/preview-shared-env-attestation` now reads the complete inventory and
  requires the exact deployment branch override, preserving configuration
  timestamps and failing closed if that override disappears.
- This is operational maintenance, Sprint ID: NONE. No auth bypass, RLS,
  migration, credential, or product behavior change is included. Passing
  readiness alone does not certify authenticated workflows or the whole release.

## Verification

The new behavioral regression fails against original main and passes after
requiring the exact deployment branch override. Six focused evidence-contract tests pass.
Required repository checks and authenticated live results remain to be recorded
for the final head; no pending check is represented as passing.

## Active follow-on: Team & Time staging interface

- PR #562 adds the feature-flagged responsive `/team-time` workspace, assigned-job punches, breaks, supervisor review/corrections, employee/subcontractor classification, and approved-hours CSV handoff.
- The work requires the server-only project ref pinned to TradeOS Staging and matching the project reference in the configured URL hostname, and is explicitly disabled on Vercel Production. It does not submit payroll, verify jobsite location, or replace the existing login.
- The real phone-to-office test still requires dedicated staging worker/supervisor accounts, an assigned staging job, a protected feature-enabled Preview deployment, and a matching staging API/database path. Do not touch shared beta fixtures, enable Production, or claim live clock verification until that isolated path exists.
- The deployed Edge Function and migration source remain outside this repository; version them before claiming complete live Team & Time certification.

## Historical RC smoke follow-up

Earlier release-certification work called for verifying RC smoke attempt 2 and
rerunning S027 against an immutable replacement frontend with the expected
staging SHA and canonical sanitized Beta Smoke organization. That remains
historical release-evidence context, not the active session instruction. The
active resume contract is the S066 / PR #634 block at the end of this handoff.

## S061 Today implementation reconciliation — 2026-10-02

- Classification: `EXISTING_WORK_FOUND`; merged PR #585 already satisfies the S061 structural acceptance contract on current main.
- Current implementation remains the single Today landing surface: `OwnerDashboardHeader` + `TodayCommandBoard`, with Now / Needs you / Coming up / Money and no lower duplicate dashboard modules.
- S061 advances to `IN_REVIEW`, not release-certified; S060 remains its separate certification prerequisite.
- Do not create another S061 implementation branch unless S060 evidence reproduces a current-main defect.

## S062 implementation merge and S063 readiness — 2026-10-03

- S062 PR #629 merged as `6f6a0a6567c1413c837afc86b943c1c45f5f03e0` after exact-head Web/docs/governance checks passed. Customer creation opens its server-created record; context-free Job intent continues through Project creation. S062 remains `IN_REVIEW` pending retained browser/permission/refresh evidence; S052/S056/S058 certification remains separate.
- S063 reuses merged PRs #582 (Lead/Site Visit), #586 (Customer/Project), and #587 (derived CRM). Current CRM limits the visible pipeline and follow-ups, particularly mobile lanes with only their first Project, and omits existing Task ownership. Accepted Proposal handoff must link to canonical Project state; do not add another CRM persistence model.
- Classification: `NEW_WORK_REQUIRED` only for the bounded S063 continuity gaps. No open S063 implementation PR or branch was found during this reconciliation. Repository main was `6f6a0a6567c1413c837afc86b943c1c45f5f03e0`; connector-native execution has no local worktree/dirty state. Existing CRM APIs and hosted Web CI suffice for this frontend slice; no migration or new infrastructure is required. Founder decision: NO for the bounded continuity scope. Stop if implementation requires a new assignment, conversion, proposal, or authorization policy. PR #630 merged as `28c939e405966ded5b3049f1fc64f3c3ae58ba98`; PR #631 merged as `b25988a11a3a4b62551f5bc3091f5fd298da6684` after exact-head Web/docs/governance checks. S063 remains `IN_REVIEW` for retained authenticated responsive, permission/tenant-negative, and refresh evidence; no duplicate implementation branch.

## S066 active implementation — 2026-10-03

- Readiness PR #633 merged as `2022b1c0f266f1ef1a7afff5b2d38121b6ee49f3`; non-draft implementation PR #634 is the sole S066 implementation lane.
- The current slice links technician-visible Project Job rows into `/field`, preserves explicit assigned-Job deep links, labels outside-today context, and keeps a directly opened authorized Job usable when the daily queue is degraded.
- No backend route, lifecycle, auth/RBAC/RLS, schema, financial handoff, offline/photo/issue/change/inventory/messaging/timekeeping capability is added.
- Exact-head Web/docs/governance checks passed after the latest code/test repair. Retained authenticated responsive/negative/failure/refresh evidence remains open. Do not mark S066 DONE from repository implementation alone.

## S052 certification implementation — 2026-10-03

- Readiness PR #636 merged as `ee714a38c52ef59ab97d1218d70bdab2af2ad35f`; draft PR #637 on `test/s052-customer-project-certification` is the sole active S052 certification lane.
- Classification: `NEW_WORK_REQUIRED` for certification tooling only; Customer/ServiceAddress/Project product implementation remains the merged PR #586/#629 contract.
- PR #637 now implements the bounded `s052` evidence harness: owner Customer create/update, ServiceAddress persistence, duplicate/required validation, Customer-linked Project persistence/reload; synthetic admin Customer→Project proof at 1440/768/390; inactive-membership denial; existing foreign Customer/Project tenant probes; exact-SHA correlation; and scenario-specific artifact validation.
- Continue on #637 with exact-head CI/review, then run S052 preflight and one full retained non-production evidence matrix when the required synthetic fixtures and matching deployment are available. Missing fixtures stay NOT READY; do not substitute founder credentials.
- Stop for founder review if passing evidence would require a new Customer merge policy, role/permission, auth/RBAC/RLS, schema/migration, domain model, production mutation, or real customer data.

## Next Eligible Sprint

Sprint ID: NONE
Eligibility: No numbered sprint is currently `READY`; S052 is `IN_REVIEW` in PR #637, S064/S066 remain `IN_REVIEW`, and S065 remains dependency-blocked by S064.
Dependencies: N/A while no sprint is eligible.
Overlap check: continue S052 only through PR #637; do not create another S052 certification branch or revive stale PR #565 / `feature/s052-customer-project-vertical-certification`. Existing S053/S059/Costbook lanes remain separate.
Startup prompt: Continue S052 through PR #637 by implementing the remaining bounded role/persistence/denial evidence and focused harness tests. Keep validation fail-closed and repair product code only if the evidence reproduces a current-main defect inside the authorized contract.
