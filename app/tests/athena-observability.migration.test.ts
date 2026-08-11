import fs from "node:fs";
import path from "node:path";

describe("athena observability migration", () => {
  const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20260811020000_add_athena_observability/migration.sql"), "utf8");

  it("adds the trace/metrics indexes needed for bounded observability queries", () => {
    expect(migration).toContain("create index idx_athena_executions_org_trace on athena_executions(org_id, trace_id)");
    expect(migration).toContain("create index idx_athena_executions_org_request on athena_executions(org_id, request_id)");
    expect(migration).toContain("create index idx_athena_executions_org_created on athena_executions(org_id, created_at)");
    expect(migration).toContain("create index idx_athena_telemetry_records_org_trace on athena_telemetry_records(org_id, trace_id)");
    expect(migration).toContain("create index idx_athena_telemetry_records_org_span_created on athena_telemetry_records(org_id, span_type, created_at)");
    expect(migration).toContain("create index idx_athena_telemetry_records_org_status_created on athena_telemetry_records(org_id, status, created_at)");
    expect(migration).toContain("create index idx_athena_event_dead_letters_org_created on athena_event_dead_letters(org_id, created_at)");
  });

  it("adds athena_alerts with forced RLS restricted to owner/admin only", () => {
    expect(migration).toContain("create table athena_alerts");
    expect(migration).toContain("alter table athena_alerts enable row level security");
    expect(migration).toContain("alter table athena_alerts force row level security");

    expect(migration).toContain("create policy athena_alerts_select_policy on athena_alerts");
    expect(migration).toContain("create policy athena_alerts_insert_policy on athena_alerts");
    expect(migration).toContain("create policy athena_alerts_update_policy on athena_alerts");

    // Deliberately narrower than current_app_can_administer() (which also
    // admits 'dispatcher') - every policy on this table must check the role
    // directly against ('owner', 'admin') only.
    const policyBlocks = migration.match(/create policy athena_alerts_\w+_policy[\s\S]*?;/g) ?? [];
    expect(policyBlocks.length).toBeGreaterThanOrEqual(3);
    for (const block of policyBlocks) {
      expect(block).toContain("current_app_role()) in ('owner', 'admin')");
      expect(block).not.toContain("current_app_can_administer()");
    }
  });

  it("enforces the (org_id, dedupe_key) uniqueness that alert deduplication depends on", () => {
    expect(migration).toContain("create unique index idx_athena_alerts_org_dedupe_key on athena_alerts(org_id, dedupe_key)");
  });

  it("never stores raw prompt/message/reasoning columns", () => {
    expect(migration).not.toMatch(/^\s*message\s+text/im);
    expect(migration).not.toMatch(/^\s*prompt\s+text/im);
    expect(migration).not.toMatch(/^\s*reasoning\s+text/im);
  });
});
