# ABC Shared-Catalog Import — Operator Runbook (issue #735, Phase 2)

How to run, resume, inspect, and recover the ABC Supply sandbox catalog
import. Sandbox only. Nothing in this runbook touches production hosts or
data; production ABC access is separate issue #719.

## What the importer does

`app/scripts/run-abc-catalog-import.ts` (service:
`app/modules/supplier-integration/abcCatalogImport.ts`) pages the full
sandbox catalog at 1000 items/page through `AbcCatalogClient.listRaw`
(the only read path that returns `Inactive` items) and upserts one row per
item number into the shared, org-less `abc_catalog_items` table, keyed by a
SHA-256 content hash over the stored fields. `Inactive` items are stored
with `is_displayable = false`. `abc_catalog_hierarchy` is seeded from
`GET /api/product/v1/hierarchy` and from item payloads; empty level nodes
are preserved (code collapses to `''` in `path_key`). Every page commits
in one transaction and only then advances `checkpoint_page` in
`abc_catalog_sync_runs` — a run resumes from `checkpoint_page + 1`.

What it never does: store a price (the mapper is an explicit field
allowlist and rejects any price-like key), write `SupplierProduct` or
`Material` rows (the service has no access to those models), or touch
tenant data. A catalog item becomes a tenant Material only through the
existing operator-gated activation flow (Phase 5).

## Running it

### Via the manual workflow (normal path)

`.github/workflows/abc-sandbox-catalog-import.yml` — dispatch from `main`
only, `abc-sandbox` environment, exact confirmation
`IMPORT_ABC_SANDBOX_CATALOG`. Inputs:

| Input | Meaning |
|---|---|
| `dry_run` (default `true`) | Count what would change; write nothing, create no run row. Always run this first. |
| `max_pages` (default `3`) | Bound the run to N 1000-item pages. `0` = all 259 pages (~1.5 h provider time). |
| `resume_run_id` | Resume an interrupted run by its run id. |
| `second_run` (default `false`) | After a full import, run the identical import again and require 0 adds / 0 updates. |
| `db_capacity_bytes` (default `10737418240` = 10 GiB) | Total database capacity for the headroom gate — the disposable runner's disk. |

The workflow imports into a **disposable Postgres started in the runner**,
not into staging (see "Staging target is blocked" below). A full run plus
second pass takes ~3 h of provider time; the job timeout is 360 minutes.

### Via the CLI (same script the workflow runs)

```bash
cd app
npx ts-node scripts/run-abc-catalog-import.ts [--dry-run] [--max-pages N] \
  [--resume <run-id>] [--correlation-id <id>] [--db-capacity-bytes N]
```

Environment: `ABC_SUPPLY_SANDBOX_CLIENT_ID` /
`ABC_SUPPLY_SANDBOX_CLIENT_SECRET` (the `abc-sandbox` environment),
`DATABASE_URL` (the target database), and `ABC_CATALOG_DB_CAPACITY_BYTES`
(or `--db-capacity-bytes`). Stdout carries exactly one JSON report line
(counts only). Progress goes to stderr. Exit codes: `0` succeeded,
`2` partial (bounded stop or provider drift — resumable), `1` failed.

## The recommended sequence for a first full import

1. **Dry-run, bounded:** dispatch with `dry_run = true`, `max_pages = 3`.
   Verify the summary: provider totals 258,494 items / 259 pages, counts
   sane, stored rows still 0 (the workflow asserts this).
2. **Bounded write, then resume:** dispatch with `dry_run = false`,
   `max_pages = 3`. The run ends `partial` with `checkpoint_page = 3`.
   Dispatch again with `resume_run_id` set to the run id from the summary
   and `max_pages = 0` (or a larger bound) to continue to completion.
   This is the resume proof: the second dispatch must not re-add the
   first 3 pages' items.
3. **Full import:** dispatch with `dry_run = false`, `max_pages = 0`,
   `second_run = true`. The summary must show `items_seen` equal to
   provider `totalItems` (± documented drift) and the second pass
   `0 adds / 0 updates`.

## Headroom gate (Phase 1 open check, discharged here)

Before any write, the importer measures live database size with
`pg_database_size(current_database())` and requires
`capacity − used ≥ ~2 GB` (the 0.53–1.32 GB catalog plus trigram/GIN
indexes and refresh headroom). Capacity comes from
`ABC_CATALOG_DB_CAPACITY_BYTES` / `--db-capacity-bytes` — the operator
records it from the Supabase dashboard (Settings → Database → disk usage
vs the plan's included storage). **Without a capacity figure the import
fails closed** (`catalog_import_headroom_unconfigured`); the importer
never guesses headroom. The workflow also runs a read-only `psql`
headroom step first and echoes used/free MB in its summary.

For the disposable runner the capacity is its disk (10 GiB default). For
a staging run the operator must replace it with the staging plan's
included storage from the dashboard for refs `qfbgdkbamfaasmtjfyru`
(staging) / `kssaceuetdjwfqnbzhly` (prod) — record the numbers on #735
when the check runs.

## Staging target is blocked (exact owner action)

No single GitHub environment holds both halves of a staging import: the
`abc-sandbox` environment holds only the ABC client credentials (no
database secret) and the `staging` environment holds only
`STAGING_DATABASE_ADMIN_URL` / `STAGING_APP_DB_ROLE_PASSWORD` (no ABC
credentials); a job runs under exactly one environment, and passing
258k provider items between jobs would need a payload upload, which is
forbidden. **Owner action:** add `ABC_SUPPLY_SANDBOX_CLIENT_ID` and
`ABC_SUPPLY_SANDBOX_CLIENT_SECRET` to the `staging` environment (or add
the staging database URL to `abc-sandbox`). Either placement is secret
creation and needs the owner. Once placed, the same script runs against
staging unchanged — the target is just `DATABASE_URL` — and the
workflow's disposable-DB steps are replaced by the staging secret.
Staging verification via the deployed app is additionally gated on the
Vercel 402 clearing.

## Inspecting a run

```sql
-- Latest runs, newest first (counts are cumulative per run id).
select id, kind, status, started_at, finished_at,
  provider_total_items, provider_total_pages,
  pages_processed, items_seen, items_added, items_updated,
  items_deactivated, items_failed, checkpoint_page, error
from abc_catalog_sync_runs order by started_at desc limit 5;

-- Sync checkpoint (what Costbook freshness reads).
select * from abc_catalog_sync_state where id = 'abc-catalog';

-- Stored catalog size and displayable split.
select count(*), count(*) filter (where is_displayable) as displayable,
  count(*) filter (where status <> 'Active') as inactive
from abc_catalog_items;
```

All of the above are readable by any authenticated org session (global
SELECT policy); no org can write these tables — writes require the
ingestion flag, which only the importer sets inside its own transactions.

## Failure codes and recovery

| Code / status | Meaning | Recovery |
|---|---|---|
| `catalog_import_bounded_stop` (`partial`) | Operator-bounded run stopped at `max_pages`. | Resume with `--resume <run-id>`. |
| `catalog_import_pagination_drift` (`partial`) | Provider `totalItems`/`totalPages` changed mid-run. | Inspect the totals; resume — the run re-reads totals from the checkpoint and continues. If the catalog genuinely changed, a fresh full run is also safe (hash upsert). |
| `catalog_import_empty_provider_response` (`failed`) | First page returned 0 items — treated as provider outage, not withdrawal. | Stored data is untouched. Re-run when the provider is back. |
| `catalog_import_insufficient_headroom` (`failed`) | < ~2 GB free. | Free space or record a larger plan capacity from the dashboard; re-run. |
| `catalog_import_headroom_unconfigured` (`failed`) | No capacity figure supplied. | Supply `ABC_CATALOG_DB_CAPACITY_BYTES` from the dashboard; re-run. |
| `catalog_import_already_running` | A `full` run is still `running`. | Resume that run (`--resume <id>`) instead of starting a new one. A killed run stays `running` with its checkpoint — resuming it is the recovery path; never hand-edit the row. |
| `catalog_import_run_already_succeeded` | `--resume` on a finished run. | Start a new run (a second identical run must be 0/0). |
| `provider_denied` / `provider_unavailable_http_*` / `provider_request_failed` | ABC sandbox auth/availability. | Check the `abc-sandbox` credentials and the provider; re-run or resume. |
| `catalog_import_price_key_found` (per-item) | One item carried a price-like key; counted in `items_failed`, listed in the run's `error` field. | The sync continues. Investigate the item; it is skipped, never stored. |

A database transaction failure aborts the run, not the item: the page
is not half-written and the checkpoint does not advance past it — resume
re-processes that page idempotently.

## Rollback

There is no delete path by design (no DELETE policy on any catalog
table): rows are soft-deactivated, never hard-deleted, so history and
tenant links survive. To back out a bad import, re-run the import from
the provider (hash upsert corrects changed rows) or, if ABC narrows or
revokes permission, stop the importer and handle the stored copy per
ABC's direction as a deliberate Phase 6 operation — never a silent purge.
Sync runs are the audit trail and are never deleted.
