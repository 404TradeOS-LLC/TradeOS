---
status: current
owner: platform
last_verified: 2026-08-13
source_of_truth: false
related_docs:
  - AGENTS.md
  - docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/ENGINEERING_COMMAND_CENTER.md
related_code:
  - scripts/reconcile-task.mjs
  - scripts/reconcile-task-lib.mjs
  - scripts/__tests__/reconcile-task.test.mjs
---

# Autonomy Reconciliation Preflight

This is the mandatory scoped preflight for scheduled, unattended, or
agent-driven implementation. It deepens the live-overlap inspection in step 4
of the canonical startup flow. It does not define a second general startup or
completion contract.

## Gate sequence

```text
TASK RECEIVED
  -> REPOSITORY RECONCILIATION
  -> EXISTING WORK SEARCH
  -> CLASSIFY
       EXISTING_WORK_FOUND
       NEW_WORK_REQUIRED
       NO_ACTION_REQUIRED
  -> BRANCH CREATION ONLY FOR NEW_WORK_REQUIRED
```

Complete the sequence before modifying files or running a branch-creation
command.

## 1. Reconcile repository state

At minimum run or obtain equivalent evidence for:

```bash
git status --short --branch
git branch --show-current
git fetch --all --prune
git log --oneline --decorate -n 20 origin/main
git branch --remotes
```

Record the repository path, current branch, current and base SHAs, cleanliness,
remote, upstream, and active worktrees. Stop on unexplained dirty state,
unexpected branch movement, or the wrong repository/base.

## 2. Search existing work

Search open and draft PRs, recently closed PRs, remote branches, recent
commits, linked issues, task/sprint identifiers, feature names, changed files,
acceptance criteria, failing tests, and production-incident descriptions.

Search semantic overlap, not exact titles. For example, "make event
persistence transactional" and "wrap canonical event write in database
transaction" are potentially the same objective and must be inspected as such.

The evidence helper is:

```bash
npm run autonomy:reconcile -- --task "<objective>"
```

When historical task input names a branch, include
`--referenced-branch <name>`. The helper fetches/prunes, reads current Git
state, queries GitHub through authenticated `gh`, surfaces likely semantic
matches, and prints the required report fields. It is conservative evidence,
not a substitute for reviewing the actual diffs and PR state.

## 3. Classify before editing

### `EXISTING_WORK_FOUND`

Use when an existing PR, branch, or recoverable recent unmerged effort
substantially covers the task. Inspect it, update it from current `main` when
appropriate, repair or extend it, rerun required validation, and continue the
same PR where technically possible. An imperfect PR is not justification for a
competitor.

### `NEW_WORK_REQUIRED`

Use only when no viable overlapping effort or equivalent implementation on
`main` exists. Review related closed attempts for reusable evidence and known
failure modes. Only this state permits creating one bounded branch.

### `NO_ACTION_REQUIRED`

Use when the requested change already exists on `main`, the task is based on
stale information, a cited fix has merged, or an obsolete branch/PR reference
requires no repair. Make no implementation change and report the supporting
commits, PRs, files, and checks.

## Stale named branches

If a named branch exists, inspect it. If it does not exist, treat the name as
stale task input. Reconcile against current `main`, PRs, branches, and commits;
do not recreate the name automatically.

## Duplicate-PR hard gate

Immediately before opening a PR, repeat the open/draft/recently-closed search.
Work substantially overlaps when it shares the same bug, acceptance criteria,
files, sprint/task identifier, architecture objective, failing test,
production incident, or documentation requirement. Update an open overlapping
PR instead of creating another one.

## Supersession

A replacement PR is justified only when the original branch is corrupted or
unrecoverable, contains retained secret material, uses a fundamentally unsafe
approach, cannot be continued because of ownership/permissions, was explicitly
replaced by founder direction, or cannot be rebased without preserving invalid
architecture.

When superseding:

1. Document the exact reason.
2. Link replacement and superseded PRs.
3. Close the superseded PR.
4. Do not leave both active.
5. Delete or prune the obsolete branch when safe.

## Required visible report

```text
AUTONOMY PREFLIGHT
Repository state:
Current branch:
Main SHA:
Open relevant PRs:
Relevant remote branches:
Recent related closed PRs:
Existing implementation on main:
Referenced branch:
Classification: EXISTING_WORK_FOUND | NEW_WORK_REQUIRED | NO_ACTION_REQUIRED
Chosen action:
Reason:
```

## Branch hygiene

Classify remote branches `SAFE_TO_DELETE`, `RETAIN`, or `REQUIRES_REVIEW`.
Never delete protected/release branches, active PR branches, branches with
unique unmerged work, or branches whose purpose is uncertain. A merged PR and
unchanged PR-head SHA are strong deletion evidence; a branch with no traceable
PR or unique commits requires review. Follow Repository Governance for actual
cleanup authority and report every deleted branch.
