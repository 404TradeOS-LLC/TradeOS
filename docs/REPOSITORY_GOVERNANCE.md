---
status: current
owner: platform
last_verified: 2026-08-25
source_of_truth: true
related_code:
  - AGENTS.md
  - .coderabbit.yaml
  - scripts/pr-preflight.mjs
  - scripts/pr-body-check.mjs
  - scripts/sprint-state-check.mjs
  - scripts/live-sprint-evidence-check.mjs
  - scripts/__tests__/pr-preflight.test.mjs
  - scripts/__tests__/pr-body-check.test.mjs
  - .github/workflows/docs-consistency.yml
  - .github/workflows/reconcile-production-migration.yml
  - .github/workflows/verify-repository.yml
  - .github/workflows/deploy-migrations.yml
  - .github/workflows/dependabot-patch-automerge.yml
  - .github/workflows/pr-maintenance.yml
  - .github/workflows/dependency-review.yml
  - .github/workflows/workflow-security.yml
  - .github/workflows/nightly-repository-health.yml
  - .github/workflows/preview-smoke-check.yml
  - .github/workflows/sprint-governance.yml
  - .github/workflows/migration-safety.yml
  - .github/workflows/stale-pr-check.yml
  - .github/workflows/s027-browser-evidence.yml
  - .github/workflows/docs-reconciliation.yml
  - .github/workflows/merge-readiness.yml
  - .github/workflows/nightly-full-regression.yml
  - .github/workflows/workflow-health-report.yml
  - .github/workflows/rc-smoke.yml
  - .github/pull_request_template.md
  - .github/PULL_REQUEST_TEMPLATE/
  - .github/ISSUE_TEMPLATE/
  - .github/labels.yml
  - docs/TRADEOS_BIBLE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/SPRINT_BACKLOG.md
  - docs/SESSION_HANDOFF.md
  - docs/CI_ACCELERATION.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/decisions/ADR-004-worktree-policy.md
---

# Repository Governance

This document defines the required repository workflow for TradeOS. The Bible defines doctrine, the Sprint Backlog defines executable work, and this file defines repository controls and merge discipline.

## Monorepo and AI-agent boundary policy

TradeOS first-party product capabilities remain in one governed monorepo unless a future architecture decision explicitly establishes a separate repository boundary. Codex projects, threads, or agent missions are context and execution boundaries, not repository boundaries; they should operate from the monorepo root while claiming only the paths required for the bounded mission.

Athena is the shared AI/orchestration platform layer. Its canonical package location is `packages/athena/`, and it owns the AI kernel, tool registry, context engine, router, action framework, and shared AI interfaces. Athena must not own Costbook, estimating, dispatch, CRM, Field Tech, or other domain business rules. Domain implementations retain ownership of their data and invariants and expose capabilities to Athena through explicit contracts or tool registration.

Existing `app/` and `web/` deployable boundaries remain authoritative during RC1 hardening. Do not perform broad code movement merely to make the repository resemble a target package layout. Introduce `packages/costbook/` only when shared Costbook logic has a demonstrated reusable package boundary. Any later repository split or dependency-direction change requires explicit architectural documentation and must preserve the source-of-truth hierarchy and CI/governance controls defined here.

Customer magic-link portal changes are governed by ADR-010. They must preserve
the separate non-staff principal, hashed single-use access tokens, short-lived
hashed sessions, forced RLS, customer/tenant resource checks, and the narrow
contract-signing policy; they may not broaden staff roles or legal-signature
claims.

## Live-state verification rule

GitHub rulesets, branch protection, required checks, merge methods, and review requirements are external state. They must be verified directly in GitHub before being described as current.

Do not preserve dated statements such as “no rulesets exist” or “one approval is required” as present truth after configuration may have changed.

This repository's `main` protection is configured entirely through GitHub Rulesets (`GET /repos/{owner}/{repo}/rulesets`), not the legacy branch-protection API. The legacy `GET /repos/{owner}/{repo}/branches/main/protection` endpoint returns `404 Branch not protected` here regardless of the active ruleset — that 404 is expected and does not mean protection is missing. Always check `/rulesets` (and each ruleset's own detail endpoint) before concluding `main` is unprotected.

## Required protection target

Protect `main` with a branch ruleset that:

- requires a pull request before merging;
- requires the branch to be current with `main`;
- requires all configured status checks to pass;
- requires conversation resolution;
- blocks force pushes;
- restricts deletion of `main`.

Expected verification jobs are:

- `Docs consistency` (validates required PR-description structure first, then runs PR-preflight tests, autonomy-reconciliation regressions, and documentation ownership validation);
- `App lint, unit tests, and build` (for pull requests that change `app/**` or `packages/knowledge-engine/**`, runs Prisma schema validation, a high-severity production-dependency audit, TypeScript typechecking, backend unit tests, the `athena:contracts` and `athena:smoke` named gates, the backend build, and a tracked-source cleanliness check; for unrelated pull-request diffs the same required job reports success without expensive setup);
- `App integration tests` (for pull requests that change `app/**` or `packages/knowledge-engine/**`, rehearses the production migration-deployment path against an isolated PostgreSQL instance before the live integration/RLS tests; for unrelated pull-request diffs the same required job reports success without expensive setup and no longer waits for the ordinary app lane before starting);
- `Web lint and build` (for pull requests that change `web/**`, runs a high-severity production-dependency audit, frontend unit tests, lint, build, and a tracked-source cleanliness check; for unrelated pull-request diffs the same required job reports success without expensive setup).

Pushes to `main` run every app, integration, and web lane in full. Pull-request path scoping is an execution optimization, not a branch-protection bypass: the required check names remain unchanged, each required job still reports, and the changed product lane receives its full verification surface.

Within `Verify repository`, App typecheck, unit tests, Athena contracts/smoke, and build/dependency-audit work may run as independent child jobs; Web tests, lint, and build/dependency-audit work may do the same. The existing required summary-job names above remain the stable branch-protection contract, and each summary fails if any required child lane for its changed surface fails. Parallelization changes wall-clock execution, not verification scope.

Supplemental workflows such as `Sprint governance`, `Migration safety`, `PR branch currency`, `Live documentation reconciliation`, `Merge readiness`, authenticated browser evidence, nightly full regression, and workflow-health reporting provide earlier or richer evidence. Their presence in the repository does not make them required branch-protection checks or grant merge authority; only live GitHub ruleset configuration can do that. `docs/CI_ACCELERATION.md` documents their operating intent and credentials/evidence boundaries.

The dedicated `Dependency review` workflow is an additional pull-request security signal. It runs with read-only repository contents access and fails when a pull request introduces a dependency with a known high or critical vulnerability. It complements the package-manager audits in the normal verification workflow; it does not replace them. The workflow uses `actions/dependency-review-action@v5`, whose internal Node 24 runtime is isolated from the explicit Node versions used for TradeOS workload verification. Whether `Dependency review` is a required branch-protection check is live GitHub state and must be verified before being described as enforced.

A green required-check set is the minimum evidence for autonomous merge eligibility. Agents must not weaken, skip, mark non-blocking, or remove a gate merely to make a PR mergeable. A failing security audit, schema validation, migration rehearsal, test, typecheck, lint, build, or clean-tree check in a relevant lane is a real blocker until root-caused and either repaired or explicitly approved through a governance change. S041 PR #351 and its completion-evidence lane are the current example of this one-lane process: legacy SQL role semantics remain fail-closed while application permission gates are verified separately, and the merged evidence records the final repository truth.

The exact GitHub check names remain the source of truth and must be verified before editing the ruleset.

Workflow action implementations must stay on supported action-runtime majors. Upgrading `actions/checkout` or `actions/setup-node` to a supported major is maintenance of the CI execution environment; it does not by itself change the explicit `node-version` values used to test or deploy TradeOS. As of 2026-08-18, workflow checkout call sites are maintained on `actions/checkout@v7.0.1`; this patch refresh does not change application runtime policy.

PR #308 applies the same CI-runtime-maintenance principle to `actions/upload-artifact`, moving the existing RC smoke and S027 browser-evidence artifact steps from v6 to v7 while retaining their normal archived artifact names and paths. The workflows do not set `archive: false` or otherwise opt into v7 direct-upload behavior, and the change does not alter workflow permissions, secrets, triggers, explicit TradeOS Node workload versions, auth/RLS, schema, or product behavior.

The S047 RC smoke workflow is an operator-triggered, non-production evidence
lane. Its workflow inputs offer only Preview and Staging, require a dedicated
smoke-tenant label, separate owner/admin and technician storage-state fixtures,
and a distinct lifecycle auth account, and run the authentication, golden
customer/project/estimate/proposal, contract/invoice/portal, and Dispatch/Field
checks. Mutating golden runs are additionally bound to the approved
`tradeos-costbook-web-*.vercel.app` Preview host pattern. Screenshot publication
is opt-in and requires explicit sanitized-tenant confirmation; the route script
also refuses screenshots when its target environment is production. Workflow
artifact publication always attempts to retain available failure diagnostics,
including the detailed golden report. These controls protect customer data in
CI artifacts without changing product authentication or authorization policy.

Workflow-file changes are also subject to the supplemental `Workflow security` workflow. It runs pinned `actionlint` directly on the GitHub-hosted runner and rejects default-prohibited patterns including `pull_request_target`, `permissions: write-all`, `actions: write`, `id-token: write`, and direct interpolation of untrusted event payload content into shell/script commands. Exceptions require an explicit reviewed governance change. The workflow is not part of the documented required-check set unless live branch protection separately confirms it has been added there.

## Solo-maintainer review posture

TradeOS is currently operated by one repository maintainer. The intended solo-maintainer configuration is:

- pull requests remain mandatory;
- required checks remain mandatory;
- conversation resolution remains mandatory;
- required approving-review count is zero while there is only one maintainer;
- self-review may be recorded as a comment or audit, but it is not treated as independent approval;
- approval requirements may be raised when another qualified maintainer or reviewer joins.

The founder-only merge exception is now an accepted governance path under
[ADR-009](decisions/ADR-009-solo-maintainer-founder-merge-exception.md): when
there is no qualified independent reviewer, the founder may authorize a
founder/administrator merge after the PR records the exception and all
technical gates pass. The record must state the authorization, unavailable
reviewer, risk boundaries, rollback/recovery plan, final-head validation,
required-check evidence, and the trigger for restoring independent review.
It must not claim that self-review is independent approval.

The live ruleset must express this posture without a broad protection bypass:
`required_approving_review_count: 0`,
`require_extra_approval_for_unattributed_changes: false`, and no bypass actor
that can skip required checks, branch freshness, conversation resolution,
linear history, deletion protection, or non-fast-forward protection. The
second setting is the specific solo-maintainer deadlock repair; it removes an
implicit approval requirement while preserving the technical gates. A later
qualified maintainer should cause the approving-review requirement to be raised.

Do not weaken CI, up-to-date requirements, deletion protection, force-push
protection, linear history, conversation resolution, or pull-request
requirements to compensate for the zero-approval setting.

## Verified default-branch controls

On 2026-08-12, and again on 2026-08-17, a read-only live GitHub verification was performed against repository `404TradeOS-LLC/TradeOS`. No repository setting or ruleset was changed by either verification. The 2026-08-17 pass corrected the Copilot-review misattribution noted below; every other bullet in this section was re-confirmed unchanged against the live ruleset.

The active `TradeOS Main Branch Protection` ruleset ([ID 18958081](https://github.com/404TradeOS-LLC/TradeOS/rules/18958081)) targets the default branch and currently contains:

- deletion and non-fast-forward protection;
- mandatory pull requests with zero required approving reviews;
- required review-thread resolution, with neither code-owner review nor last-push approval required;
- strict required-status-check enforcement, which requires the branch to be current before merge;
- the exact required checks `Docs consistency`, `App lint, unit tests, and build`, `App integration tests`, and `Web lint and build`;
- linear-history enforcement;
- allowed pull-request merge methods of **squash and rebase**;
- no configured bypass actors; and
- `current_user_can_bypass: never` for the connected user during verification.

The desired solo-maintainer policy above is not yet fully reflected in this
live snapshot: the verified ruleset still reports
`require_extra_approval_for_unattributed_changes: true` and no bypass actor.
The repository policy is changed by ADR-009, but an administrator must apply
the narrow ruleset configuration change before auto-merge can use it. No broad
ruleset bypass is authorized.

Copilot review is not part of ruleset 18958081 at all — it lives entirely in the separate `Code Quality Copilot review for default branch` ruleset ([ID 19465256](https://github.com/404TradeOS-LLC/TradeOS/rules/19465256)), which is configured for `review_on_push`/`review_draft_pull_requests` but currently shows `enforcement: "disabled"`. Confirmed empirically too: no `Copilot` check run appears in recent PRs' status-check rollups. It must not be described as an active enforcement layer, nor listed alongside ruleset 18958081's controls, unless a later live verification shows it enabled again.

Repository settings were read again on 2026-08-21 and confirmed that GitHub auto-merge is enabled for this repository, squash and rebase merging remain allowed, merge commits remain disabled, and server-side branch updating is available. This settings read does not replace the ruleset-specific verification requirement above.

Re-run live read-only inspection before changing these statements or editing repository controls. Documentation records observed state; GitHub remains authoritative.

## Merge posture

- prefer squash merge for normal feature, fix, and documentation PRs;
- rebase merge is also permitted by the live main ruleset when appropriate;
- do not merge a draft PR;
- do not merge with failing required checks;
- do not merge with unresolved review threads;
- verify the expected head SHA immediately before merge;
- enable GitHub auto-merge for an otherwise-safe low-risk PR when doing so removes a manual wait without weakening any required check, branch-freshness, or conversation-resolution rule;
- only merged evidence may mark a sprint `DONE`.

Dependabot patch auto-merge is a narrow convenience layer, not a branch-protection bypass. `.github/workflows/dependabot-patch-automerge.yml` may enable GitHub auto-merge only when the actor is `dependabot[bot]`, the PR originates from this repository, targets `main`, and Dependabot metadata classifies the update as `version-update:semver-patch`. Minor and major dependency updates remain manual. Enabling auto-merge does not merge immediately; all required status checks, branch-freshness requirements, review-thread resolution, and other live ruleset controls still apply. The workflow runs from the normal `pull_request` event and pins `dependabot/fetch-metadata` to the immutable v3.1.0 commit; its Node 24 action runtime is CI-only and does not change TradeOS application runtime policy.

## Manual PR maintenance workflow

`.github/workflows/pr-maintenance.yml` provides a guarded server-side branch-update path for an explicitly selected pull request. It is `workflow_dispatch` only and must remain operator-triggered rather than automatically mutating every open branch when `main` moves.

The workflow may act only on an open pull request from this repository whose base is `main`. It must reject closed pull requests, fork-originated pull requests, and pull requests targeting another base branch. Its branch update must use GitHub's supported pull-request branch-update/rebase operation rather than custom force-push logic.

PR maintenance does not grant merge authority. After a successful rebase, normal rules still apply: the branch must satisfy required checks, review-thread resolution, current-head verification, and all other live branch-protection requirements. Conflicts or unsupported server-side updates remain a stop condition for manual resolution in a normal git workspace.

## Autonomous maintenance governance

`AGENTS.md` defines the repository-specific execution contract for autonomous maintenance agents. That contract may make low-risk repairs more action-oriented, but it cannot weaken the repository controls in this document.

Autonomous agents may diagnose, repair, test, publish, and merge bounded work
when the live branch rules permit it and the final head satisfies every
required check, up-to-date requirement, review-thread requirement, ownership
requirement, and merge-readiness condition. The ADR-009 founder-only exception
may authorize a protected merge when independent review is unavailable, but it
does not waive technical gates or permit an unrecorded administrator bypass. A
maintenance agent must prefer advancing an existing overlapping PR over
creating a competing implementation.

The following remain founder-decision or PR-only boundaries unless a narrower
approved runbook explicitly authorizes the exact operation: new or materially
changed database migrations, destructive data operations, authentication or
authorization policy changes, RLS redesign, production secrets or credential
rotation, billing or money movement, major architecture or repository-boundary
changes, and new production trust boundaries. ADR-009 changes who may complete
the merge review in the solo-maintainer case; it does not silently approve
those product or operational decisions. Agents must never bypass required
checks, push directly to `main`, or convert an unverified result into a pass.

Athena approval/audit hardening is an example of this protected class: even when the implementation is narrow, any change that adds approval-backed tables, changes RLS policies, or tightens operator review boundaries must stop at a reviewable PR and may not be autonomously merged.

This governance model intentionally separates **technical merge evidence** from **product or operational authority**: green CI is necessary for autonomous merge, but it is not sufficient when the change falls inside a protected human-decision category.

### Pull-request throughput and deterministic repair

PR speed must come from removing avoidable serial work, not weakening verification. Before expensive local checks or PR creation/update, run:

```bash
npm run pr:preflight -- --base origin/main
```

The preflight reuses the documentation-ownership evaluator to report changed paths, exact required owner docs, any missing docs, and the minimum relevant local app/web verification lanes. `npm run pr:preflight:run -- --base origin/main` fails before expensive verification if required docs are still missing, then runs the scoped local plan. Required GitHub checks remain authoritative regardless of the local plan.

Once a PR exists, use one continuous repair loop:

1. inspect current-head CI plus every unresolved review thread;
2. automatically repair deterministic, scoped findings such as objective documentation drift, formatting, lint/type failures, missing behavioral regression coverage, and low-risk localized correctness issues;
3. for CodeRabbit findings with structured fix instructions, `@coderabbitai autofix` may commit the proposed repair directly to the current PR branch, after which the resulting diff and tests must still be inspected;
4. do not auto-apply findings that would change migrations/schema/data, authentication or authorization policy, RLS, billing/money semantics, destructive operations, major architecture/repository boundaries, production trust boundaries, or other protected decisions;
5. prefer tests that execute the real behavior or mocked failure path; source-text assertions are appropriate only when source shape itself is the deliberate repository contract;
6. resolve a review thread only after its fix is present and verified on the current head;
7. rerun failed/relevant checks rather than restarting unrelated successful work when the platform supports it;
8. enable auto-merge when the PR is otherwise safe and leave the protected-branch ruleset as the final merge gate;
9. finish the oldest/highest-value viable PR before opening competing work unless an explicit priority requires otherwise.

PRs should remain surgical. A nearby defect discovered during review should become separate follow-up work when repairing it would materially broaden product semantics, migration scope, authorization, billing behavior, or architecture.

## Reconciliation and duplicate-PR gate

Scheduled and agent-driven implementation must complete the scoped
[Autonomy Reconciliation Preflight](agent-prompts/AUTONOMY_RECONCILIATION.md)
before branch creation. The preflight deepens step 4 of the canonical startup
flow; it does not replace or duplicate that general flow.

New branch creation is prohibited until the task is classified
`NEW_WORK_REQUIRED`. `EXISTING_WORK_FOUND` requires advancing the viable
existing branch or PR wherever technically possible. `NO_ACTION_REQUIRED`
requires an evidence report and no implementation branch.

Substantially overlapping work includes the same bug, acceptance criteria,
files, sprint/task identifier, architecture objective, failing test,
production incident, or documentation requirement. Semantic equivalence
matters; title equality is not required. Before opening a PR, repeat the search
across open, draft, and recently closed PRs. If an open PR already addresses
the objective, update it instead of opening a competitor.

A replacement PR is allowed only when the existing effort is technically
unsalvageable or intentionally superseded. Valid reasons include corrupted or
unrecoverable history, retained secret material, a fundamentally unsafe
approach, branch permissions that prevent continuation, an explicit founder
request, or a rebase that cannot avoid preserving invalid architecture. The
replacement PR must document the reason, link the old PR, close it, avoid a
period with both efforts active, and delete/prune the obsolete branch when
safe.

Named branches in task instructions must be verified. A missing historical
branch is stale task input: inspect `main`, live PRs, and current branches, and
do not recreate it automatically.

## Branch and worktree lifecycle

The executable agent startup and completion sequences are owned only by the [Next Sprint Protocol](agent-prompts/NEXT_SPRINT_PROTOCOL.md). This document owns the repository policy those flows enforce: branch and worktree lifecycle, PR readiness, review, merge, and cleanup. `AGENTS.md`, compatibility checklists, and backend, frontend, docs, or recovery contracts may link to the canonical flows and add lane-specific requirements; they must not duplicate or weaken the general sequence.

Use one clean `main` worktree plus one linked worktree per active mission.

Standard flow:

1. fetch origin;
2. verify exact repository, path, branch, upstream, and clean state;
3. reconcile open/draft/recently closed PRs, branches, commits, and semantic overlap;
4. classify the mission `EXISTING_WORK_FOUND`, `NEW_WORK_REQUIRED`, or `NO_ACTION_REQUIRED`;
5. create one short-lived branch and linked worktree only for `NEW_WORK_REQUIRED`;
6. state allowed paths, forbidden paths, validation, and stop conditions;
7. perform only the approved mission;
8. update required source-of-truth documents in the same branch;
9. run `npm run pr:preflight -- --base origin/main` after the final scope is known, then run the relevant local checks it reports;
10. inspect the complete diff against the correct base;
11. repeat reconciliation, then push normally and open or update one PR with every required default-template section completed;
12. inspect required checks and review threads on the current head, repairing deterministic scoped findings in one continuous loop;
13. enable auto-merge for an otherwise-safe low-risk PR or merge only after review readiness is established;
14. sync `main` and verify the landed content;
15. remove linked worktrees with `git worktree remove`;
16. delete merged or superseded branches when safe;
17. run `git worktree prune`.

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

## Production migration history reconciliation

Normal production schema rollout uses the protected migration deployment process, not ad hoc SQL.

The temporary `.github/workflows/reconcile-production-migration.yml` workflow exists only to mark `20260728120000_add_settings_asset_uploads` as already applied after production schema equivalence has been verified. It is `workflow_dispatch` only, uses the `production` Environment approval gate, shares the production migration concurrency group, scopes `DATABASE_ADMIN_URL` to the Prisma steps as `DATABASE_URL`, runs only `prisma migrate resolve --applied` followed by diagnostic `prisma migrate status`, and must not run `prisma migrate deploy` or alter schema objects, policies, or buckets.

PR #30 has landed, but the temporary reconciliation workflow still materializes only `app/prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql` from its pinned `refs/pull/30/head` source. It must fail closed if the ref, path, or pinned SHA-256 checksum cannot be verified, and it must not execute code from the fetched pull-request ref. `prisma migrate resolve --applied` remains a hard-fail step. `prisma migrate status` is diagnostic and non-blocking because known earlier pending migrations can return a nonzero status after the target history row has been recorded.

CI schema validation and migration rehearsal must remain isolated from production. Pull-request verification may exercise the tracked migration path against a disposable database but must never use production credentials, apply pull-request migrations to production, or mutate production migration history.

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
