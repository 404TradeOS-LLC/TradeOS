---
status: current
owner: platform
last_verified: 2026-09-22
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
  - docs/decisions/ADR-009-solo-maintainer-founder-merge-exception.md
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
  - .github/workflows/s036-index-evidence.yml
  - app/scripts/s036-index-evidence.sh
  - .github/workflows/stale-pr-check.yml
  - .github/workflows/s027-browser-evidence.yml
  - .github/workflows/docs-reconciliation.yml
  - .github/workflows/merge-readiness.yml
  - .github/workflows/nightly-full-regression.yml
  - .github/workflows/workflow-health-report.yml
  - .github/workflows/rc-smoke.yml
  - .github/workflows/repair-rc-beta-vercel.yml
---

# TradeOS Engineering Command Center

Successor backlog: the 2026-09-22 vertical audit at `main`
`9a27682a575f6c8b13337a61e88cdd7b838dcfe2` confirms that the authenticated
frontend/backend seam is substantial and historically exercised, but the
current head is not beta-certified across every contractor/customer journey.
The audit and limitations are recorded in
`docs/reports/FRONTEND_BACKEND_VERTICAL_AUDIT_2026-09-22.md`. The Sprint Backlog
now owns S051-S100; S051 is `DONE` through merged PR #538, and S053 is the
successor sprint promoted to `READY` in a separate governance PR. S051 added an
executable action-to-route/permission/RLS/refresh/evidence matrix plus drift
validation. It does not certify rendered browser behavior or current-head
browser evidence, and must not repair application behavior or absorb later
vertical sprints.

S027 continuation: the Costbook browser-evidence lane now covers all nine routes
at all four required widths, visible keyboard focus, equipment mutations and
validation errors, and calculated pricing preview. Runtime Beta authentication
replaces the missing stored-session secret. Workflow run `#22` passed the live
evidence contract on `main` at `c7003f3`; its credential-scanned artifact
`#10042902412` was uploaded. S027 and S036 are complete; S036 implementation PR #476 merged on 2026-09-08. Production application of the index remains separately gated.

S049 (stale branch/PR/worktree retirement) is `DONE` as of 2026-09-12: a governance-only readiness promotion (PR #494, merged `0b6f98ad`) reconciled live GitHub state (open PRs #482, #489, #491, #492, #493; PR #470 closed unmerged) and classified 23 remote branches `SAFE_TO_DELETE` and 23 `REQUIRES_REVIEW`. The agent session's credentials could not delete remote refs, so the founder executed the deletions directly; this was independently confirmed against live `origin` state (all 23 gone, everything else untouched) before closing the sprint. The same reconciliation flagged `feat/stripe-connect-payments` (no open PR) and open PR #491 (`feat/stripe-billing-subscriptions`, a separate branch) as two related Stripe billing items still needing a founder decision.

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
- **CodeRabbit repository policy (reversed 2026-09-15):** PR #180 merged as `bdcc4bd1dcbf07abb38dd85a924786b6549040a3`, adding repository-level assertive review guidance with failed commit status when automated review cannot run. Its repository-level configuration (`.coderabbit.yaml`) was deleted on 2026-09-15 after its per-hour review-quota limits repeatedly left stale, uncleared `CHANGES_REQUESTED` reviews blocking otherwise-green, already-repaired PRs. Configuration removal does not by itself revoke the GitHub App's installation or repository access; until an organization administrator uninstalls it (see Known Limitations in the removal PR), it may continue to auto-review with its own default settings. The CI-required checks and manual/agent review in `AGENTS.md` and this document remain the authoritative merge gate regardless of whether the app is still installed.
- *…20834 tokens truncated…atisfy the checker.

Changes to `docs/DOC_OWNERSHIP.yml` itself must include this file (`docs/REPOSITORY_GOVERNANCE.md`, which defines the enforced policy) and `docs/README.md` (the docs entrypoint), not only `docs/ENGINEERING_COMMAND_CENTER.md` — a PR that only touches `DOC_OWNERSHIP.yml` and the Command Center can otherwise change enforced ownership rules without the document that describes them to contributors ever being reviewed.

Ownership is not limited to `app/**` and `web/**`. A package-level data corpus can be its own owning subject with its own README as the canonical entry point, rather than requiring a `docs/modules/*.md` file for every change. `packages/knowledge-engine/README.md` is the first instance of this pattern: it owns the package's canonical-path, provenance, and cleanup-history documentation, separate from `app/modules/knowledge-runtime/README.md`, which owns the live API consumer's documentation.

The Bible does not replace:

- `CURRENT_STATE.md` for verified implementation truth;
- `SPRINT_BACKLOG.md` for executable work;
- `SESSION_HANDOFF.md` for current continuity;
- module docs for detailed implementation contracts;
- accepted ADRs for active architectural rationale;
- research docs for supporting evidence.

## Nightly repository health workflow

`.github/workflows/nightly-repository-health.yml` is a diagnostic maintenance workflow, not a merge-time authority. It may run on schedule or by manual dispatch to re-check drift-sensitive repository health with read-only repository permissions. It must not deploy, mutate production data, weaken required pull-request checks, or automatically convert a nightly failure into repository changes. Any repair prompted by the nightly signal follows the normal reconciliation, PR, verification, and merge controls in this document.

## Preview smoke check workflow

`.github/workflows/preview-smoke-check.yml` is a diagnostic, non-blocking workflow, not a merge-time authority — it is not part of the required-check set. It runs `web/scripts/preview-smoke-check.mjs` against a live Vercel Preview deployment (and, when a backend URL is supplied, the shared staging backend) to catch staging-isolation regressions early; see `docs/DEPLOYMENT_GUIDE.md`'s "Environment architecture" section for the full staging setup this checks against. It has two triggers: `workflow_dispatch` (always reliable, run manually against any known Preview URL) and `deployment_status` (best-effort automatic trigger, filtered to the frontend project's successful Preview deployments). The `deployment_status` filter has not been confirmed against a live event in this repository — if it does not fire as expected, use `workflow_dispatch` rather than loosening the filter blindly. The workflow has read-only repository contents access and only makes outbound HTTP requests to the URLs it is given; it does not deploy, mutate data, or touch Production.

## Beta evidence workflow

`.github/workflows/beta-evidence.yml` is an operator-triggered release-evidence workflow, not a merge-time authority — it is not part of the required-check set. It captures the authenticated contractor workflow against an approved non-production release-candidate deployment at 1440, 1024, 768, and 390 pixels and retains validated artifacts for 30 days. It runs in one of two dispatch modes: `preflight`, which verifies configuration, guards, and credential availability and reports readiness without capturing evidence or claiming a PASS; and `full`, which captures real evidence and therefore creates records in the release-candidate tenant.

The workflow holds read-only repository contents permission, is serialized through the `tradeos-beta-evidence` concurrency group so two runs cannot corrupt shared smoke data, and carries no `continue-on-error` on any release-critical step. It fail-closes before doing anything destructive: production hosts, the Production alias, and `-git-main-` previews are refused outright; environment identity must be explicitly declared and self-consistent; and a mutating run additionally requires a Supabase project ref proving the release-candidate deployment does not share the production database. Authenticated session state is generated at runtime, written outside the working tree, deleted in an `always()` step, and never uploaded; the evidence bundle is scanned for credential material before publication. See [testing/BETA_EVIDENCE.md](testing/BETA_EVIDENCE.md) for the full contract and acceptance criteria.

Beta evidence is UNVERIFIED until a `full` run passes. Neither this document nor the workflow's existence is evidence of live runtime behavior.

## RC beta Vercel repair workflow

`.github/workflows/repair-rc-beta-vercel.yml` is manual-only and requires the exact `CLEANUP_RC` confirmation. It targets only the current TradeOS RC beta frontend/backend Preview deployments, updates branch-scoped Preview `BACKEND_API_URL`, `EMAIL_FROM`, and `APP_BASE_URL`, then redeploys those deployments. It must not be used for Production changes, database changes, or `RESEND_API_KEY` rotation. Its completion proves configuration/deployment actions only; authenticated reset-email smoke is still required to prove delivery.

`.github/workflows/repair-staging-supabase-auth.yml` is manual-only and requires the exact `REPAIR_STAGING_AUTH` confirmation. It writes the public staging Supabase URL only to Preview scope for the `staging` branch, captures the staging SHA and redeploys a matching READY Preview by verified ID, or creates a fresh fixed-branch Preview when none exists. It checks the replacement immutable hostname for matching runtime SHA, database/schema readiness, and invalid Supabase token rejection after issuer initialization. It may not target Production, copy Production secrets, accept an operator-selected deployment target, or change auth policy.

## Production migration history reconciliation

Normal production schema rollout uses the protected migration deployment process, not ad hoc SQL.

The temporary `.github/workflows/reconcile-production-migration.yml` workflow exists only to mark `20260728120000_add_settings_asset_uploads` as already applied after production schema equivalence has been verified. It is `workflow_dispatch` only, uses the `production` Environment approval gate, shares the production migration concurrency group, scopes `DATABASE_ADMIN_URL` to the Prisma steps as `DATABASE_URL`, runs only `prisma migrate resolve --applied` followed by diagnostic `prisma migrate status`, and must not run `prisma migrate deploy` or alter schema objects, policies, or buckets.

PR #30 has landed, but the temporary reconciliation workflow still materializes only `app/prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql` from its pinned `refs/pull/30/head` source. It must fail closed if the ref, path, or pinned SHA-256 checksum cannot be verified, and it must not execute code from the fetched pull-request ref. `prisma migrate resolve --applied` remains a hard-fail step. `prisma migrate status` is diagnostic and non-blocking because known earlier pending migrations can return a nonzero status after the target history row has been recorded.

CI schema validation and migration rehearsal must remain isolated from production. Pull-request verification may exercise the tracked migration path against a disposable database but must never use production credentials, apply pull-request migrations to production, or mutate production migration history.

The `.github/workflows/s036-index-evidence.yml` workflow is a supplemental,
pull-request-scoped evidence lane for the S036 index candidate. It uses a
disposable PostgreSQL service and an isolated synthetic schema, applies the
tracked migration unmodified, captures redacted before/after planner output,
records index size and controlled write observations, rehearses rollback, and
uploads the generated artifact for review. The companion
`app/scripts/s036-index-evidence.sh` cleans up the synthetic schema on exit.
This lane must never use production credentials or data and does not by itself
authorize production application, merge, or an S036 completion claim.

## Session continuity

Every contributor uses the [Canonical Startup Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-startup-flow) and [Canonical Completion Flow](agent-prompts/NEXT_SPRINT_PROTOCOL.md#canonical-completion-flow). Those sections own the reading order, live-state checks, handoff requirements, and completion report; this policy does not define a competing checklist.

`ENGINEERING_COMMAND_CENTER.md` is a concise operating overview, not a running log. `SESSION_HANDOFF.md` is replaced with current truth at the end of a substantive session.

## Pull request readiness

A PR is ready for required review or founder-authorized merge only when:

- work stayed within its approved scope;
- `npm run pr:preflight -- --base origin/main` has been run after the final scope is known;
- required owner documents are present and meaningful;
- the final diff contains no unrelated changes;
- relevant local validation has passed or an external blocker is explicitly documented;
- the PR body contains every required default-template section and a real non-placeholder Summary;
- GitHub required checks are green;
- the branch is up to date;
- deterministic automated-review findings are either repaired or explicitly classified as inapplicable/protected;
- review threads are resolved only after corresponding fixes are verified on the current head;
- the PR description accurately states current scope, validation, limitations, and remaining risks.

If no independent reviewer exists, the PR must also contain the complete
founder-only exception record from ADR-009 before an administrator enables or
uses the merge path. The exception record is not an approval and must not be
used to conceal unresolved findings.

For an otherwise-safe low-risk PR, enabling auto-merge is preferred to waiting for a second manual merge action after the ruleset becomes satisfied. Auto-merge does not waive any required status, freshness, or conversation-resolution condition.

Branch-specific changed-file counts, temporary PR blockers, and validation notes belong in `docs/SESSION_HANDOFF.md` or the pull request body. Do not preserve them as durable governance policy after the branch lands.

## Pull request templates

The default PR template is the required baseline for every pull request. `scripts/pr-body-check.mjs` enforces the presence of its required section headings and a non-template Summary inside the existing `Docs consistency` job so incomplete PR metadata fails early.

It must capture:

- summary, scope, branch, worktree, and linked issue
- startup verification against the Command Center and source-of-truth docs
- allowed-path and forbidden-path compliance
- PR preflight output, documentation impact, and `DOC_OWNERSHIP.yml` review
- exact relevant verification commands, N/A reasons for irrelevant lanes, and blocked checks
- classification of automated-review findings, review-thread resolution status, and auto-merge posture
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


## CodeQL and code-quality autofix

Scheduled and manually dispatched maintenance workflows may generate isolated pull requests for bounded CodeQL remediations or deterministic frontend ESLint fixes. They must preserve required repository checks, immutable action pinning, branch-current validation, and documentation governance. They may not write directly to `main` or autonomously change product behavior, database/schema/migrations, authentication/authorization/RLS, billing semantics, or production trust boundaries.

The CodeQL autofix workflow pins `actions/github-script` v9.0.0 to an immutable commit. Its embedded script must remain compatible with the v9 execution contract: use the injected `github`, `context`, and `core` objects; do not call CommonJS `require('@actions/github')`; and do not redeclare the injected `getOctokit` parameter with `const` or `let`. Moving the action runtime major does not by itself authorize permission, trigger, product, schema, auth/RLS, billing, or production-trust changes.
