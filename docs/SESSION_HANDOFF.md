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

# TradeOS Session Handoff

## Costbook preview policy — PR #775 blocked on isolation verification

The proposed web-only `feat/costbook-*` deployment allowlist is prepared for review; backend branches stay restricted. Do not merge or enable it until effective Preview Supabase and backend bindings are independently verified as staging-only. The connected Vercel account can read the project but its environment-metadata request returned HTTP 403; the CLI has no existing credentials. Historical staging claims are not current binding evidence. No deployment or environment value was changed.

## Costbook Add states and accessibility review continuation

- `EXISTING_WORK_FOUND`: continued PR #781 on `feat/figma-to-code-completion`, published parent `89619293`, current main `15d7e0c7`. No new implementation branch or numbered sprint was created.
- Added 768/1024 mapping sets, four reviewer-only navigators, and install-pending/current-cost outcomes in the existing Figma Estimates page. The newest twelve Add pending/failed/confirmed specimens cover 390/768/1024/1440. Add failure retains selection and quantity; confirmed success clears the picker, restores search focus, resets quantity/section/cost type/taxability using the existing handler, and refreshes the estimate. Amounts are explicitly illustrative fixtures and must use persisted response values in production. Full runtime certification remains outstanding.
- PR #781 is approved and non-draft. A normal merge attempt was blocked by two new review conversations: mobile retry target size and screen-reader progress. Both were validated and repaired locally: 44px mobile minimum, compact desktop sizing, dynamic accessible name, and persistent polite status. Fresh Web 507/507, full lint, production build including TypeScript, docs check/tests 40/40, PR preflight, and diff whitespace checks pass. Publication and hosted verification of this repair follow. Do not claim merge or deployment.
- Next five: (1) publish and verify the accessibility repair; (2) resolve its reviewed conversations and complete the protected merge when permitted; (3) visually verify all 60 state/viewport combinations and touch/focus specifications; (4) capture sanitized authenticated Add persistence/recovery and snapshot evidence; (5) reassess Ready for Dev and continue the next approved Estimate workflow. Figma remains Design Complete partial, Ready for Dev NO.

## Costbook mapping retry handoff — 2026-10-21

- `NEW_WORK_REQUIRED` for the explicit Costbook preview-retry control: current main `15d7e0c736bf069bc8a34ce9a3e32ddb5651505a` had a read-only preview error message but no retry action; live open/recent PR search found no UI overlap. PR #773 is a separate research recipe catalog extension. Branch `feat/figma-to-code-completion` is based on that main SHA; draft PR [#781](https://github.com/404TradeOS-LLC/TradeOS/pull/781) is open, not merged.
- Implemented locally in the existing Estimate builder: failed mapped-cost previews expose an accessible `Retry preview` button that refetches the same tenant-scoped read, communicates retry progress, and leaves Install disabled until a finite, nonnegative preview resolves. No install, Estimate Add, pricing, API, auth, tenant, RLS, or financial behavior changed. Added a regression contract assertion.
- Updated the canonical Estimates mapping workflow in Figma: removed the extra Current Unit Price panel, aligned the single aggregate preview, and added retry controls to the 1440/390 preview-error states. Added and visually inspected 1440/390 Cost Item search loading, no-results, lookup-error, and install-success-return states. Prototype links now cover search entry/recovery, preview retry, resolved install, and install retry; the success state returns to the existing selected-assembly/current-cost boundary and does not imply Estimate Add.
- PR #781 review reconciliation: CodeRabbit's two scoped findings were validated and repaired. Current-state and handoff copy now name the finite, nonnegative preview gate; the contract test isolates the exact retry button and verifies its label, refetch handler, pending disablement, and dynamic text together. The PR body still needs the repository template update on the published head, and fresh hosted checks/re-review remain pending.
- Verification: `cd web && npm test -- --test-name-pattern "starter assembly setup"` ran the full 507-test suite and passed 507/507; focused ESLint, `npx tsc --noEmit`, a clean-cache production build, `npm run docs:check`, `npm run docs:test` (40/40), `npm run autonomy:test` (10/10), `npm run pr:preflight -- --base origin/main`, and `git diff --check` pass. Authenticated browser evidence, 1024/768 mapping targets, fresh hosted exact-head CI/re-review, thread resolution, merge, and deployment remain unverified. Figma remains Design Complete (partial), Ready for Dev NO.
- Next five TODOs: (1) add 1024/768 responsive mapping targets and connect the existing gate entry points; (2) complete remaining prototype outcome paths and inspect the end-to-end 1440/390 flow; (3) publish this review repair, update the PR body to the repository template, and obtain fresh exact-head CI/re-review; (4) capture authenticated 390/768/1024/1440 runtime evidence without production mutation; (5) reassess Ready for Dev only after those gates pass, then continue the highest-priority unfinished approved Estimate workflow.

## Items cost columns checkpoint — 2026-10-17 UTC

Reconciled main `41a62cea99c7bc91eda45d805e4b0363b8906132`: #760 progressive entry is merged as `17c339cf`, production READY `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL`; #761 explicit line-edit cost is merged as `41a62cea`, production READY `dpl_12gVocD7WKCA9vwgSp89YKc4apwi`. These are exact-source deployments, not authenticated workflow certification. Older pending/blocked statements below are historical.

Branch `feat/estimate-items-cost-columns-20261017` reconciles canonical Desktop Items `378:441` (Estimates page `4:10`, high-fidelity context/screenshot inspected). Existing saved items lacked quantity/unit-cost/line-cost columns and visible editor labels. Shared desktop column tracks now align actual saved values; mobile keeps the compact quantity × unit-cost summary and 44px edit actions. Six editor fields have visible, associated labels. Internal costs are explicitly distinguished from customer pricing; saved lineCost is rendered directly, never recomputed. Existing PATCH, draft/permission gates, validation, pricing and snapshots are unchanged.

The missing-header regression failed on the base; all 16 isolated layout/edit/entry/stage browser cases now pass across 390/768/1024/1440. Headers align with cells, cost text matches the response, labels/keyboard Cancel work, mobile targets fit and no horizontal overflow occurs. Every mutation is intercepted; synthetic reads are clearly labeled. Desktop 1440/1024 and mobile 390 renders inspected. Local Web 506/506, lint/build, governance 151/151, docs 40/40, ownership/preflight and Playwright discovery pass. Current branch is unmerged/undeployed pending exact-head hosted checks/review. Authenticated nonproduction persistence and tenant denial remain unverified.

- Classification NEW_WORK_REQUIRED, Sprint NONE: #760/#761 own entry/validation and are merged; current saved-row presentation still lacked the canonical columns. Live overlap reconciliation found only unrelated open Davis-Bacon #700 and Field contracts #702. No equivalent active Estimate implementation.
- Worktree `/workspace/scratch/1f8f19f950ac/tradeos-stage-nav`; allowed builder presentation, focused browser tests and owned docs. Excluded backend/API behavior, financial calculations, auth/RBAC/RLS, schema, suppliers, proposal lifecycle, infrastructure and unrelated main-checkout PNG/GIF edits. #751/#731 remain owner-closed without merge; preserve their branches.
- Next five TODOs: (1) pass local Web/governance/docs and exact-head hosted gates for columns; (2) reconcile automated review findings and complete normal protected merge; (3) verify landed main and exact-source deployment; (4) reconcile laptop Athena rail usability against approved responsive behavior; (5) certify sanitized authenticated Costbook → Price → Proposal persistence and foreign-tenant denial once Preview/data-plane isolation is proven.

## Estimate line-edit explicit cost — active 2026-10-17 UTC

- Main reconciled at `17c339cf28ce36056f1f2d97989e5521f74e1611` (#760 merged normally). Exact tree matches tested source; web production `dpl_3FnbfxKB3J1NhRS62ixSme7CLBNL` is READY at that SHA. This is deployed-source evidence, not authenticated functionality. #751/#731 remain closed without merge; #755/#758 and evidence #756/#757 are merged. Preserve root's unrelated concept PNG and knowledge-engine demo GIF modifications.
- Classification NEW_WORK_REQUIRED: #760 fixed custom Add only; current `EditableLineItem` still converted blank Unit cost to numeric 0. No open line-edit equivalent found. Branch `fix/estimate-edit-explicit-cost-20261017`, base `17c339cf`, same isolated worktree; Sprint NONE. Allowed: existing line-editor required-cost gate/help/error semantics, focused browser regression and four owner docs. Excluded: backend/API/schema/auth/RBAC/RLS, financial computations or explicit-zero policy, supplier integrations, proposal lifecycle, infrastructure and production data.
- Canonical Items `378:441` and written unknown-cost/mutation-recovery contract remain authoritative; no new estimator or visual system. A new 390px browser regression first failed because blank cost left Save enabled. Repair requires input presence in the existing handler and Save control, marks the input required, describes intentional zero and announces actual failed saves as alerts. Explicit zero remains valid; existing price calculations and draft-only server writes remain unchanged.
- Verification: 12/12 isolated browser cases at 390/768/1024/1440 (edit/entry/stage matrices) pass. Edit cases intercept every mutation, prove no blank write, verify only explicit 0/original-cost PATCH payloads, pending/repeated rejection, retained input, Cancel and overflow. Synthetic reads, no backend mutation or authenticated persistence proof. Web 506/506, lint/build, root governance 151/151, docs 40/40, ownership/preflight and Playwright discovery pass; 390/1440 edit/error renders inspected. Temporary fixture/config/cache removed. Exact-head hosted CI/review are next; this branch is unmerged and undeployed.
- Next five TODOs: publish the focused edit-cost PR; resolve exact-head hosted checks; reconcile review and merge normally; verify landed source and exact deployment; finish approved desktop Items quantity/unit-cost/amount composition while preserving internal-cost meaning.


## Estimate Items progressive entry — active 2026-10-17 UTC

- Base main `f9a93dc4aebaeeaa428c781de606999f460b4f81`. #755 responsive stages, #758 failed-finalization focus and #756/#757 persisted-price evidence instrumentation are merged. #751 is owner-closed without merge; do not reopen or reuse its obsolete two-layout implementation. #731 remains closed without merge. Historical entries below do not override these facts.
- Classification NEW_WORK_REQUIRED: no open/draft or recent closed Items disclosure implementation; existing #746 reviewed Add and #624 assembly mapping remain authoritative. Branch `fix/estimate-items-progressive-entry-20261017`, worktree `/workspace/scratch/1f8f19f950ac/tradeos-stage-nav`, Sprint NONE. Allowed: existing picker presentation/filter/focus and explicit missing-cost validation, isolated behavioral test, canonical evidence UI entry helper and its documentation, Current State/estimating/ledger/handoff. Excluded: backend/API contracts, schema, auth/RBAC/RLS, financial calculations/policy, supplier integration, public proposal actions, infrastructure and production data.
- Exact canonical Figma Desktop Items `378:441` screenshot/context re-read: saved item rows follow compact Add assembly / Costbook / Custom item actions. Existing always-expanded forms put saved rows below hundreds of pixels of unused entry fields. Reuse those same forms and APIs behind explicit native disclosure buttons; custom inputs and same-source selection survive closing; switching catalog type deliberately clears the prior type's selection. Search filters existing resolved source kinds; starter install/review/Add gates remain unchanged.
- Verification passed: four-width isolated browser matrix for saved-line Edit access, keyboard/focus, disclosure/draft retention, source filtering, select-without-write, resolved preview gate and repeated rejected custom Add; existing stage/save matrix also passed (8/8 total). The first run exposed a stale Shift+Tab expectation after main began focusing stage headings; the regression now asserts Review then Price, preserving the heading-focus contract. Explicit synthetic catalog fixtures; every non-GET proxy request intercepted, no records written. Web 506/506, lint/build, governance 151/151, docs 40/40, preflight/ownership and eight-case Playwright discovery pass; Items screenshots inspected at 390/1440. Temporary fixture/config/cache removed. Exact-head hosted CI/review still pending. This branch is unmerged and undeployed.
- PR #760 initially published at `42a655fb`. Codex review found unrelated-source blocking: query now keys by selected catalog kind and requests only that source (assemblies plus starter recipes, or Cost Items). A held Costbook response proves loading is announced, no false empty state appears, and assembly endpoints are not called. All eight browser cases pass again after the fix. Fresh exact-head hosted checks/review must be reconciled. The canonical Beta runner now uses the same tested Custom item opening interaction before its existing writes, preserving legacy visible editors and all data-plane/auth/amount guards; no full evidence run claimed.
- Additional reproduced defect: the existing custom form submitted blank Unit cost as numeric 0. UI now requires an explicit cost, preserves intentional 0, and guards both Add and handler; four-width cases verify blank disabled, explicit 0 enabled and no implicit write. This changes input presence validation, not backend financial calculations/policy.
- Next five TODOs: finish #760 fresh checks/review after source-isolation and evidence-entry compatibility repairs; resolve fresh exact-head hosted CI/review and conversations; merge through normal protected gates; verify landed source and exact deployment; continue the next demonstrated gap while authenticated sanitized Preview/data-plane certification remains separately gated.


## Evidence locator parity after responsive Estimate merge — 2026-10-16

- Base main `5469bfe276b253fd31310bfa75ba83acf618e74c` (#755 merged), branch `test/beta-estimate-proposal-review-link-20261016`, sprint NONE. Existing main evidence runner #756 already verifies saved Estimate and Proposal fixed totals; this repair makes the final Review-stage proposal link unique under strict Playwright mode.
- Allowed: evidence script, source regression and owned documentation only; no production deploy or data mutation, auth/RLS/tenant/financial code, migration or provider integration.
- No verified full Beta Evidence run: the dedicated nonproduction TradeOS Staging Supabase project has been restored ACTIVE_HEALTHY, but exact Preview identity and tenant data-plane isolation remain unverified, and deployment/data-plane isolation for the latest SHA has not been proven. Do not run against production.
- PR #751 has been closed **without merge**, so do not claim its enhanced focus-recovery logic shipped. It remains historical/unfinished work.
- Next five TODOs: pass exact-head evidence test and governance CI; protected merge without bypass; verify main and targeted evidence script version; restore and certify isolated staging with owner authorization if any cost/credential changes are needed; then perform authenticated four-width estimate-to-proposal plus role/tenant-negative checks and retain sanitized artifacts.


## Active finalization recovery focus — 2026-10-16

- Founder-directed P0 continuation; base main `5469bfe276b253fd31310bfa75ba83acf618e74c` (#755 merged). Separate prior PR #751 closed **without merge** by owner; do not reopen, dismiss its review, or copy its outdated two-layout implementation.
- Branch `fix/estimate-finalization-error-focus-20261016`. Existing shared Review stage only; repair visible error focus/scroll then keyboard Retry without touching server finalization, Costbook, money calculations, proposal, authorization, database, payments or production environment.
- Shared Review rendering now uses one `EstimateFinalizationError` notice for an actual failed finalize; focus is prevented for hidden stage content. Existing state guards require server confirmation before proposal.
- Verification: Web test/lint/build, App integration and governed PR CI/review pending. Authenticated non-production failed-finalize / focus / retry across 390/768/1024/1440 remains a release gate.
- Other priority state: #756 Beta evidence runner merged, #755 responsive UI merged and Vercel source READY; staging Supabase restore is ACTIVE_HEALTHY but Vercel Preview environment metadata GET returned 403, so tenant data-plane isolation remains **UNPROVEN** and full mutating Beta Evidence must not run.
- Next five TODOs: (1) exact-head CI/review this focus slice; (2) merge normally if allowed, verify main and deployed source; (3) obtain Vercel Preview environment attestation without revealing secrets; (4) deploy approved exact-SHA RC against verified nonproduction staging; (5) run four-width authenticated Estimate → Proposal persistence and foreign-tenant denial with sanitized artifacts.


## Active Estimate → Proposal evidence parity — 2026-10-16

- Classification: NEW_WORK_REQUIRED in canonical Beta Evidence script, no overlap with existing #755 responsive UI or #751 recovery branch. Base main `9769dacfdb8beb69f0acbd40e1e8465affdee925`, branch `test/estimate-proposal-evidence-parity-20261016`; sprint NONE, non-production certification instrumentation only.
- Changed: stage navigation in real browser capture (Items / Price / Review, legacy desktop compatibility), s053 return to builder, persisted Estimate lineCost/subtotal and finalized total/status API assertions, persisted Proposal estimateId/finalPrice match. Original pricing/tax, preview isolation and tenant-negative probes remain.
- Safety: `Beta Evidence` mode=full remains opt-in, refuses production target/shared production Supabase, requires synthetic owner/foreign tenant, scans artifacts for credentials. No runner invoked, secrets read, production mutations, auth bypass, database, pricing or customer lifecycle change.
- Current blockers: PR #751 requested-changes reviewer still active though source findings corrected; review disposition requires authorized reviewer action. PR #755 owns responsive stage composition; do not duplicate UI. Authenticated Preview owner/foreign fixtures and exact deployed-SHA execution have not been proven in this session.
- Verification: new source assertions pending hosted CI; authenticated four-width full run and artifact validation still required. Do not mark S053 complete.
- Next five TODOs: (1) pass exact-head tests/reviews and merge this evidence repair; (2) synchronize with merged #755 and exact Preview SHA; (3) dispatch preflight to prove RC identity/data-plane safely; (4) run full synthetic authenticated beta scenario with retained sanitized artifacts and tenant denial; (5) reconcile #751 legitimate reviewer clearance, rerun recovery and inspect final proposal cost/status persistence.

## Responsive Estimate stages — active 2026-10-16

- Classification NEW_WORK_REQUIRED after existing mobile navigation PR #754 merged as `9769dacfdb8beb69f0acbd40e1e8465affdee925`. Live searches found no open desktop-stage implementation; #751 separately owns finalization recovery. This branch extends the landed flow, not a replacement for #754. Sprint ID NONE.
- Branch `feat/estimate-responsive-stages-20261016`, worktree `/workspace/scratch/1f8f19f950ac/tradeos-stage-nav`, base `9769dacf`. Allowed: existing Estimate Builder, stage contract/browser tests, Current State/estimating/ledger/handoff. Excluded: backend, schema/migrations, auth/RBAC/RLS, supplier/pricing policy, financial calculations, proposal lifecycle and infrastructure. Root checkout's unrelated modified concept PNG is preserved.
- Canonical Figma Estimates `4:10`: high-fidelity contexts/screenshots inspected for Desktop Scope `378:440`, Items `378:441`, Price `378:442`, Review `378:443`, plus mobile step tracker `381:801`. Implement shared four-stage composition and desktop Athena rail using existing components/tokens and real mutations. Persisted one-question clarification and universal pricing-reconciliation gates remain separate capability gaps; no scripted values or fake approvals.
- One responsive flow replaces duplicate desktop/mobile controls. Inactive forms remain mounted/hidden to retain unfinished edits; Items search shortcut only handles keys while Items is active. Dirty-scope progression awaits PATCH acknowledgment and stays on Scope on failure. Desktop actions are inline; mobile actions remain above the Control Dock.
- Main #754 source is deployed READY as `dpl_CEbaBSEUmbp45yjcwbLCRA8sZdKZ` (production, exact `9769dacf`). This is source delivery, not signed-in workflow proof. Four isolated browser cases on this responsive implementation pass at 390/768/1024/1440: native keyboard, pending save, failure/retry, scope retention, unsaved line/pricing edits, breakpoint continuity and overflow. Sixteen stage screenshots were captured and selected Scope/Items/Price/Review renders inspected. Explicit local synthetic fixtures and intercepted responses; no authenticated persistence or RLS proof. Temporary routes/config/cache removed. Web 506/506, lint, governance 149/149, docs 40/40, ownership/preflight and Playwright discovery pass; production build passes.
- #751 head `5d886423` remains open with green required checks at its older base and a formal CodeRabbit CHANGES_REQUESTED review on historical `dea278a7`. Legitimate re-review again returned rate-limited. Do not dismiss/bypass; reconcile its tests to stage buttons and current main before advancing the same PR. #731 remains owner-closed without merge; preserve its branch.
- Exact next task: reconcile refreshed hosted CI and CodeRabbit findings, verify source-level 390/768/1024/1440 regression assertions, then complete governed review and merge if eligible. The four-width synthetic browser matrix and local Web/root tests were already run as described above; do not rerun solely to satisfy this historical checklist. No merge/deployment is claimed yet.
- Next five TODOs: reconcile exact-head CI after three CodeRabbit fixes; obtain legitimate review disposition and governed merge; verify landed source and deployment; reconcile #751 separately without bypassing its reviewer gate; capture authenticated persisted Costbook Add → Price → finalize → Proposal total and tenant-denial evidence on sanitized Preview.

Older entries below are historical and superseded by this checkpoint.

## Current proposal retention / blocked recovery checkpoint — 2026-10-16

- Main: `3811e5832c801957604cedb7d1ff1a914d26a8c1` (#752). Vercel production source READY: `dpl_Dk3KsHe5djrEtwvuLZYUSAFpEbfn`. Authenticated proposal persistence remains unverified. #731 remains closed without merge; preserve its branch. Main's unrelated concept PNG is untouched.
- Estimate recovery #751 final head `87038de0af9cedde1a53f59adffc5ebab9821cec` is current with main; Web/App/integration/Docs all green, all findings repaired/resolved, five isolated browser cases pass. Normal merge returned HTTP 405: one write-access reviewer requesting changes. CodeRabbit declined re-review due OSS rate limit. No dismissal/rules change/bypass. BLOCKED on legitimate formal review disposition; resume the same PR, do not recreate it.
- NEW_WORK_REQUIRED for independently reproduced proposal input loss; no overlapping PR/branch. Active branch `fix/proposal-retain-failed-input-20261016` from current main; PR #753, runtime revision `f85bcc19afdbb7f5e9ea3b6468a4d36a8a1c1d81`. Reconcile the PR live head/checks before merging or resuming. Sprint ID NONE. Allowed: existing proposal-new form, focused Playwright retention spec, Current State/proposals/ledger/handoff docs. Backend, server action, auth/RLS, schema, financial rules, suppliers, dependencies and infrastructure excluded.
- Root cause: returned server errors are fulfilled React actions and reset uncontrolled fields. Actual incomplete-payment validation reset company/scope to fixture defaults and erased the milestone. The bounded fix cancels the native form reset (successful create redirects) and focuses the returned error alert. No typed values are persisted to browser storage.
- Design checkpoint: existing canonical Estimate Review `287:240`, Copperline Review Mobile `361:119` and written canonical design contract. Preserve real failure/retry semantics without activating scripted public actions or redesigning the form.
- Verification: four executed cases at 390/768/1024/1440, two real server payment-validation failures each, all text/textarea/payment/checkbox/Estimate identity retained, error focus and Tab to submit, no overflow. Explicit synthetic local props, no backend create reached; no authenticated/API-persistence proof. Temporary route/config/cache removed. Local Web 504/504, lint/build/typecheck, governance 149/149, docs 40/40 and preflight/consistency pass. Exact-head hosted CI, formal review and final delivery are tracked by PR #753; this checkpoint does not predeclare its merge.
- Exact next task: finish retention checks, publish and pass the focused PR; merge normally if eligible. Next five TODOs: complete retention CI/review/merge; verify its exact-source deployment; reconcile #751 formal review when available; repair mobile Scope/Items/Price/Review keyboard semantics while preserving async scope-save gates; verify sanitized authenticated Estimate → proposal persistence and fixed total.

Older entries below are historical and superseded by this checkpoint.


## Active proposal price-basis continuation — 2026-10-16

- NEW_WORK_REQUIRED from main `4f4adf7d`; no overlapping proposal-new price summary in open/recent closed PRs or remote branches. #751 independently owns estimate finalization recovery and is awaiting final-head CI/review. Branch `fix/proposal-selected-estimate-price-20261016`; Sprint ID NONE.
- Allowed: existing proposal-new form, focused read-only Playwright regression and Current State/proposals/ledger/handoff docs. Backend/server action, financial calculations/approval rules, auth/RLS, schema, suppliers and infrastructure excluded. Main's unrelated modified concept image is preserved.
- Root cause reproduced on the real form with explicit synthetic local props: selected saved Estimate total $121.37, displayed intake range $100–$200, no selected-price summary. Backend `createFromEstimate` already snapshots the selected total; frontend now shows that existing price basis, preserves cents and announces selection changes. Unknown/draft selection cannot become an eligible option.
- Figma checkpoint: Estimates canonical Review `287:240` requires pricing review before proposal; Copperline Review Mobile `361:119` presents proposed total and scope. Only the staff handoff price discrepancy is repaired; no customer signature/payment capability or full Copperline visual parity is claimed.
- Verification: four read-only browser cases pass at 390/768/1024/1440 with two different saved totals, submitted Estimate identity, return to intake range and no writes/overflow. Isolated synthetic props, not authenticated creation/persistence. Temporary fixture route/config removed; Web 504 tests, lint/build/typecheck and root docs/preflight pass. Hosted final-head CI/merge/deployment pending.
- Next five actions: finish #751 governed merge; reconcile this branch onto the landed main without dropping its docs/code; publish price-basis PR and pass exact-head CI/review; merge and verify exact-source deployment; verify authenticated finalized Estimate → proposal creation and stored fixed total on sanitized Preview.

Earlier handoff entries are historical.



## Active Universal Create presentation repair — 2026-10-16

- EXISTING_WORK_FOUND: continued unpublished `fix/universal-create-role-options` at `96515786` and merged current main `7a9d965a`. No overlapping open PR; #731 onboarding is separately waiting on CodeRabbit's historical changes-requested disposition despite green current required CI at `e5de4dab`.
- Scope: AppNav Create entries, authenticated shell role read, optional AbortSignal on existing settings read, pure role predicate/tests and owned docs. Backend/RBAC/RLS/auth policy, financial rules, suppliers, schema/migrations, dependencies and infrastructure excluded.
- The defect is established in source: Create filters only Athena capability, exposing Project/Customer/Job/Billing workflows to roles whose existing endpoints deny those writes. Continue existing role-aware presentation, not a new permission model.
- Main #749 is MERGED and Vercel production deployment `dpl_HtrJucc4Wr9mHenH3r6YgN2xHmex` is READY at `7a9d965a`. This is deployed source evidence, not authenticated browser proof.
- Next: role predicate/source checks, full Web tests/lint/typecheck/build and root docs/preflight; publish this same branch once reviewed. Keep all current owner documentation and exact-head branch protection. No browser/parity/RLS certification without runtime evidence.
- Next five TODOs: complete Create CI/review; merge when permitted; capture signed-in owner/technician/viewer Create behavior at four widths; resolve #731 legitimate reviewer disposition and verify its delivery; continue canonical workflow gaps from the ledger.


## Estimate Price → Review → Copperline parity — current 2026-10-15

- Sprint: NONE; founder-authorized bounded Figma-to-code completion from `main` `51ecb15c7864e193656dd31bd96fb5641dd7c29c`; branch `fix/estimate-price-review-copperline-handoff-20261015`.
- Preflight: source code and current docs inspected; recent Figma prototypes edited in place; no overlapping open estimate finalization/proposal-review PR. Last merged estimate Add safety #746 is preserved.
- Scope: `EstimateBuilder` saved type breakdown, internal-cost labeling, explicit failure/retry for the existing finalize mutation, separate proposal-draft link, source regression tests and owned docs.
- Excluded: Estimate Engine, Costbook price writes, RLS/tenant/auth, supplier proofs, public proposal acceptance, PDF redesign, proposal server action, payment/deposit, schema/migration, production deployment.
- Required verification: focused Web unit/lint/build, App integration, docs consistency/governance, head currency and review. Authenticated browser screenshots and persisted finalize-to-proposal lifecycle proof remain pending.
- Next five TODOs: (1) resolve exact-head CI; (2) resolve review findings; (3) check mobile/desktop keyboard and errors on Preview; (4) test finalized Estimate to Proposal Draft and creation with role/tenant denial; (5) merge after governed gates, reconcile main and separately certify host delivery.

## Active Figma-to-production continuation — 2026-10-16

- Initial classification: EXISTING_WORK_FOUND. Reused remote branch `fix/estimate-price-review-copperline-handoff-20261015` at `873dc2ae`; its parent is audited main `51ecb15c` (#747). Open #731 owns onboarding, #744 instrumentation, #700 wages, #702 Field contracts; none owns this estimator runtime change. No new competing branch.
- Reconciliation update: PR #748 merged as `be126ff9` and its remote branch was deleted during verification. Follow-up classification NEW_WORK_REQUIRED; current branch `fix/estimate-desktop-scope-recovery-20261016` starts at `be126ff9` and contains only desktop scope, delete recovery, cost-display hardening and docs/tests. No duplicate Price/Review implementation.
- Scope: existing builder + focused cost aggregation helper/tests, Current State/estimating docs and `docs/design/FIGMA_IMPLEMENTATION_LEDGER.md`. Backend/schema/migrations, auth/RLS/RBAC, supplier integration, pricing policy and production configuration excluded.
- Added shared desktop/mobile scope editing, saved cost-type transparency, visible failed-finalize retry and delete reconciliation, honest internal Review labeling and explicit proposal handoff.
- Figma: inspected live Scope `432:25161` and Mobile Price `432:27891` screenshots/context, canonical component mappings and current written design contract. Full application parity not certified.
- Next: run final Web tests/lint/typecheck/build + root docs/preflight, publish the same branch PR, reconcile exact-head hosted CI/reviews; merge only through normal gates, then verify deployment and authenticated four-width workflow.
- Local browser blocker: pinned Chromium v1248 download returns an invalid ZIP. No provisioned authenticated non-production fixture has been used. No browser/RLS/deployment verification claimed.
- Next five TODOs: complete this PR's exact-head checks; repair scoped review findings; exercise scope save/failure and reviewed add/finalize in Preview at 390/768/1024/1440; verify stored snapshot + proposal draft handoff; continue #731 and ledger-ready gaps after fresh reconciliation.


## Estimate Costbook selection and preview guard — 2026-10-15

- Sprint ID: NONE; bounded founder-requested Figma-to-code fix from `main` `049ff512470e1997edf5afcdc8a9ff9cdca76a76`.
- Autonomy preflight: NEW_WORK_REQUIRED. Open Costbook PRs #700 (wages) and #745 (ABC catalog detail) do not overlap the Estimate Items picker. Previous S064 assembly picker and starter mapping are already implemented on main.
- Branch: `fix/estimate-picker-reviewed-add-20261015`. GitHub connector edits only; local git checkout/npm execution unavailable due blocked GitHub DNS. Do not treat remote CI as local test evidence.
- Scope: explicit Costbook/assembly search selection, read-only unit-cost preview, quantity and error gates, mapped starter install before separate Estimate Add, focused tests and owner docs.
- Safety: backend Estimate pricing snapshots/tenant/RLS/auth, schema/migrations, API contracts, supplier quotes, automation and proposal/invoice flows unchanged.
- Validation: exact-head Web tests/lint/build and repository documentation CI, branch currency, review and authenticated 390/768/1024/1440 checks still need reconciliation. No hosted screenshot or tenant-negative evidence yet.
- Next five TODOs: reconcile fresh PR checks; repair deterministic review/test failures; capture authenticated search/preview/add/cancel and failed cost cases on 390/1440; verify stored Estimate snapshot matches the backend resolved cost without historical repricing; then merge through protected PR gates and verify main.

## Figma-to-code customer portal access parity — active 2026-10-14

- Sprint ID: NONE; bounded founder-requested frontend design parity, not S059 release certification.
- Autonomy preflight: NEW_WORK_REQUIRED; remote `main` at `b3eb5ce9edae61d363b763bcc9ce426005a2454a`. No open access UI overlap; open first-estimate PR #731 remains separate. An old `ui/customer-portal-action-workspace-20261003` branch edits only the portal home page and is not replaced or deleted.
- Branch: `feat/portal-access-figma-parity-20261014`; GitHub connector-only implementation with no local checkout or worktree (local git fetch/status and npm validations unavailable).
- Scope: public access confirmation/recovery layout, contract-preserving source regressions, current-state and portal-module documentation. Preserve explicit same-origin POST, pending HttpOnly token handling, non-enumerating denial, customer/tenant principal and all financial permissions.
- Required checks: Web test/lint/build, docs/governance/preflight, hosted exact-head CI and review; authenticated 390/768/1024/1440 browser and negative customer-session evidence remain pending. No production access or deployments.
- Next five TODOs: verify fresh PR checks; repair scoped failures; inspect exact-head diff and review threads; capture sanitized responsive/authentication negative evidence; obtain legitimate merge decision and reconcile main before the next UI slice.

## Founder-authorized Costbook legacy assembly audit — active 2026-10-08

- Classification: `NEW_WORK_REQUIRED`; branch `fix/costbook-legacy-assembly-match-audit` from current `main` `bd28d751f1a63fde36dce880cc1ea6fe2f735ac7`. No overlapping open Costbook/assembly canonicalization PR was found; open PRs #690/#691/#692 are separate prevailing-wage/supplier-sync lanes.
- Scope: audit the historical generated `pricedAssemblies.ts` snapshot for deterministic false positives without broadening the canonical matcher or inventing replacement prices.
- Implemented first pass: a conservative registry of high-confidence nominal-dimension, product-type, and material-spec conflicts plus `AUDIT_FILTERED_LEGACY_PRICED_ASSEMBLY_COMPONENTS`, a non-mutating filtered view for review/analysis. Raw rows stay intact for provenance.
- Safety: no schema/migration, RLS/auth/permission change, supplier observation mutation, Material price update, Assembly recipe mutation, Estimate repricing, or production-data write. Precomputed legacy assembly rollups remain historical and are not certified as current pricing.
- Verification required: exact-head App unit/typecheck/build, Costbook provenance audit, docs/governance, review reconciliation, and branch currency.
- Next five tasks: run exact-head CI; repair deterministic failures; review the remaining unmatched legacy rows for additional high-confidence conflicts; decide whether to retire or regenerate the historical rollups from governed identities; then expand canonical families only from reviewed supplier evidence.


## Founder-authorized Costbook cross-supplier canonicalization — merge-ready 2026-10-08

- Initial classification was `NEW_WORK_REQUIRED`; continuation now classifies `EXISTING_WORK_FOUND` because PR #686 on branch `feat/costbook-cross-supplier-canonicalization` is the authoritative implementation lane. Base remains `main` `adfce90b3e81a29e280d8c18e07441542f1aa70e`; PR #685 is separate ABC Supply feed wiring.
- Scope: establish TradeOS-owned SPF precut-stud canonical identities, crosswalk reviewed Lowe's/Menards/Home Depot/Niehaus source-key variants, hard-reject dimension/spec conflicts, and prevent raw workbook keys from becoming cross-supplier joins.
- Compatibility/safety: governed aliases may compare across suppliers; ungoverned exact keys remain readable only when eligible evidence belongs to one supplier. SPF-stud-shaped keys outside the governed registry, mixed-unit governed groups, and conflicting product dimensions fail closed.
- Import invariant: canonical mapping is create-only during supplier-evidence import. Re-import never mutates an existing `SupplierProduct.canonicalMaterialKey`; manager canonical review remains the explicit update path and therefore cannot be erased by a conflicting workbook replay.
- Regression repair: the generated 92-5/8 in. wall-stud component → 104-5/8 in. Niehaus match is removed. No LF↔EA conversion is invented. Remaining generated assembly prices are still legacy name/unit matches, not a completed canonical-identity audit.
- Safety boundary: no schema/migration, RLS, auth, permission, Material price mutation, Estimate repricing, or production-data write.
- Verification: rebased onto current `main` `8e3b171d9ee66bdfd6b114098afc8c65aa530617`; exact-head `ef7e7f5345051720e975e9e974d422e6a5c00dde` passed Verify repository, App unit/typecheck/build/integration, Athena smoke, Costbook provenance audit, supplier-evidence seed dry run, docs consistency, sprint governance, dependency review, live-doc reconciliation, CodeQL, and branch currency. CodeRabbit is green and no review threads remain unresolved. Sprint ID: NONE.
- Next five tasks: merge PR #686 at exact head `ef7e7f5345051720e975e9e974d422e6a5c00dde`; verify the resulting `main` SHA and required post-merge checks; preserve the now-landed canonicalization boundary in Costbook docs; audit the next highest-risk legacy assembly identity mismatches as a separate bounded slice; expand governed identity families only from reviewed supplier corpus evidence.


## S073 release-critical RLS coverage — readiness active 2026-10-05

- Sprint: `S073 — Release-critical RLS coverage matrix`.
- Founder explicitly authorized starting S073.
- Readiness base: `main` `37deee0bad44d8c3ca4ad65f7e89d15190d7cae3`; S051 is DONE; no S073 PR/branch overlap found.
- Readiness branch: `docs/s073-rls-coverage-readiness`.
- Scope: current S052-S060 persisted-resource inventory, exact forced-RLS policy/migration mapping, deterministic matrix validation, and additive live same-org/cross-org PostgreSQL evidence.
- Known evidence gaps at readiness: no direct `app/tests/rls.integration.ts` coverage for at least `customer_portal_access_tokens`, `customer_portal_sessions`, `estimate_line_items`, and `invoice_line_items`.
- Safety: no schema/migration or RLS-policy redesign, no role/permission/auth/portal-principal change, no production DB access. A discovered policy defect becomes a blocking `GAP`; it is not silently repaired inside S073.
- Next five tasks: merge readiness; create the isolated S073 implementation branch; build the release-critical resource/policy matrix; add missing live PostgreSQL evidence and validator coverage; run exact-head App integration/repository checks and stop on any protected security-policy gap.

## Founder-authorized Costbook supplier-evidence review — merged 2026-10-05

- Classification: `NO_ACTION_REQUIRED` for the implementation lane after verified merge of PR #670 as `ab6e541c925e0077aae9e14d2907c7968daa0a9e`.
- Landed scope: tenant-scoped supplier-evidence review at `/costbook/supplier-evidence`, exact-observation selection, server-backed cursor pagination, stored-currency display, typed evidence/review APIs, and manager-gated confirmation of the governed matcher suggestion.
- Review hardening: the mutation reruns the fresh canonical matcher against current supplier-product identity, rejects unsuggested keys and cross-key relinks, and fails closed on concurrent matcher-input changes.
- Verification: exact-head repository verification, App/Web checks, docs consistency, dependency review, sprint governance, branch currency, and live documentation reconciliation passed before merge; all review threads were resolved.
- Safety boundary remains unchanged: canonical review can update only `SupplierProduct.canonicalMaterialKey`; it does not promote evidence into `Material.unitCost`, reprice Estimates, import new supplier data, or change schema/migrations, RLS, auth, or permissions.
- Sprint ID: NONE. S082 remains BLOCKED on S073; PR #670 does not complete S082.
- Next safe action: finish the existing bounded Costbook mission here. A separate founder request such as `Run the next TradeOS sprint` is required before starting S073 or another numbered sprint under `NEXT_SPRINT_PROTOCOL.md`.

## Founder-authorized Codex Playwright setup — 2026-10-05

- Classification: `NEW_WORK_REQUIRED`; base `cd419b6dd00686cd36a649e3675fe5a31abf7e58`.
- Branch: `chore/playwright-codex-agents`; Sprint ID: NONE.
- Adds reviewed planner/generator/healer definitions, pinned root test runner,
  non-production target guards and a meaningful logged-out login-shell seed.
- The healer preserves genuine failures. Only the three agent TOMLs are
  allowlisted; local Codex state and authentication material remain ignored.
- Existing S053 PR #654 owns hosted certification; this setup does not replace
  it, provision credentials, certify a lifecycle or change sprint status.
- Next five tasks: verify hosted PR checks; land the bounded setup; start an
  approved local/Preview target; run the login seed; plan authenticated flows
  only after the existing Beta Evidence fixture/data-plane prerequisites pass.

## Founder-authorized Today exception lane — 2026-10-04

- Branch `feat/today-real-exception-queue`; PR #643 is ready for review directly on current `main` after Customer→Project #645 and S067 #644 merged. It is no longer stacked on the closed Customer→Project branch.
- Scope: add only persisted blocked Project Tasks and existing organization-week schedule conflicts to canonical **Needs You**.
- Reuses `GET /api/v1/projects/tasks` and `GET /api/v1/schedule/conflicts`; no backend route/schema/RBAC/RLS change.
- A 50-row incomplete-Task cap is treated as unavailable rather than silently undercounting blocked work. Failure of any required exception source makes the aggregate Needs You count unavailable instead of synthetic zero.
- Pricing-verification and material-unavailable entries are deliberately not fabricated because current persisted Estimate/Project state does not expose a truthful company-wide exception source for them.
- S061/S060 release certification status is unchanged; this is a bounded runtime continuity improvement, not a sprint-DONE claim.

## S067 active implementation — 2026-10-04

- Readiness PR #642 merged as `3333414e6c5d7939b0a7446c261cc619ae2bbb3c`; draft PR #644 on `feature/s067-schedule-visit-continuity` is the sole S067 implementation lane.
- The first slice reuses the canonical Job schedule/conflict/assignment contract and existing optional `SiteVisit.jobId`: scheduled Job context can open Site Visit capture from Dispatch/Project, invalid or archived/wrong-Project Job context falls back to Project-only capture, and saved linked visits preserve that Job context.
- Owner/admin/dispatcher receive the new capture affordance; technician CRM write behavior is unchanged. The backend same-org/same-Project/unarchived-Job controller check remains authoritative.
- No new scheduler, persistence model, lifecycle state, schema/migration, auth/RBAC/RLS policy, GPS/route tracking, notifications, or external-calendar integration is included.
- Continue #644 through hosted Web/docs/governance checks and review. Retained responsive, permission/tenant-negative, refresh evidence and S056 remain completion/release gates.

## Founder-authorized Customer → Project parity lane — 2026-10-04

- Classification: `NEW_WORK_REQUIRED`; runtime Customer→Project parity does not overlap the already-merged S052 certification harness or current evidence/staging lanes.
- Branch: `feat/customer-project-canonical-continuity`; draft PR #645.
- Customer-context Project creation now keeps the existing CRM Customer selected, reuses active ServiceAddress rows by copying the selected formatted address into `Project.siteAddress`, and explicitly preserves the boundary that no Project→ServiceAddress relationship exists.
- **Create project** now opens the created Project workspace immediately; **Create & start estimate** reuses the existing Estimate intent/create path. Context-free Project creation and the existing Job intent remain supported.
- No backend route, schema/migration, auth/RBAC/RLS, Customer merge, Lead persistence, or ServiceAddress ownership change is included.
- S052 release certification remains separate and must not be marked DONE from this runtime/UI PR.

# Session Handoff

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

## Next Eligible Sprint

Sprint ID: S073
Eligibility: S073 is `READY`; S051 is `DONE`; founder authorization is explicit.
Dependencies: S051 — DONE through merged PR #538.
Overlap check: Recheck live PRs/branches before starting; this non-numbered repair does not advance S073 or authorize a second active sprint.
Startup prompt: Execute S073 from current main using `docs/architecture/S073_RELEASE_CRITICAL_RLS_COVERAGE_PLAN.md` after canonical startup/reconciliation; stop on protected policy gaps.
