---
status: current
owner: platform
last_verified: 2026-11-10
source_of_truth: true
related_code:
  - .github/workflows/pr-commander.yml
  - scripts/pr-commander.mjs
  - scripts/pr-commander-lib.mjs
related_docs:
  - docs/PR_COMMANDER.md
  - docs/REPOSITORY_GOVERNANCE.md
---

# PR Commander configuration

Setup and operating instructions for the PR Commander
(`.github/workflows/pr-commander.yml`). For what the Commander is, its modes,
verdicts, and founder boundaries, see
[PR Commander](PR_COMMANDER.md). **Arming is Billy's decision only — no
agent creates or enables the arming variable.**

## Repository variable setup

The Commander is dry-run by default. It acts only when BOTH of these hold:

1. the repository variable below is exactly `"true"`, AND
2. a `workflow_dispatch` runs with `mode=armed`.

### Create the variable (founder only, after the activation checklist)

1. Go to the repository on GitHub → **Settings → Secrets and variables →
   Actions → Variables** tab → **New repository variable**.
2. Name (exact): `TRADEOS_PR_COMMANDER_WRITE_ENABLED`
3. Value (exact): `true`
4. Save.

The value is case-sensitive and exact: absent, empty, `"false"`, `"1"`,
`"yes"`, or `"TRUE"` are all dry-run. The CLI/library gate `isArmed()`
reads only this variable and is true only for exactly `"true"`.

Do not create this variable until the activation checklist in
[PR Commander](PR_COMMANDER.md#activation-checklist-billy-must-complete-before-write-mode)
is complete. Absent = dry-run, which is the safe default — the variable
does not exist yet by design.

### Verify the variable

- List repository variables:
  `gh api repos/404TradeOS-LLC/TradeOS/actions/variables --jq '.variables[].name'`
  (the value itself is not secret, but GitHub does not return variable
  values through the API — confirm the value in Settings, or confirm
  behavior from a dispatch: a dispatch with `mode=armed` reports
  `effectively armed: true` in the run summary only when the variable is
  exactly `"true"`).
- A variable that returns 404 does not exist — that is the expected
  pre-activation state.

## Workflow inputs

`workflow_dispatch` inputs for `.github/workflows/pr-commander.yml`:

| Input | Type | Default | Meaning |
| --- | --- | --- | --- |
| `pr_number` | number | `0` | PR to evaluate, or `0` for all open PRs (up to 50). A dispatched PR that is not open evaluates nothing. |
| `mode` | choice | `dry-run` | `audit` (read-only even when the variable is set), `dry-run` (verdict + plan, no writes), or `armed` (acts only when effectively armed — see above). |

There is no input that arms the Commander by itself: `mode=armed` without
the variable set to exactly `"true"` is still a dry-run.

## Schedule

- **Hourly sweep at :17 UTC** — cron `"17 * * * *"`. Read-only: schedule
  runs can never act, even if the variable is set.
- **Fast path** — `pull_request` events (`opened`, `synchronize`,
  `reopened`) evaluate only the changed PR, read-only. This covers
  immediacy, so the sweep does not need a faster cadence.

## Concurrency limits

- **Evaluation:** matrix over PRs with `max-parallel: 4` (global
  evaluation cap), plus a per-PR concurrency group
  (`pr-commander-pr-<n>`, `cancel-in-progress: false`).
- **Writes:** all write actions are serialized in one global
  `pr-commander-act` concurrency group, in dependency order (stacked PRs
  merge base-first). Merge actions must be serialized in dependency order.
- **Timeouts:** discover 5 min, evaluate 10 min per PR, report 5 min,
  act 30 min.

## How to run a dry-run dispatch

1. GitHub → **Actions → PR Commander → Run workflow**.
2. Leave `mode` at `dry-run` (or pick `audit` for a strictly read-only
   run). Set `pr_number` to a single PR to scope the run, or `0` for all
   open PRs.
3. Run workflow.

Or from the CLI:

```bash
gh workflow run pr-commander.yml --repo 404TradeOS-LLC/TradeOS \
  -f mode=dry-run -f pr_number=0
```

## How to verify a dry-run produced no writes

A dry-run must leave **zero** trace on any PR. Check all of these:

1. **Run summary** — the summary states the mode and
   `effectively armed: false`, and lists each PR's verdict. A
   `DRY_RUN_ONLY` verdict means "all gates pass, nothing may be merged."
2. **Artifact** — download the `pr-commander-verdicts` artifact (retained
   30 days). Each `pr-<n>.json` carries `armed: false`, the verdict,
   reasons, next actions, founder items, and evidence links. The comment
   body is rendered there as "would post/update verdict comment" — it is
   not posted.
3. **No verdict comment** — no PR carries a comment containing
   `<!-- tradeos-pr-commander -->` from this run. (The comment is written
   only by armed runs.)
4. **No label** — no PR gained the `pr-commander:needs-founder` label from
   this run.
5. **No merges, no repair pushes, no dispatches** — check the run's
   `act` job: on a dry-run dispatch it is skipped entirely (its `if:`
   requires `workflow_dispatch` + variable `"true"` + `mode=armed`).
   No PR shows a new commit from `github-actions[bot]`, no auto-merge was
   enabled, and no `codeql-autofix.yml` run was dispatched by this run.

If any of those checks fails — a comment, label, merge, push, or dispatch
appeared from a dry-run — stop, do not arm, and report it: that is a
Commander defect, not expected behavior.

## How to run an armed dispatch (after activation)

1. Confirm the variable is exactly `"true"` (Settings → Variables).
2. Dispatch with `mode=armed`, scoped to one PR first:
   `pr_number=<n>`. Watch the `act` job and inspect the verdict comment
   it posts before dispatching armed sweeps over all open PRs.
3. For a full sweep, dispatch with `pr_number=0`.

```bash
gh workflow run pr-commander.yml --repo 404TradeOS-LLC/TradeOS \
  -f mode=armed -f pr_number=<n>
```

The `act` job re-reads every PR's snapshot at the exact head and
re-evaluates before any write; a moved head or a changed verdict stops
that PR with no action.

## How to disable

Either step alone stops all write action; both together fully stop the
Commander:

1. **Disarm (recommended first step):** delete the repository variable
   `TRADEOS_PR_COMMANDER_WRITE_ENABLED` (Settings → Secrets and variables
   → Actions → Variables → Delete), or set it to anything other than
   exactly `"true"`. With the variable absent, every run — including
   `mode=armed` dispatches — is a dry-run.
2. **Stop the schedule:** disable the workflow in the Actions tab
   (Actions → PR Commander → ⋯ → Disable workflow). This stops hourly
   sweeps; manual dispatches remain possible until re-enabled.

Removing the variable does not remove verdict comments or labels already
posted by earlier armed runs. Those are ordinary PR comments/labels: the
comment is the durable verdict record for its head, and the label is
removed with `gh pr edit <n> --remove-label "pr-commander:needs-founder"`
once the founder item is resolved.

## What to check after first activation

After the first armed run (single PR, watched live):

- [ ] The `act` job ran (not skipped) and its summary lists what it did.
- [ ] The verdict comment on the PR shows the correct verdict, head SHA,
      reasons, next actions, and founder items — and the
      `repair-attempts:<sha>:<n>` counter line.
- [ ] If the PR was `MERGE_READY`, auto-merge was enabled at exactly the
      head SHA in the verdict — and the merge itself was gated by the live
      ruleset (required checks, thread resolution, branch currency).
- [ ] If the PR had founder items, the `pr-commander:needs-founder` label
      was applied.
- [ ] If the PR was `REPAIRABLE` with a web-lint failure, at most one
      repair attempt was made, the repair was verified by unit tests +
      lint + build before pushing, and the attempt counter incremented.
- [ ] No PR outside the dispatched scope was touched.
- [ ] No ruleset, branch protection, secret, or environment was changed
      by the run (the Commander never changes any of these — verify it
      didn't).

Then repeat the dry-run verification above on the next scheduled sweep to
confirm read-only runs still produce no writes.

## Local CLI (development / debugging only)

The evaluator and CLI live in `scripts/`:

```bash
node scripts/pr-commander.mjs --help
node scripts/pr-commander.mjs --snapshot snapshot.json --mode dry-run
```

`--snapshot` reads a `gh pr view` JSON snapshot; `--stdin` reads one from
stdin; `--pr <n>` fetches a live snapshot with `gh` (needs `gh` auth).
The CLI passes `armed` explicitly from `isArmed(process.env)` — a bare
`evaluateGate(snapshot)` call in the library is NOT a dry-run. Local runs
never post comments or merge; only the GitHub workflow's `act` job writes.

Tests: `node --test scripts/__tests__/pr-commander-gate.test.mjs
scripts/__tests__/pr-commander-order.test.mjs` (48 tests; also wired into
`npm run pr:test`).
