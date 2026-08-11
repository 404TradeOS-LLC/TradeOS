import fs from "node:fs";
import path from "node:path";

describe("costbook workspace foundation migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260811120000_add_costbook_workspace_foundation/migration.sql"),
    "utf8"
  );

  it("creates org-scoped Costbook workspace foundation tables", () => {
    expect(migration).toContain("create table if not exists costbook_workspaces");
    expect(migration).toContain("organization_id uuid not null unique references organizations(id) on delete cascade");
    expect(migration).toContain("create table if not exists costbook_workspace_events");
    expect(migration).toContain("costbook_workspace_id uuid not null references costbook_workspaces(id) on delete cascade");
  });

  it("forces RLS and scopes reads to the current organization", () => {
    for (const table of ["costbook_workspaces", "costbook_workspace_events"]) {
      expect(migration).toContain(`alter table ${table} enable row level security`);
      expect(migration).toContain(`alter table ${table} force row level security`);
    }

    expect(migration).toContain("organization_id = (select public.current_app_org_id())");
  });

  it("keeps Costbook workspace writes owner/admin managed", () => {
    expect(migration).toContain("current_app_can_manage_costbook()");
    expect(migration).toContain("public.current_app_role() in ('owner', 'admin')");
  });

  it("prevents cross-organization workspace event records", () => {
    expect(migration).toContain("enforce_costbook_workspace_event_org");
    expect(migration).toContain("new.organization_id <> workspace_org");
  });
});
