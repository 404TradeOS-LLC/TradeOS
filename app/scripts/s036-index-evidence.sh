#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required for disposable S036 evidence}"

case "$DATABASE_URL" in
  postgresql://*|postgres://*)
    ;;
  *)
    echo "S036 evidence requires a PostgreSQL disposable target" >&2
    exit 1
    ;;
esac

DATABASE_AUTHORITY="${DATABASE_URL#*://}"
DATABASE_AUTHORITY="${DATABASE_AUTHORITY%%/*}"
DATABASE_HOST="${DATABASE_AUTHORITY##*@}"
DATABASE_HOST="${DATABASE_HOST%%:*}"
DATABASE_NAME="${DATABASE_URL##*/}"
DATABASE_NAME="${DATABASE_NAME%%\?*}"

if [[ "$DATABASE_HOST" != "127.0.0.1" && "$DATABASE_HOST" != "localhost" ]]; then
  echo "S036 evidence refuses non-local database targets" >&2
  exit 1
fi

if [[ -z "$DATABASE_NAME" || "$DATABASE_NAME" != *_evidence ]]; then
  echo "S036 evidence requires a database name ending in _evidence" >&2
  exit 1
fi

RUN_TOKEN_RAW="${GITHUB_RUN_ID:-local_$(date +%s)_${RANDOM}}"
RUN_TOKEN="$(printf '%s' "$RUN_TOKEN_RAW" | tr -cd '[:alnum:]_' | cut -c1-32)"
RUN_TOKEN="${RUN_TOKEN:-local}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_PATH="$SCRIPT_DIR/../prisma/migrations/20260908120000_add_active_job_assignment_lookup/migration.sql"
OUTPUT_PATH="${S036_EVIDENCE_OUTPUT:-$SCRIPT_DIR/../../artifacts/s036-index-evidence/evidence.md}"
SCHEMA="s036_evidence_${RUN_TOKEN}"
INDEX_NAME="idx_job_assignments_active_org_job"

mkdir -p "$(dirname "$OUTPUT_PATH")"
rm -f "$OUTPUT_PATH"

psql_args=(-X --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1)

run_sql() {
  PGOPTIONS="-c search_path=${SCHEMA},public" psql "${psql_args[@]}" --tuples-only --no-align --command="$1"
}

extract_json() {
  printf '%s\n' "$1" |
    awk '
      BEGIN { started = 0 }
      /^\[/ { started = 1 }
      started { print }
      started && /^\]$/ { exit }
    ' |
    cat
}

compact_json() {
  extract_json "$1" | jq -c .
}

write_timing() {
  extract_json "$1" |
    jq -c '.[0] | {planning_ms: .["Planning Time"], execution_ms: .["Execution Time"]}'
}

plan_uses_index() {
  extract_json "$1" | jq -r --arg name "$INDEX_NAME" '
    [.. | strings | select(contains($name))] | length > 0
  '
}

verify_index_contract() {
  local fixture_name="$1"

  INDEX_COLUMNS="$(run_sql "select string_agg(a.attname, ',' order by key_position) from pg_index i join pg_class c on c.oid = i.indexrelid join pg_class t on t.oid = i.indrelid join pg_namespace n on n.oid = t.relnamespace cross join lateral unnest(i.indkey) with ordinality as keys(attnum, key_position) join pg_attribute a on a.attrelid = t.oid and a.attnum = keys.attnum where n.nspname = '${SCHEMA}' and c.relname = '${INDEX_NAME}'")"
  INDEX_PREDICATE="$(run_sql "select pg_get_expr(indpred, indrelid) from pg_index i join pg_class c on c.oid = i.indexrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = '${SCHEMA}' and c.relname = '${INDEX_NAME}'")"
  INDEX_UNIQUE="$(run_sql "select indisunique::text from pg_index i join pg_class c on c.oid = i.indexrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = '${SCHEMA}' and c.relname = '${INDEX_NAME}'")"
  INDEX_DEFINITION="$(run_sql "select pg_get_indexdef(c.oid) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = '${SCHEMA}' and c.relname = '${INDEX_NAME}'")"

  if [[ "$INDEX_COLUMNS" != "org_id,job_id" || "$INDEX_UNIQUE" != "f" || "$INDEX_PREDICATE" != *"removed_at IS NULL"* || "$INDEX_PREDICATE" != *"declined_at IS NULL"* ]]; then
    echo "S036 ${fixture_name} index contract verification failed" >&2
    exit 1
  fi
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

before_plan="$(run_sql "explain (format json) ${QUERY}")"
before_insert="$(run_sql "begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (1001, 'synthetic-org', 1001, 26, 'technician', 1); rollback")"
before_update="$(run_sql "begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"

psql "${psql_args[@]}" <<SQL
set search_path = ${SCHEMA}, public;
\i ${MIGRATION_PATH}
SQL

after_plan="$(run_sql "explain (format json) ${QUERY}")"
after_insert="$(run_sql "begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (1001, 'synthetic-org', 1001, 26, 'technician', 1); rollback")"
after_update="$(run_sql "begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"
index_bytes="$(run_sql "select pg_relation_size('${SCHEMA}.${INDEX_NAME}')")"
index_tuples="$(run_sql "select reltuples::bigint from pg_class where oid = '${SCHEMA}.${INDEX_NAME}'::regclass")"
verify_index_contract representative
representative_index_columns="$INDEX_COLUMNS"
representative_index_predicate="$INDEX_PREDICATE"
representative_index_unique="$INDEX_UNIQUE"

if [[ -z "$before_plan" || -z "$after_plan" ]]; then
  echo "S036 evidence capture produced an empty before or after plan" >&2
  exit 1
fi

printf '%s\n' "$before_plan" > "${OUTPUT_PATH}.before-plan.raw"
printf '%s\n' "$after_plan" > "${OUTPUT_PATH}.after-plan.raw"

run_sql "drop index if exists ${INDEX_NAME}"
rollback_index="$(run_sql "select coalesce(to_regclass('${SCHEMA}.${INDEX_NAME}')::text, 'absent')")"

if [[ "$rollback_index" != "absent" ]]; then
  echo "S036 rollback verification failed: ${rollback_index}" >&2
  exit 1
fi

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
  format('synthetic-org-%s', ((job_id - 1) % 100) + 1),
  case when job_id % 4 = 0 then 'scheduled' else 'unscheduled' end,
  case when job_id % 25 = 0 then now() else null end,
  now() + make_interval(secs => job_id)
from generate_series(1, 100000) as job_id;

insert into job_assignments (
  id, org_id, job_id, user_id, assignment_role, is_lead, assigned_by_id,
  declined_at, removed_at
)
select
  assignment_id,
  format('synthetic-org-%s', (((assignment_id - 1) % 100000) % 100) + 1),
  ((assignment_id - 1) % 100000) + 1,
  ((assignment_id - 1) % 250) + 1,
  'technician',
  assignment_id % 25 = 1,
  1,
  case when assignment_id % 20 between 5 and 8 then now() else null end,
  case when assignment_id % 20 between 1 and 4 then now() else null end
from generate_series(1, 500000) as assignment_id;

analyze jobs;
analyze job_assignments;
SQL

SELECTIVE_QUERY="
select j.id, ja.user_id
from jobs j
join job_assignments ja
  on ja.org_id = j.org_id
 and ja.job_id = j.id
where j.org_id = 'synthetic-org-1'
  and j.status in ('scheduled', 'unscheduled')
  and j.archived_at is null
  and ja.removed_at is null
  and ja.declined_at is null
order by j.scheduled_start, j.id
limit 50
"

selective_before_plan="$(run_sql "explain (format json) ${SELECTIVE_QUERY}")"
selective_before_insert="$(run_sql "begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (500001, 'synthetic-org-1', 100001, 251, 'technician', 1); rollback")"
selective_before_update="$(run_sql "begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"

psql "${psql_args[@]}" <<SQL
set search_path = ${SCHEMA}, public;
\i ${MIGRATION_PATH}
SQL

selective_after_plan="$(run_sql "explain (format json) ${SELECTIVE_QUERY}")"
selective_after_insert="$(run_sql "begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (500001, 'synthetic-org-1', 100001, 251, 'technician', 1); rollback")"
selective_after_update="$(run_sql "begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"
selective_index_bytes="$(run_sql "select pg_relation_size('${SCHEMA}.${INDEX_NAME}')")"
selective_index_tuples="$(run_sql "select reltuples::bigint from pg_class where oid = '${SCHEMA}.${INDEX_NAME}'::regclass")"
verify_index_contract selective
selective_index_columns="$INDEX_COLUMNS"
selective_index_predicate="$INDEX_PREDICATE"
selective_index_unique="$INDEX_UNIQUE"

if [[ -z "$selective_before_plan" || -z "$selective_after_plan" ]]; then
  echo "S036 selective evidence capture produced an empty before or after plan" >&2
  exit 1
fi

printf '%s\n' "$selective_before_plan" > "${OUTPUT_PATH}.selective-before-plan.raw"
printf '%s\n' "$selective_after_plan" > "${OUTPUT_PATH}.selective-after-plan.raw"

run_sql "drop index if exists ${INDEX_NAME}"
selective_rollback_index="$(run_sql "select coalesce(to_regclass('${SCHEMA}.${INDEX_NAME}')::text, 'absent')")"

if [[ "$selective_rollback_index" != "absent" ]]; then
  echo "S036 selective rollback verification failed: ${selective_rollback_index}" >&2
  exit 1
fi

captured_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
before_plan_json="$(compact_json "$before_plan")"
after_plan_json="$(compact_json "$after_plan")"
before_insert_timing="$(write_timing "$before_insert")"
after_insert_timing="$(write_timing "$after_insert")"
before_update_timing="$(write_timing "$before_update")"
after_update_timing="$(write_timing "$after_update")"
after_uses_index="$(plan_uses_index "$after_plan")"
selective_before_plan_json="$(compact_json "$selective_before_plan")"
selective_after_plan_json="$(compact_json "$selective_after_plan")"
selective_before_insert_timing="$(write_timing "$selective_before_insert")"
selective_after_insert_timing="$(write_timing "$selective_after_insert")"
selective_before_update_timing="$(write_timing "$selective_before_update")"
selective_after_update_timing="$(write_timing "$selective_after_update")"
selective_after_uses_index="$(plan_uses_index "$selective_after_plan")"

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

\`\`\`json
${before_plan_json}
\`\`\`

## After plan

\`\`\`json
${after_plan_json}
\`\`\`

Planner selected the candidate index after creation: \`${after_uses_index}\`.

## Index size and write-cost observations

- Candidate index size after creation: \`${index_bytes}\` bytes.
- Candidate index estimated tuples after creation: \`${index_tuples}\`.
- Candidate index columns: \`${representative_index_columns}\`.
- Candidate index predicate: \`${representative_index_predicate}\`.
- Candidate index unique flag: \`${representative_index_unique}\`.
- Baseline insert timing: \`${before_insert_timing}\`.
- Indexed insert timing: \`${after_insert_timing}\`.
- Baseline active-to-declined update timing: \`${before_update_timing}\`.
- Indexed active-to-declined update timing: \`${after_update_timing}\`.

These are single controlled \`EXPLAIN (ANALYZE, FORMAT JSON)\` operations in a
disposable fixture, not production latency or SLO measurements.

## Larger selective fixture

- 100,000 synthetic jobs and 500,000 synthetic assignments across 100
  synthetic organizations.
- The target organization contains approximately 1,000 jobs and 5,000
  assignments, so the query filters a small tenant slice of the larger table.

### Before plan

\`\`\`json
${selective_before_plan_json}
\`\`\`

### After plan

\`\`\`json
${selective_after_plan_json}
\`\`\`

Planner selected the candidate index after creation: \`${selective_after_uses_index}\`.

## Larger fixture index size and write-cost observations

- Candidate index size after creation: \`${selective_index_bytes}\` bytes.
- Candidate index estimated tuples after creation: \`${selective_index_tuples}\`.
- Candidate index columns: \`${selective_index_columns}\`.
- Candidate index predicate: \`${selective_index_predicate}\`.
- Candidate index unique flag: \`${selective_index_unique}\`.
- Baseline insert timing: \`${selective_before_insert_timing}\`.
- Indexed insert timing: \`${selective_after_insert_timing}\`.
- Baseline active-to-declined update timing: \`${selective_before_update_timing}\`.
- Indexed active-to-declined update timing: \`${selective_after_update_timing}\`.

## Rollback rehearsal

\`\`\`sql
drop index if exists ${INDEX_NAME};
\`\`\`

Representative fixture rollback verification: \`${rollback_index}\`.
Larger selective fixture rollback verification: \`${selective_rollback_index}\`.

The schema cleanup trap then dropped the entire synthetic fixture. This artifact
is evidence for review; it does not authorize production application or merge
by itself.
EOF

echo "S036 evidence written to $OUTPUT_PATH"
