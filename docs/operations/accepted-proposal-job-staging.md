# Accepted proposal to Job: staging review packet

This is a proposed rollout plan for draft PR #810, not execution authority.
Keep the feature draft until migration, matching API/web deployment, authenticated
acceptance and final-head release review are complete. Issue #811's invoice
history is independent evidence.

## Reconciled source and live evidence — 2026-10-30

- Feature source inspected: `f96231c11f49c7eb05748927f6be6623edc264cc`,
  branch `feat/accepted-proposal-job-handoff-20261028`, zero behind main
  `d1d64137c2912225b8f42ae1895c5786a20643b9` at inspection.
- Exact-head repository verification run `41029394012` and migration safety run
  `41029393951` succeeded. Eight review threads were resolved. The approval at
  `787c4f315cfaefbea005faee5fde888c74d1eb58` is not final-head review.
- Live read-only staging query against Supabase `qfbgdkbamfaasmtjfyru` returned
  66 completed migrations, zero unfinished; Job handoff migration, columns and
  index absent. Main inventories 66 migration SQL files; the feature branch 67.
  Counts alone do not establish matching migration names or checksums.
- Migration: `20261028151000_accepted_proposal_job_handoff`.
  Exact file SHA-256:
  `3db2c92bf2ae533b47ba976ab09ae814c7974a161c219d61fc6dc31f07aed293`.
  Preserve the existing migration bytes/name; do not stamp it as applied.

## Decision required before execution

The normal protected staging apply workflow accepts only `main`, with no
feature-source input. This migration is absent from main. The staging
orchestrator reads migration status and cannot apply it. Dispatching either
workflow as currently configured does not solve this dependency.

A migration-first extraction would need a deliberately reviewed split of #810,
not a competing implementation. Before publishing that split, reconcile
ownership and remove its overlap from #810 as part of the agreed dependency
sequence. Main pushes touching migrations automatically queue the separate
**production** migration workflow behind its production Environment gate.
Therefore even a schema-only main merge is not an exclusively staging event.
Do not merge the feature to unlock staging, approve production, relax the
main-only restriction, or apply SQL through the Supabase connector as a shortcut.

The reviewer must select and approve the migration-first split and its production
queue handling, or a separately reviewed exact-source staging workflow change.
Neither option is implemented or approved by this packet. Existing protected
Environment approval remains required for actual staging execution.

## Read-only preflight and postflight

Use [the evidence SQL](accepted-proposal-job-staging.sql) only after verifying
the connection's protected provenance and staging project identity. It uses a
read-only repeatable-read transaction and reads schema/ledger metadata and an
aggregate Job count; it does not apply migrations or create test records.

At the exact approved source SHA, inventory every migration name and SHA-256.
Compare the full applied ledger against that inventory, including historical
rollback rows. Before apply, the only missing completed migration must be the
Job handoff migration; reject unexpected applied names, duplicate successful
entries, unfinished rows, checksum differences or partial Job schema.
Recheck if main, staging or the feature source changes.

Before apply, both new columns and the index must be absent. Record existing
Job count and enabled/forced jobs RLS. The migration adds nullable TEXT
`source_proposal_id`, nullable JSONB `accepted_baseline_json`, and a unique
index on the source proposal. It contains no row backfill, RLS change, scheduling,
invoicing or proposal mutation. Standard index creation can block Job writes;
review the actual table size and use an agreed staging maintenance window.

After the protected apply succeeds, repeat the capture: applied migration name
and checksum must match; both columns must have the expected types, be nullable
and have no default; the unique source index must be valid and ready with the
expected definition. Applied names must equal the approved source inventory,
with zero unfinished rows and no unexpected successful duplicates. Existing Job
count and jobs RLS must remain consistent with the preflight; investigate
concurrent changes rather than inferring data loss from counts alone.

## Ordered runtime acceptance

1. Apply and verify the reviewed additive migration through the approved
   staging-only protected path. Retain run ID, source SHA, checksum and captures.
2. Deploy the matching reviewed API before exposing the frontend action. The
   generated Prisma client selects the new Job fields; deploying it first can
   break ordinary Job reads against an unmigrated database.
3. Verify both staging API/web deployment IDs, aliases, SHA and staging bindings;
   verify API health/readiness. Hide the action by retaining the prior web build
   until the API is ready; no runtime capability gate is claimed here.
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
