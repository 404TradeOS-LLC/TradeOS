import fs from "node:fs";
import path from "node:path";

const migrationPath = path.join(__dirname, "../prisma/migrations/20260810130000_add_athena_memory/migration.sql");
const sql = fs.readFileSync(migrationPath, "utf8");

describe("Athena memory migration", () => {
  it("creates the memory table, active stable-key index, and forced RLS", () => {
    expect(sql).toMatch(/create table athena_memories/i);
    expect(sql).toMatch(/idx_athena_memories_active_stable_key/i);
    expect(sql).toMatch(/where status = 'active'/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/force row level security/i);
  });

  it("keeps user and conversation memory actor-scoped with no admin bypass", () => {
    expect(sql).toContain("scope in ('user', 'conversation') and subject_id = (select current_app_user_id())::text");
  });

  it("allows exact organization scope while project and job scopes remain fail-closed", () => {
    expect(sql).toContain("scope = 'organization' and subject_id = (select current_app_org_id())::text");
    expect(sql).not.toMatch(/scope in \('organization', 'project', 'job'\)/);
    expect(sql).not.toMatch(/or scope in \('organization', 'project', 'job'\)/);
  });
});
