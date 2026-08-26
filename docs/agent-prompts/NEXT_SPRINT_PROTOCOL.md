---
status: current
owner: platform
last_verified: 2026-08-06
source_of_truth: true
related_docs:
  - docs/TRADEOS_BIBLE.md
  - docs/SPRINT_BACKLOG.md
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/SESSION_HANDOFF.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/agent-prompts/AGENT_STARTUP_CHECKLIST.md
  - docs/agent-prompts/AGENT_COMPLETION_CHECKLIST.md
---

# TradeOS Agent Execution and Next Sprint Protocol

This file is the sole executable owner of the general agent startup and
completion flows. The Bible owns doctrine, Repository Governance owns branch,
worktree, review, and merge policy, the Sprint Backlog owns executable sprint
state, and the Session Handoff owns immediate continuity. Supporting checklists
and worktree contracts link here and add only task-specific requirements.

## Canonical Startup Flow

Complete these steps in order before editing:

1. Read `AGENTS.md` for repository-specific engineering constraints.
2. Verify and report the exact repository path, branch, `HEAD`, intended base,
   working-tree state, remote, upstream, and active worktree list. Fetch
   `origin` before trusting local comparisons. A dirty tree is permitted only
   when its existing changes are understood, preserved, and non-overlapping.
3. Read `docs/TRADEOS_BIBLE.md` as the first source-of-truth document, then
   `docs/ENGINEERING_COMMAND_CENTER.md`, `docs/CURRENT_STATE.md`,
   `docs/SPRINT_BACKLOG.md`, `docs/SESSION_HANDOFF.md`, and
   `docs/REPOSITORY_GOVERNANCE.md`.
4. Inspect live open pull requests, recent merges, branches, and worktrees for
   overlap. Treat external GitHub state as live evidence, not documentation.
5. State the mission, allowed paths, forbidden paths, explicit exclusions,
   required validation, documentation impact, branch/worktree plan, and stop
   conditions.
6. Stop before editing if repository identity, authority, scope, ownership,
   dependency, infrastructure, founder-decision, or overlap evidence is
   missing or contradictory.

`continue` resumes only the current bounded mission. It never authorizes a new
task, another sprint, or broader scope.

## Sprint Selection and Execution

For numbered-sprint work, apply these rules after the Canonical Startup Flow:

1. Ignore sprints marked `DONE`, `IN_REVIEW`, `BLOCKED`, `DEFERRED`, or
   `CANCELLED`.
2. Select the lowest-numbered `READY` sprint whose dependencies are `DONE` and
   whose scope remains unoccupied.
3. If a `READY` record is stale or incomplete, stop implementation and repair
   readiness in a governance-only PR before proceeding.
4. Create one isolated branch and linked worktree for exactly one sprint. Do
   not implement directly on `main`.
5. Execute only the sprint's allowed scope and run its named validation plus
   documentation-ownership checks.
6. Publish one draft PR. Set the sprint to `IN_REVIEW` only after that PR
   exists; a local commit or pushed branch is not review evidence.
7. Require the final diff, required checks, review state, and branch currency
   to satisfy `docs/REPOSITORY_GOVERNANCE.md` before merge.
8. Set the sprint to `DONE` only after merge evidence exists. When necessary,
   use a separate governance-only evidence PR after the implementation merge.
9. Replace `docs/SESSION_HANDOFF.md` with concise current truth and stop. Do not
   begin another sprint from the same branch.

If no sprint qualifies, report the exact blocker and use `Sprint ID: NONE` in
the handoff instead of inventing work.

## Stop Conditions

Stop without publishing implementation when:

- the path, branch, remote, upstream, or base is wrong;
- unexpected dirty work or an active PR/worktree overlaps the mission;
- a dependency is not `DONE` or a `READY` record is incomplete;
- the founder decision field is `YES` and the decision is unresolved;
- required infrastructure is unavailable;
- source-of-truth evidence contradicts the requested work;
- a required test fails for a product or contract reason;
- the remote branch moves unexpectedly;
- implementation requires a forbidden path; or
- the task expands into unapproved product or architecture decisions.

Environment failures may be diagnosed and repaired only when that does not
change product scope. Otherwise report the blocked check explicitly.

## Canonical Completion Flow

Complete these steps in order before final handoff:

1. Inspect the complete diff against the intended base and confirm that no
   unrelated file, secret, generated noise, or forbidden-path change entered.
2. Run the named focused and broad checks. Record passed, failed, and
   environment-blocked checks separately.
3. Include every documentation update required by `docs/DOC_OWNERSHIP.yml` in
   the same branch. Replace the Session Handoff for substantive or PR-ready
   work; update the Command Center only when operating context changed.
4. Commit only reviewed paths and publish only when the task authorizes it.
   Record commit, upstream, push, and PR results; use `N/A` for legitimately
   read-only, stopped, or unpublished work rather than inventing evidence.
5. For PR work, verify the exact final head, required checks, review threads,
   readiness, and merge result. Do not call an open PR complete or mark a
   sprint `DONE` before merge evidence exists.
6. After verified merge, synchronize the base and remove only clean,
   intentionally disposable worktrees through the governed lifecycle.
7. Report the mission or sprint ID/title; outcome; original and final SHAs;
   files and documentation changed; checks passed, failed, or blocked; scope
   and exclusions; stop conditions encountered; commits; final
   `git status --short --branch`; upstream and push result; PR number/URL and
   readiness or merge state; remaining risks; and the exact next safe action
   derived from the backlog and handoff (or `NONE`).
8. Stop after the bounded mission. Completion never authorizes the next task.

## Founder Shortcut

The founder may say:

```text
Run the next TradeOS sprint.
```

That means: follow this file exactly. It does not authorize bypassing checks,
rewriting unrelated code, weakening governance, or beginning multiple sprints.

## Copy/Paste Invocation

```text
Follow docs/TRADEOS_BIBLE.md and execute
docs/agent-prompts/NEXT_SPRINT_PROTOCOL.md exactly for this request.
```
