## Summary

<!-- Describe the user-visible or operator-visible outcome in 2-4 sentences. -->

## Scope

- Branch:
- Base branch:
- Worktree path:
- Linked issue:
- Scope type: security

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

## Required Security Review

- [ ] Threat model or abuse case described.
- [ ] Auth, membership, authorization, and RLS impact reviewed.
- [ ] Secrets and environment variables are not exposed.
- [ ] Input validation and output encoding reviewed.
- [ ] Database writes remain service-layer mediated.
- [ ] Logging avoids secrets and sensitive customer data.
- [ ] Migration, destructive-action, and data-loss risks reviewed.
- [ ] Tests or reproduction steps demonstrate the fix or hardening.

## Change Checklist

- [ ] Changes stayed inside the stated scope.
- [ ] No unrelated cleanup, refactor, dependency upgrade, merge, or rebase was included.
- [ ] No secrets, local-only files, generated caches, or `.codex/` artifacts were committed.
- [ ] Tenant isolation, authorization, validation, and service-layer write paths were reviewed.

## Documentation Impact

- [ ] `docs/DOC_OWNERSHIP.yml` requirements were checked.
- [ ] `docs/RBAC_MATRIX.md` updated when permissions changed.
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
