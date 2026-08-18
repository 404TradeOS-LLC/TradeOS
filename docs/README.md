---
status: current
owner: platform
last_verified: 2026-08-18
source_of_truth: true
related_code:
  - AGENTS.md
  - README.md
  - docs/REPOSITORY_GOVERNANCE.md
  - .github/pull_request_template.md
  - .github/PULL_REQUEST_TEMPLATE/
  - .github/ISSUE_TEMPLATE/
  - .github/labels.yml
  - docs/DOC_OWNERSHIP.yml
  - docs/DEPLOYMENT_GUIDE.md
  - packages/knowledge-engine/README.md
  - app/backend/server.ts
  - app/domain/contracts.ts
  - app/prisma/schema.prisma
  - .github/workflows/reconcile-production-migration.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/deploy-migrations.yml
  - .github/workflows/dependabot-patch-automerge.yml
  - .github/workflows/pr-maintenance.yml
  - .github/workflows/dependency-review.yml
  - .github/workflows/workflow-security.yml
  - .github/workflows/nightly-repository-health.yml
  - .github/workflows/preview-smoke-check.yml
---

# TradeOS Documentation

This directory is the documentation entry point for implementation truth in TradeOS.

## Authoritative documents

Use these files first:

- `docs/ENGINEERING_COMMAND_CENTER.md` for the current engineering mission and verified priorities
- `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` for the sole executable agent startup and completion flows
- `docs/agent-prompts/AUTONOMY_RECONCILIATION.md` for the mandatory scheduled/agent-driven preflight that deepens startup overlap inspection
- `docs/CURRENT_STATE.md` for verified implementation status
- `docs/SESSION_HANDOFF.md` for the latest completed-session context and next exact task
- `docs/PRODUCT_SCOPE.md` for product boundaries and non-goals
- `docs/ARCHITECTURE.md` for repository and tenancy architecture
- `docs/DOMAIN_MODEL.md` for canonical entity definitions and relationships
- `docs/API_REFERENCE.md` for route groups and request conventions
- `docs/RBAC_MATRIX.md` for canonical roles and permission expectations
- `docs/WORKFLOW_LIFECYCLES.md` for status vocabulary and transition rules
- `docs/ROADMAP.md` for future work only
- `docs/REPOSITORY_GOVERNANCE.md` for protected-branch policy, required checks, worktree lifecycle, PR templates, issue templates, label taxonomy, and manual PR-maintenance controls
- `docs/DEPLOYMENT_GUIDE.md` for deployment environment variables, migration rollout, and approved production migration-history reconciliation procedures
- `docs/DOC_OWNERSHIP.yml` for required documentation updates by code path
- `docs/athena/README.md` for Athena platform doctrine, contracts, and the A1 kernel roadmap (implementation truth for the A1 kernel foundation itself still lives in `docs/CURRENT_STATE.md`)
- `docs/athena/SECURITY_MODEL.md` for Athena trust boundaries, approval rules, and forbidden patterns

Temporary production migration-history workflows are governed by `docs/REPOSITORY_GOVERNANCE.md` and must stay manual, approval-gated, and history-only. If the migration file being reconciled has not merged yet, the workflow may materialize only that exact file from the named pull-request ref and must verify its pinned checksum before any database write.

The `PR maintenance` workflow is also manual-only. It accepts an explicit open same-repository PR number targeting `main` and requests GitHub to rebase that branch onto current `main`; it must not bypass branch protection, required checks, review requirements, fork restrictions, or merge-conflict handling.

## Current versus archived

Current source-of-truth documents:

- live under `docs/` or `docs/modules/`
- use front matter with `status: current`
- may set `source_of_truth: true` when they are canonical

Historical or superseded documents:

- live under `docs/archive/`
- use front matter with `status: archived`
- are preserved for history only
- must not be used for implementation decisions

If a file is not in the authoritative list above, treat it as supporting material unless it explicitly says otherwise.

## Hierarchy

Global source-of-truth files define shared rules.

- `CURRENT_STATE.md` answers what exists now
- `ENGINEERING_COMMAND_CENTER.md` answers where engineering should start right now
- `SESSION_HANDOFF.md` answers what the last completed session did and what should happen next
- `PRODUCT_SCOPE.md` answers what TradeOS is and is not trying to do
- `ARCHITECTURE.md` answers how the system is structured
- `DOMAIN_MODEL.md` answers what entities mean
- `API_REFERENCE.md` answers how backend surfaces are organized
- `RBAC_MATRIX.md` answers who can do what
- `WORKFLOW_LIFECYCLES.md` answers how statuses move
- `ROADMAP.md` answers what is next
- `REPOSITORY_GOVERNANCE.md` answers how repository work must be isolated, verified, triaged, labeled, reviewed, and merged
- `DEPLOYMENT_GUIDE.md` answers how production deployment, migration rollout, and explicit migration-history reconciliation are operated

Module docs under `docs/modules/` inherit those shared rules and should not redefine them. Module docs should link back to the global file instead of copying role or lifecycle rules.

Decision records under `docs/decisions/` explain durable architectural choices.

`docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md` owns the canonical startup and
completion flows. Other files under `docs/agent-prompts/` are compatibility
links or lane-specific additions and do not define parallel general contracts.

## Documentation enforcement

Documentation changes are enforced in the same branch and pull request as relevant code changes.

The repository verification workflow runs backend typechecking, unit tests,
Athena contract/smoke checks, Prisma schema validation, production-dependency
security auditing, build verification, live integration/migration rehearsal,
and tracked-source cleanliness checks. The frontend gate runs production-
dependency auditing, framework-free unit tests, lint, build, and the same
tracked-source cleanliness check. These checks are intended to make a green PR
a meaningful prerequisite for safe autonomous merging rather than a shallow
build signal.

The dedicated dependency-review workflow is a pull-request security gate with read-only repository contents access. It fails when a PR introduces a dependency with a known high or critical vulnerability. This is additive to the existing package-manager production dependency audits and does not replace the normal repository verification workflow. The gate uses `actions/dependency-review-action@v5`; its internal Node 24 action runtime is CI implementation detail and does not change TradeOS workload runtime versions.

The workflow implementation uses supported major versions of `actions/checkout` and `actions/setup-node`. As of 2026-08-18, checkout call sites are maintained on the v7.0.1 patch release; this action-runtime maintenance does not change the explicit Node versions used for TradeOS workload testing or deployment.

Changes under `.github/workflows/**` and `.github/actions/**` additionally trigger `workflow-security.yml`. Workflow YAML is inspected directly; for a change anywhere under a local action directory, the gate resolves and inspects that changed file's enclosing `action.yml` or `action.yaml` manifest and fails closed if no manifest exists. It runs pinned `actionlint` directly on the hosted runner and rejects the repository's default-prohibited workflow patterns. This remains supplemental CI unless live branch protection is separately configured to require the check.

The `preview-smoke-check.yml` workflow is a diagnostic, non-required gate — see `docs/REPOSITORY_GOVERNANCE.md`'s "Preview smoke check workflow" section for its two triggers and known limitation.

The enforcement flow is:

1. `scripts/__tests__/reconcile-task.test.mjs` verifies the autonomous-work classification and evidence-report contract.
2. `scripts/docs-check.mjs` determines the changed files against the PR base.
3. `docs/DOC_OWNERSHIP.yml` maps changed code paths to required docs.
4. The checker fails if the required docs are not also changed.

Run locally with:

```bash
npm run docs:check
```

Run tests for the checker with:

```bash
npm run docs:test
```

Run the autonomous-work reconciliation helper and its focused tests with:

```bash
npm run autonomy:reconcile -- --task "describe the requested outcome"
npm run autonomy:test
```

The helper requires authenticated `gh` access for live PR evidence. Its
classification is a gate and evidence summary, not permission to skip review
of surfaced branches, pull requests, commits, or overlapping file paths.

## `DOC_OWNERSHIP.yml` format

The file contains `rules` and optional `exemptions`.

Each rule supports:

- `paths`: one or more exact paths or glob patterns
- `requires`: one or more documentation files that must change with matching code
- `explanation`: optional human-readable context

Each exemption supports:

- `paths`: one or more exact paths or glob patterns
- `reason`: required explanation for why doc updates are not required

Rules are additive. If multiple rules match the same code changes, the checker requires the union of all referenced docs.

Rename handling:

- code-path ownership checks apply to both the old and new path for renamed files
- ordinary edits to living docs do not automatically require `docs/README.md`
- `docs/README.md` is reserved for documentation-governance, hierarchy, ownership-rule, checker, PR-template, and docs-workflow changes — enforced mechanically: any change to `docs/DOC_OWNERSHIP.yml` requires `docs/README.md` and `docs/REPOSITORY_GOVERNANCE.md` to also change in the same PR
- controller and middleware files should be listed when they own module-specific validation, permission, throttling, or security behavior; for example, AI estimator controller and rate-limit changes are owned by the AI Estimate Assist documentation set
- package-level data corpora are listed when their content feeds a documented runtime consumer; for example, `packages/knowledge-engine/**` runtime and vendored-content changes are owned by `packages/knowledge-engine/README.md`, which is the package's own canonical entry point rather than a `docs/modules/*.md` file

## Dependabot patch auto-merge

The optional `.github/workflows/dependabot-patch-automerge.yml` workflow may enable GitHub auto-merge only for same-repository Dependabot pull requests targeting `main` when Dependabot metadata classifies the update as `version-update:semver-patch`. It never directly merges a PR, does not cover minor or major updates, and does not bypass required checks, branch freshness, or review-thread requirements. The workflow now runs from the normal `pull_request` event and uses the immutable `dependabot/fetch-metadata` v3.1.0 commit; the action's Node 24 runtime is confined to GitHub Actions and does not alter TradeOS application runtime policy.

### Nightly repository health

`.github/workflows/nightly-repository-health.yml` provides a scheduled and manually dispatchable diagnostic signal for dependency, Prisma, build, Athena-contract, tracked-source, and workflow-file drift. It is not a branch-protection requirement and does not deploy or mutate production data.

## Source-of-truth files

- [CURRENT_STATE.md](CURRENT_STATE.md)
- [ENGINEERING_COMMAND_CENTER.md](ENGINEERING_COMMAND_CENTER.md)
- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [PRODUCT_SCOPE.md](PRODUCT_SCOPE.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DOMAIN_MODEL.md](DOMAIN_MODEL.md)
- [API_REFERENCE.md](API_REFERENCE.md)
- [RBAC_MATRIX.md](RBAC_MATRIX.md)
- [WORKFLOW_LIFECYCLES.md](WORKFLOW_LIFECYCLES.md)
- [ROADMAP.md](ROADMAP.md)
- [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)
- [REPOSITORY_GOVERNANCE.md](REPOSITORY_GOVERNANCE.md)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [DOC_OWNERSHIP.yml](DOC_OWNERSHIP.yml)
- [modules/](modules/)
- [decisions/](decisions/)
- [agent-prompts/](agent-prompts/)
- [archive/](archive/)

Athena production-readiness changes that touch approvals, audit persistence,
permission context, or provider scope should update both the Athena-specific
docs and whichever shared platform docs describe tenancy, RBAC, or runtime
architecture.
