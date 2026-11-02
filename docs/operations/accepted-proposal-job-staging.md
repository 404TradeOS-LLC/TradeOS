# Accepted proposal to Job: staging review packet

This is a staging-only acceptance plan for PR #810, not permission to deploy or change production. The feature is ready for review but remains unmerged until protected binding proof, coherent API/web deployment, authenticated acceptance and final release review.

## Verified staging baseline — 2026-11-02

- The protected Job migration `20261028151000_accepted_proposal_job_handoff` **already succeeded**. Read-only staging inspection shows 67 completed Prisma migrations, zero unfinished, and the Job migration applied exactly once with checksum `3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`.
- Staging API-first promotion PR #837 merged as `ce903c3ee159fc6139f9901e1d61a09c2140330c`. This carries backend source into staging but does not establish web CTA acceptance or protected runtime binding proof.
- Current staging head `cf6a7e3a8c5d6562249ae7614ea60dd0f68847ac` has matching READY Vercel API/web deployments and aliases; its source inventory has 68 migration SQL files because the later, separate `20261102020000_add_job_expenses` is not yet applied. Do not confuse this with the completed Job handoff migration.
- Vercel environment metadata reads returned HTTP 403. A deployment SHA/alias match alone is insufficient to attest effective staging DATABASE_URL, SUPABASE_URL and AUTH_JWT_SECRET bindings. Require an approved protected secret-safe attestation; never print or downgrade secret values.
- The proposal-aware web action remains absent from the inspected staging web source. A reviewed web-only promotion after API readiness is still required.

## No repeat migration — proceed to protected postflight and deployment

The reviewed Job migration was already applied under the protected staging Environment. **Do not apply, stamp, reset, or backfill it again.** Reconcile the latest release candidate's complete tracked migration inventory with the staging ledger before another acceptance attempt. The newer expense migration must receive its own reviewed staging-only disposition; it does not reopen the completed Job migration.

Protected Environment approval remains required for future protected staging actions. An HTTP 403 on Vercel environment metadata must fail closed; it is not authorization to read sensitive values, change their sensitivity, bypass an Environment reviewer, or use a different target. Preserve provenance of the approved SHA, staging Supabase project ref and both Vercel project IDs.

## Read-only preflight and postflight

Use [the evidence SQL](accepted-proposal-job-staging.sql) only after verifying
the connection's protected provenance and staging project identity. It uses a
read-only repeatable-read transaction and reads schema/ledger metadata and an
aggregate Job count; it does not apply migrations or create test records.

For the exact candidate SHA, inventory every migration name and SHA-256 and compare the full applied ledger, including historical rollback rows. The Job handoff migration must be present and successfully applied once. Reject any remaining missing or unexpected applied names, duplicate successful entries, unfinished rows, checksum differences, or partial Job schema. Recheck whenever main, staging, or the feature source changes.

The already-applied migration added nullable TEXT `source_proposal_id`, nullable JSONB `accepted_baseline_json`, and a unique source-proposal index. It contains no row backfill, RLS change, scheduling, invoicing or proposal mutation. Treat the previous pre-apply absence of columns/index as historical evidence, not a new condition to satisfy.

Postflight must verify applied migration name and checksum; both columns with expected types, nullability and no default; and the unique index valid, ready, and correctly defined. The complete applied migration name set must equal the candidate source inventory with zero unfinished and no unexpected successful duplicates. Job count capture must fail closed if RLS would filter rows; investigate concurrent changes rather than inferring loss from count differences.

## Ordered runtime acceptance

1. Verify the **already applied** Job migration through protected read-only postflight; retain the existing protected apply run ID, exact SQL checksum, provenance and captures. Do not reapply.
2. Verify staging API readiness and the deployed API SHA against the reviewed Job migration. PR #837's source merge alone does not prove binding identity or readiness. Do not expose the frontend action before verifying the backend.
3. After protected secret-safe binding proof and backend readiness, promote the missing proposal-aware web source through the reviewed staging-only lane. Verify both staging API/web deployment IDs, aliases, coherent SHA and effective staging bindings. The existing prior web build does not implement the handoff CTA.
4. In the sanitized authenticated staging tenant, prove accepted proposal plus
   explicitly chosen customer address creates one unscheduled Job, preserves
   the approved snapshot and original proposal, and retries/concurrent requests
   return the same Job without duplicate activity. Prove invalid/unaccepted and
   foreign-tenant proposals fail, wrong-customer addresses fail, technician
   conversion fails, and technician reads/mutations redact commercial terms.
   Confirm existing standalone Job reads/writes remain usable.
5. Retain the step-9 browser evidence at 1440/1024/768/390 and DB-backed tenant,
   concurrency and rollback evidence on the same runtime source. Resolve every
   current-head review finding and obtain release review before ready/merge.

## Recovery

Before conversion traffic, roll back API/web to their known compatible builds
and leave the nullable additive columns/index in place. After conversion
traffic, preserve the new Job provenance/baseline data; do not drop columns or
delete migration history to roll back code. A failed or partially applied
migration requires read-only diagnosis and a separately reviewed recovery plan,
not an automatic rerun or a blind `migrate resolve`. Production execution is
outside this packet.
