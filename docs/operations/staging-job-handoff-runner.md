# Proposed protected staging Job handoff runner

This infrastructure change unblocks the migration dependency of draft PR #810
without adding its migration or feature code to main. It requires review before
merge and the existing protected staging approval before any execution.
Nothing here approves a database operation or certifies step-9 acceptance.

## Trust boundary

The manual workflow runs only from main, with `contents: read`, pinned actions,
the existing `staging` Environment and `deploy-migrations-staging` concurrency
group. It checks out the workflow's main SHA. Source SHA is validated before
fetch; `git show` reads only
`app/prisma/migrations/20261028151000_accepted_proposal_job_handoff/migration.sql`.
Its SHA-256 must be exactly
`3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`.
No source branch dependency, script, Prisma schema or workflow is executed.
Dependencies and Prisma CLI are from trusted main only. The staging database
secret is injected into the single runner step, never install or source fetch.

A verified staging direct host or project-bound pooler username is mandatory.
Routing query overrides and unknown parameters are rejected; Prisma/psql use
TLS session mode on port 5432. Credentials and child process output are not
logged. The runner compares complete applied migration names and checksums,
rejects unfinished/duplicate success rows, untracked/partial Job schema,
weakened jobs RLS and any unrelated pending migration. Historical rolled-back
attempts are retained and ignored only for successful-inventory comparison.

Preflight uses read-only SQL and does not create migration files or invoke
Prisma deploy. In apply mode, only the pinned SQL is copied into trusted main's
migration directory; the ordinary trusted Prisma CLI applies it. The full
ledger, nullable TEXT/JSONB columns and valid/ready, nonpartial, single-key
unique index are checked afterward. A verified already-applied migration is a
no-op. No `migrate resolve`, ledger stamping, role provisioning or RLS changes
are performed.

## Reviewed operator sequence

1. Review/merge this infrastructure PR through normal gates. It touches no
   `app/prisma/migrations/**` or production deployment script, so it does not
   trigger the production migration workflow's path filter. Do not merge #810
   merely to install this runner.
2. Review #810's exact source head and its migration checksum/rehearsal. Dispatch
   **Review or apply staging Job handoff migration** from **main**, setting the
   full `source_sha`, with mode **preflight**. The existing staging reviewer must
   approve the job. Check the printed source SHA, project ref, checksum and sole
   missing migration. A changed source/main/ledger requires a new preflight.
3. After reviewing a successful preflight and staging maintenance window, set
   `STAGING_JOB_HANDOFF_APPROVED_SHA` in the protected staging Environment to
   that exact reviewed source SHA. Dispatch from main with mode **apply** and
   confirmation **APPLY_STAGING_JOB_HANDOFF**, then obtain existing Environment
   approval. This document does not set that variable, dispatch or approve.
4. Inspect successful postflight and retain run ID, workflow/source SHAs and
   migration checksum. Remove the one-time approval variable after verification.
   Capture existing Job counts before/after in the staging window; investigate
   concurrent changes. Standard index creation can block writes on a large table.
5. Deploy reviewed matching API first, then web, both isolated to staging. Verify
   runtime/deployment SHA and aliases, and retain authenticated step-9 evidence
   including tenant denial, selected customer address, immutable baseline,
   retry/concurrency, technician redaction and standalone Job compatibility.
   Final-head CI/review and all release gates on #810 remain mandatory.

## Verification and limitations

Local checks passed: 181 governance tests (including ten focused runner tests),
40 documentation tests, ownership, Node syntax, actionlint 1.7.7 and whitespace.
The runner tests cover identity, URL override, SHA/confirmation, ledger and schema
failure paths plus workflow privilege scoping. A fresh read-only query validated
all 66 staging migration names/checksums against main and confirmed the sole
pending Job migration, absent columns/index, and enabled+forced jobs RLS.
An isolated PGlite PostgreSQL-compatible rehearsal executed the pinned SQL and
the actual capture query: existing rows survived, standalone NULL sources remain
valid, duplicate non-NULL sources fail, and postflight accepted the correct
schema/index. It does not prove hosted Prisma CLI, network or reviewer behavior.
Local system PostgreSQL installation is blocked by container UID/group
permissions; the Ruby-based workflow policy awaits hosted CI because Ruby is
unavailable locally. Required hosted checks and a protected live preflight remain gates.
No live migration, dispatch, staging deployment or production operation ran.

## Recovery

On preflight failure, apply nothing and repair the named drift through review.
On apply failure/timeout, inspect ledger/schema read-only before any retry;
never blindly stamp or rerun a partial migration. After a successful additive
migration, roll API/web back to compatible builds while retaining columns,
unique index, baseline and provenance data. Destructive schema rollback needs
separate review. Disable this manual workflow or remove its approval variable
if its one-time authorization must be revoked; do not weaken staging controls.
