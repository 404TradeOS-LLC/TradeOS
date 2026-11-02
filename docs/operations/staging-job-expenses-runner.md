# Protected staging-only Job Expense migration — operator runbook

Status: **proposed and not executed**. Source scope: PR #905, dependent staging web PR #904, canonical feature PR #810, and Job Expenses Issue #885.

## Why the ordinary runner is unsafe here

At read-only inspection on November 2, 2026, the staging source SHA was `7370e8fb05d9fb7739e79b832ff259c292d7b995`. Its 68 migration directories included the accepted-proposal Job handoff and the new Job Expense migration; staging had 67 successful migration rows, zero unfinished, zero duplicate successful names, and precisely one missing name: `20261102020000_add_job_expenses`. The Job handoff migration was already successfully applied and recorded with SHA-256 `3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`. The expense table did not exist and the four required authorization helper functions were present; Jobs RLS was enabled and forced.

The standard `deploy-staging-migrations.yml` checks out `main`, whose 67 migrations **exclude** the already applied Job handoff and include the Expense migration. Running ordinary main-only Prisma migration deployment would leave source/ledger parity ambiguous, and its count-only check is not sufficient to certify historical rows. Do **not** run or repurpose that workflow for this remediation.

## Trust, scope, and approval

The dedicated manual [staging Job Expense workflow](../../.github/workflows/staging-job-expenses-migration.yml) must be reviewed and merged to trusted `main` before it can be dispatched. The workflow is manual only, has `contents: read`, uses pinned checkout/setup-node actions, shares the existing `deploy-migrations-staging` concurrency group, and requires the GitHub `staging` Environment with its human reviewer. It refuses any dispatch from another branch. It does not touch production or make environment changes.

Its source SHA must be a **40-digit hex commit equal to the live staging head**; source Git objects are fetched before the credential-bearing step. Source SQL is read as data only. The original Job handoff SQL hash is pinned as above, and the Expense SQL SHA-256 is `c6599040d635a5aa69ae8b5b01a2f29014617a751b822ea015395ea9231743a1` (source Git blob `3ef5101d93ddfe3c10027e0a366ec117e854a31e`). Neither source code nor feature dependencies run with secrets. The trusted main runner's tested staging connection validator rejects foreign database/project identities, URL routing overrides, unsafe query parameters, and transaction-pooler migration mode.

In `preflight` mode, the runner reads the complete 68-name checksum inventory, existing handoff schema/index, migration ledger including historical rollback rows, Jobs FORCE RLS, request-session helpers and absence of the expense table. It never alters schema or calls Prisma deployment. Successful completion must show **exactly the Expense migration pending**.

A successful preflight is **not** sufficient authorization for apply. After independent review of the exact runner/SQL and an appropriate staging maintenance window:

1. Record the full current staging SHA and successful preflight run ID.
2. Set the protected **staging Environment** variable `STAGING_JOB_EXPENSES_APPROVED_SHA` to that exact reviewed staging SHA. Do not use a repository variable or a production Environment setting.
3. Dispatch workflow **Review or apply staging Job Expense migration** from **main**, mode `apply`, source SHA exactly the staging head, and typed confirmation `APPLY_STAGING_JOB_EXPENSES`.
4. Separately approve the specific `staging` Environment job through its normal reviewer. Do not weaken or bypass protections.
5. Inspect the protected run postflight before changing any staging deployments. Clear the one-time approval variable after certification.

The only allowed write is the normal trusted-main Prisma `migrate deploy` of the sole pending Expense migration, followed by a single idempotent GRANT of SELECT/INSERT/UPDATE/DELETE on the new table to the existing restricted app role. It does not reset a password or alter grants on other tables. The runner materializes the original reviewed Job handoff SQL into trusted main's *temporary checkout inventory* to make Prisma aware it is already applied. It must **not execute that historical migration again**, use `migrate resolve`, stamp/modify any ledger row, backfill existing Jobs, or execute source-branch code. Runtime secrets exist only in the final guarded job step and are never logged.

## Required postflight

A successful run must report 68 successful migration rows with all names and SHA-256 checksums identical to the reviewed inventory, zero unfinished and duplicate successes, and the original handoff checksum unchanged. `public.job_expenses` must exist with the exact reviewed 11-column shape, expected constraints and indexes, four policies, both RLS flags enabled/forced, zero grants to `anon`/`authenticated`/`PUBLIC`, and restricted app-role SELECT/INSERT/UPDATE/DELETE grants. Jobs FORCE RLS and its original source-Proposal unique index must be unchanged.

A successful SQL migration alone does **not** prove authenticated tenant isolation, owner or technician expense workflows, private receipt security or acceptance of the accepted-proposal Job handoff. These require separate nonproduction browser/integration evidence.

## Recovery and next release gate

On missing approval, staging-source drift, identity mismatch, schema drift, unexpected applied migration, incomplete ledger or failed postflight: fail closed and inspect the database read-only. Never replay a failed partial apply or clear migration history blindly. A partially applied schema needs a separate reviewed recovery plan. After a successful additive migration, preserve the new table and any recorded expense data; rolling back API/web does not justify dropping tables.

Only **after** 68/68 parity and the complete RLS/role postflight pass, reconcile and merge the separately reviewed web-only [PR #904](https://github.com/404TradeOS-LLC/TradeOS/pull/904) into staging. Verify matching API and web deployments, staging aliases, runtime SHA and protected binding attestation, then capture authenticated step-9 tenant, concurrent idempotency, rollback/recovery and browser evidence at 1440, 1024, 768 and 390 widths. Finish final release review on [PR #810](https://github.com/404TradeOS-LLC/TradeOS/pull/810). No production migration or merge is authorized by this runbook.
