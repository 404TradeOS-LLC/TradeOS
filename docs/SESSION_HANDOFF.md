---
status: current
owner: platform
last_verified: 2026-10-21
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/CURRENT_STATE.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
---

## PR #980 — PR Commander required-check success-only gate (in review)

- Founder-authorized CI hardening on existing TradeOS monorepo; `NEW_WORK_REQUIRED` after checking open PR overlap, base `e30b8d4a0cbff6530d8750de96d6b2053afa3ee0`, branch `fix/pr-commander-required-check-conclusions`.
- Root cause: `scripts/pr-commander-lib.mjs` classified required `SKIPPED` and `NEUTRAL` conclusions as green, permitting `MERGE_READY` without actual successful required validation.
- Verified RED: original regression-only head `f1aa52caf4dd65bd6f8a4c5a01c8925d6ff7b39f` failed hosted `npm run pr:test` at the new assertion (411 passing / 1 failing), proving a skipped required Web check incorrectly returned `MERGE_READY`.
- Fix: only `SUCCESS` is green; regression exercises every required check with `SKIPPED` and `NEUTRAL`. `docs/PR_COMMANDER.md` documents intentional stricter-than-GitHub fail-closed policy. No workflow permission, arming, branch-protection, deployment, secrets, schema, billing, auth or production change.
- GREEN verification was observed for the four required check names, including PostgreSQL integration, at head `8974c792e1a47079c6238cd5d2275ffe062996d5` before the handoff correction. The final merge still requires fresh exact-head check and review reconciliation; see PR #980 for live merge evidence. Continue the same PR and do not create a duplicate.

## Autonomous execution policy reconciliation — PR #979 (pending)

- Repository `404TradeOS-LLC/TradeOS`, base `main` at `99ccafcc347ef1902d5dbf6d56fc5bcc755688b0` when PR was opened; existing work: PR #979, branch `docs/autonomous-execution-default-20261113`. Do not make a duplicate PR. Classification: `EXISTING_WORK_FOUND`.
- Codex review identified real DOC_OWNERSHIP drift: AGENTS and NEXT_SPRINT_PROTOCOL changes require aligned Bible, Backlog, Engineering Command Center, Session Handoff and Repository Governance. These companion edits clarify consecutive independent missions, not bypass of gates or automatic runtime capability.
- Source-only documentation amendments; no CI, review approval, merge, staging deployment or production acceptance is implied. Recheck final PR head, docs consistency, required hosted CI and review threads before any merge; runtime PR Commander capabilities still require separate implementation and tests.

## GitHub issue queue — #927 existing PR #931

- User requested working through GitHub issues. PR #933 is merged as `b3a16b58`; 12 open issues and existing PRs were reconciled. EXISTING_WORK_FOUND for #927 in draft PR #931; use `/workspace/TradeOS-email`, branch `feat/resend-delivery-journal-927`, original head `e517a84376f2f4bf7eebb8319247e4881bdcb791`. Current main was merged normally to preserve the original lane, without force push.
- Reproduced out-of-order delivery-status regression in three actual PostgreSQL adapter tests: delivered was replaced by delayed sent/bounce callbacks, including concurrent timezone-offset events. Repair locks known-message rows, validates/normalizes occurrence dates, and prevents older known events from replacing current status. All events and suppression candidates are retained. No schema/RLS, pool, sender, credentials, webhook registration or deployment changes.
- Suspected shared-pool deadlock was not established on normal auth routes (delivery is scheduled after response), so no pool architecture change was made.
- Disposable PostgreSQL 16 container `tradeos-issue927-db`, loopback port 55433, hosts only synthetic test data. Tracked migrations and restricted app-role provisioning were rehearsed there; local psql compatibility wrapper is outside the repo. No staging/production database was touched.
- Verification: 332 backend suites / 3,054 unit tests / one snapshot; 26 PostgreSQL suites / 196 integration tests; 265 repository tests; 40 documentation tests; typecheck/lint and production build all passed. All 71 tracked migrations plus restricted-role provisioning succeeded on the disposable database. Catalog model/browse tests: 12 passed. #872 was reverified live and its title/status updated; four already-merged #518 checklist items were reconciled without closing either issue.
- #927 remains open until ingress integration, protected staging and signed end-to-end callback acceptance pass. #925/#759/#811 need environment evidence; #719/#735/#711 need provider/operator gates; #910 retains existing Forge lanes; #870 needs deployed logo acceptance; #518/#606 are multi-slice tracking issues. Do not close issues from merged-source claims alone.

## PR #933 auto-merge follow-through

User requested auto-merge. Existing checks were green, but a new unresolved validator thread showed fixture proof could be detached from the passing denial entry. Reproduced three failures, repaired same-probe PASS plus optional route/status consistency, and added matching/compact-report compatibility coverage. Continue this PR only; no product or deployment change. Enable normal GitHub auto-merge after publishing and resolving the verified repair; never bypass checks or merge a draft.

## PR #933 findings repair — current bounded mission

- EXISTING_WORK_FOUND: continue clean branch/worktree `feat/invited-beta-pdf-evidence` at `/workspace/TradeOS-beta`; original PR head `300b30bf831297b21845c717844ef19c3467c767`, main `376a089b57a21e9c39d3eb0172411f95b9ff7380`. Live PR identity and remote fetch verified. User explicitly requested fixing both reviewed findings.
- Foreign Proposal denial now requires dedicated synthetic owner/admin login, pinned distinct organization membership and exact owner-scoped Proposal reads before/after the smoke denial. No foreign session persistence or credential-bearing error output. Artifact validation requires fixture proof; workflow preflight/full checks and capture startup require the new foreign-owner inputs.
- Verification for the repair: 261 repository tests, 33 focused ownership/PDF/validator tests, 40 docs tests, 331 backend suites / 3,037 tests and one snapshot passed. Backend lint/typecheck/build, script syntax, documentation ownership and whitespace checks passed. Hosted exact-head checks remain pending after push.
- Runbook now explicitly requires retained passing PDF renderer tests on the exact release SHA. No product APIs, auth/RLS policy, schema, migrations, dependencies, production settings or deployments are changed.
- Added regressions for deleted/missing fixtures, expired owner session, wrong/same tenant, role denial, mismatched Proposal, readable PDF, redirect and deletion during probe; current full checks and publication are recorded in PR #933. Live protected staging execution remains blocked on provisioned dedicated synthetic foreign-owner inputs and a matching approved deployment, not claimed passed.

## Invited beta PDF evidence — local implementation, 2026-11-06

- Sprint ID: NONE; bounded slice of founder-approved beta implementation. Repository `/workspace/TradeOS`, clean base `376a089b57a21e9c39d3eb0172411f95b9ff7380`; linked worktree `/workspace/TradeOS-beta`, branch `feat/invited-beta-pdf-evidence`, inherited upstream `origin/main`. No other local worktrees or unexplained changes at startup.
- Classification: NEW_WORK_REQUIRED for the opt-in PDF-ending evidence scenario and cohort runbook. Live open PRs #931/#924/#923/#922/#921/#920/#918/#904/#775 and recent #929/#930 were reconciled; saved-line fixes are already landed, email/readiness/staging lanes remain separate. No branch was deleted or competing PR created.
- Implemented `beta_pdf` in existing workflow/runner/capture/isolation/validator: reuses S053 review/Apply/reload plus manual financial fixture through Proposal, authenticates PDF download, retains bytes/hash/Proposal/run receipt, checks Proposal reload, requires foreign Customer/Project/Estimate/Athena/PDF denials, stops before downstream mutations. Canonical/S052/S053 defaults remain. Existing S053 assertion-name mismatch is repaired.
- Added behavioral PDF transport tests, actual artifact-validator positive/negative fixtures, and execution of the workflow's preflight/full shell gates with synthetic environment values. No real browser/deployment PASS is claimed from these tests. New operator fixture: `BETA_RC_FOREIGN_PROPOSAL_ID` → runtime `BETA_FOREIGN_PROPOSAL_ID`.
- Allowed paths: existing Beta Evidence scripts/workflow, focused tests/root test registration and owner docs. No product schema, pricing, auth/RLS policy, secret, dependency, production or deployment changes. Code commit `db3cc95f26a20033fee2528cc00400a76fd6ce9f` is pushed in draft [PR #933](https://github.com/404TradeOS-LLC/TradeOS/pull/933), tracking `origin/feat/invited-beta-pdf-evidence`. No merge, deployment or hosted-CI pass is claimed.
- See [Invited beta operations](operations/INVITED_BETA.md) for cohort scope, remaining gates, onboarding, support and incident/recovery procedures. HOLD remains mandatory until actual environment/security/financial/recovery evidence passes.
- Verification: app unit tests 331 suites / 3,037 tests and one snapshot passed; app lint/typecheck and build passed; 248 repository tests, 40 documentation tests and final 69 focused evidence tests passed; docs ownership, connection matrix (10 journeys / 52 actions), script syntax and whitespace passed. Live PostgreSQL integration, authenticated staging/browser/PDF visual evidence and hosted exact-head CI remain unrun.
- Next safe actions: review draft PR #933 and its exact-head CI; retain HOLD until protected evidence and independent review pass; provision synthetic foreign Proposal fixture and exact-source isolated target through the existing protected operator workflow; run full `beta_pdf` plus S052 role evidence. Obtain staging reproduction IDs/inputs for the two documented pricing discrepancies before changing calculations. Implement the footing clarification contract in a separately bounded domain slice; do not simulate it or mark it complete here.

## Estimate authenticated saved-line acceptance — 2026-11-05

- Branch `feat/estimate-authenticated-reload-denial`, based on main `f3449d0c532da20532f0f779bc4898bc252c9482`. This bounded slice strengthens existing opt-in S053 Beta Evidence and source-contract tests; no auth, RLS, database, pricing, secret, or deployment changes.
- S053 captures the real Apply response and retained reviewed payload, verifies newly applied/idempotently identified lines against the authenticated organization-scoped Estimate read and visible “Saved line verification” rows, then hard-reloads the builder and checks exact same IDs, descriptions, persisted quantities and target relations.
- The existing tenant-isolation runner sends an authenticated GET for the configured foreign Estimate and requires 403/404; S053 continues to verify foreign Athena draft/apply denial. Regression tests pin the requirements.
- Not run against an approved non-production deployment: exact SHA correlation, dedicated synthetic identity/tenant fixtures and operator-dispatched full evidence remain required. Do not mark acceptance passed until retained artifacts report PASS.
- Next five after this gate: run S053 in approved non-production; persist/restore footing clarification answer; reconcile the $1,670 deck discrepancy; establish Estimate $2.10→Proposal $42,680 snapshot continuity; prove deployed saved-line acceptance on exact deployment SHA.


# Session Handoff

## Active bounded mission — Estimate Apply saved-line identity, 2026-11-04

- Sprint ID: NONE; classification `NEW_WORK_REQUIRED`. Repository `404TradeOS-LLC/TradeOS`; rebased exact base `b4c50d0d19cc83425f66c4eb2035a359e9bcf7fc`, tree `425ad2f0d5d9bd5cac7b5f03831252bb6a2e1004`. Open PRs #924/#923/#922/#921/#920/#918/#917/#904/#775 do not overlap the Estimate Apply client/backend contract. The named branch still pointed at its earlier base and is advanced only through an expected-head compare-and-swap after this reconciliation.
- Branch: `feat/figma-to-code-completion`. Publication uses exact GitHub base-tree commits. Allowed scope: structured Apply acknowledgement, authorized saved-line verification, focused tests, existing acknowledged Figma result states and owned docs. Excluded: schema/migration, auth/RLS permission changes, pricing calculations, dependencies, secrets/environments and deployment.
- Implemented in the rebased candidate: idempotent source-key and exact-line skips return their existing `lineItemId`; the client reads the authorized Estimate after POST acknowledgement and verifies saved ID, target, quantity and normalized description against the frozen request. Read failure or mismatch remains conservative/unconfirmed. Rejected/unresolved skips stay review-only. No automatic retry or new endpoint.
- Figma: existing result roots 390 `1064:28688`, 768 `1064:28782`, 1024 `1073:29301`, 1440 `1065:28715` distinguish Saved & verified identity from unverified pricing evidence. Four renders were inspected; Inter/Space Grotesk, existing StatusBadge/PricingProvenance instances, zero UI rasters and the same Items actions are retained.
- Focused evidence from the unchanged candidate sources: 15 pure TypeScript cases passed (11 request-session plus 4 saved-line reconciliation). Full app/web tests, lint/build, responsive production-component cases, exact-head CI, review and merge remain gates.
- Next five: publish and verify this exact-head slice; complete authenticated full-review reload and tenant/record denial; resolve structured footing-answer persistence; reconcile the deck $1,670 discrepancy; establish Estimate-to-Proposal financial snapshot continuity.

## Accepted-proposal handoff #810 — branch reconciliation, 2026-11-02

- The feature is open for review but not release-certified. Three CodeRabbit findings were repaired; GitHub reports zero unresolved review threads. New-head hosted CI and current-main currency require verification.
- Staging's accepted-proposal migration was previously applied exactly once; the staging backend feature came via merged PR #837. New staged web source is prepared in draft PR #904; it has not been merged or accepted.
- Run 41106407474 succeeded for protected, secret-safe binding isolation. It does not substitute for authenticated tenant or service-key provenance evidence.
- The separate Job Expenses migration remains missing from staging's applied 67 of 68 source inventory. Do not repeat the handoff migration to repair that difference.
- Next: reconcile exact-head checks, separately reviewed staging inventory parity, coherent staging web/API deployment, authenticated Step 9 tenant/concurrency/rollback and four-width evidence, then final release review. No production action.


## Active bounded mission — Frozen Estimate Apply recovery, 2026-10-31

- Sprint ID: NONE; classification NEW_WORK_REQUIRED. Main `ed97db6b908f3113bd319eab7875e8003d3e3e43`, tree `48ab6d6ccd7a64f69f225515cc5d755ee42cde68`. Four open PRs (#837/#830/#810/#775) do not own this fix. The old named feature branch was absent. The older estimate-review recovery branch has identical Assist source and later Proposal-only recovery changes; current Assist history #569/#542 and merged #839 do not freeze Apply.
- Branch: `feat/figma-to-code-completion`, created from exact main after reconciliation. Local path `/workspace/scratch/5c7f3e9dcd3e/tradeos-apply-snapshot` is a fetched source snapshot, not an authenticated Git checkout; no local upstream/worktree or full-repository cleanliness result is invented. Publication uses the connected GitHub API and exact base tree.
- Scope: existing Assist client/page, bounded request-session helper/unit tests, responsive real-component browser cases and owned docs. Backend, schema, auth/RLS/RBAC, pricing/financial calculations, dependencies, secrets/environments, deployment and other active missions are excluded.
- Implemented on branch: one serialized request body; synchronous duplicate lock; review/generation lock during pending and unconfirmed Apply; explicit identical-body retry; saved-Items navigation; acknowledgement unlock; nonintrusive keyboard recovery focus; summary invalidation on suggestion edits; record-keyed remount and late callback suppression. No automatic retry, scope in URL/storage or invented status endpoint.
- Verified locally: 11 helper behavioral cases plus 15 existing Estimate mobile/source contracts passed (26 total). Four real-component browser cases at 390/768/1024/1440 cover pending/failed locked review, exact retry, acknowledgement, generation exclusion and obsolete-record response suppression; all passed at code head `3f570e7` in [Verify repository 41234398010](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/41234398010), along with 569 web tests, 55 browser/component cases, 189 PostgreSQL integration tests and lint/build/type checking. Four unconfirmed-state screenshots were inspected (artifact 13054428374, expires November 7). React hook/accessibility/serialization checklist reviewed. Full local web suite/lint/build cannot run without dependencies.
- Review follow-through: reproduced definitive 400 rejection locking with a failing test, then distinguished first-attempt known refusals (400/403/404/409) from unknown/transient responses. A prior unconfirmed response remains retained even after a later refusal; no blanket 4xx inference or permission change. Expanded browser cases verify unlocked correction and a newly serialized corrected payload. The owning Assist module holds the contract; estimating/current-state docs link to it.
- Figma's eight existing recovery/result layouts and twenty selected connections were inspected in the prior design pass. These are design/prototype evidence, not authenticated or persisted-line proof. This implementation does not certify the whole Estimate workflow.
- Next five: finish exact-head CI/browser cases and scoped review repairs; prove acknowledged saved-line identity and safe recovery; verify authenticated reload and tenant/record denial; resolve footing-answer persistence; reconcile deck and Estimate→Proposal financial snapshots.


## Active bounded mission — Estimate full-review scope continuity, 2026-10-31

- Sprint ID: NONE. `NEW_WORK_REQUIRED` after inspecting main `6a19766f3865262c37ddc37c7f8794363d45e3f0`, four open PRs (#837/#830/#810/#775), relevant branches and prior #751/#569/#542. None owns the current scope handoff defect; the historical `feat/figma-to-code-completion` branch is absent.
- Repository: `404TradeOS-LLC/TradeOS`; exact fetched source snapshot `/workspace/scratch/5c7f3e9dcd3e/tradeos-review-snapshot`, no authenticated local Git checkout/upstream/worktree. The connected GitHub API is the publication path. No local full-repository status or test result is invented.
- Branch: `feat/figma-to-code-completion`, based on that exact main. Scope is builder/contextual navigation, authorized full-review saved-scope loading, bounded helper/tests and owned docs. Backend, schema/migration, auth/RLS policy, financial calculations, secrets/environments and production operations are excluded.
- Implemented: await existing Project scope-save acknowledgement before both review entries; retain scope on failure, block duplicate entry and late navigation; load saved scope only for the authorized Project/Estimate pair; keep initial suggestions and structured draft empty. Key builder state by record IDs. No URL/local-storage scope transfer or automatic generation.
- Validation: 9 behavioral tests plus 15 existing Estimate mobile/source contracts passed (24 total) under Node 24.22.1. React hook/disabled-state/serialization review completed. Full repository web suite, lint, TypeScript/build and browser/authenticated evidence cannot execute from this dependency-free snapshot and remain hosted exact-head gates. Do not mark this flow Ready for Dev or production-ready from these tests.
- Initial head 73702f3 passed hosted web lint/build, 561 web tests, 47 existing component cases, docs and 189 PostgreSQL integration tests. Code head `6c8056e` passed [Verify repository 41218673255](https://github.com/404TradeOS-LLC/TradeOS/actions/runs/41218673255): 561 web tests, 51 component cases, web lint/build/type checking and 189 PostgreSQL integration tests. Four new real-Builder cases exercise both entry controls, acknowledgement/failure/retry and obsolete-record suppression at 390/768/1024/1440; their retained failure screenshots were inspected. The unused fixture variable reported by code-quality review was removed and that thread resolved. Final-head checks remain a merge gate; CodeRabbit is temporarily rate-limited, not an approval.
- Figma full-review entry/generation/failure targets and 40 matching-width links are inspected; the live implementation gap remains open until the PR is reviewed, merged and browser-verified. Existing scope/freshness, saved-line identity and financial continuity gates remain separate.
- Next five: verify final-head checks/review and normal merge gates; prove authenticated full-review reload and Project/Estimate mismatch denial; verify acknowledged Add/Apply saved-line identity and retry; specify remaining structured footing-answer persistence without inventing a contract; reconcile deck and Proposal financial fixtures before certification.


## Proposed protected staging Job migration runner — 2026-10-30

- `NEW_WORK_REQUIRED` for infrastructure only; feature implementation remains
  `EXISTING_WORK_FOUND` in #810. No open/recent PR implements a trusted-main,
  checksum-pinned feature SQL apply path. Branch `fix/staging-job-handoff-migration`
  starts at main `d1d64137c2912225b8f42ae1895c5786a20643b9` in isolated worktree
  `/workspace/scratch/332cdaafbc27/TradeOS-job-migration`. Sprint ID NONE.
- Allowed: new manual staging workflow/runner/tests, root test registration,
  workflow owner docs. Forbidden: feature schema/API/web files, production
  workflow, protected settings/secrets, live apply. This PR does not supersede
  #810 or #833 and carries no feature migration file.
- Fresh live read-only evidence: all 66 staging names/checksums match main;
  only the Job handoff would be pending. Both Job RLS flags are true.
- Validation: 181 governance tests, 40 documentation tests, ownership, Node
  syntax, actionlint 1.7.7 and whitespace passed. Live evidence passed the full
  66-name/checksum comparison. Isolated PGlite SQL rehearsal passed; full
  hosted Prisma execution and Ruby workflow policy remain unverified locally.
- Next five: review infrastructure exact-head CI; merge only with migration
  authority/review satisfied; run protected preflight at the reviewed source
  SHA; approve and execute staging apply with verified postflight; deploy
  matching API/web and capture #810 authenticated acceptance.

## Estimate quick-create partial-failure recovery — 2026-10-29

- `NEW_WORK_REQUIRED` for the existing `/projects/new?intent=estimate` action;
  the closed, unmerged #731 addresses a distinct onboarding quick-start route.
  Branch `fix/estimate-create-saved-project-recovery` starts at main
  `1829a64b1ee10b037f0446ab325979d2d5c9a27a`.
- A failed or ambiguous Estimate POST after Project creation now sends the user
  to the saved Project with a notice to inspect its Estimates, instead of
  leaving the original form ready to create another Project on retry. No API,
  auth, schema, RLS, pricing, or financial behavior is changed.
- Local checks: Web 548/548, lint, TypeScript and production build pass;
  documentation 40/40, PR governance 168/168, docs ownership and whitespace
  pass. Exact-head hosted CI and review remain required. Authenticated
  nonproduction recovery and delayed-commit evidence remain separate gates.
- Next five: publish the bounded PR; verify exact-head hosted checks; resolve
  review findings; verify authenticated saved-Project recovery and ambiguous
  Estimate response; merge only when normal gates pass.

## Active bounded mission — cinematic entry implementation, 2026-10-24

- `NEW_WORK_REQUIRED`, Sprint ID: NONE. Founder approved the cinematic Sites
  entry and directed product implementation. Branch `feat/cinematic-entry`,
  isolated worktree `/workspace/scratch/fb80abefb51d/tradeos-cinematic`, from
  main `7013cdcaab8faabcb9c0dd8e7a045ac776c9c748`. No existing open PR implements
  the entry; #787 is a separate Costbook controls lane and was left untouched.
- Allowed scope: `/login` presentation, scoped entry components, official
  vectors/fonts, renderer dependencies, entry tests and owner documentation.
  Existing auth/session/bootstrap, routes, backend, database/RLS and workspace
  themes remain unchanged. Approved design provenance is in `.stitch/DESIGN.md`.
- Implemented: silent mark-first copper scene, four/2.5-second timing,
  reduced-motion bypass, skip/focus/cleanup, GPU fallback, centered real sign-in,
  curated greetings, client validation and failure/pending retention. The
  Sites prototype's simulated auth and inspection affordances are excluded.
- Verified locally: 513 frontend tests, lint, TypeScript, production build,
  zero production audit vulnerabilities. Browser harness uses the production
  component with synthetic transport; it proves presentation/interactions only.
  Local component Playwright execution is blocked at launch by missing Chromium
  after the official CDN returned an invalid archive. No live successful auth,
  deployed Lighthouse score or real-GPU visual certification is claimed.
- Merge/deployment remain subject to exact-head hosted checks and repository
  review policy. Rollback: revert this bounded PR; no data migration exists.
- Next five: publish the bounded PR; inspect hosted browser and required checks;
  resolve scoped review findings; verify live staging auth and GPU/Lighthouse;
  merge through protection and verify the deployed entry with the approved design.


## ABC SKU → Material activation batch proposal (2026-10-23)

- `NEW_WORK_REQUIRED` after autonomy reconciliation, Sprint ID: NONE. PR #701
  shipped the single-item operator activation gate and PR #705 the link-only
  backfill, but no full-catalog mapping proposal existed. This branch adds a
  REVIEW-ONLY batch mapping all 584 seeded ABC Supply products to candidate
  canonical Costbook materials; nothing activates, no database rows change,
  and no live ABC pricing ran.
- Batch: `app/modules/costbook/abcSkuMaterialActivationBatch.ts` (generated by
  `app/scripts/generate-abc-activation-batch.ts`), summary in
  `docs/research/abc-sku-material-activation-batch.md`. Counts: PROPOSED 157,
  REVIEW 407, UNMAPPED 20; unit verdicts (PR #708) COMPATIBLE 0 / CONFLICT 128
  / UNKNOWN 456 — workbook units are never provider-verified, so every
  activation still needs the provider stocking-unit check at the gate. 398 of
  584 rows carry no SKU in the source and cannot activate until SKUs are
  confirmed from the ABC catalog.
- Next: operator reviews the batch; activation decisions stay with the
  operator through the single-item gate. Do not merge without the founder's
  explicit word.
## Today 2.0 dependency audit continuation — 2026-10-27

- `EXISTING_WORK_FOUND`, Sprint ID NONE. Preserve Today PR #798 at `d431ac5`; its final 26 Chromium cases passed in hosted run 40430809189, alongside 525 Web, 2873 API and 174 real PostgreSQL tests. Its backend build/audit fails on existing vulnerable dependencies.
- Extend existing runtime PR #795 in `/workspace/scratch/4360a72ccbf4/TradeOS-api-runtime-security`; reconcile main `93d1fff`. Preserve #799's exact body-parser patch and close it as superseded only after the consolidated repair merges. Leave independent moderate ip-address work to #786.
- Patch Zod directly and transitively to 4.6.7, preserve legacy identifier syntax with GUID validators, migrate one-argument records and typed enum pipelines. No role, tenant, RLS, schema, financial or production environment change. Major-upgrade review remains governed by AGENTS.md; no independent approval is claimed.
- Local focused 72/72 and high-severity audit pass; full exact-head source and hosted PostgreSQL evidence must be recorded in the runtime upgrade document/PR.
- Next five: finish full compatibility checks; publish/review #795 on the existing branch; clear dependency audit through normal required gates; reconcile/retest #798 on the landed security baseline; resume authenticated/field/domain/Athena acceptance without retrying the declined sign-in automatically.


## Costbook picker ergonomics and browser recovery — 2026-10-23

- Sprint ID: NONE; founder-authorized Figma-to-code continuation.
  `NEW_WORK_REQUIRED`: main `e17a166d` includes #773/#774/#785, but only
  Custom Item sizing shipped in #785. The open queue and remote branches do
  not implement catalog-picker target sizing. The historical Figma branch
  was absent; use `feat/figma-to-code-completion` from current main.
- Scope: catalog Search/Section/Quantity 44px below 1024, 32px above; Add,
  Clear, Select and Taxable targets 44px. No payload, pricing, auth/RLS,
  defaults, query, mapping or persistence behavior changes.
- Added four actual-production-component cases with synthetic transport.
  Local Chromium 153 was recovered from an npm-packaged binary after the
  Playwright CDN returned invalid archives. All twelve component cases pass
  across 390/768/1024/1440; Web 507/507, lint, TypeScript and build pass.
  Local browser evidence does not replace required hosted current-head CI.
- Staging runtime certification remains separate: the latest inspected READY
  web/API pair was different older SHAs. No new real-login, tenant-isolation,
  Add persistence or reload claim. Fixture credentials remain in governed
  workflow secrets; no secret is exposed or browser auth bypass introduced.
- Next five: publish this scoped PR; verify twelve hosted browser cases;
  reconcile starter recipe selection in Figma; align staging through the
  existing governed process; execute real-login tenant/Add/reload evidence.


## Today 2.0 active implementation — 2026-10-26

- Sprint ID: NONE; `NEW_WORK_REQUIRED` for founder-supplied Today 2.0 brief. Repository `404TradeOS-LLC/TradeOS`, isolated branch `feat/today-2-command-center`, base `e17a166` (merged #774). Historical Today #585/#643 are already on main; no open Today implementation PR or remote branch overlapped. #793 entry work is separate and preserved.
- Implemented authenticated Today/Needs You/Work data contract, operational UI, contextual source navigation, Athena reuse, two themes, Today timeline, upcoming work and persistent dock/Task creation. New interfaces and supported/unsupported boundaries are recorded in `architecture/TODAY_2_IMPLEMENTATION.md`.
- Preserve JWT, membership and forced RLS; no policy/schema/financial mutation changes. Field ProjectTask assignment/write is unsupported, so field views do not read organization task or commercial queues.
- Continuation: current repo `/workspace/scratch/4360a72ccbf4/TradeOS-resume` tracks the existing PR #798. `EXISTING_WORK_FOUND` confirmed against live PR and fetched main `f5fac882`. Prior head `fdcc63cc` passed hosted verification run 40427077847 including 20 Chromium component tests and PostgreSQL/migration rehearsal. All six original review threads were resolved.
- The real Vercel Preview at https://tradeos-costbook-9vrksg8yo-billykshowalters.vercel.app/login is READY for `fdcc63cc`; dashboard redirects to login. Secure sign-in was declined. Do not retry sign-in without a new user request; live authenticated role journeys remain unverified.
- New continuation adds permission-aware task status editing using the existing authenticated PATCH/audit path. Success requires confirmed source identity/status, then server refresh; errors/offline preserve the queue and pending saves prevent duplicate submission/dismissal. A backward-compatible backend revision precondition now makes Today task saves atomic against concurrent edits; legacy callers may omit it. New real PostgreSQL concurrent-save and tenant/read-only regressions require hosted verification. Fresh verification is recorded in `architecture/TODAY_2_IMPLEMENTATION.md` and the PR.
- Next five: verify the new contextual task save in a permitted authenticated session; implement a reviewed field assignment/write contract; add genuine visit/crew/milestone source capabilities; connect Athena permitted execution and confirmation recovery; complete all acceptance/review gates before marking ready or merging. Keep PR draft while these gaps remain.
- Earlier Costbook handoffs below are retained historical context; #773 and #774 are now merged in the captured base.

## Openings/appliance retarget and validation — PR #774 (2026-10-23)

- `EXISTING_WORK_FOUND`, Sprint ID: NONE. Existing branch
  `feat/costbook-openings-appliance-gaps-20261018` retained; original head
  `45278dcf`. Parent #773 is verified merged as `ef983efc`, with a landed tree
  identical to reviewed head `97709786`. Retarget #774 to main and reconcile
  the squash-merge ancestry without duplicating the parent's kitchen recipes.
- Preserve main's Estimate Builder changes, Figma checkpoint, dependencies and
  all three research scopes. Catalog total: 107. No schema, auth/RLS, financial
  policy, supplier pricing or Estimate snapshot change. Keep qualified
  installation, product-specific instructions and native EA mapping explicit.
- The JELD-WEN JII001 source repair is retained. Hono 4.13.13 is already on
  main through merged #783; the retargeted diff must contain no lockfile change.
- Fresh focused API/type/build/docs validation and hosted exact-head checks
  are required after reconciliation. No staging, browser or production
  certification is claimed; this task leaves #774 open after revalidation.
- Next five: validate the reconciled tree; publish to the existing branch;
  reconcile source/lockfile review findings; verify fresh required checks;
  record remaining review/certification limits for a separate merge decision.

## Retained parent review checkpoint

The following #773 checkpoint predates its verified merge as `ef983efc`;
its pending-merge instructions are historical. The retained Figma/runtime
certification boundaries remain in force.

## Costbook kitchen recipe reconciliation — PR #773 (2026-10-23)

- `EXISTING_WORK_FOUND`, Sprint ID: NONE. Continue
  `feat/costbook-kitchen-assembly-gaps-20261018`; original head `955492cb`.
  Reconcile with main `762bb992`, retaining its Estimate Builder implementation
  and the Figma handoff below. No new feature branch or numbered sprint.
- Preserve two price-neutral research scopes (wall cabinet EA, straight-run
  laminate LF), registered sources and tenant-owned exact-unit mapping.
  Catalog total: 104. No schema, authorization, RLS, financial policy or
  Estimate snapshot change; rollback is revert of the additive PR.
- The original head passed all four required checks, including live PostgreSQL
  integration/migration rehearsal. All three earlier inline findings are fixed
  and resolved. The reconciled head still requires fresh required CI and
  reviewed-head evidence before merge; authenticated mapping/install remains
  a separate nonproduction certification gate.
- Next five: validate the reconciled tree; publish on the existing branch;
  reconcile the stale review; verify exact-head checks and protected merge;
  verify landed main before retargeting and revalidating stacked PR #774.

## Retained Figma handoff checkpoint

The following checkpoint is preserved from main. PR #785 subsequently merged
as `762bb992`; its earlier pending-review text is historical. Its runtime and
certification limitations remain in force.

## Active bounded mission — Custom Item control ergonomics

Sprint ID: NONE. Founder-authorized Figma-to-code continuation, not a new
numbered sprint or release-certification claim.

- Classification: `NEW_WORK_REQUIRED` for scoped sizing/alignment only.
  Main `218639bc8d2ff2aa95d586e7dc072355bdf8e69e` includes prior progressive
  entry, explicit cost, preview retry and mapping keyboard repairs. Open PRs
  #782/#778/#775/#774/#773/#772/#744/#702 do not implement this repair.
- Branch: `fix/estimate-custom-controls`, isolated worktree from current main.
  The old `feat/figma-to-code-completion` lane is retained with its separate
  history; PR #781 already merged its preview-retry implementation.
- Changes: only Custom Item phone/tablet text-input sizing, Add/select and
  Taxable label targets, label spacing and desktop control alignment. Shared
  primitives, DOM order, mutation payloads, validation, defaults, and
  pending/failure/success behavior are preserved.
- Figma: authoritative handoff `793:11017` in master
  `xImUa9CYUjx3Cb3zTrkfnY`; sixteen initial/pending/failure/invalid specimens
  at 390/768/1024/1440 exist. These are design targets, not full-app runtime
  certification. The entire illustrated shell is outside this code slice.
- Verification: Web 507/507, lint, TypeScript and production build passed;
  documentation ownership and 40/40 documentation tests passed. Hosted run
  39713763198 at head 0da62c1 passed all eight Chromium component cases
  (Custom Item and mapping at all four widths). All four synthetic failure
  screenshots were downloaded and inspected. Artifact 12398047963 has SHA-256
  c7331692622edd8d51b573231b67662b679bdc67149e9503c0246a51909efdcf.
  This verifies isolated components with controlled transport, not authenticated
  persistence, tenant boundaries, the full shell, or deployed runtime.
- Current-head review identified a Web scope-filter gap. The repair includes
  component tests/config, root runner manifests and the workflow in Web scope.
  A real temporary-Git regression fails before the repair and passes after it.
  Current-head CI/review for this follow-up remains pending; do not merge
  based only on the prior green head. PR #785 is ready for review, not merged.
- The local autonomy helper could not query PRs because `gh` is absent;
  authenticated GitHub connector reads supplied current open/recently-closed
  PR reconciliation instead. No repository guard was weakened.

## Next five bounded TODOs

1. Complete exact-head CI and review for the scope-filter repair; retain the
   passing component evidence and inspect any new findings.
2. Merge this repair only
   when every applicable gate passes, then verify landed main content.
3. Reconcile Costbook search/result/cost-review Figma states and canonical entry.
4. Reconcile Add assembly picker entry and canonical pricing labels/totals.
5. Verify an isolated nonproduction target and sanitized fixtures for the
   authenticated Install → Add → reload/failure-recovery evidence lane.

## Standing boundaries

Existing S052/S053/S064/S066 and Assembly Catalog browser certification gates
remain open until their retained authenticated evidence passes. Production
readiness is separate from implementation. Preserve existing auth/RBAC,
forced RLS, Estimate snapshots and financial accuracy. Production credentials,
protected migrations, supplier activation and ABC API licensing remain governed
by their dedicated runbooks; this mission authorizes none of those operations.

## Active continuation — shared assigned-job tasks (2026-10-27)

Branch `feat/field-assigned-job-tasks` is isolated from active Today PR #798
(head `23a9cd1d2ba85378b9b1838cb2ca8ed76a7a9fc8`). Reconciliation classification:
`NEW_WORK_REQUIRED`: PR #702 covers denial tests/capture proposals, not this
read-only task aggregation; #798 did not provide field task reads. Scope is
project-task service/controller/routes, API client/Today/Field UI, regression
tests and owning docs. Schema, RLS, commercial mutations and personal field-task
write grants are excluded.

The shared-job task projection and field source display are implemented. Local
API/controller tests: 14 passed; web tests: 528 passed; API type check passed.
Local live integration is blocked because `docker` is not installed. Added
real PostgreSQL assignment/tenant/removed/declined coverage must pass hosted CI.
Browser fixture records are explicitly synthetic. Authenticated deployed testing
remains unverified; do not retry the previously declined browser sign-in.

Complete local checks on this continuation: 2,884 API tests across 317 suites,
528 web tests, API type/build, web lint/build, 159 governance tests, docs
ownership/preflight and whitespace passed. Local Chromium could not launch
because its executable was absent; installation returned a truncated ZIP.
Hosted CI must verify the 31 component cases (including shared field task
context at 390px) and the new live PostgreSQL test. These are not local passes.

## Today review follow-through — 2026-10-27

`EXISTING_WORK_FOUND`: extend #800 on `feat/field-assigned-job-tasks`; parent
#798 remains draft at `23a9cd1d`. Review identified missing destination-page
coverage. Added actual async FieldPage rendering tests for populated task
information, empty tasks, unavailable tasks, safe text, stored due dates and
continued job usability. No runtime or permission change. Prior final head
`c8e58147` passed 2,884 API, 175 PostgreSQL, 528 web and 32 Chromium cases.
New web test/lint/build and exact-head hosted verification precede integration.

## Remaining Today contracts — 2026-10-27

`EXISTING_WORK_FOUND`: extend draft Today #798 after child #800 merged at
`c7c7c19b` (tree verified equal to reviewed child). Proposal:
`architecture/TODAY_FIELD_SCHEDULING_CONTRACTS.md`. It concretely defines the
recommended personal task identity/status-only write boundary, RLS/column
invariants, rollout and live test gates; and real Crew/Visit/Milestone/Blocker
sources reusing Dispatch. These are proposed, not implemented or approved.
New schema/authorization/RLS remains PR-only/human-decision work under AGENTS.

Runtime repair proceeds independently in #801: optional keyed receipt for
existing low-risk follow-up creation; no new mutation authority or risk change.
Deployment inspection found latest staging attempts cancelled at `959e3ef4`;
Vercel environment metadata returned 403, and CLI fallback was not installed.
No staging isolation or authenticated live journey is certified. Production
and the previously declined user sign-in were left untouched.

## Athena routine recovery repair — 2026-10-27

`NEW_WORK_REQUIRED`: open-PR search found no keyed follow-up retry repair.
Branch `fix/athena-follow-up-retries`, isolated worktree
`/workspace/scratch/4360a72ccbf4/TradeOS-athena-recovery`, starts at main
`9bd9a761`. Bounded scope: existing follow-up tool metadata, action-dispatch
regressions and owner docs. No schema, permission, approval, RLS, financial,
production environment or generic engine behavior changes.

Two regression cases initially failed: same-key replay created another task,
and changed input with a reused key executed. Optional engine receipts repair
both; 57 focused tool/action tests pass. Legacy unkeyed calls, independent
tenant keys and technician denial are covered. Complete API/Athena/hosted RLS
verification is required before merge. Today #800 is merged into parent #798
as `c7c7c19b`; it is not on main or deployed.


## Today integration verification — 2026-10-27

Shared-task #800 merged into Today at `c7c7c19b` after review coverage repair:
530 web tests and 32 browser cases plus 2,884 API and 175 PostgreSQL tests
passed on reviewed child head `5c2d8c7e`. Main #801 merged as `900d31e7`;
its tree was verified equal to reviewed head `d476b8e9` after 2,873 API and
174 PostgreSQL tests, 420 Athena contracts and four smoke tests passed.
Integrate that unchanged low-risk routine recovery into Today, preserving both
documentation additions. Final combined CI must pass before review/merge.

Remaining contract proposal is not activation approval: explicit personal task
identity/status-only writes and real scheduling sources still require their
schema/RLS/domain decisions and implementations. No production migration,
credential change, permission expansion or customer communication occurred.
Vercel's latest READY staging API is `cf91d93f` and web is `c05c20d1`;
newer attempts at `959e3ef4` are cancelled. Environment metadata is forbidden
(403); unavailable CLI cannot restore access. These older mismatched runtimes
cannot certify current Today. Do not retry declined user sign-in automatically.

## Field task implementation — 2026-10-27

`NEW_WORK_REQUIRED` for the personal identity/write slice absent from #798.
Branch `feat/field-task-ownership` starts at Today head `3eaa932f`. The founder
explicitly requested implementation, not another plan. Scope: nullable task
identity, narrow guarded field status route/service/RLS, office assignment
controls, shared status editor, actual-role capability flags and regressions.
No production migration/activation or financial mutation is authorized here.

Implementation is present end to end. Focused tests initially pass; required
full and hosted live PostgreSQL/browser verification is pending. Read-only
boundary review caught and repaired historical-assignee office regression and
undefined-identity UI matching; added a real two-session revocation-lock test.
The existing SQL helper includes technicians, so the migration explicitly
excludes them from the old broad task policy before adding the narrow one.
Legacy estimator identity administration is not widened; regular task status
updates remain supported. Schema/RLS changes retain PR-only merge posture.

## Staging blockers — bounded issue #759 repair, 2026-11-12

- Classification NEW_WORK_REQUIRED after current open/closed PR and branch
  reconciliation; #958/#959 are merged and no existing PR owns a web runtime
  identity endpoint. Base `080ac08d6dd8623b59e2b7496794c761d3034a1f`; isolated
  worktree `/workspace/TradeOS-staging-identity`, branch `fix/staging-runtime-attestation-759`.
- Implemented: staging-only, no-store, secret-free public binding/commit evidence
  endpoint, fail-closed tests and protected rollout runbook. No auth, RLS, schema,
  credential or protected workflow changes. Authorized staging-only Edge repair
  deployed reviewed Team & Time source as ACTIVE v7; re-fetched source matches,
  JWT verification stays enabled and unauthenticated bootstrap returns 401.
- Prior verified evidence on this base: 46 expense tests, 753 web tests,
  196 restricted-role PostgreSQL integration tests, all 71 local migrations,
  396 repository tests; live staging has matching applied inventory and forced RLS.
- Current candidate validation: 758 web tests, lint/build, 396 repository tests,
  40 docs tests and ownership checks pass. Built Next HTTP probes verify staging
  200 with expected public bindings/no-store and production 404. Focused tests
  cover malformed/foreign destinations, environment gates and credential redaction.
- Remaining gates: hosted checks/review, approved API/web source
  promotion, authenticated Team & Time permission acceptance,
  secret provenance and synthetic authenticated four-width acceptance.
- Next: publish and verify this PR; review the exact staging promotion; resolve
  effective runtime identity; deploy approved Edge source; run canonical acceptance.

## Active bounded repair — verified synthetic smoke fixture, 2026-11-12

- Base `8781db8a`; isolated branch `fix/beta-verified-test-fixture-759` and worktree
  `/workspace/TradeOS-beta-fixture`; NEW_WORK_REQUIRED after open-PR reconciliation.
- Source parity/metadata blockers repaired in #971/#973, Team & Time v7 deployed
  and source-verified. Run `43130359603` failed only at the expected-tenant check
  after login, before workflow capture.
- Proposed explicit `use_test_org` selection reuses existing encrypted TEST_STAGING
  credentials and verified active owner fixture `d86d0874-6ba3-4b06-94b6-bd0ae99fe532`.
  Configuration guard requires exact staging/UUID/label; actual API assertion is
  unchanged. No credential, account, membership, auth/RLS or migration changes.
- Next: test/publish, inspect hosted review, promote reviewed workflow source into
  staging, rerun correlated canonical evidence, retain actual results.

## Next Eligible Sprint

Sprint ID: S073
Eligibility: S073 is `READY`; S051 is `DONE`; founder authorization is explicit.
Dependencies: S051 — DONE through merged PR #538.
Overlap check: Recheck live PRs/branches before starting; this non-numbered repair does not advance S073 or authorize a second active sprint.
Startup prompt: Execute S073 from current main using `docs/architecture/S073_RELEASE_CRITICAL_RLS_COVERAGE_PLAN.md` after canonical startup/reconciliation; stop on protected policy gaps.
