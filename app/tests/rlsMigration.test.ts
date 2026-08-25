import fs from "node:fs";
import path from "node:path";

describe("organization RLS migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260623180000_enable_org_rls/migration.sql"),
    "utf8"
  );

  it("forces RLS on identity, membership, audit, and inherited tenant tables", () => {
    const explicitlyForcedTables = [
      "users",
      "organization_memberships",
      "organizations",
      "organization_membership_audits",
      "material_price_audits",
      "supplier_price_updates",
      "categories",
      "subcategories",
      "assembly_items",
      "estimate_line_items",
      "change_orders",
      "change_order_line_items",
    ];

    for (const table of explicitlyForcedTables) {
      expect(migration).toContain(`alter table ${table} force row level security`);
    }

    for (const table of ["divisions", "materials", "cost_items", "projects", "estimates"]) {
      expect(migration).toContain(`'${table}'`);
    }
  });

  it("defines role-aware read, write, and administration helpers", () => {
    expect(migration).toContain("current_app_auth_subject()");
    expect(migration).toContain("current_app_can_write()");
    expect(migration).toContain("current_app_can_administer()");
    expect(migration).toContain("org_id = current_app_org_id()");
  });

  it("keeps raw-SQL Athena idempotency storage forced behind tenant policies", () => {
    const idempotencyMigration = fs.readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20260814200000_add_athena_action_idempotency/migration.sql"),
      "utf8"
    );

    expect(idempotencyMigration).toContain("create table athena_action_idempotency");
    expect(idempotencyMigration).toContain("alter table athena_action_idempotency enable row level security");
    expect(idempotencyMigration).toContain("alter table athena_action_idempotency force row level security");
    expect(idempotencyMigration).toContain("org_id = current_app_org_id()");
  });
});
