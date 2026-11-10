# PR Commander — implementation note

Workstream B deliverable. Branch `feat/pr-commander-autonomous`, base main
`2b116767`. Files: `.github/workflows/pr-commander.yml`,
`scripts/pr-commander-lib.mjs`, `scripts/pr-commander.mjs` (this note).

Read the overlap audit first
(`~/workspace/research_notes/pr-commander-2026-11-10/overlap-audit.md`): the
Commander composes existing pieces and rebuilds none of them.

## Interface contract (pinned by the coordinator, 2026-11-10)

- `isArmed(env)` reads ONLY `TRADEOS_PR_COMMANDER_WRITE_ENABLED` and is true
  only for exactly `"true"`. Absent, `"false"`, `"1"`, `"yes"`, `"TRUE"` are
  all false.
- `evaluateGate(snapshot, opts)` with `opts = { armed }`. The evaluator is
  armed unless opts says otherwise: omitting opts (or `{ armed: true }`)
  lets a ready snapshot return `MERGE_READY`; `{ armed: false }` returns
  `DRY_RUN_ONLY` instead. The dry-run default of the Commander as a whole
  lives in the callers — the workflow's evaluate job and the CLI always pass
  `armed` explicitly (false unless the run is armed via the repository
  variable). A bare `evaluateGate(snapshot)` call is NOT a dry-run.
- `orderMerges(prs)` THROWS an Error naming the cycle on a dependency cycle;
  otherwise returns the PRs base-first.
- `detectStacks(prs)` returns groups of PR objects (arrays), each chain
  ordered base-first. Snapshots carry both `headRefName` and `baseRefName`.
- The ADR-009 requirement is derived from `snapshot.files` (migration files
  trigger it); a standing change request is read from `reviewDecision` and/or
  a `CHANGES_REQUESTED` entry in `reviews`. The review gate is ONLY the
  absence of a standing `CHANGES_REQUESTED`: the live ruleset requires zero
  approving reviews, so a null/absent `reviewDecision` (or
  `REVIEW_REQUIRED`) does not block on its own — the ADR-009 requirement
  comes from the changed files, not from review state.
- `classifyPrFiles(files)` takes plain path strings; `other` is true exactly
  when ≥ 1 file falls in no protected category. Auth covers `auth`,
  `authorization`, `permissions`, `jwt`, `oauth` paths; protected staging
  covers staging/reconcile/deploy workflow files plus `.env.staging` and
  `.env.production`.
- `nextRetryDelayMs(attempt)` is 1-based: attempt 1 → 60 s, 2 → 120 s,
  3 → 240 s, 4+ → null (escalate).
- Verdict mapping: failing required check → `REPAIRABLE`;
  `CHANGES_REQUESTED` / ADR-009-required → `BLOCKED` with `founderItems`
  naming the dismissal / ADR-009 item; `DIRTY` / `CONFLICTING` merge state →
  `BLOCKED` (or `BLOCKED_ESCALATED` after 3 attempts), never `REPAIRABLE` or
  `MERGE_READY`.

Verdict set (worst-first precedence: `BLOCKED_ESCALATED` > `BLOCKED` >
`REPAIRABLE` > `DRY_RUN_ONLY` / `MERGE_READY`): `MERGE_READY`,
`DRY_RUN_ONLY`, `REPAIRABLE`, `BLOCKED`, `BLOCKED_ESCALATED`. The verdict
object is `{ verdict, reasons[], nextActions[], founderItems[], headSha }`.

## Requirement map

1. **Inspect every open PR** — MET. Workflow job `discover` lists all open
   PRs (or one PR on `pull_request` / dispatched `pr_number`); job
   `evaluate` builds an exact-head snapshot per PR with `gh pr view`
   (head SHA, draft, merge state, mergeability, review decision, required-
   check rollup, files, reviews) plus review threads via GraphQL (threads
   are not exposed by `gh pr view`). Incomplete thread pagination aborts
   evaluation for that PR rather than deciding on partial evidence.
2. **Detect failed workflows, actionable findings, conflicts, stale
   branches** — MET. `evaluateGate` classifies every required check
   (green / failed / pending / missing), counts unresolved threads, flags
   `DIRTY`/`CONFLICTING` and `BEHIND` merge states, and treats missing
   required-check evidence as `BLOCKED`, never as green.
3. **Auto-delegate repairable findings; regression tests for behavior
   changes** — MET (armed runs only; see the delegation tiers below).
   Tiers, in order: (a) deterministic repair in Actions — the
   `code-quality-autofix.yml` pattern (ESLint `--fix` on the PR branch,
   verified by `npm test` + lint + build before any push); the workflow's
   repair tier is deliberately narrow in v1 (same-repo PRs whose failing
   check is `Web lint and build`); (b) CodeQL Autofix for security findings
   — the existing `codeql-autofix.yml` is dispatched, never re-implemented;
   (c) CodeRabbit re-review after a repair push (one best-effort request,
   60 s backoff; re-review is externally rate-limited). Copilot Agent Merge
   is NOT available (org: 0 Copilot seats, no billing source, quota failures
   on review) — nothing is built on it; Copilot/Codex are optional,
   human-triggered, best-effort only. This is stated plainly in the workflow
   header. Regression tests: a repair push happens only if the PR branch's
   unit tests + lint + build pass after the fix.
4. **Independent AI review + security checks after each repair** — MET as
   designed, with one honest limit. After a repair push, CodeRabbit
   re-reviews the new head automatically on push, and the workflow requests
   re-review once (best-effort, backoff); the existing required checks and
   CodeQL run on the new head, and the verdict is re-computed only after
   re-reading checks/threads/reviews at the new head. The Commander cannot
   force an independent review into existence (Copilot/Codex are
   quota-blocked; see req. 3) — but under the live ruleset (zero approving
   reviews required) a missing review alone does not block; what blocks is
   a standing `CHANGES_REQUESTED` or an ADR-009 requirement from the files.
5. **Reconcile findings against the NEW exact head; never reuse stale
   evidence** — MET. Every verdict records `headSha` (`headVerdictKey`).
   Job `act` re-reads the snapshot and re-evaluates before ANY write; a
   moved head or a changed verdict stops that PR with no action. The
   repair-attempt counter is keyed per head (`repair-attempts:<sha>:<n>` in
   the verdict comment), so a new head resets the counter.
6. **Auto-resolve threads ONLY when the correction is verified; NEVER
   dismiss blocking reviews** — NOT-ACTIVATED (thread resolution) / MET
   (no dismissal). There is NO dismissal path anywhere in this code: no
   `gh pr review --dismiss`, no dismissal API call. A standing
   `CHANGES_REQUESTED` (including a stale CodeRabbit review on a superseded
   head) is `BLOCKED` with a founder item naming the dismissal, surfaced
   via the verdict comment + `pr-commander:needs-founder` label.
   Thread auto-resolution is NOT wired in v1: no `resolveReviewThread` call
   exists in the workflow or the library. Reason: the thread→fix mapping is
   not established, and resolving a thread without knowing which verified
   correction addresses it would violate the requirement's own "verified
   correction" condition. Threads are resolved by the author/review flow
   after a verified fix on the current head; the verdict comment lists the
   unresolved threads and the next action. This is a deliberate
   fail-closed omission, not an oversight — wire it only when a fix can be
   attributed to specific threads and verified on the new head first.
7. **Identify stacked PRs; dependency-safe merge ordering** — MET.
   `detectStacks` returns base-first chains (e.g. #945 → #960 → #961);
   `orderMerges` returns the merge order (bases first, ties by PR number)
   and THROWS naming the cycle on a cyclic base chain — the workflow then
   merges nothing from the cyclic set. Job `act` processes ready PRs
   strictly in that order and, before merging a stacked PR, verifies its
   base PR is already merged (in this run or earlier); otherwise it skips.
8. **Detect migrations, RLS, auth, environment approvals, protected
   staging** — MET (detection + surfacing; never application).
   `classifyPrFiles` flags migration / RLS / auth / protected-staging
   paths. Migration files trigger the ADR-009 requirement
   (`BLOCKED` + founder item naming the ADR-009 record until the record is
   present). RLS / auth / protected-staging changes are `BLOCKED` with a
   founder item even with an ADR-009 record, because ADR-009 covers the
   merge-review requirement only — it does not approve security or
   operational decisions. The workflow never applies migrations and never
   dispatches staging-apply or migration jobs.
9. **Enable auto-merge ONLY when all gates are satisfied** — MET.
   `MERGE_READY` requires: non-draft, mergeable, merge state `CLEAN`, all
   four required checks green (`Web lint and build`; `App lint, unit tests,
   and build`; `App integration tests`; `Docs consistency`), zero
   unresolved threads, no standing `CHANGES_REQUESTED` (a null/absent
   review decision does not block — the ruleset requires zero approving
   reviews), no protected change, no unrecorded ADR-009 requirement, fewer
   than 3 repair attempts — and the run armed. Auto-merge is
   `gh pr merge --auto --squash`, after a fresh head re-read immediately
   before merging.
10. **Retry transient failures with exponential backoff, max 3 repair
    attempts per head; escalate persistent failures** — MET.
    `nextRetryDelayMs(attempt)` is 1-based: attempt 1 → 60 s, 2 → 120 s,
    3 → 240 s, then `null` (escalate, do not retry). The per-head counter lives
    in the verdict comment (`repair-attempts:<sha>:<n>` — no state file in
    the repo); at 3 attempts the verdict is `BLOCKED_ESCALATED` and the
    Commander stops repairing that head.
11. **Process independent PRs concurrently, branch isolation, concurrency
    limits** — MET. Evaluate job: matrix over PRs with `max-parallel: 4`
    (global evaluation cap) and a per-PR concurrency group
    (`pr-commander-pr-<n>`); each leg checks out `main` only and works on
    its own PR snapshot. All write actions are serialized in one global
    `pr-commander-act` group, in dependency order.
12. **Durable per-PR state record + audit trail with evidence links** —
    MET (decision: artifacts + verdict comment + summary; NO repo state
    file). Workflow artifact `pr-commander-verdicts` (JSON per PR per run:
    snapshot + verdict + run/check/PR evidence links + plan); one Commander
    verdict comment per PR updated in place (marker
    `<!-- tradeos-pr-commander -->`); run summary aggregating every
    verdict. No state file is written to the repo (churn/conflicts) — the
    repair-attempt counter lives in the verdict comment. In dry-run the
    verdict comment is NOT written (dry-run takes zero write actions); its
    body is rendered into the artifact + summary as "would post/update".
13. **Notify the founder only for genuine protected approvals, exhausted
    repairs, or material blockers** — MET (in-repo only). Verdict comment +
    `pr-commander:needs-founder` label, applied (armed runs only) when
    `founderItems` is non-empty. No email, no Resend, no external message
    anywhere in this code.
14. **Do NOT bypass branch protection, merge drafts, self-approve, modify
    production, or spend money** — MET as hard guards in
    `evaluateGate`: draft → `BLOCKED`; any required check not green →
    never `MERGE_READY`; no self-approval path exists (there is no
    `gh pr review --approve` anywhere); no production scope in
    permissions (workflow permissions are read-only except the armed `act`
    job: `contents: write, pull-requests: write, issues: write,
    checks: read, actions: write`); no spending path exists. The workflow
    works WITH live ruleset 18958081 and never creates, edits, enables, or
    disables a ruleset. No `pull_request_target`, no `write-all`,
    least-privilege permissions, SHA-pinned actions, no untrusted
    interpolation.

## Design decisions worth knowing

- **Dry-run is the default, in two layers.** The library evaluator is
  armed unless its caller says otherwise, so the dry-run default lives in
  the callers: the workflow's evaluate job always passes `{ armed: false }`
  and the CLI passes `{ armed: isArmed(process.env) }`. The workflow adds
  a second gate: job `act` runs only on `workflow_dispatch` with
  `mode=armed` AND `vars.TRADEOS_PR_COMMANDER_WRITE_ENABLED == 'true'`.
  Schedule and `pull_request` runs can never act. The variable is the
  founder's switch; no agent enables it.
- **The verdict comment is armed-only.** The brief's phrasing ("comment
  writes beyond the verdict comment") could be read as permitting the
  verdict comment in dry-run, but the dry-run rule ("emit the verdict +
  plan and take no write action") is explicit and fail-closed, so it wins:
  dry-run writes nothing, including the comment.
- **The evaluate job always evaluates dry-run** (`armed: false`), even on
  armed dispatches. Job `act` re-evaluates armed before any write, so a
  verdict that was `DRY_RUN_ONLY` becomes `MERGE_READY` only on a fresh
  head re-read inside the armed job.
- **Repair scope in v1 is intentionally narrow** (same-repo PRs, web lint
  autofix only). Widening it means adding a repair tier with its own
  verification command — not loosening the existing one.
- **CodeRabbit re-review request** (`@coderabbitai review` comment) is a
  single best-effort attempt with a 60 s pause; a failure is logged and
  the run continues. CodeRabbit also re-reviews automatically on push.
- **Schedule: hourly at :17 UTC.** A full sweep is ~19 PRs, read-only;
  hourly keeps the queue moving without the merge-queue's 15-minute
  cadence, and the `pull_request` fast path covers immediacy.

## What this workstream did NOT do (for the coordinator / other workstreams)

- Tests: Workstream C owns `scripts/__tests__/pr-commander-gate.test.mjs`
  and `scripts/__tests__/pr-commander-order.test.mjs` plus the `pr:test`
  wiring in `package.json` — both landed in this worktree while this
  workstream was building, and this workstream modified neither the tests
  nor `package.json` (the `package.json` diff in the worktree is C's). This
  workstream changed no pre-existing file at all and added no lockfile
  changes.
- No docs updates: `docs/DOC_OWNERSHIP.yml` requires workflow changes to
  update `docs/README.md`, `docs/REPOSITORY_GOVERNANCE.md`, and
  `docs/ENGINEERING_COMMAND_CENTER.md` in the same PR — that is PR
  assembly work, not this workstream's deliverable.
- No PR opened, no merge, no repository variable created, no ruleset
  touched. The variable `TRADEOS_PR_COMMANDER_WRITE_ENABLED` does not
  exist yet by design: it must be created by Billy only after he reviews
  this configuration (absent = dry-run, which is the safe default).
- No live run: the workflow has never executed on GitHub. First-run
  verification (dry-run sweep + artifact inspection) is owed after the PR
  lands.

## Local validation performed (2026-11-10, worktree)

- `node --check` on both scripts: pass.
- Lib smoke test via node (all pinned behaviors): bare
  `evaluateGate(ready)` → `MERGE_READY`; `{ armed: false }` →
  `DRY_RUN_ONLY`; `{ armed: true }` → `MERGE_READY`; failing required
  check → `REPAIRABLE`; standing `CHANGES_REQUESTED` → `BLOCKED` with
  dismissal founder item; migration files without ADR-009 → `BLOCKED`,
  with record → ready; `DIRTY` → `BLOCKED`, `DIRTY` + 3 attempts →
  `BLOCKED_ESCALATED`; `detectStacks` on #945/#960/#961 → `[[945, 960,
  961]]`; `orderMerges` → `[945, 960, 961]`; cycle → throws
  `PR dependency cycle detected: 1 -> 2 -> 1`; backoff (1-based)
  `[60000, 120000, 240000, null, null]`; `isArmed` true only for exactly
  `"true"`; `classifyPrFiles` flags migrations, `other` true iff an
  unprotected file exists; `headVerdictKey` returns the SHA or null.
- Workstream C's tests (`scripts/__tests__/pr-commander-gate.test.mjs`,
  `scripts/__tests__/pr-commander-order.test.mjs`, landed in this worktree
  while this workstream was building): **48/48 pass**
  (`node --test` on both files). The first run caught 10 mismatches
  (lib default arming, null-review handling, 1-based backoff, `permissions`
  → auth, `.env.staging` → protected staging); all were fixed in the lib
  to match the pinned contract — no test was modified.
- CLI end-to-end: `--help` works; `--snapshot` (ready, dry-run and armed
  via env var) and `--stdin` (repairable, `--attempts 1` → 120 s backoff)
  print verdict JSON + the dry-run plan. `--pr` (live `gh` fetch) was not
  exercised locally — it needs `gh` auth against the repo and is covered
  by the workflow's own runs.
- Workflow YAML: `python3 -c yaml.safe_load` parses; `actionlint` 1.7.7
  (pinned SHA `023070a2…0757`, same as `workflow-security.yml`) exits 0
  with no findings.
