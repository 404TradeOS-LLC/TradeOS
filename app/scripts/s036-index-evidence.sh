set search_path = ${SCHEMA}, public;
\i ${MIGRATION_PATH}
SQL

after_plan="$(run_sql "explain (format json) ${QUERY}")"
after_insert="$(run_sql "begin; explain (analyze, format json) insert into job_assignments (id, org_id, job_id, user_id, assignment_role, assigned_by_id) values (1001, 'synthetic-org', 1001, 26, 'technician', 1); rollback")"
after_update="$(run_sql "begin; explain (analyze, format json) update job_assignments set declined_at = now() where id = 1; rollback")"
index_bytes="$(run_sql "select pg_relation_size('${SCHEMA}.${INDEX_NAME}')")"
index_tuples="$(run_sql "select reltuples::bigint from pg_class where oid = '${SCHEMA}.${INDEX_NAME}'::regclass")"

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

