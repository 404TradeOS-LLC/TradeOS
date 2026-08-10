import fs from "node:fs";
import path from "node:path";

describe("athena memory migration", () => {
  it("adds the expected table, partial unique index, and forced RLS policies", () => {
    const migration = fs.readFileSync(path.join(__dirname, "../prisma/migrations/20260810130000_add_athena_memory/migration.sql"), "utf8");

    expect(migration).toContain("create table athena_memories");

    // Deterministic upsert (Step 5): at most one active row per stable key.
    expect(migration).toContain("create unique index idx_athena_memories_active_stable_key");
    expect(migration).toContain("on athena_memories (org_id, scope, subject_id, kind)");
    expect(migration).toContain("where status = 'active'");

    expect(migration).toContain("alter table athena_memories enable row level security");
    expect(migration).toContain("alter table athena_memories force row level security");

    expect(migration).toContain("create policy athena_memories_select_policy on athena_memories");
    expect(migration).toContain("create policy athena_memories_insert_policy on athena_memories");
    expect(migration).toContain("create policy athena_memories_update_policy on athena_memories");

    // Stricter-than-execution-audit isolation: no admin bypass for
    // user/conversation scope rows.
    expect(migration).toContain("subject_id = (select current_app_user_id())::text");
    expect(migration).toContain("current_app_can_administer()");

    // No delete policy - forgetting is a status update (soft delete), never
    // a hard DELETE, so RLS need not separately authorize row removal.
    expect(migration).not.toMatch(/create policy athena_memories_delete_policy/);
  });
});
