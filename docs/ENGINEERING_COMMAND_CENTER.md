---
status: current
owner: platform
last_verified: 2026-08-16
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
- **GitHub Actions runtime:** PR #181 merged as `1d6120ad4598b60d3c14a91366cb73b2bf42bd48`, replacing stale #130/#131 with one governed update to `actions/checkout@v7` and `actions/setup-node@v7` while preserving the explicit TradeOS Node workload versions.

These changes improve evidence for low-risk automated repair. They do not grant autonomous authority over migrations, auth/RLS policy, destructive data operations, secrets, billing, major architecture, or other protected decisions.

## Current numbered-sprint state

- S001-S006 are complete where the backlog records merged evidence; specifically, S006's lifecycle inventory merged in PR #95 as `5e59880aba24acbe943b03d1a34aa787cb7db801`.
- S013 is complete: PR #30 merged as `2d80214a99b476e9a271c04fbe8a608eb80b3883`.
- S027 remains `BLOCKED`. Its old blockers #94/#95/#96 are merged. Its 2026-08-12 blockers PR #128 and PR #151 are also resolved as of 2026-08-16 (#151 merged, #128 closed unmerged/superseded by merged PR #183), but S027 promotion still needs its own dedicated live-verified scope/overlap review against the further Costbook work merged since (PR #183, #210, #216) — see `docs/SPRINT_BACKLOG.md`.
- No numbered sprint is currently `READY`. The correct computed state is `Sprint ID: NONE` until a separate governance-only readiness promotion proves a planned sprint is eligible.

## Active engineering queue

Prioritize existing authorized work before inventing new scope. As of the 2026-08-16 reconciliation, the live out-of-band queue is:

1. **PR #231 — dashboard hierarchy/navigation affordance hardening.** Phase 2 follow-up to merged #211; frontend-only, clean mergeable state.
2. **PR #230 — docs reconciliation of `CURRENT_STATE.md`/`SESSION_HANDOFF.md`** after PR #211; docs-only.
3. **PR #229 / #227 / #226 / #225 — CI/workflow governance additions** (nightly repository health, workflow security gate, dependency review gate, guarded PR maintenance workflow); no runtime behavior change.
4. **PR #217 — Server Action partial-write compensation** for estimate-intake photo uploads; clean mergeable state.

The prior 2026-08-12 queue (PR #151, PR #128, PR #145/issue #144, issue #153) is fully resolved — #151 merged, #144 closed via merged PR #191, #128/#145 closed unmerged and superseded by equivalent merged work, and #153 closed completed. It is retained here only as resolved history, not as live overlap. This resolved-history note intentionally covers only items that remained in that active overlap queue; broader resolved maintenance history such as PR #171, PR #169, and superseded PRs #130/#131 remains recorded in `docs/SPRINT_BACKLOG.md` and the hardening baseline above.

## Autonomous maintenance operating mode

Scheduled maintenance and repair agents follow `AGENTS.md`, the Next Sprint Protocol, and Repository Governance together.

Before any scheduled or agent-driven branch is created, agents must run the scoped [Autonomy Reconciliation Preflight](agent-prompts/AUTONOMY_RECONCILIATION.md) and record `EXISTING_WORK_FOUND`, `NEW_WORK_REQUIRED`, or `NO_ACTION_REQUIRED`. Only `NEW_WORK_REQUIRED` permits branch creation. The `npm run autonomy:reconcile -- --task "..."` helper gathers current Git/PR evidence and likely semantic overlap; agents still inspect the surfaced evidence before acting.

For a validated low-risk maintenance defect, the expected loop is:

**reconcile → reuse or classify new work → reproduce/validate → root-cause → repair → test → inspect diff → reconcile again → publish one focused PR → verify exact CI/review state → merge only when permitted → verify landed state**

Agents should advance an existing overlapping PR instead of creating duplicate work. Green CI is required technical evidence, not authority to merge protected changes.

Production repair should use the health split first:

- `/health` failing → investigate process/deployment/routing/platform availability;
- `/health` succeeding and `/ready` failing → investigate database connectivity/configuration/availability;
- both succeeding while a workflow fails → investigate auth, tenancy/RLS, route/domain behavior, or frontend/backend integration.

## Required verification

Expected required CI jobs include:

- `Docs consistency` — autonomy-reconciliation regressions plus documentation ownership validation;
- `App lint, unit tests, and build` — Prisma schema validation, high-severity production dependency audit, TypeScript typecheck, backend unit tests, Athena contracts/smoke, build, and tracked-source cleanliness;
- `App integration tests` — production migration-path rehearsal against disposable PostgreSQL plus live integration/RLS verification;
- `Web lint and build` — production dependency audit, frontend unit tests, lint, build, and tracked-source cleanliness.

Repository workflows use supported action-runtime majors (`actions/checkout@v7` and `actions/setup-node@v7`) independently of the explicit Node versions exercised by the jobs. Action-runtime upgrades are CI maintenance; changes to the TradeOS Node workload matrix require separate compatibility evidence.

The optional Dependabot patch auto-merge workflow is deliberately narrower than required CI: it can only enable GitHub auto-merge for same-repository Dependabot PRs targeting `main` whose metadata is `version-update:semver-patch`. Minor/major updates remain manual, and required checks, branch freshness, review threads, and branch protection still determine whether a patch PR actually lands.

Documentation foundation/governance work should run:

```bash
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
- CODEOWNERS currently provides routing/visibility. Requiring code-owner approval in live branch rules needs separate solo-maintainer compatibility review to avoid deadlocking self-authored PRs.

## Session execution

The sole executable general session contract is `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. Use its Canonical Startup Flow before editing and Canonical Completion Flow before handoff. The Command Center reports current operating context and does not define a competing checklist.

## Next engineer starts here

There is no numbered `READY` sprint at this handoff. Advance or reconcile existing live out-of-band work first (see the Active engineering queue above) without bypassing migration, RLS, documentation, review, or current-base requirements. If existing PR work should not proceed, perform a governance-only readiness review — S027 is the most likely candidate given its prior blockers are resolved — and promote exactly one eligible `PLANNED` sprint before implementation.

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
