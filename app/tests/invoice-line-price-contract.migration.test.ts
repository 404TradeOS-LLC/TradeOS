import fs from "node:fs";
import path from "node:path";

describe("invoice line-item price contract migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260902200000_contract_invoice_line_price_columns/migration.sql"),
    "utf8"
  );

  it("removes compatibility machinery before dropping legacy columns", () => {
    expect(migration).toContain("drop trigger if exists invoice_line_item_price_columns_sync");
    expect(migration).toContain("drop function if exists public.sync_invoice_line_item_price_columns()");
    expect(migration).toContain("drop column unit_cost");
    expect(migration).toContain("drop column line_cost");
  });

  it("does not recreate or rename the canonical selling-price columns", () => {
    expect(migration).not.toMatch(/drop column (unit_price|line_total)/i);
    expect(migration).not.toMatch(/rename column/i);
  });
});
