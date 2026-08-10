import fs from "node:fs";
import path from "node:path";

describe("athena kernel execution migration", () => {
  it("adds the expected tables, indexes, and forced RLS policies", () => {
    const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20260809120000_add_athena_kernel_execution/migration.sql"), "utf8");

    expect(migration).toContain("create table athena_executions");
    expect(migration).toContain("create table athena_execution_transitions");
    expect(migration).toContain("create table athena_telemetry_records");

    for (const table of ["athena_executions", "athena_execution_transitions", "athena_telemetry_records"]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`alter table ${table} force row level security`);
    }

    expect(migration).toContain("create policy athena_executions_select_policy on athena_executions");
    expect(migration).toContain("create policy athena_executions_insert_policy on athena_executions");
    expect(migration).toContain("create policy athena_executions_update_policy on athena_executions");
    expect(migration).toContain("create policy athena_execution_transitions_select_policy on athena_execution_transitions");
    expect(migration).toContain("create policy athena_telemetry_records_select_policy on athena_telemetry_records");

    // Object-level (actor) scoping, not just org scoping - HIGH-005 in the
    // A0.5 architecture review.
    expect(migration).toContain("actor_user_id = current_app_user_id()");
    expect(migration).toContain("current_app_can_administer()");

    // No raw prompt/message columns anywhere in this schema (comments
    // explaining that absence are fine; column definitions are not).
    expect(migration).not.toMatch(/^\s*message\s+text/im);
    expect(migration).not.toMatch(/^\s*prompt\s+text/im);
  });
});
