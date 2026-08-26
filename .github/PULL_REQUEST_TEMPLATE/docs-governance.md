## Summary

<!-- Describe the user-visible or operator-visible outcome in 2-4 sentences. -->

## Scope

- Branch:
- Base branch:
- Worktree path:
- Linked issue:
- Scope type: docs / governance

## Required Startup Verification

- [ ] Exact worktree path verified.
- [ ] Exact branch verified.
- [ ] `git fetch origin --prune` run before branch comparison.
- [ ] Remote repository target verified.
- [ ] Upstream state reported, or missing upstream explicitly documented.
- [ ] Active worktrees reviewed for overlap.
- [ ] Open PR overlap reviewed.
- [ ] `docs/ENGINEERING_COMMAND_CENTER.md` read after environment verification.
- [ ] `docs/CURRENT_STATE.md` read.
- [ ] `docs/SESSION_HANDOFF.md` read.
- [ ] `docs/REPOSITORY_GOVERNANCE.md` read for governance or workflow changes.
- [ ] Allowed paths, forbidden paths, exclusions, and stop conditions were stated before edits.

## Required Governance Review

- [ ] Source-of-truth hierarchy stayed aligned with `docs/README.md`.
- [ ] Branch/worktree policy stayed aligned with `docs/REPOSITORY_GOVERNANCE.md`.
- [ ] Startup and completion protocol stayed aligned with agent prompt docs.
- [ ] Required status checks stayed aligned with `.github/workflows/`.
- [ ] PR and issue templates reinforce current RC1 operating rules.
- [ ] Label taxonomy changes are reflected in governance documentation.
- [ ] No runtime `app/` or `web/` implementation behavior changed.
- [ ] No governance rule weakens tenant isolation, required verification, or review expectations.

## Change Checklist

- [ ] Changes stayed inside the stated scope.
- [ ] No unrelated cleanup, refactor, dependency upgrade, merge, or rebase was included.
- [ ] No secrets, local-only files, generated caches, or `.codex/` artifacts were committed.

## Documentation Impact

- [ ] `docs/DOC_OWNERSHIP.yml` requirements were checked.
- [ ] Required source-of-truth docs changed in this branch.
- [ ] `docs/SESSION_HANDOFF.md` was refreshed for this substantive or PR-ready session.
- [ ] `docs/ENGINEERING_COMMAND_CENTER.md` changed only because mission, priorities, blockers, CI requirements, or operating protocol changed.
- [ ] No documentation update required.

If no documentation update was required, explain why:

## Verification

- [ ] `npm run docs:check`
- [ ] `npm run docs:test`
- [ ] `git diff --check`
- [ ] Other:

Exact final `git status --short --branch`:

## Environment-Blocked Checks

<!-- List blocked checks and the exact environment cause, not just "not run". -->

## Risk Review

- [ ] Branch is current with `origin/main`, or drift is documented.
- [ ] Required checks match the branch protection target in `docs/REPOSITORY_GOVERNANCE.md`.
- [ ] Known limitations and deferred work are documented below.

## Known Limitations

## Follow-Up Work
