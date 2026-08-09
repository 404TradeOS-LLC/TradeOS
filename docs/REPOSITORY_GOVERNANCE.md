---
status: current
owner: platform
last_verified: 2026-08-09
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
- `App lint, unit tests, and build` (now also runs the `athena:contracts` and `athena:smoke` named gates for the Project Athena A1 kernel foundation before the build step, per `docs/athena/roadmap/A1-ai-kernel-implementation-plan.md` "Named Validation Gates");
- `App integration tests`;
- `Web lint and build` (includes frontend unit tests before lint and build).

The frontend job must run `npm test` before lint/build so server/client
environment-boundary regressions are part of the merge gate.

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

On 2026-08-04, S003 performed a read-only verification of the live GitHub
configuration at `main` commit `cdadd24d`. No repository setting or ruleset
was changed.

The active `TradeOS Main Branch Protection` ruleset
([ID 18958081](https://github.com/404TradeOS-LLC/TradeOScostbook/rules/18958081))
targets the default branch and contains:

- deletion and non-fast-forward protection;
- mandatory pull requests with zero required approving reviews;
- required review-thread resolution, with neither code-owner review nor
  last-push approval required;
- strict required-status-check enforcement, which requires the branch to be
  current before merge;
- the exact required checks `Docs consistency`,
  `App lint, unit tests, and build`, `App integration tests`, and
  `Web lint and build`;
- linear-history enforcement;
- allowed pull-request merge methods of merge and squash; and
- Copilot review on pushes and draft pull requests.

The separate active
`Code Quality Copilot review for default branch` ruleset
([ID 19465256](https://github.com/404TradeOS-LLC/TradeOScostbook/rules/19465256))
also targets the default branch and requests Copilot review on pushes and draft
pull requests.

GitHub's unauthenticated public ruleset response does not disclose bypass
actors, so this verification makes no claim about bypass-actor configuration.
Re-run the live read-only inspection before changing these statements or
editing repository controls.

## Merge posture

- prefer squash merge for normal feature, fix, and documentation PRs;
- do not merge a draft PR;
- do not merge with failing required checks;
- do not merge with unresolved review threads;
- verify the expected head SHA immediately before merge;
- only merged evidence may mark a sprint `DONE`.

## Branch and worktree lifecycle

The executable agent startup and completion sequences are owned only by the
[Next Sprint Protocol](agent-prompts/NEXT_SPRINT_PROTOCOL.md). This document
owns the repository policy those flows enforce: branch and worktree lifecycle,
PR readiness, review, merge, and cleanup. `AGENTS.md`, compatibility checklists,
and backend, frontend, docs, or recovery contracts may link to the canonical
flows and add lane-specific requirements; they must not duplicate or weaken the
general sequence.

Use one clean `main` worktree plus one linked worktree per active mission.

Standard flow:

1. fetch origin;
2. verify exact repository, path, branch, upstream, and clean state;
3. create one short-lived branch and linked worktree for the bounded mission;
4. state allowed paths, forbidden paths, validation, and stop conditions;
5. inspect open PR and worktree overlap;
6. perform only the approved mission;
7. update required source-of-truth documents in the same branch;
8. run required local checks;
9. inspect the complete diff against the correct base;
10. push normally and open or update one PR;
11. wait for required checks;
12. merge only after review readiness is established;
13. sync `main` and verify the landed content;
14. remove linked worktrees with `git worktree remove`;
15. delete merged branches when safe;
16. run `git worktree prune`.

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

Changes to `docs/DOC_OWNERSHIP.yml` itself must include this file (`docs/REPOSITORY_GOVERNANCE.md`, which defines the enforced policy) and `docs/README.md` (the docs entrypoint), not only `docs/ENGINEERING_COMMAND_CENTER.md` — a PR that only touches `DOC_OWNERSHIP.yml` and the Command Center can otherwise change enforced ownership rules without the document that describes them to contributors ever being reviewed.

Ownership is not limited to `app/**` and `web/**`. A package-level data corpus can be its own
owning subject with its own README as the canonical entry point, rather than requiring a
`docs/modules/*.md` file for every change. `packages/knowledge-engine/README.md` is the first
instance of this pattern: it owns the package's canonical-path, provenance, and known-duplicate
documentation, separate from `app/modules/knowledge-runtime/README.md`, which owns the live API
consumer's documentation.

The Bible does not replace:

- `CURRENT_STATE.md` for verified implementation truth;
- `SPRINT_BACKLOG.md` for executable work;
- `SESSION_HANDOFF.md` for current continuity;
- module docs for detailed implementation contracts;
- accepted ADRs for active architectural rationale;
- research docs for supporting evidence.

## Production migration history reconciliation

Normal production schema rollout uses the protected migration deployment process, not ad hoc SQL.

The temporary `.github/workflows/reconcile-production-migration.yml` workflow exists only to mark `20260728120000_add_settings_asset_uploads` as already applied after production schema equivalence has been verified. It is `workflow_dispatch` only, uses the `production` Environment approval gate, shares the production migration concurrency group, scopes `DATABASE_ADMIN_URL` to the Prisma steps as `DATABASE_URL`, runs only `prisma migrate resolve --applied` followed by diagnostic `prisma migrate status`, and must not run `prisma migrate deploy` or alter schema objects, policies, or buckets.

PR #30 has landed, but the temporary reconciliation workflow still materializes only `app/prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql` from its pinned `refs/pull/30/head` source. It must fail closed if the ref, path, or pinned SHA-256 checksum cannot be verified, and it must not execute code from the fetched pull-request ref. `prisma migrate resolve --applied` remains a hard-fail step. `prisma migrate status` is diagnostic and non-blocking because known earlier pending migrations can return a nonzero status after the target history row has been recorded.

## Session continuity

Every contributor uses the
[Canonical Startup Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow)
and
[Canonical Completion Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow).
Those sections own the reading order, live-state checks, handoff requirements,
and completion report; this policy does not define a competing checklist.

`ENGINEERING_COMMAND_CENTER.md` is a concise operating overview, not a running log. `SESSION_HANDOFF.md` is replaced with current truth at the end of a substantive session.

## Pull request readiness

A PR is ready for human review only when:

- work stayed within its approved scope;
- required owner documents are present;
- the final diff contains no unrelated changes;
- local validation has passed or an external blocker is explicitly documented;
- GitHub required checks are green;
- the branch is up to date;
- review threads are resolved;
- the PR description accurately states current scope, validation, limitations, and remaining risks.

Branch-specific changed-file counts, temporary PR blockers, and validation notes belong in `docs/SESSION_HANDOFF.md` or the pull request body. Do not preserve them as durable governance policy after the branch lands.

## Pull request templates

The default PR template is the required baseline for every pull request.

It must capture:

- summary, scope, branch, worktree, and linked issue
- startup verification against the Command Center and source-of-truth docs
- allowed-path and forbidden-path compliance
- documentation impact and `DOC_OWNERSHIP.yml` review
- exact verification commands and blocked checks
- final `git status --short --branch`
- known limitations and follow-up work

Specialized templates under `.github/PULL_REQUEST_TEMPLATE/` provide focused review prompts for:

- backend changes
- frontend changes
- docs and governance changes
- security hardening

Specialized templates do not replace the default readiness standard. They exist to make the relevant risks harder to miss.

## Issue templates

Issue templates under `.github/ISSUE_TEMPLATE/` are required for normal public issue intake.

Templates cover:

- bug reports
- engineering tasks
- feature requests
- governance and docs tasks
- security review requests

Blank issues are disabled so every issue starts with enough scope, risk, and verification context for triage. Security-sensitive reports that include exploitable details, secrets, or customer data must use private security advisories instead of public issues.

## Label taxonomy

The canonical repository label taxonomy lives in `.github/labels.yml`.

Label groups:

- `type:*` describes the kind of work
- `area:*` describes the product or platform surface
- `priority:*` describes severity and scheduling pressure
- `risk:*` highlights release, data, security, migration, or external-service risk
- `status:*` describes review, triage, blocked, stale, or merge readiness state
- `owner:*` identifies the expected owner lane when work is split across agents or humans

Labels should be applied consistently during triage. Do not create one-off labels until the taxonomy is updated in the same branch.
