---
status: current
owner: platform
last_verified: 2026-08-03
source_of_truth: true
related_code:
  - .github/workflows/reconcile-production-migration.yml
  - app/prisma/migrations/20260728120000_add_settings_asset_uploads/migration.sql
  - docs/ENGINEERING_COMMAND_CENTER.md
  - docs/REPOSITORY_GOVERNANCE.md
  - docs/SPRINT_BACKLOG.md
---

# TradeOS Session Handoff

## Current mission

Repair PR #62 so the one-time production history reconciliation can safely materialize PR #30's migration file, verify its pinned checksum, and record `20260728120000_add_settings_asset_uploads` as already applied without executing migration SQL.

## Live pull-request state

- PR #61 is merged on `main` as `0c86a7a`.
- PR #62 is the only branch authorized to change the temporary reconciliation workflow and its required operating documentation. It must remain unmerged until its real diff is reviewed and fresh required checks pass.
- PR #30 remains open and owns the Settings/Brand Studio asset-persistence implementation and migration file. Do not copy or modify its application, schema, or migration scope from another branch.
- PR #56 is approved but remains behind `main`; its dependency update is unrelated to this reconciliation repair.

## Completed in this branch

- added a fail-closed fetch of `refs/pull/30/head` that materializes only the target migration file;
- preserved the pinned SHA-256 checksum gate before any production database access;
- kept `prisma migrate resolve --applied` hard-fail and made the later `prisma migrate status` diagnostic;
- preserved manual dispatch, the `production` Environment gate, the shared migration concurrency group, and the prohibition on `prisma migrate deploy` or migration SQL;
- updated the workflow's required owner documentation.

## Current blocker

No production history change occurs from merging this branch alone. PR #62 still needs review, fresh required checks, and merge. The manual reconciliation must then be dispatched from `main`, pass the production Environment approval gate, and complete the hard-fail resolve step before PR #30 proceeds.

## Next exact safe action

Review PR #62's final diff and required checks. If green, squash-merge it; then run **Actions -> Reconcile production migration history** from `main`, approve the production Environment gate, and verify the resolve step reports `20260728120000_add_settings_asset_uploads` as applied before rebasing PR #30.
