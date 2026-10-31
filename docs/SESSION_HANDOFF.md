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

# Session Handoff

## Active bounded mission — Frozen Estimate Apply recovery, 2026-10-31

- Sprint ID: NONE; classification NEW_WORK_REQUIRED. Main `ed97db6b908f3113bd319eab7875e8003d3e3e43`, tree `48ab6d6ccd7a64f69f225515cc5d755ee42cde68`. Four open PRs (#837/#830/#810/#775) do not own this fix. The old named feature branch was absent. The older estimate-review recovery branch has identical Assist source and later Proposal-only recovery changes; current Assist history #569/#542 and merged #839 do not freeze Apply.
- Branch: `feat/figma-to-code-completion`, created from exact main after reconciliation. Local path `/workspace/scratch/5c7f3e9dcd3e/tradeos-apply-snapshot` is a fetched source snapshot, not an authenticated Git checkout; no local upstream/worktree or full-repository cleanliness result is invented. Publication uses the connected GitHub API and exact base tree.
- Scope: existing Assist client/page, bounded request-session helper/unit tests, responsive real-component browser cases and owned docs. Backend, schema, auth/RLS/RBAC, pricing/financial calculations, dependencies, secrets/environments, deployment and other active missions are excluded.
- Implemented on branch: one serialized request body; synchronous duplicate lock; review/generation lock during pending and unconfirmed Apply; explicit identical-body retry; saved-Items navigation; acknowledgement unlock; nonintrusive keyboard recovery focus; summary invalidation on suggestion edits; record-keyed remount and late callback suppression. No automatic retry, scope in URL/storage or invented status endpoint.
- Verified locally: 8 helper behavioral cases plus 15 existing Estimate mobile/source contracts passed (23 total). Four real-component browser cases at 390/768/1024/1440 cover pending/failed locked review, exact retry, acknowledgement, generation exclusion and obsolete-record response suppression; hosted runtime execution is pending. React hook/accessibility/serialization checklist reviewed. Full local web suite/lint/build cannot run without dependencies.
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

## Next Eligible Sprint

Sprint ID: S073
Eligibility: S073 is `READY`; S051 is `DONE`; founder authorization is explicit.
Dependencies: S051 — DONE through merged PR #538.
Overlap check: Recheck live PRs/branches before starting; this non-numbered repair does not advance S073 or authorize a second active sprint.
Startup prompt: Execute S073 from current main using `docs/architecture/S073_RELEASE_CRITICAL_RLS_COVERAGE_PLAN.md` after canonical startup/reconciliation; stop on protected policy gaps.
