#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required for disposable S036 evidence}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_PATH="$SCRIPT_DIR/../prisma/migrations/20260908120000_add_active_job_assignment_lookup/migration.sql"
OUTPUT_PATH="${S036_EVIDENCE_OUTPUT:-$SCRIPT_DIR/../../artifacts/s036-index-evidence/evidence.md}"
SCHEMA="s036_evidence"
INDEX_NAME="idx_job_assignments_active_org_job"

mkdir -p "$(dirname "$OUTPUT_PATH")"
rm -f "$OUTPUT_PATH"

psql_args=(-X "$DATABASE_URL" -v ON_ERROR_STOP=1)

run_sql() {
  psql "${psql_args[@]}" -Atqc "$1"
}

compact_json() {
  printf '%s' "$1" | jq -c .
}

write_timing() {
  printf '%s' "$1" | jq -c '.[0] | {planning_ms: .["Planning Time"], execution_ms: .["Execution Time"]}'
}

plan_uses_index() {
  printf '%s' "$1" | jq -r --arg name "$INDEX_NAME" '
    [.. | strings | select(contains($name))] | length > 0
  '
}

cleanup() {
  run_sql "drop schema if exists ${SCHEMA} cascade" >/dev/null 2>&1 || true
}
trap cleanup EXIT

run_sql "drop schema if exists ${SCHEMA} cascade; create schema ${SCHEMA}"

psql "${psql_args[@]}" <<SQL
set search_path = ${SCHEMA}, public;

create table jobs (
  id bigint primary key,
  org_id text not null,
  status text not null,
  archived_at timestamptz,
  scheduled_start timestamptz not null
);

create table job_assignments (
  id bigint primary key,
  org_id text not null,
  job_id bigint not null,
  user_id bigint not null,
  assignment_role text not null,
  is_lead boolean not null default false,
  assigned_by_id bigint not null,
  declined_at timestamptz,
  removed_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into jobs (id, org_id, status, archived_at, scheduled_start)
select
  job_id,
  'synthetic-org',
  case when job_id % 4 = 0 then 'scheduled' else 'unscheduled' end,
  case when job_id % 25 = 0 then now() else null end,
  now() + make_interval(mins => job_id)
from generate_series(1, 1000) as job_id;

insert into job_assignments (
  id, org_id, job_id, user_id, assignment_role, is_lead, assigned_by_id,
  declined_at, removed_at
)
select
  assignment_id,
  'synthetic-org',
  ((assignment_id - 1) % 1000) + 1,
  ((assignment_id - 1) % 25) + 1,
  'technician',
  assignment_id % 25 = 1,
  1,
  case when assignment_id between 301 and 500 then now() else null end,
  case when assignment_id between 101 and 300 then now() else null end
from generate_series(1, 500) as assignment_id;

analyze jobs;
analyze job_assignments;
SQL

QUERY="
select j.id, ja.user_id
from jobs j
join job_assignments ja
  on ja.org_id = j.org_id
 and ja.job_id = j.id
where j.org_id = 'synthetic-org'
  and j.status in ('scheduled', 'unscheduled')
  and j.archived_at is null
  and ja.removed_at is null
  and ja.declined_at is null
order by j.scheduled_start, j.id
limit 50
"

before_plan="$(run_sql "set search_path = ${SCHEMA}, public; explain (format json) ${QUERY}")"
before_insert="$(run_sql "set search_path = ${SCHEMA}, public; begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (1001, 'synthetic-org', 1001, 26, 'technician', 1); rollback")"
before_update="$(run_sql "set search_path = ${SCHEMA}, public; begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"

psql "${psql_args[@]}" <<SQL
set search_path = ${SCHEMA}, public;
\i ${MIGRATION_PATH}
SQL

after_plan="$(run_sql "set search_path = ${SCHEMA}, public; explain (format json) ${QUERY}")"
after_insert="$(run_sql "set search_path = ${SCHEMA}, public; begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (1001, 'synthetic-org', 1001, 26, 'technician', 1); rollback")"
after_update="$(run_sql "set search_path = ${SCHEMA}, public; begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"
index_bytes="$(run_sql "select pg_relation_size('${SCHEMA}.${INDEX_NAME}')")"
index_tuples="$(run_sql "select reltuples::bigint from pg_class where oid = '${SCHEMA}.${INDEX_NAME}'::regclass")"

run_sql "set search_path = ${SCHEMA}, public; drop index if exists ${INDEX_NAME}"
rollback_index="$(run_sql "select coalesce(to_regclass('${SCHEMA}.${INDEX_NAME}')::text, 'absent')")"

captured_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
before_plan_json="$(compact_json "$before_plan")"
after_plan_json="$(compact_json "$after_plan")"
before_insert_timing="$(write_timing "$before_insert")"
after_insert_timing="$(write_timing "$after_insert")"
before_update_timing="$(write_timing "$before_update")"
after_update_timing="$(write_timing "$after_update")"
after_uses_index="$(plan_uses_index "$after_plan")"

cat > "$OUTPUT_PATH" <<EOF
# S036 Disposable PostgreSQL Evidence

Status: \`CAPTURED\` — synthetic disposable fixture only; no production
database, customer data, credentials, or production workload was used.

Captured at: \`${captured_at}\`

## Fixture

- Isolated schema: \`${SCHEMA}\` (dropped automatically after capture).
- 1,000 synthetic jobs and 500 synthetic assignments, matching the S035
  representative cardinalities.
- 100 assignments were active; 200 were removed and 200 were declined.
- The exact S036 migration file was applied unmodified with the isolated schema
  first in \`search_path\`.

## Before plan

```json
${before_plan_json}
```

## After plan

```json
${after_plan_json}
```

Planner selected the candidate index after creation: \`${after_uses_index}\`.

## Index size and write-cost observations

- Candidate index size after creation: \`${index_bytes}\` bytes.
- Candidate index estimated tuples after creation: \`${index_tuples}\`.
- Baseline insert timing: \`${before_insert_timing}\`.
- Indexed insert timing: \`${after_insert_timing}\`.
- Baseline active-to-declined update timing: \`${before_update_timing}\`.
- Indexed active-to-declined update timing: \`${after_update_timing}\`.

These are single controlled \`EXPLAIN (ANALYZE, FORMAT JSON)\` operations in a
disposable fixture, not production latency or SLO measurements.

## Rollback rehearsal

```sql
drop index if exists ${INDEX_NAME};
```

Rollback verification: \`${rollback_index}\`.

The schema cleanup trap then dropped the entire synthetic fixture. This artifact
is evidence for review; it does not authorize production application or merge
by itself.
EOF

echo "S036 evidence written to $OUTPUT_PATH"
