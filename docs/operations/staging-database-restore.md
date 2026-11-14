# Actual staging public database restore rehearsal

Dispatch **Rehearse actual staging public database restore** from `main` after
review of the final merged workflow. The protected `staging` environment and its
reviewer gate own access to `STAGING_DATABASE_ADMIN_URL`. Only the canonical
`qfbgdkbamfaasmtjfyru` direct host or existing us-east-2 session pooler on 5432
is accepted. Supply a connection URI without query parameters or with exactly `sslmode=require`; this conventional TLS option is normalized into the fixed connection configuration. All other options and duplicate query keys remain rejected. The workflow
never fetches a credential or accepts a production/target URL input.

The script opens a repeatable-read, read-only staging transaction, exports its
snapshot, counts actual public tables and fingerprints columns, constraints,
policies and forced RLS. PostgreSQL 17 `pg_dump` uses that same snapshot. The
public schema and data archive is restored with `pg_restore --exit-on-error
--single-transaction` into a separate disposable PostgreSQL 17 service. No
application migrations replace the dump. Catalog fingerprints and counts must
match. A local NOSUPERUSER/NOBYPASSRLS role with SELECT grants must see zero tenant-owned
rows on forced RLS tables with direct `org_id`/`organization_id` columns and an empty synthetic identity. NULL-tenant global rows are permitted and counted; child tables without direct tenant columns remain explicitly unverified by this probe. This is a denial
probe, not a full application tenant/role certification.

Tracked Prisma migrations do not reference executable `auth.*` or `storage.*`
objects; they require `btree_gist`. Actual staging can drift: only the supported
pgcrypto, uuid-ossp, btree_gist and citext extensions (in their original public or extensions namespace) and policy role names are
created in the local service. The extension dependency closure starts from public objects and follows catalog references plus internally/automatically owned defaults, policies, constraints and rewrite rules. Unrelated installed Supabase extensions are excluded. Unsupported extensions or namespaces in that closure fail closed. Dynamic or string-bodied function references absent from PostgreSQL catalogs are not certified by dependency analysis; missing dependencies still fail restore or the exercised probes, and unexercised function behavior remains unverified. Any other missing dependency, restore error,
manifest mismatch or restricted-role failure fails the rehearsal. No Supabase
schemas are stubbed, no source roles/ACLs/secrets are exported, and no source
write is executed. Ownership and ACL restoration is excluded explicitly;
local grants test RLS separately.

Raw data stays inside a mode-0700 directory under `RUNNER_TEMP`, with a
mode-0600 archive. Python `finally` cleanup and an independent `always()` job
step remove it on failures; runner disposal is the final cancellation boundary.
Only fixed phase names and SQLSTATE/fixed error codes diagnose failures. Preflight failures distinguish malformed URI, format, database, query, host/port, and missing credential without exposing any supplied value. No exception messages, raw dump or subprocess errors are uploaded or printed (errors can contain
row data). Only the specifically named sanitized JSON receipt is retained for
seven days: run/commit/project identity, elapsed time, archive digest, table
counts, catalog digest and probe status. A failed run yields no passing receipt.

This proves recovery of actual staging public database schema/data only when
the protected workflow passes. It does not establish Supabase Auth, object
storage, production recovery, retention durability, WAL/PITR or an RPO. Keep
those beta recovery gates open. Measured elapsed time covers this rehearsal,
not an approved production RTO.

Local checks: `python3 -m unittest discover -s scripts -p test_staging_database_restore.py`.
