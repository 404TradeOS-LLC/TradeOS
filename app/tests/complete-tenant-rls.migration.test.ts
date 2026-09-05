import fs from "node:fs";
import path from "node:path";

describe("complete tenant RLS migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260828120000_complete_tenant_rls/migration.sql"),
    "utf8"
  );
  const tenantTables = [
    "activity_events",
    "notifications",
    "attachments",
    "comments",
    "tags",
    "tag_assignments",
    "saved_views",
    "recent_items",
    "feature_flags",
  ];

  it("enables and forces RLS on every previously uncovered tenant table", () => {
    for (const table of tenantTables) {
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain("alter table %I enable row level security");
    expect(migration).toContain("alter table %I force row level security");
    expect(migration).toContain("org_id = (select current_app_org_id())");
    expect(migration).toContain("(select current_app_can_write())");
  });

  it("keeps administrative user reads inside the active organization", () => {
    expect(migration).toContain("drop policy if exists users_select_policy on users");
    expect(migration).toContain("membership.org_id = (select current_app_org_id())");
  });
});
