import fs from "node:fs";
import path from "node:path";

describe("invoice line-item selling-price rename migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260902193000_rename_invoice_line_price_columns/migration.sql"),
    "utf8"
  );
  const schema = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");

  it("renames both physical columns in place", () => {
    expect(migration).toContain("alter table invoice_line_items\n  rename column unit_cost to unit_price");
    expect(migration).toContain("alter table invoice_line_items\n  rename column line_cost to line_total");
    expect(migration).not.toMatch(/drop column/i);
  });

  it("keeps Prisma's selling-price field names aligned with the renamed columns", () => {
    expect(schema).toContain('unitPrice     Decimal  @map("unit_price")');
    expect(schema).toContain('lineTotal     Decimal  @map("line_total")');
  });
});
