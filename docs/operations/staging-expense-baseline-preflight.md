# TradeOS staging Job Expense baseline migration — protected reconciliation

This document supports the existing **Deploy staging database migrations** workflow on **main**. It does not authorize any database change by itself.

## Observed preflight, November 2, 2026

Read-only Supabase staging identity: project `qfbgdkbamfaasmtjfyru`. Its Prisma ledger contains **67** successful migrations and **zero** unfinished rows. The main branch contains **67** tracked migration files; **66** are already applied, the only pending main file is `20261102020000_add_job_expenses`, and staging has exactly one separately reviewed Job handoff migration not yet in main: `20261028151000_accepted_proposal_job_handoff`, checksum `3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`. The `public.job_expenses` table and both expense migrations are absent. These findings are time-bounded and must be re-checked before protected dispatch.

The former post-deployment count-only check (`applied == main migration directories`) would reject this valid, reviewed staging-only migration *after* applying the expense baseline. That produces a misleading failure. The replacement verifier reconciles **every applied migration name and SHA-256 SQL checksum** with the trusted main inventory and permits only the exact known staging Job-handoff exception; other extras or unrelated pending migrations fail closed.

## Protected baseline procedure

1. Merge the verifier change only after code-owner review and exact-head hosted checks. It does not alter, approve or dispatch the protected environment.
2. The existing `Deploy staging database migrations` workflow must be dispatched from **main**. Keep its `staging` protected environment, reviewer, staging-only secret identity checks, concurrency group and invoice migration preconditions unchanged.
3. Before any Prisma deployment, `LEDGER_PHASE=preflight` runs `node scripts/verify-staging-prisma-ledger.mjs`. It rejects unfinished, duplicate, unknown and checksum-drifted ledger rows; unrelated pending migrations; a partially untracked expense table/column; and an unexpected staging database identity. Only an absent or already-applied expense baseline is permitted.
4. The existing trusted main Prisma deploy step runs only after the protected environment reviewer approves. It is not a SQL-from-PR runner and must not apply the separate payer migration before that migration's own review.
5. Afterwards, `LEDGER_PHASE=postflight` independently checks all tracked successful migration checksums, the exact approved staging-only Job handoff, presence of `job_expenses`, **enabled and forced RLS**, and all four expected policy names. It refuses a payer column without its separate release.
6. Archive the run URL, main/source SHA, ledger comparison, target staging identity and test results. If anything fails, inspect read-only before retrying; no `migrate resolve`, ledger stamping, secret printing or production fallback.

## Payment responsibility remains separate

PR #891's `20261102074000_add_job_expense_payment_responsibility` migration **must not** be run as part of this baseline-only release. Its `NOT VALID` CHECK is enforced for new/updated rows while avoiding the historical validation scan in the write-blocking migration. Review and approve a separate protected staging-only application path for the full reviewed payer source SHA. Afterwards, separately validate historical rows using `ALTER TABLE public.job_expenses VALIDATE CONSTRAINT job_expenses_payment_responsibility_check;` in the protected staging environment, then verify `pg_constraint.convalidated=true`. Do not run that validation here or assume it succeeded.

## Security and acceptance gates

The verification code is **read-only**. It executes one read-only repeatable-read SQL transaction with `psql`, passes credentials as process environment (not arguments), and does not print secrets or child-command error text. It checks the explicit staging project identity and the trusted main ref. Tests can run without any credentials: `node --test scripts/verify-staging-prisma-ledger.test.mjs`. Independent authenticated owner/technician expense and tenant-isolation acceptance requires a matching staging API+web deployment and approved test session. No production migration, deployment, or tenant change is implied.

The verifier only permits the baseline's pending migration during this workflow. A payer migration already completed through its **separately approved** staging process can be recognized by exact name and fixed SQL SHA-256 checksum, including a present CHECK constraint; it cannot be applied as a pending migration by the baseline workflow. The pinned payer digest corresponds to SQL blob `78809995da33cd4d9079c3fa10457deda7c9ade8` in PR #891. A `NOT VALID` CHECK is distinguished from a separately `VALIDATE`d CHECK without asserting historical validation succeeded.
