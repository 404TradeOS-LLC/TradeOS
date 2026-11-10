import fs from "node:fs";
import path from "node:path";

describe("codes authority/jurisdiction/source migration (#946 TODO 2)", () => {
  const migration = fs.readFileSync(
    path.resolve(__dirname, "../prisma/migrations/20261109220000_add_codes_authority_jurisdiction_source/migration.sql"),
    "utf8"
  );
  const schema = fs.readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");

  it("creates the four codes_* tables with the specified uniques", () => {
    for (const table of ["codes_authority", "codes_jurisdiction", "codes_source", "codes_source_history"]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain("UNIQUE (name, state, county)");
    expect(migration).toContain("UNIQUE (authority_id, name, jurisdiction_kind)");
    expect(migration).toContain("UNIQUE (authority_id, code_family, citation, version_label)");
    // PostgreSQL treats NULLs as distinct in a UNIQUE constraint, so the
    // unversioned singleton needs its own partial index.
    expect(migration).toContain("codes_source_unversioned_key");
    expect(migration).toContain("WHERE version_label IS NULL");
    expect(migration).toContain("status text NOT NULL DEFAULT 'research'");
    expect(migration).toContain("CHECK (status IN ('research', 'reviewed', 'superseded'))");
    expect(migration).toContain("CHECK (source_hash IS NULL OR source_hash ~ '^[0-9a-f]{64}$')");
  });

  it("grants authenticated reads only, with no tenant write policies", () => {
    for (const table of ["codes_authority", "codes_jurisdiction", "codes_source", "codes_source_history"]) {
      expect(migration).toContain(`CREATE POLICY codes_${table.replace("codes_", "")}_select_policy ON public.${table}`);
    }
    expect(migration).toContain("FOR SELECT USING (public.current_app_org_id() IS NOT NULL)");
    expect(migration).not.toContain("FOR INSERT");
    expect(migration).not.toContain("FOR UPDATE");
    expect(migration).not.toContain("FOR DELETE");
  });

  it("seeds the six pilot references as reviewed rows with no guessed dates or hashes", () => {
    for (const citation of [
      "Vigo County UZO §16",
      "Vigo County UZO §5",
      "675 IAC 13-2.6",
      "675 IAC 17-1.8",
      "INDOT — Outdoor Advertising Sign Permits",
      "INDOT — Above Ground Occupancy",
    ]) {
      expect(migration).toContain(citation);
    }
    expect(migration).toContain("'reviewed', '2026-11-08'");
    expect(migration).toContain("'1996-10-21'");
    expect(migration).toContain("'2014-12-01'");
    expect(migration).toContain("'2009-08-26'");
    // No effective date is guessed for any seed row.
    expect(migration).not.toMatch(/effective_date\s+date NOT NULL/);
  });

  it("holds no pricing, CostItem, estimate or payment columns", () => {
    // Column-level check: comments elsewhere in the file legitimately name
    // the things these tables must NOT store, so scope the assertion to
    // the CREATE TABLE column lists.
    const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.(codes_\w+) \(([\s\S]*?)\n\);/g)];
    expect(tables.map((match) => match[1]).sort()).toEqual([
      "codes_authority",
      "codes_jurisdiction",
      "codes_source",
      "codes_source_history",
    ]);
    for (const [, name, columns] of tables) {
      for (const forbidden of ["price", "cost_item", "estimate", "invoice", "payment", "amount", "org_id"]) {
        expect(`${name}: ${columns}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
      }
    }
    expect(schema).toContain("model CodesAuthority");
    expect(schema).toContain("model CodesJurisdiction");
    expect(schema).toContain("model CodesSource");
    expect(schema).toContain("model CodesSourceHistory");
    expect(schema).toContain('@@map("codes_authority")');
    expect(schema).toContain('@@map("codes_jurisdiction")');
    expect(schema).toContain('@@map("codes_source")');
    expect(schema).toContain('@@map("codes_source_history")');
  });
});
