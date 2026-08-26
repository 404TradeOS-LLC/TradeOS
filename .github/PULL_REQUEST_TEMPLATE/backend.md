## Summary

<!-- Describe the user-visible or operator-visible outcome in 2-4 sentences. -->

## Scope

- Branch:
- Base branch:
- Worktree path:
- Linked issue:
- Scope type: backend

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

## Required Backend Review

- [ ] Request authentication and organization membership checks verified.
- [ ] RLS expectations verified for each tenant-scoped read or write.
- [ ] Services accept `orgId` explicitly and do not depend on Express request objects.
- [ ] Controllers own HTTP concerns and Zod validation.
- [ ] Writes go through existing service-layer APIs.
- [ ] Prisma schema and migrations do not duplicate existing models.
- [ ] New RLS-protected tables include live integration coverage.
- [ ] Error handling uses existing `ApiError` and centralized middleware patterns.

## Change Checklist

- [ ] Changes stayed inside the stated scope.
- [ ] No unrelated cleanup, refactor, dependency upgrade, merge, or rebase was included.
- [ ] No secrets, local-only files, generated caches, or `.codex/` artifacts were committed.
- [ ] Runtime behavior changes include relevant tests.
- [ ] Tenant isolation, authorization, validation, and service-layer write paths were reviewed.
- [ ] RLS, migration, Prisma, or database changes include live integration coverage or a documented blocker.

## Documentation Impact

- [ ] `docs/DOC_OWNERSHIP.yml` requirements were checked.
- [ ] `docs/API_REFERENCE.md` updated when routes or contracts changed.
- [ ] `docs/RBAC_MATRIX.md` updated when permissions changed.
- [ ] `docs/WORKFLOW_LIFECYCLES.md` updated when states changed.
- [ ] Relevant module doc updated.
- [ ] `docs/CURRENT_STATE.md` updated when implementation status changed.
- [ ] `docs/SESSION_HANDOFF.md` was refreshed for this substantive or PR-ready session.
- [ ] No documentation update required.

If no documentation update was required, explain why:

## Verification

- [ ] `npm run docs:check`
- [ ] `npm run docs:test`
- [ ] `cd app && npm test`
- [ ] `cd app && npm run lint`
- [ ] `cd app && npm run build`
- [ ] `cd app && npm run test:integration`
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
