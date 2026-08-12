---
status: current
owner: platform
last_verified: 2026-08-12
source_of_truth: true
related_code:
  - AGENTS.md
  - .github/workflows/docs-consistency.yml
  - .github/workflows/reconcile-production-migration.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/deploy-migrations.yml
  - .github/pull_request_template.md
  - .github/PULL_REQUEST_TEMPLATE/
  - .github/ISSUE_TEMPLATE/
  - .github/labels.yml
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/SPRINT_BACKLOG.md
  - docs/SESSION_HANDOFF.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/decisions/ADR-004-worktree-policy.md
---

# Repository Governance

This document defines the required repository workflow for TradeOS. The Bible defines doctrine, the Sprint Backlog defines executable work, and this file defines repository controls and merge discipline.

## Monorepo and AI-agent boundary policy

TradeOS first-party product capabilities remain in one governed monorepo unless a future architecture decision explicitly establishes a separate repository boundary. Codex projects, threads, or agent missions are context and execution boundaries, not repository boundaries; they should operate from the monorepo root while claiming only the paths required for the bounded mission.

Athena is the shared AI/orchestration platform layer. Its canonical package location is `packages/athena/`, and it owns the AI kernel, tool registry, context engine, router, action framework, and shared AI interfaces. Athena must not own Costbook, estimating, dispatch, CRM, Field Tech, or other domain business rules. Domain implementations retain ownership of their data and invariants and expose capabilities to Athena through explicit contracts or tool registration.

Existing `app/` and `web/` deployable boundaries remain authoritative during RC1 hardening. Do not perform broad code movement merely to make the repository resemble a target package layout. Introduce `packages/costbook/` only when shared Costbook logic has a demonstrated reusable package boundary. Any later repository split or dependency-direction change requires explicit architectural documentation and must preserve the source-of-truth hierarchy and CI/governance controls defined here.

## Live-state verification rule

GitHub rulesets, branch protection, required checks, merge methods, and review requirements are external state. They must be verified directly in GitHub before being described as current.

Do not preserve dated statements such as “no rulesets exist” or “one approval is required” as present truth after configuration may have changed.

## Required protection target

Protect `main` with a branch ruleset that:

- requires a pull request before merging;
- requires the branch to be current with `main`;
- requires all configured status checks to pass;
- requires conversation resolution;
- blocks force pushes;
- restricts deletion of `main`.

Expected verification jobs are:

- `Docs consistency`;
- `App lint, unit tests, and build` — installs from lockfile, validates the Prisma schema, audits production dependencies at high severity or above, runs TypeScript typechecking, backend unit tests, Athena contract/smoke gates, builds the backend, and verifies the build did not modify tracked source;
- `App integration tests` — provisions PostgreSQL and runs the same migration-deployment path used by production before live integration/RLS tests;
- `Web lint and build` — installs from lockfile, audits production dependencies at high severity or above, runs frontend unit tests, lint, build, and verifies tracked source remains clean.

A green required-check set is the minimum evidence for autonomous merge eligibility. Agents must not weaken, skip, mark non-blocking, or remove a gate merely to make a PR mergeable. A failing security audit, schema validation, migration rehearsal, test, typecheck, lint, build, or clean-tree check is a real blocker until root-caused and either repaired or explicitly approved through a governance change.

The exact GitHub check names remain the source of truth and must be verified before editing the ruleset.

## Solo-maintainer review posture

TradeOS is currently operated by one repository maintainer. The intended solo-maintainer configuration is:

- pull requests remain mandatory;
- required checks remain mandatory;
- conversation resolution remains mandatory;
- required approving-review count is zero while there is only one maintainer;
- self-review may be recorded as a comment or audit, but it is not treated as independent approval;
- approval requirements may be raised when another qualified maintainer or reviewer joins.

Do not weaken CI, up-to-date requirements, deletion protection, force-push protection, or PR requirements to compensate for the zero-approval setting.

## Verified default-branch controls

On 2026-08-04, S003 performed a read-only verification of the live GitHub configuration at `main` commit `cdadd24d`. No repository setting or ruleset was changed.

The active `TradeOS Main Branch Protection` ruleset targets the default branch and contains deletion and non-fast-forward protection, mandatory pull requests with zero required approving reviews, required review-thread resolution, strict required-status-check enforcement, linear-history enforcement, and allowed pull-request merge methods of merge and squash. Re-run live read-only inspection before changing those statements or editing repository controls.

## Merge posture

- prefer squash merge for normal feature, fix, and documentation PRs;
- do not merge a draft PR;
- do not merge with failing required checks;
- do not merge with unresolved review threads;
- verify the expected head SHA immediately before merge;
- only merged evidence may mark a sprint `DONE`.

## Branch and worktree lifecycle

The executable agent startup and completion sequences are owned only by the [Next Sprint Protocol](agent-prompts/NEXT_SPRINT_PROTOCOL.md). This document owns the repository policy those flows enforce: branch and worktree lifecycle, PR readiness, review, merge, and cleanup.

Use one clean `main` worktree plus one linked worktree per active mission.

Required policy:

- do not develop directly on `main`;
- do not use permanent per-module feature branches;
- do not use plain force push;
- use `--force-with-lease` only when a reviewed rebase requires it and the remote head is verified unchanged;
- do not use `rm -rf` to remove linked worktrees;
- stop on unexpected branch movement or overlapping scope.

## Documentation ownership

`docs/DOC_OWNERSHIP.yml` is enforced repository policy.

When a changed file triggers an ownership requirement, the owning document must be included and updated meaningfully in the same PR. Do not add an empty or cosmetic edit merely to satisfy the checker.

The Bible does not replace `CURRENT_STATE.md` for verified implementation truth, `SPRINT_BACKLOG.md` for executable work, `SESSION_HANDOFF.md` for current continuity, module docs for implementation contracts, accepted ADRs for architectural rationale, or research docs for supporting evidence.

## Production migration history reconciliation

Normal production schema rollout uses the protected migration deployment process, not ad hoc SQL. Production migration changes remain approval-gated. CI may validate Prisma schema and rehearse the migration path against an isolated disposable PostgreSQL instance, but it must never apply pull-request migrations to production or mutate production migration history.

## Session continuity

Every contributor uses the Canonical Startup Flow and Canonical Completion Flow in `docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md`. `ENGINEERING_COMMAND_CENTER.md` is a concise operating overview, not a running log. `SESSION_HANDOFF.md` is replaced with current truth at the end of a substantive session.

## Pull request readiness

A PR is ready for human review or autonomous merge consideration only when:

- work stayed within its approved scope;
- required owner documents are present;
- the final diff contains no unrelated changes;
- local validation has passed or an external blocker is explicitly documented;
- GitHub required checks are green;
- the branch is up to date;
- review threads are resolved;
- the PR description accurately states current scope, validation, limitations, and remaining risks.

## Pull request templates

The default PR template is the required baseline for every pull request. Specialized backend, frontend, docs/governance, and security templates do not replace the default readiness standard.

## Issue templates and labels

Normal public issues use the repository issue templates; sensitive vulnerability details belong in private security advisories. Labels follow `.github/labels.yml`; do not invent one-off taxonomy outside that file.
