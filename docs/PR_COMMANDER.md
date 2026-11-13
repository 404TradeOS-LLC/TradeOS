---
status: current
owner: platform
last_verified: 2026-11-11
source_of_truth: true
related_code:
  - .github/workflows/pr-commander.yml
  - scripts/pr-commander.mjs
  - scripts/pr-commander-lib.mjs
  - scripts/__tests__/pr-commander-gate.test.mjs
  - scripts/__tests__/pr-commander-order.test.mjs
  - scripts/__tests__/pr-commander-ai-repair.test.mjs
  - scripts/pr-commander-implementation-note.md
  - .github/workflows/verify-repository.yml
  - .github/workflows/merge-readiness.yml
  - .github/workflows/pr-maintenance.yml
  - .github/workflows/codeql-autofix.yml
  - .github/workflows/code-quality-autofix.yml
  - .github/workflows/stale-pr-check.yml
related_docs:
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/PR_COMMANDER_CONFIGURATION.md
  - docs/decisions/ADR-009-solo-maintainer-founder-merge-exception.md
---

# PR Commander

The PR Commander is the autonomous pull-request coordinator for TradeOS. It
sweeps every open pull request, evaluates each one against the unchanged merge
bar, repairs what is deterministically repairable, requests independent
re-review, and enables auto-merge only when every gate passes — with a durable
verdict record per PR.

It **composes** existing pieces and rebuilds none of them: required checks are
read from `verify-repository.yml`, readiness comes from `merge-readiness.yml`
(extended with threads, branch currency, ADR-009, and file classification),
rebases are dispatched to `pr-maintenance.yml` by the armed `act` job
(founder policy exception for `actions: write`, 2026-11-10; depends on
PR #965's numeric-input fix in that workflow), security fixes are left
to the `codeql-autofix.yml` scheduled run (the Commander never dispatches
it — see "Repair tiers" below), and the lint-autofix pattern comes from
`code-quality-autofix.yml`. See
[PR Commander configuration](PR_COMMANDER_CONFIGURATION.md) for setup, and
`scripts/pr-commander-implementation-note.md` for the 14-requirement map.

## What the Commander is

- A scheduled sweep (hourly at :17 UTC) plus a fast path on every
  `pull_request` event (opened / synchronize / reopened) for the changed PR
  only.
- A gate evaluator (`scripts/pr-commander-lib.mjs`, `evaluateGate`) that
  applies the merge bar to an exact-head snapshot: head SHA, draft state,
  mergeability, review decision, the four required checks, review threads
  (via GraphQL — `gh pr view` does not expose them), changed files, and
  reviews.
- A bounded repair loop: deterministic lint repair on the PR branch
  (verified by unit tests + lint + build before any push), an AI repair
  worker that invokes the installed Codex app once per head for
  REPAIRABLE PRs the deterministic tier could not fix, security
  findings surfaced as founder items and handled by the scheduled
  CodeQL Autofix run (no dispatch from this workflow), and one
  best-effort CodeRabbit re-review request after a repair push.
- A dependency-safe merge orderer: stacked PRs merge base-first
  (`detectStacks` / `orderMerges`); a dependency cycle merges nothing from
  the cyclic set.
- An audit trail: one JSON verdict artifact per PR per run, one verdict
  comment per PR (armed runs only), and a run summary aggregating every
  verdict.

## What the Commander is not

- **Not a reviewer.** It never approves a PR. There is no
  `gh pr review --approve` anywhere in the workflow or the library.
  CodeRabbit is the reviewer of record; the Commander requests its
  re-review after a repair push and treats its threads as the work list.
- **Not a merge bypass.** It works *with* live ruleset 18958081
  (`TradeOS Main Branch Protection`). It never creates, edits, enables, or
  disables a ruleset, never bypasses branch protection, never merges a
  draft, and never merges on pending, missing, or failing required checks.
- **Not a migration or staging operator.** It never applies migrations,
  never dispatches staging-apply or migration jobs, never changes RLS or
  auth on its own authority, and never touches production.
- **Not a review-dismissal tool.** There is no dismissal path anywhere in
  the Commander. A standing `CHANGES_REQUESTED` review — including a stale
  CodeRabbit review on a superseded head — is a founder item, never
  something the Commander clears.
- **Not a thread resolver (v1).** Thread auto-resolution is deliberately
  NOT wired: no `resolveReviewThread` call exists. Threads resolve only
  after a verified correction on the current head, by the author/review
  flow. The thread-to-fix mapping is not established, and resolving without
  it would violate the "verified correction" condition. This is a deliberate
  fail-closed omission, not an oversight.
- **Not a second merge queue.** It uses native auto-merge
  (`gh pr merge --auto --squash`) and never assumes the native merge queue
  is live — the queue ruleset was never applied and its enable variable is
  absent (see the overlap audit).

## Modes

The workflow has three modes, selected by the `workflow_dispatch` input
`mode` (default `dry-run`). The mode is a property of the *run*, not of the
repository.

| Mode | Writes anything? | Verdict comment posted? | When it runs |
| --- | --- | --- | --- |
| `audit` | No — read-only even when the arming variable is set | No | `workflow_dispatch` only |
| `dry-run` | No — emits the verdict + plan (artifact JSON + run summary) and takes no write action | No — the comment body is rendered into the artifact + summary as "would post/update verdict comment" | Default for `workflow_dispatch`; also the behavior of `pull_request` runs, and of schedule runs unless both opt-in variables are exactly `true` |
| `armed` | Yes — but only when the run is *effectively armed* (see below) | Yes — one comment per PR, updated in place | `workflow_dispatch` with `mode=armed` **and** the repository variable set to exactly `"true"`, or a schedule run with **both** opt-in variables set to exactly `"true"` |

**Effectively armed** requires the repository variable `TRADEOS_PR_COMMANDER_WRITE_ENABLED` exactly `"true"` (absent, `"false"`, `"1"`, `"yes"`, `"TRUE"` are all dry-run), AND either:
1. a `workflow_dispatch` with `mode=armed`, OR
2. a `schedule` run with the second variable `TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED` also exactly `"true"` (unattended mode, live since 2026-11-11, PR #967).

`pull_request` runs can **never** act, even if the variables are set. `audit` runs can never act either. Every write call in the `act` job sits behind a single gate (the job `if:`). The `act` job does not call `isArmed()`; its shell steps run `gh` and `git push` directly. Exact `"true"` is enforced by a case-sensitive shell check at the top of the "Apply verdicts" step, before any write — the job `if:` compares strings case-insensitively, so it alone cannot enforce the exact value. The evaluate job always evaluates dry-run (`armed: false`), even on armed dispatches; the `act` job re-evaluates with `armed: true` on a fresh head re-read before any write. The `act` job gate re-checks the raw variables at job admission (after discovery), so flipping `TRADEOS_PR_COMMANDER_WRITE_ENABLED` off before the act job starts prevents it from running; flipping `TRADEOS_PR_COMMANDER_UNATTENDED_ENABLED` off prevents scheduled runs only (a manual armed dispatch does not check it) — but neither stops an already-running act job; cancel a running act job separately (see the rollback instructions in the configuration document).

**Dry-run is the default, in two layers.** The library evaluator is armed
unless its caller says otherwise, so the dry-run default lives in the
callers: the workflow's evaluate job and the CLI always pass `armed`
explicitly. The workflow adds the second gate above. A bare
`evaluateGate(snapshot)` call is NOT a dry-run — do not assume it is.

## The merge bar (unchanged)

The Commander encodes the existing auto-merge readiness contract
(`AGENTS.md`, 12 conditions) plus live ruleset 18958081. It does not weaken
or reinterpret it. A PR is merge-ready only when **all** of these hold at one
exact head SHA:

- non-draft;
- mergeable, merge state `CLEAN` (current branch — strict required checks
  require it);
- all four required checks green:
  - Only a completed `SUCCESS` conclusion counts. `SKIPPED` and `NEUTRAL` are not proof that required validation executed and therefore cannot yield `MERGE_READY`, even when GitHub branch protection itself accepts those conclusions. This is a deliberate fail-closed gate.
  - `Web lint and build`
  - `App lint, unit tests, and build`
  - `App integration tests`
  - `Docs consistency`
- zero unresolved review threads;
- complete, validated review-thread evidence is mandatory. A missing GraphQL response, incomplete pagination, or malformed thread totals yields `BLOCKED` (not zero unresolved), including when the standalone CLI reads a PR. Only an explicit complete zero-thread result certifies none are open;
- no standing `CHANGES_REQUESTED` review. The review gate is ONLY the
  absence of a standing change request: the live ruleset requires zero
  approving reviews, so a null/absent `reviewDecision` (or
  `REVIEW_REQUIRED`) does not block on its own;
- no protected change (migration / RLS / auth / protected staging) without
  a founder decision;
- no unrecorded ADR-009 requirement (see below);
- fewer than 3 repair attempts on this head;
- and the run is armed.

A `DIRTY`/`CONFLICTING` branch gets no `pull_request` CI runs at all
(#918 lesson), so conflicts are `BLOCKED` and routed to human resolution —
missing CI is never read as green. Missing required-check evidence is
`BLOCKED`, never green.

## Gate table — verdicts

`evaluateGate` returns one verdict per PR, standing on one exact head SHA
(`headSha`). Precedence is worst-first: `BLOCKED_ESCALATED` > `BLOCKED` >
`REPAIRABLE` > `DRY_RUN_ONLY` / `MERGE_READY`.

| Verdict | Meaning | What happens next |
| --- | --- | --- |
| `MERGE_READY` | All gates pass **and** the run is armed. | `act` re-reads the head, re-evaluates, and — only if the fresh verdict is still `MERGE_READY` at the same SHA — enables auto-merge (`gh pr merge --auto --squash`). Stacked PRs merge base-first; a stacked PR is skipped until its base PR has merged (in this run or earlier). |
| `DRY_RUN_ONLY` | All gates pass but the run is not armed. | Nothing is merged. The verdict + plan are recorded in the artifact and summary. This is the proof the gates work. |
| `REPAIRABLE` | A repairable defect: a failing required check, unresolved review threads, or a behind branch. | Armed runs attempt bounded deterministic repair (see below). Dry-run runs report the plan only. |
| `BLOCKED` | A hard stop: draft, conflict, missing/pending required-check evidence, a standing `CHANGES_REQUESTED`, an ADR-009 record required but absent, or a protected change needing a founder decision. A `BLOCKED` merge state is a hard stop only when its cause is a standing change request or is otherwise unexplained — when the block is attributable to failing checks, the verdict is `REPAIRABLE` (see below). | No auto-merge from here. Founder items (if any) are surfaced via the verdict comment + `pr-commander:needs-founder` label (armed runs only). |
| `BLOCKED_ESCALATED` | Repair attempts exhausted (3 per head). | The Commander stops repairing that head. Founder item: decide whether to abandon, re-scope, or hand-repair it. |

Every verdict carries `reasons[]`, `nextActions[]`, `founderItems[]`, and
`headSha`. A verdict that was `DRY_RUN_ONLY` becomes `MERGE_READY` only on a
fresh head re-read inside the armed job — a moved head or a changed verdict
stops that PR with no action.

**`BLOCKED` merge state is not always a hard stop.** GitHub reports merge
state `BLOCKED` whenever a required check fails, so the gate distinguishes
the cause from the snapshot evidence: a block attributable to failing
checks, with no standing change request, is `REPAIRABLE` (the repair tiers
exist for exactly those PRs); a block caused by a standing
`CHANGES_REQUESTED`, or a block with no failing check and no review to
explain it, stays `BLOCKED`. An unconditional demotion here previously made
the "failing required check → `REPAIRABLE`" mapping unreachable in
practice — proven by the Phase 4 validation on PR #970 (failing required
check, no standing change request, verdict `BLOCKED` before this fix).

### ADR-009 gate

The ADR-009 requirement is derived from the PR's changed files: migration
files trigger it (as does an explicit PR-only/human-decision category flag).
A PR that needs the founder-only merge exception
([ADR-009](decisions/ADR-009-solo-maintainer-founder-merge-exception.md)) is
`BLOCKED` with a founder item until the complete record is present in the PR:
explicit founder authorization and the reason independent review is
unavailable, scope / risk boundaries / rollback plan, final-head SHA and
green required-check evidence, resolved conversations and current branch,
confirmation of no unresolved security / tenant / migration / financial /
contractual / production finding, and the owner + trigger for restoring
independent review.

ADR-009 covers the merge-review requirement **only**. RLS, auth, and
protected-staging changes stay `BLOCKED` with a founder item even with an
ADR-009 record, because the exception does not approve security or
operational decisions.

### Protected-file classification

`classifyPrFiles` flags changed paths (fail-closed — an ambiguous path is
flagged, and flagging only ever routes the PR to founder review):

- **migrations** — `prisma/migrations/`, any `/migrations/` path, or
  `migration` in the path;
- **RLS** — `rls`, row-level-security, or force-row-level-security paths;
- **auth** — `auth`, `authorization`, `permissions`, `jwt`, `oauth`, or
  `middleware/auth` paths;
- **protected staging** — deploy/staging/reconcile workflow files,
  `.env.staging`, `.env.production`, deploy-migrations / reconcile
  workflows, `staging-orchestrator`, or production-migration paths.

## Arming procedure

Arming is **Billy's decision only**. No agent enables the variable.

1. Review this document, the configuration document, the workflow header,
   and the implementation note.
2. Complete the activation checklist below.
3. Create the repository variable (see
   [PR Commander configuration](PR_COMMANDER_CONFIGURATION.md)): name
   `TRADEOS_PR_COMMANDER_WRITE_ENABLED`, value exactly `true`.
4. Dispatch the workflow manually from the Actions tab:
   `pr-commander.yml` → Run workflow → `mode: armed` (optionally a single
   `pr_number`, or `0` for all open PRs).
5. Watch the run: the `act` job runs only when both arming conditions hold.
   If either is missing, the run is a dry-run and nothing is written.

> **Warning:** setting the variable alone arms nothing — a dispatch with
> `mode=armed` is still required for every acting run, and schedule /
> `pull_request` runs can never act. Conversely, do not set the variable
> until the activation checklist is complete: once it exists, any armed
> dispatch will write.

To disarm, remove the variable (or set it to anything other than exactly
`"true"`) — see the configuration document. Disabling the workflow in the
Actions tab stops schedule runs as well.

## Per-PR lifecycle walkthrough

1. **Discover.** Job `discover` resolves the mode and arming, then lists the
   PRs to evaluate: all open PRs (schedule / dispatch with `pr_number: 0`),
   one dispatched PR, or the single changed PR on a `pull_request` event.
2. **Evaluate (read-only, max 4 in parallel).** For each PR, job `evaluate`
   checks out `main` (never a PR head) and builds an exact-head snapshot
   with `gh pr view` (head SHA, draft, merge state, mergeability, review
   decision, required-check rollup, files, reviews) plus review threads via
   GraphQL. Incomplete thread pagination aborts evaluation for that PR
   rather than deciding on partial evidence. The per-head repair-attempt
   counter is read from the verdict comment
   (`repair-attempts:<sha>:<n>`); a new head resets the counter to 0.
   `evaluateGate` produces the verdict, which is written to a per-PR
   `pr-commander-verdict-<n>` artifact (JSON per PR per run: snapshot +
   verdict + evidence links + plan) and the run summary.
3. **Report / order.** Job `report` aggregates all verdicts, detects
   stacked PRs, computes the dependency-safe merge order (base-first; a
   cycle yields an empty ready list and merges nothing from the cyclic
   set), and lists founder items and escalated PRs in the summary.
4. **Act (armed only, serialized).** Job `act` runs only on an effectively
   armed dispatch. All write actions are serialized in the single global
   `pr-commander-act` concurrency group, in dependency order. For each
   ready PR it re-reads the snapshot at the exact head and re-evaluates;
   a moved head or changed verdict stops that PR with no action. Only then
   does it upsert the verdict comment and enable auto-merge. For every
   other PR it re-reads the head, applies the founder label when
   `founderItems` is non-empty, dispatches CodeQL Autofix once per run if
   a security finding is present, and attempts bounded deterministic repair
   for `REPAIRABLE` PRs (below), then upserts the verdict comment.
5. **Verdict comment.** One comment per PR, updated in place, marked
   `<!-- tradeos-pr-commander -->`, carrying the verdict, head SHA, reasons,
   next actions, founder items, evidence links, and the
   `repair-attempts:<sha>:<n>` counter. Armed runs only.

### Repair, in order (armed runs only)

1. **Deterministic repair first, in Actions** — the
   `code-quality-autofix.yml` pattern, per-PR and deliberately narrow in
   v1: same-repo PRs whose failing check is `Web lint and build` get
   ESLint `--fix` on the PR branch, verified by `npm test` + lint + build
   before any push. Repair pushes use real `git push` from the runner —
   never the REST git-data API, because API-pushed commits emit no push
   event and never trigger `pull_request` CI. A repair push happens only
   if the verification passes; otherwise the branch is restored and
   nothing is pushed.
   **Push-credential requirement:** GitHub's default `GITHUB_TOKEN` does
   not trigger `pull_request` workflows when it pushes. The armed repair
   checkout uses the founder-installed, repo-scoped Actions secret
   `TRADEOS_PR_COMMANDER_PUSH_TOKEN` when present. If it is absent, the
   checkout persists **no** git credentials and the deterministic repair
   branch skips without attempting a push or consuming a repair attempt.
   A warning identifies the missing setup; no agent creates the secret.
   See [PR Commander configuration](PR_COMMANDER_CONFIGURATION.md#dedicated-repair-push-credential-founder-setup-not-an-arming-control).
2. **Rebase for behind branches** — for a `REPAIRABLE` verdict whose
   branch is behind `main`, the armed `act` job dispatches
   `pr-maintenance.yml` (`gh workflow run pr-maintenance.yml --ref main
   -f pr_number=<n>`). The dispatch is async: that workflow validates
   (open, base `main`, same-repo) and rebases the branch; the Commander
   re-evaluates at the new head on the next run. One dispatch counts as
   one repair attempt on the head (cap 3). Fork PRs and non-`main` bases
   are never dispatched. Requires the founder policy exception for
   `actions: write` (2026-11-10) on the `act` job and PR #965's
   numeric-input fix in `pr-maintenance.yml` (a dispatched `pr_number`
   arrives as `953.0` without it).
3. **CodeQL Autofix for security findings** — the existing
   `codeql-autofix.yml` is **not dispatched from this workflow and never
   re-implemented here**: the founder policy exception for `actions: write`
   (2026-11-10) covers the pr-maintenance dispatch only. Security
   findings are surfaced as founder items in the verdict comment and
   handled by the `codeql-autofix.yml` scheduled run (every 2h) on its
   own cadence. On-demand dispatch is still unwired: wiring it is a
   separate change, either a wider exception (a founder decision) or a
   `workflow_call` restructure of `codeql-autofix.yml`.
4. **AI repair worker (Codex)** — after the deterministic tier does not
   push and no rebase was dispatched, the armed `act` job may invoke the
   already-installed ChatGPT Codex GitHub app once per head on a
   `REPAIRABLE` same-repo PR. The invocation is a single
   `@codex address that feedback` comment (the trigger Codex's own review
   receipt documents), built by `buildAiRepairComment` in
   `scripts/pr-commander-lib.mjs`: the failing check names, the run link,
   the unresolved-thread count, the scope limits (only the files the fix
   needs; never migrations, auth, RLS, workflow files, or production
   config; push to this PR's branch only), and the prohibitions (never
   approve, merge, dismiss a review, or resolve a thread). Eligibility is
   enforced by `isAiRepairEligible` in the same module: not a draft, not
   conflicting, not behind (rebase first), no protected files in the PR
   (fail-closed via `classifyPrFiles`), same-repo only, repair attempts
   remain, no prior AI invocation on this head, and something to address
   (a failing check or unresolved threads) — and every required input must
   be present and well-formed, or the PR is ineligible (missing evidence
   never reads as eligible). One invocation counts as one
   of the 3 per-head repair attempts and is recorded as
   `ai-repair:<sha>:<n>` in the verdict comment. The attempt is reserved
   in the verdict comment *before* the invocation posts: the live head is
   re-checked immediately before posting (a moved head skips the
   invocation without consuming an attempt), then the reservation is
   written, and the comment posts only if that write succeeds. If the
   post fails after a successful reservation, the reservation stands —
   the attempt is consumed, never silently retried on this head. Codex works in its own
   cloud environment; a push creates a new head, fresh CI runs, and the
   Commander re-evaluates on its next run. The merge bar still decides
   every merge — the worker cannot merge anything on its own.
   **Validation status:** Codex's push to a PR branch in THIS repo is
   UNCONFIRMED until the end-to-end validation run observes it (zero
   Codex commits exist in this repo), as is whether Codex responds to a
   mention from `github-actions[bot]`. A no-response is recorded by the
   attempt counter, never silently retried. Do not claim the push works
   until it is observed.
5. **CodeRabbit re-review** — after a repair push, one best-effort request
   (`@coderabbitai review`, after a 60 s backoff). CodeRabbit also
   re-reviews automatically on push. Re-review is externally rate-limited:
   one best-effort request with backoff, never a retry loop.

### Copilot gap — stated plainly

**Copilot Agent Merge is NOT available as a reliable delegation path, and
nothing in the Commander depends on it.** Verified live 2026-11-10
(overlap audit §3) and re-verified 2026-11-11: the org has 0 Copilot
seats, no billing source, and Copilot review quota failures on request;
the Copilot code-review ruleset (19465256) is disabled; the two prior
Copilot agent PRs (#695, #922) both closed unmerged (0-for-2). The
Claude GitHub app is installed org-wide but has no repo wiring and zero
observed activity on TradeOS — it is not a path either. The AI repair
worker delegates to Codex instead (see "Repair, in order" step 4): the
Codex connector is installed on this repo and reviews PRs, but its
repair push is UNCONFIRMED until the end-to-end validation observes it.
Until that observation, the deterministic tier is the ceiling for
verified repairs.

## Founder notification contract

In-repo only: the verdict comment plus the `pr-commander:needs-founder`
label. **No email, no Resend, no external message of any kind.**

The label is applied (armed runs only) when a PR's verdict carries one or
more `founderItems`. Founder items are raised for genuine protected
approvals, exhausted repairs, or material blockers only:

- a standing `CHANGES_REQUESTED` review — dismissal is founder-only
  (including stale CodeRabbit reviews on superseded heads; on PR #915 three
  such reviews blocked the merge until all were dismissed);
- an ADR-009 record required but absent;
- a protected change (migration / RLS / auth / protected staging) needing
  a founder decision;
- repair attempts exhausted on a head (`BLOCKED_ESCALATED`);
- a draft that would need an undraft decision (undraft only when READY, and
  only on the founder's word);
- a dependency cycle (nothing merges from the cyclic set).

The following remain founder-only and are never performed by the Commander:
review dismissals, undraft decisions, staging-apply gate clicks, production
touches of any kind, new/materially changed migrations, destructive data
operations, auth/authorization or RLS changes, production secrets or
credential rotation, billing/money movement, and major architecture or
trust-boundary changes.

## Failure and escalation behavior

- **Missing/pending required checks** → `BLOCKED`. Never read as green.
- **Conflict (`DIRTY`/`CONFLICTING`)** → `BLOCKED`, routed to human
  resolution. The Commander never rebases a conflicting branch itself; a
  clean rebase goes through the governed `pr-maintenance.yml` dispatch.
- **Behind branch** → `REPAIRABLE` (rebase via `pr-maintenance.yml`, then
  re-evaluate at the new head).
- **Repair attempts** — max 3 per exact head SHA, with backoff 60 s / 120 s /
  240 s (`nextRetryDelayMs`: attempt 1 → 60 s, 2 → 120 s, 3 → 240 s, 4+ →
  null). At 3 attempts the verdict is `BLOCKED_ESCALATED` and the Commander
  stops repairing that head. A new push (new head SHA) resets the counter.
- **Moved head** — any verdict stands on one exact head SHA. Before any
  write, `act` re-reads the snapshot at the exact head and re-evaluates; a
  moved head or a changed verdict stops that PR with no action. The fresh
  verdict is reported in the comment instead.
- **Dependency cycle** — `orderMerges` throws naming the cycle; the report
  job merges nothing from the cyclic set and surfaces it as a founder item.
- **Incomplete evidence** — paginated/incomplete review-thread evidence
  aborts evaluation for that PR rather than deciding on partial evidence.
- **Fork PRs** — no repair push (repair is same-repo only).
- **Concurrency** — evaluate matrix `max-parallel: 4`; per-PR concurrency
  groups (`pr-commander-pr-<n>`); all writes serialized in one global
  `pr-commander-act` group, in dependency order.

## State and audit trail

- One workflow artifact per evaluated PR, `pr-commander-verdict-<n>`
  (JSON per PR per run: snapshot + verdict + evidence links + plan),
  retained 30 days. Per-PR names are required: upload-artifact v4
  cannot upload to the same artifact name from multiple matrix jobs.
- One Commander verdict comment per PR, updated in place, marked
  `<!-- tradeos-pr-commander -->` (armed runs only).
- Run summary aggregating every verdict, the merge order, founder items,
  and escalated PRs.
- **No state file in the repo** (churn/conflicts). The per-head
  repair-attempt counter lives in the verdict comment as
  `repair-attempts:<sha>:<n>`, and the per-head AI invocation counter
  lives beside it as `ai-repair:<sha>:<n>` (at most one invocation per
  head; a new head resets both).

## Activation checklist (Billy must complete before write mode)

- [ ] **Verify the live ruleset.** Read ruleset 18958081
  (`TradeOS Main Branch Protection`) directly in GitHub: four required
  checks, squash + rebase only, required thread resolution, strict branch
  freshness, zero required approving reviews, no bypass actors. Confirm
  `require_extra_approval_for_unattributed_changes` is `false` — the
  narrow ADR-009 ruleset change was applied live 2026-11-10; see the
  correction note in
  [Repository Governance](REPOSITORY_GOVERNANCE.md#verified-default-branch-controls).
  GitHub is authoritative; do not rely on dated documentation.
- [ ] **Verify the variable does not exist yet** (absent = dry-run, the safe
  default), then create it only when ready — see the configuration
  document. No agent creates or enables it.
- [ ] **Provision the isolated repair-push credential, if automatic repairs
  are desired.** Create the founder-controlled repo-scoped
  `TRADEOS_PR_COMMANDER_PUSH_TOKEN` Actions secret with CI-triggering
  push permissions. If absent, automatic repair pushes must remain
  disabled, even in an armed run. This secret does not replace the
  separate explicit arming variable and manual dispatch.
- [ ] **Review a dry-run sweep.** Dispatch `mode=dry-run` (or wait for an
  hourly schedule run), inspect the `pr-commander-verdict-<n>` artifacts and
  the run summary, and confirm the verdicts match the known state of the
  open PRs — and that no write action occurred (no comments, no labels,
  no merges, no repair pushes).
- [ ] **Confirm the Copilot gap is understood.** Copilot Agent Merge is not
  available (0 org seats, quota failures, disabled review ruleset); the
  Commander delegates to deterministic repair, CodeQL Autofix, and
  CodeRabbit re-review instead. No Copilot seat purchase or billing change
  is implied by activating the Commander.
- [ ] **Confirm the founder-only boundaries.** Review dismissals, undraft
  decisions, staging-apply clicks, and production touches stay Billy's,
  per PR / per item. The Commander surfaces them; it never performs them.
- [ ] **Confirm the first armed run is watched.** Dispatch the first
  `mode=armed` run manually (single PR first is the safe choice), watch
  the `act` job, and inspect the verdict comments it posts before
  dispatching armed sweeps over all open PRs.
