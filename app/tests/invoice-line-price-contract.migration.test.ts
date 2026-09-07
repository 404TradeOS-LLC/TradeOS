import fs from "node:fs";
import path from "node:path";

describe("invoice line-item price contract migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260902200000_contract_invoice_line_price_columns/migration.sql"),
    "utf8"
  );

  it("removes compatibility machinery before dropping legacy columns", () => {
    const triggerDrop = migration.indexOf("drop trigger if exists invoice_line_item_price_columns_sync");
    const functionDrop = migration.indexOf("drop function if exists public.sync_invoice_line_item_price_columns()");
    const legacyColumnDrop = migration.indexOf("alter table invoice_line_items");

    expect(triggerDrop).toBeGreaterThanOrEqual(0);
    expect(functionDrop).toBeGreaterThan(triggerDrop);
    expect(legacyColumnDrop).toBeGreaterThan(functionDrop);
    expect(migration.indexOf("drop column unit_cost", legacyColumnDrop)).toBeGreaterThan(legacyColumnDrop);
    expect(migration.indexOf("drop column line_cost", legacyColumnDrop)).toBeGreaterThan(legacyColumnDrop);
  });

  it("does not recreate or rename the canonical selling-price columns", () => {
    expect(migration).not.toMatch(/drop column (unit_price|line_total)/i);
    expect(migration).not.toMatch(/rename column/i);
  });
});
