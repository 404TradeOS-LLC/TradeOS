---
status: current
owner: platform
last_verified: 2026-08-24
source_of_truth: true
related_code:
  - AGENTS.md
  - docs/TRADEOS_BIBLE.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SESSION_HANDOFF.md
  - docs/CI_ACCELERATION.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - .github/CODEOWNERS
  - .coderabbit.yaml
  - scripts/pr-preflight.mjs
  - scripts/pr-body-check.mjs
  - scripts/sprint-state-check.mjs
  - scripts/live-sprint-evidence-check.mjs
  - .github/pull_request_template.md
  - .github/workflows/docs-consistency.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/reconcile-production-migration.yml
  - .github/workflows/dependabot-patch-automerge.yml
  - .github/workflows/sprint-governance.yml
  - .github/workflows/migration-safety.yml
  - .github/workflows/stale-pr-check.yml
  - .github/workflows/s027-browser-evidence.yml
  - .github/workflows/docs-reconciliation.yml
  - .github/workflows/merge-readiness.yml
  - .github/workflows/nightly-full-regression.yml
  - .github/workflows/workflow-health-report.yml
  - .github/workflows/rc-smoke.yml
---

# TradeOS Engineering Command Center

## Purpose

This is the concise operating overview for TradeOS engineering. It does not replace the Bible, Current State, Sprint Backlog, Session Handoff, module contracts, ADRs, or research evidence.

Start with:

1. [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
2. [CURRENT_STATE.md](CURRENT_STATE.md)
3. [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
4. [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
5. [agent-prompts/NEXT_SPRINT_PROTOCOL.md](agent-prompts/NEXT_SPRINT_PROTOCOL.md)

## Project identity and boundary

- `404 TradeOS` is the parent company and operating context.
- `TradeOS` is the contractor SaaS product in this repository.
- TradeOS remains one first-party monorepo. Focused agent workstreams such as Athena, Costbook, Estimator, Dispatcher, Field Tech, CRM, or Office Manager are execution-context boundaries, not separate repository boundaries.
- Athena is the reusable orchestration platform layer; domain business rules remain owned by their domains and register capabilities through explicit contracts.
- Existing `app/` and `web/` deployable boundaries remain authoritative during RC1 hardening. Do not move production code merely to match a target package layout.

## Current engineering phase

TradeOS is in `RC1 hardening`.

Verified implementation truth belongs in [CURRENT_STATE.md](CURRENT_STATE.md). Strategic sequencing belongs in [ROADMAP.md](ROADMAP.md). Executable numbered work belongs in [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md).

## Hardening baseline landed 2026-08-12

The repository now has a stronger autonomous-maintenance safety envelope:

- **CI gatekeeper:** PR #172 merged as `cd9a960861e611956f7ff55d9704461b6586ae47`. Required verification includes Prisma schema validation, high-severity production dependency audits, backend typechecking/unit/Athena checks/build, live migration-path rehearsal and integration/RLS tests, frontend tests/lint/build, and tracked-source cleanliness.
- **Sensitive ownership:** PR #175 merged as `38232b19b3ca02de0856ffbf6ba1f6a798b5ca62`, adding `.github/CODEOWNERS` coverage for governance, auth/tenancy/RLS, schema/migrations, deployment, Athena foundation/security, and billing/payment surfaces.
- **Autonomous agent contract:** PR #177 merged as `25ce0817b8a87a068348496fca12bd32230bfaf9`, strengthening `AGENTS.md` while preserving repository governance as the controlling merge policy.
- **Production health surface:** PR #178 merged as `834fb3433604045a46dfe377df47fa08cee499d8`, separating dependency-free `/health` liveness from database-aware `/ready` readiness and adding structured readiness-failure logging.
- **CodeRabbit repository policy:** PR #180 merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`, adding repository-level assertive review guidance with failed commit status when automated review cannot run.
- **API development toolchain:** PR #169 merged as `919beaaec3b08d92d268b3a8ac24f11842eb7a82`, advancing the backend development stack through TypeScript 6 and Jest 30 with explicit compatibility migrations and full App/Web/docs/live migration rehearsal validation.
- **GitHub Actions runtime:** PR #181 merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`, replacing stale #130/#131 with one governed update to `actions/checkout@v7` and `actions/setup-node@v7` while preserving the explicit TradeOS Node workload versions. Checkout call sites are maintained on v7.0.1 as of 2026-08-18; this patch maintenance does not alter the workload runtime matrix.

These changes improve evidence for low-risk automated repair. They do not grant autonomous authority over migrations, auth/RLS policy, destructive data operations, secrets, billing, major architecture, or other protected decisions.

## Current numbered-sprint state

- S001-S010 are complete where the backlog records merged evidence; S006's lifecycle inventory merged in PR #95 as `5e59880aba24acbe943b03d1a34aa787cb7db801`, S007 Project lifecycle normalization merged in PR #261 as `e736bb6b92ce00441f2e0863ef3c4d34174571be`, S008 Estimate lifecycle normalization merged in PR #264 as `dee5f98f0b46e98782b887fca80a63e55800cd65`, S009 Proposal lifecycle normalization merged in PR #267, and S010 Contract lifecycle normalization merged in PR #276 as `fcbf1fff342053d854ad73667c54a5e44c1bbfb6`.
- S011 Invoice lifecycle normalization is `DONE`: PR #283 merged 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`, and separate completion evidence records the shipped behavior. Its bounded slice owns backend payment reconciliation correctness and paid follow-up exclusion. Overdue and partially-paid remain derived, payment-entry UI expansion is deferred, and no schema/status/portal/billing redesign or unrelated Invoice mutation repair was included.
- S012 Job lifecycle normalization is `DONE`: readiness PR #285 merged as `5264ad84202d832a93ba0a73cb2b291bd0965d46`, implementation PR #286 merged as `403d84cb6187b59cf468802977a19fbc847ce314`, and separate completion evidence records the exact-head CI and PostgreSQL/RLS verification. The implementation centralizes the existing transition contract, preserves `on_site -> completed`, and keeps existing Job statuses, assignment/conflict and role boundaries, forced RLS, activity/required-event behavior, completion/readiness metadata, and request-scoped transactions. Dispatch attention remains derived. No Job schema/status expansion, generic status patch, Dispatcher redesign, automatic invoice creation, billing change, Project-to-Job redesign, unrelated concurrency repair, or later sprint work shipped.
- S010 is `DONE`. The implementation normalizes `toDTO()` to return canonical `sent` for stored `pending_signature`, confined to `app/modules/contracts/service.ts`. No Contract schema migration, default change, or `sign()`/`void()` guard change was made; persisted status remains `pending_signature` — see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`.
- S013 is complete: PR #30 merged as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 remains `BLOCKED/PARTIAL`. PR #257 completed the bounded supplier-review concurrency repair and PostgreSQL-backed readiness evidence. PR #260 has merged the standardized server-side catalog pagination/search/filter/sort contract. The remaining S027 promotion gate is authenticated rendered Costbook browser evidence — see `docs/architecture/COSTBOOK_S027_READINESS.md` and `docs/SPRINT_BACKLOG.md`.
- S018 is `DONE` after implementation PR #290 merged on 2026-08-24 as `6f2dd254c121855fa629d19da6bc0452cc9e6de7`; completion-evidence PR #292 records its exact-head CI and review evidence. Its current portal boundary remains the existing authenticated Supabase session plus protected bearer-authenticated API and forced PostgreSQL RLS; no separate customer token model exists. The implementation hardens local-token expiry/claim validation and inactive-user session denial, and adds focused auth/RLS evidence. Stop for a founder decision if a new customer identity or authorization policy is required.
- S019 Portal proposal acceptance flow is `DONE` after implementation PR #296 merged on 2026-08-24 as `9291ccd58624326b1bb142d47d50f97f85b413e3`; exact-head Verify repository #1358 and the required docs/governance checks passed. The bounded implementation hardens the existing authenticated proposal review/view/accept/decline and audit/event boundary with organization-scoped conditional transitions, fail-closed competing mutations, and bounded portal action feedback. No customer identity, permission widening, RBAC/RLS redesign, schema, portal redesign, or later sprint work is authorized. See `docs/architecture/S019_PORTAL_PROPOSAL_ACCEPTANCE_PLAN.md`.
- S021 is `DONE` after implementation PR #299 merged on 2026-08-24 as `514c94900263744ac8cf498c6b06da336e097512`; completion-evidence PR #300 records the separate governance-only reconciliation. The bounded implementation presents existing invoice amount, recorded-payment aggregation, derived balance/partial/overdue/voided semantics, billing authorization, authenticated portal reads, and forced PostgreSQL RLS evidence. New payment processing, public payment links, ledger/money semantics, schema, auth, or RLS/RBAC changes remain forbidden. S020 is now `DONE` after implementation PR #322 and separate completion evidence; its founder/legal-signature boundary remains resolved by ADR-007. See `docs/architecture/S021_PORTAL_INVOICE_PRESENTATION_PLAN.md`.
- S014 is `DONE` through founder-decision PR #301 and ADR-006: Brand Studio is the canonical organization-brand source and Settings remains an adapter/administration surface. S015 is `DONE` through implementation PR #310 and completion evidence #312. S016 is `DONE`: implementation PR #314 merged on 2026-08-24 as `e1618db5926134d4cc6ec9b4c05fd754f4b2ca2b`; its separate governance-only completion evidence is recorded. S017 is `DONE` after implementation PR #317 and corrective PR #319; separate completion evidence is recorded. S020 is `DONE` after implementation PR #322; separate completion evidence is being recorded in the current bounded governance lane.
- S020's founder/legal boundary is resolved through ADR-007: implementation may remain authenticated in-app contract acceptance/signature evidence, without formal e-signature claims or new identity architecture. The S020 backlog wording and S021 readiness reference are reconciled to this accepted boundary.
- S024 is `DONE` through founder-decision PR #301 and ADR-008: metadata-first AI retention, 90-day default metadata retention, no raw content by default, tenant/actor isolation, secret exclusion, and reversible organization usage ceilings. S024 is a decision sprint; S025 owns later persistence implementation.

## Active engineering queue

Prioritize existing authorized work before inventing new scope. S007-S012, S014-S021, and S024 are complete with merged evidence. No numbered-sprint implementation lane is active. S022's numbered dependencies are now satisfied but it requires a separate governance-only readiness promotion; S027 remains separately blocked on authenticated rendered Costbook browser evidence.

The earlier S027 implementation slice PR #260 is merged. The 2026-08-18 cleanup resolved PR #240, #242, #243, #245, #246, #247, #249, and #250. The earlier 2026-08-16 queue (PR #217, #225, #226, #227, #229, #230, #231) is also fully resolved — #217, #225, #226, #227, #229, and #231 merged; #230 closed unmerged. PR #237, opened to record that earlier resolution, itself closed unmerged without landing its diff. The prior 2026-08-12 queue (PR #151, PR #128, PR #145/issue #144, issue #153) remains resolved as previously recorded. None of those older items is live overlap for the next lifecycle readiness assessment.

## Autonomous maintenance operating mode

Scheduled maintenance and repair agents follow `AGENTS.md`, the Next Sprint Protocol, and Repository Governance together.

Before any scheduled or agent-driven branch is created, agents must run the scoped [Autonomy Reconciliation Preflight](agent-prompts/AUTONOMY_RECONCILIATION.md) and record `EXISTING_WORK_FOUND`, `NEW_WORK_REQUIRED`, or `NO_ACTION_REQUIRED`. Only `NEW_WORK_REQUIRED` permits branch creation. The `npm run autonomy:reconcile -- --task "..."` helper gathers current Git/PR evidence and likely semantic overlap; agents still inspect the surfaced evidence before acting.

For a validated low-risk maintenance defect, the expected loop is:

**reconcile → reuse or classify new work → reproduce/validate → root-cause → repair → test → inspect diff → reconcile again → publish one focused PR → verify exact CI/review state → merge only when permitted → verify landed state**

Agents should advance an existing overlapping PR instead of creating duplicate work. Green CI is required technical evidence, not authority to merge protected changes.

### PR throughput discipline

Before expensive local verification or PR creation/update, run:

```bash
npm run pr:preflight -- --base origin/main
```

The preflight reports the exact changed paths, required owner docs, missing docs, and minimum relevant app/web verification lanes. `npm run pr:preflight:run -- --base origin/main` may execute those scoped checks after required documentation is present. This prevents predictable docs failures and unrelated local suites from becoming extra review cycles.

Once a PR exists, use one continuous repair loop rather than waiting for serial feedback rounds:

1. inspect required CI and every unresolved review thread on the current head;
2. treat deterministic, scoped automated-review findings as auto-fix candidates;
3. for CodeRabbit findings with structured fix instructions, prefer `@coderabbitai autofix` on the current PR branch, then inspect the resulting diff and verification evidence;
4. repair objective docs drift, formatting, lint/type errors, missing behavioral regression coverage, and other low-risk deterministic findings without a separate product-decision pause;
5. do **not** auto-apply findings that would change migrations/schema/data, authentication/authorization/RLS, billing/money semantics, major architecture, production trust boundaries, destructive operations, or other protected decisions;
6. resolve a review thread only after the fix is present and verified on the current head;
7. rerun only failed/relevant checks when GitHub supports it, while new commits naturally cancel superseded runs;
8. enable GitHub auto-merge when the PR is otherwise safe so the required ruleset remains the final gate instead of requiring another manual merge round trip;
9. finish the oldest/highest-value viable PR before opening competing work unless explicit priority says otherwise.

Regression tests should exercise the actual behavior/failure path whenever practical. Static source-text tests are appropriate only when the source shape itself is the intended convention; `.coderabbit.yaml` now tells automated review to flag source-text substitutes for behavioral coverage.

Production repair should use the health split first:

- `/health` failing → investigate process/deployment/routing/platform availability;
- `/health` succeeding and `/ready` failing → investigate database connectivity/configuration/availability;
- both succeeding while a workflow fails → investigate auth, tenancy/RLS, route/domain behavior, or frontend/backend integration.

### CI acceleration operating mode

CI speed comes from parallel execution and earlier evidence, never from skipping required coverage. `Verify repository` keeps the established required App, App integration, and Web check names while independent child jobs execute typecheck/lint, unit tests, Athena checks, build/audit, and database verification concurrently. Sprint-governance, migration-safety, branch-currency, merge-readiness, live-doc reconciliation, browser evidence, nightly full regression, and workflow-health reporting are supplemental automation unless the live ruleset is separately changed to require a specific check.

The authenticated S027 and RC browser workflows are operator-triggered and require scoped Playwright storage-state secrets; they do not commit cookies or credentials and do not authorize product mutations. See [CI_ACCELERATION.md](CI_ACCELERATION.md) for the workflow inventory and evidence boundaries.

## Required verification

Expected required CI jobs include:

- `Docs consistency` — validates PR-description structure first, then PR-preflight tests, autonomy-reconciliation regressions, and documentation ownership validation;
- `App lint, unit tests, and build` — Prisma schema validation, high-severity production dependency audit, TypeScript typecheck, backend unit tests, Athena contracts/smoke, build, and tracked-source cleanliness when the pull request changes `app/**` or `packages/knowledge-engine/**`; the required job still reports success without expensive setup for unrelated pull-request diffs;
- `App integration tests` — production migration-path rehearsal against disposable PostgreSQL plus live integration/RLS verification when the pull request changes `app/**` or `packages/knowledge-engine/**`; the required job still reports success without expensive setup for unrelated pull-request diffs;
- `Web lint and build` — production dependency audit, frontend unit tests, lint, build, and tracked-source cleanliness when the pull request changes `web/**`; the required job still reports success without expensive setup for unrelated pull-request diffs.

Pushes to `main` run all app, integration, and web verification lanes. Pull-request path scoping reduces unrelated CI work without changing required check names, branch-protection requirements, or the meaning of a green check for the code actually changed. The required App and Web summary jobs aggregate parallel child jobs so the branch-protection interface remains stable while wall-clock verification is reduced.

Repository workflows use supported action-runtime majors (`actions/checkout@v7` and `actions/setup-node@v7`) independently of the explicit Node versions exercised by the jobs. The 2026-08-18 checkout patch refresh to v7.0.1 is CI-runtime maintenance only; application runtime versions are unchanged. The dedicated dependency-review gate now uses `actions/dependency-review-action@v5`; that action's internal runtime is Node 24 and does not change the Node versions used to build or test TradeOS.

The optional Dependabot patch auto-merge workflow is deliberately narrower than required CI: it can only enable GitHub auto-merge for same-repository Dependabot PRs targeting `main` whose metadata is `version-update:semver-patch`. Minor/major updates remain manual, and required checks, branch freshness, review threads, and branch protection still determine whether a patch PR actually lands. Its metadata step is pinned to the immutable `dependabot/fetch-metadata` v3.1.0 commit and runs from the normal `pull_request` event rather than `pull_request_target`; the action's Node 24 runtime is limited to GitHub Actions and does not change TradeOS workload runtimes.

The optional `preview-smoke-check.yml` workflow is not part of required CI either: it runs `web/scripts/preview-smoke-check.mjs` against a live Preview deployment (frontend reachability, backend `/health`/`/ready`, and a hard fail if either target points at Production) via manual `workflow_dispatch` or a best-effort `deployment_status` trigger — see `docs/REPOSITORY_GOVERNANCE.md` for its known auto-trigger limitation.

Documentation foundation/governance work should run:

```bash
npm run pr:preflight -- --base origin/main
npm run pr:test
npm run docs:test
npm run docs:check -- --base origin/main
git diff --check
```

The exact required-check and ruleset configuration remains live GitHub state and must be verified before changing repository controls.

## Current risks and guarded areas

- Production migration changes remain manual/approval-gated; pull-request CI may rehearse tracked migrations only against disposable databases.
- The former `packages/knowledge-engine/knowledge-engine/**` self-nested duplicate was removed in the founder-approved cleanup on 2026-08-24 after full hash, reference, and loader/path-resolution evidence. The canonical top-level package remains authoritative.
- Settings/Brand Studio asset persistence must keep service-role access server-only and organization-scoped.
- S027 implementation must extend existing Costbook, supplier, Knowledge Runtime, AI Estimate Assist, and Estimate Engine seams; do not create mock production data or autonomous AI write paths.
- PR #257 does not alter Costbook architecture or permissions. Its supplier proposal claim is transactional and review-first: only a successfully claimed pending row may mutate Material/audit state.
- CODEOWNERS currently provides routing/visibility. Requiring code-owner approval in live branch rules needs separate solo-maintainer compatibility review to avoid deadlocking self-authored PRs.

## Session execution

The sole executable general session contract is `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. Use its Canonical Startup Flow before editing and Canonical Completion Flow before handoff. The Command Center reports current operating context and does not define a competing checklist.

## Next engineer starts here

S007 is complete through PR #261, S008 through PR #264, S009 through PR #267, and S010 through PR #276. S011 is `DONE` through PR #283 and completion evidence #284. S012 is `DONE` through readiness #285, implementation #286, and completion evidence #288. S014 is `DONE` through founder-decision PR #301 and ADR-006. S015 implementation PR #310 and completion-evidence PR #312 are merged. S016 implementation PR #314 merged as `e1618db5926134d4cc6ec9b4c05fd754f4b2ca2b`; its separate completion-evidence lane records the exact-head checks, review disposition, and residual production/browser evidence limitation. S017 implementation PR #317 and corrective PR #319 are merged; its separate completion evidence is recorded. S018 implementation PR #290 and completion evidence #292 are merged. S019 implementation PR #296 and separate completion evidence #297 are merged. S020 implementation PR #322 is merged; its separate completion evidence is being recorded. S021 implementation PR #299 and completion-evidence PR #300 are merged. S024 is `DONE` through founder-decision PR #301 and ADR-008. S022 is the next candidate for governance-only readiness promotion.

## Source-of-truth links

- [TRADEOS_BIBLE.md](TRADEOS_BIBLE.md)
- [CURRENT_STATE.md](CURRENT_STATE.md)
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [RBAC_MATRIX.md](RBAC_MATRIX.md)
- [WORKFLOW_LIFECYCLES.md](WORKFLOW_LIFECYCLES.md)
- [ROADMAP.md](ROADMAP.md)
- [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
- [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [DOC_OWNERSHIP.yml](DOC_OWNERSHIP.yml)
- [CI_ACCELERATION.md](CI_ACCELERATION.md)
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
