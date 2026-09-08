import fs from "node:fs";
import path from "node:path";

describe("custom estimate line-item source constraint migration", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20260905050000_allow_custom_estimate_line_items/migration.sql"),
    "utf8"
  );

  it("allows a custom line with no Costbook source while rejecting two sources", () => {
    expect(migration).toContain("drop constraint if exists estimate_line_items_check");
    expect(migration).toContain("add constraint estimate_line_items_source_exclusivity_check");
    expect(migration).toContain("not (cost_item_id is not null and assembly_id is not null)");
    expect(migration).not.toContain("cost_item_id is not null and assembly_id is null) or");
  });
});
