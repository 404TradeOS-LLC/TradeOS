---
status: current
owner: platform
last_verified: 2026-08-23
source_of_truth: true
related_code:
  - AGENTS.md
  - docs/TRADEOS_BIBLE.md
  - docs/CURRENT_STATE.md
  - docs/ROADMAP.md
  - docs/SPRINT_BACKLOG.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - .github/CODEOWNERS
  - .coderabbit.yaml
  - scripts/pr-preflight.mjs
  - scripts/pr-body-check.mjs
  - .github/pull_request_template.md
  - .github/workflows/docs-consistency.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/reconcile-production-migration.yml
  - .github/workflows/dependabot-patch-automerge.yml
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
- S010 is `DONE`. The implementation normalizes `toDTO()` to return canonical `sent` for stored `pending_signature`, confined to `app/modules/contracts/service.ts`. No Contract schema migration, default change, or `sign()`/`void()` guard change was made; persisted status remains `pending_signature` — see `docs/architecture/S010_CONTRACT_LIFECYCLE_PLAN.md`.
- S013 is complete: PR #30 merged as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 remains `BLOCKED/PARTIAL`. PR #257 completed the bounded supplier-review concurrency repair and PostgreSQL-backed readiness evidence. PR #260 has merged the standardized server-side catalog pagination/search/filter/sort contract. The remaining S027 promotion gate is authenticated rendered Costbook browser evidence — see `docs/architecture/COSTBOOK_S027_READINESS.md` and `docs/SPRINT_BACKLOG.md`.

## Active engineering queue

Prioritize existing authorized work before inventing new scope. S007-S011 are complete with merged evidence. The next numbered-sprint action is the separate governance-only promotion of S012 — Job lifecycle normalization. S027 remains separately blocked on authenticated rendered Costbook browser evidence.

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

## Required verification

Expected required CI jobs include:

- `Docs consistency` — validates PR-description structure first, then PR-preflight tests, autonomy-reconciliation regressions, and documentation ownership validation;
- `App lint, unit tests, and build` — Prisma schema validation, high-severity production dependency audit, TypeScript typecheck, backend unit tests, Athena contracts/smoke, build, and tracked-source cleanliness when the pull request changes `app/**` or `packages/knowledge-engine/**`; the required job still reports success without expensive setup for unrelated pull-request diffs;
- `App integration tests` — production migration-path rehearsal against disposable PostgreSQL plus live integration/RLS verification when the pull request changes `app/**` or `packages/knowledge-engine/**`; the required job still reports success without expensive setup for unrelated pull-request diffs;
- `Web lint and build` — production dependency audit, frontend unit tests, lint, build, and tracked-source cleanliness when the pull request changes `web/**`; the required job still reports success without expensive setup for unrelated pull-request diffs.

Pushes to `main` run all app, integration, and web verification lanes. Pull-request path scoping reduces unrelated CI work without changing required check names, branch-protection requirements, or the meaning of a green check for the code actually changed.

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
- `packages/knowledge-engine/knowledge-engine/**` is a confirmed self-nested duplicate tree, not a second canonical package. Do not normalize it through dependency maintenance or delete it without the approved cleanup decision/process.
- Settings/Brand Studio asset persistence must keep service-role access server-only and organization-scoped.
- S027 implementation must extend existing Costbook, supplier, Knowledge Runtime, AI Estimate Assist, and Estimate Engine seams; do not create mock production data or autonomous AI write paths.
- PR #257 does not alter Costbook architecture or permissions. Its supplier proposal claim is transactional and review-first: only a successfully claimed pending row may mutate Material/audit state.
- CODEOWNERS currently provides routing/visibility. Requiring code-owner approval in live branch rules needs separate solo-maintainer compatibility review to avoid deadlocking self-authored PRs.

## Session execution

The sole executable general session contract is `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. Use its Canonical Startup Flow before editing and Canonical Completion Flow before handoff. The Command Center reports current operating context and does not define a competing checklist.

## Next engineer starts here

S007 is complete through PR #261, S008 is complete through PR #264, S009 is complete through PR #267, and S010 is complete through PR #276 (`fcbf1fff342053d854ad73667c54a5e44c1bbfb6`). S011 is now `DONE`: PR #283 merged on 2026-08-24 as `6ca838d39d170fe520e16141e6e5213188f6d5f8`, and this separate completion-evidence reconciliation records the shipped bounded backend reconciliation slice.

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
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
