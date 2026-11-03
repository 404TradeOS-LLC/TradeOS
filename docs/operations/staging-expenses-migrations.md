# Protected staging Job Expenses migration procedure — Issue #885

This workflow is a **new staging-only reviewed mechanism**, not a green light to deploy immediately. `main` currently includes the baseline expense migration; PR #891 contains its two additive follow-ups. Staging also has the already-approved and applied Job-handoff migration from PR #810, which is not yet present in `main`. This runner accounts for that exact difference rather than stamping, replacing, or deleting a Prisma ledger entry.

## Source and inventory evidence

- Staging Supabase ref: `qfbgdkbamfaasmtjfyru` (never production `kssaceuetdjwfqnbzhly`).
- Read-only staging inspection: 67 completed Prisma migrations, 0 unfinished; 66 shared with `main` and **all 66 SHA-256 checksums matched**.
- Extra already applied: `20261028151000_accepted_proposal_job_handoff` with pinned checksum `3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`. Its two nullable columns, valid+ready unique index, and enabled/forced `jobs` RLS were confirmed without writes.
- Pending baseline: `20261102020000_add_job_expenses` with hash `c6599040d635a5aa69ae8b5b01a2f29014617a751b822ea015395ea9231743a1` (tracked on `main`).
- PR #891 source commit `86149a58d23a2248f483c650c9193d7b8f7ff22a` includes only two additional migration files, pinned to hashes `e8e2d8cd36b9d09d662cdc71f9441ec970b1ea6bd0e755e88474a47f9674a1a3` and `13b40ce24b6ade9a7b1af2deccc10688350096668419e4d3aeedda3e38e8a510` respectively.
- Both expense tables are absent at preflight; Storage bucket `project-files` is private (`public=false`).
- No live staging SQL was applied, no migration ledger was edited or stamped, and no production deployment was requested.

## Trust boundary

`staging-expenses-migration.yml` can only run from the trusted `main` workflow. It has repository `contents: read`, pinned checkout/setup actions, `staging` Environment approval, and the same non-canceling `deploy-migrations-staging` concurrency group as other staging migration workflows. It consumes a source SHA solely through `git show` to read the two review-pinned SQL files. No source branch script, dependency, schema, or workflow is executed under the staging database credential. The baseline SQL is read from trusted `main` and its hash must match the reviewed value. All other tracked migration files must match the staging ledger or fail closed. The already applied Job-handoff checksum and schema must match, and no unrelated migration may remain pending.

`preflight` uses a repeatable-read READ ONLY PostgreSQL transaction and never invokes Prisma deploy. `apply` requires three independent conditions: protected GitHub staging Environment approval; staging variable `STAGING_EXPENSES_APPROVED_SHA` equal to the full, reviewed Expense source SHA; and dispatch input confirmation `APPLY_STAGING_EXPENSES`. The runner rejects production database identities and unsafe connection options. It uses Prisma migration deployment from trusted `main` with only those two pinned SQL directories added. No `migrate resolve`, unreviewed DDL, ledger manipulation, production action, or implicit constraint validation is permitted.

## Reviewed operator procedure

1. Review this infrastructure PR and merge it through normal GitHub gates. It contains only a script, test, protected workflow, and documentation; it does not modify the production migration history or enable an unprotected dispatch.
2. Review the exact PR #891 source SHA and migration SQL hashes. Dispatch **Review or apply staging Job Expenses migrations** from the `main` branch, with `source_sha` and `mode=preflight`. The `staging` Environment reviewer must approve the job. Verify a successful result reports the expected three missing migrations, no checksum drift, intact Job-handoff schema, private receipt bucket, and no partial expense schema.
3. After approval for the staging maintenance window, set `STAGING_EXPENSES_APPROVED_SHA` in the protected staging Environment to the reviewed full source SHA. Dispatch from `main` with `mode=apply` and exact `APPLY_STAGING_EXPENSES` confirmation; obtain the required Environment reviewer approval. Do not modify the variable or grant approval before reviewing preflight evidence.
4. Inspect the postflight: exactly 70 applied migration names (66 original shared + 1 existing Job handoff + 3 Expenses), no unfinished migrations, forced RLS on both expense tables, correct indexes/foreign keys/constraints, and append-only event policies. Preserve the run URL, exact source/workflow SHA and postflight summary; revoke the one-time approval variable afterward.
5. Only then deploy matched API then web builds at the same reviewed Expense SHA to staging, verify their runtime identity and database binding, and execute authenticated owner/technician, cross-tenant denial, idempotent retry/concurrency, void/audit and private receipt upload/download tests. Finish independent review; do not merge PR #891 or touch production until those gates pass.

## Recovery

If preflight fails, apply nothing. If a write fails midway, **stop** and inspect migration ledger and schema read-only before any retry; the runner deliberately refuses partial states. Avoid destructive rollback or `migrate resolve` without separate review. Since these migrations are additive, a compatible staging API/web build may be rolled back independently while retaining schema. Never remove protected review/approval requirements to accelerate the release.
