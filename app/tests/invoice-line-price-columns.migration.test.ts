import fs from "node:fs";
import path from "node:path";

describe("invoice line-item selling-price rename migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260902193000_rename_invoice_line_price_columns/migration.sql"),
    "utf8"
  );
  const schema = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");

  it("adds and backfills selling-price columns without destructive renames", () => {
    expect(migration).toContain("add column unit_price numeric(12,4)");
    expect(migration).toContain("add column line_total numeric(14,2)");
    expect(migration).toContain("set unit_price = unit_cost");
    expect(migration).toContain("line_total = line_cost");
    expect(migration).not.toMatch(/rename column/i);
    expect(migration).not.toMatch(/drop column/i);
  });

  it("keeps old and new writers synchronized during the rollout", () => {
    expect(migration).toContain("sync_invoice_line_item_price_columns");
    expect(migration).toContain("before insert or update on invoice_line_items");
    expect(migration).toContain("alter column unit_price set not null");
    expect(migration).toContain("alter column line_total set not null");
  });

  it("keeps Prisma's selling-price field names aligned with the new columns", () => {
    expect(schema).toContain('unitPrice     Decimal  @map("unit_price")');
    expect(schema).toContain('lineTotal     Decimal  @map("line_total")');
  });
});
