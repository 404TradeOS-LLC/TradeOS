## Summary

<!-- Describe the user-visible or operator-visible outcome in 2-4 sentences. -->

## Scope

- Branch:
- Base branch:
- Worktree path:
- Linked issue:
- Scope type: frontend

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

## Required Frontend Review

- [ ] Existing app shell, navigation, layouts, and design-system patterns were preserved.
- [ ] Page files remain thin and composed from reusable components.
- [ ] Server components are used unless interactivity requires client components.
- [ ] Client components are limited to browser APIs, forms, modals, animation, or analytics needs.
- [ ] Existing shared UI primitives were reused before creating new ones.
- [ ] Accessibility, focus states, labels, headings, and keyboard behavior were reviewed.
- [ ] Public page metadata, sitemap, robots, links, and schema impact were reviewed when relevant.
- [ ] No backend contracts were bypassed from client code.

## Change Checklist

- [ ] Changes stayed inside the stated scope.
- [ ] No unrelated cleanup, refactor, dependency upgrade, merge, or rebase was included.
- [ ] No secrets, local-only files, generated caches, or `.codex/` artifacts were committed.
- [ ] UI changes preserve existing design-system patterns and do not duplicate shared components.
- [ ] AI-assisted UI features remain review-first and do not write directly to the database outside validated service-layer tools.

## Documentation Impact

- [ ] `docs/DOC_OWNERSHIP.yml` requirements were checked.
- [ ] `docs/CURRENT_STATE.md` updated when implementation status changed.
- [ ] Relevant module doc updated when a product workflow changed.
- [ ] `docs/SESSION_HANDOFF.md` was refreshed for this substantive or PR-ready session.
- [ ] No documentation update required.

If no documentation update was required, explain why:

## Verification

- [ ] `npm run docs:check`
- [ ] `npm run docs:test`
- [ ] `cd web && npm run lint`
- [ ] `cd web && npm run build`
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
