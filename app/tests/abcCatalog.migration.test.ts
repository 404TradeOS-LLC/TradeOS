import fs from "node:fs";
import path from "node:path";

// Static assertions on the Phase 1 shared-catalog migration (issue #735).
// These guard the migration's shape in unit tests; the live RLS behavior
// is proven by the abc-catalog block in app/tests/rls.integration.ts,
// which runs against a real database. Neither test writes catalog rows.
describe("abc shared catalog migration (issue #735, Phase 1)", () => {
  const migration = fs
    .readFileSync(
      path.resolve(__dirname, "../prisma/migrations/20261127010000_add_abc_shared_catalog/migration.sql"),
      "utf8",
    )
    // The migration uses uppercase SQL keywords; assertions below match
    // the lowercased text so they guard structure, not keyword casing.
    .toLowerCase();

  const catalogTables = [
    "abc_catalog_items",
    "abc_catalog_hierarchy",
    "abc_catalog_sync_runs",
    "abc_catalog_sync_state",
  ];

  function tableBody(table: string): string {
    const match = migration.match(
      new RegExp(`create table public\\.${table} \\(([\\s\\S]*?)\\n\\);`, "i"),
    );
    expect(match).not.toBeNull();
    return match?.[1] ?? "";
  }

  it("creates the four org-less catalog tables with no price column", () => {
    for (const table of catalogTables) {
      expect(migration).toContain(`create table public.${table}`);
      const body = tableBody(table);
      expect(body).not.toMatch(/org_id/);
      expect(body).not.toMatch(/price/i);
    }
    // No price anywhere in a table definition: the catalog must never
    // store a price. ("NO PRICES" appears only in the header comment.)
    for (const table of catalogTables) {
      expect(tableBody(table)).not.toMatch(/price/i);
    }
  });

  it("keys items by item_number with a content hash and display flag", () => {
    const body = tableBody("abc_catalog_items");
    expect(body).toContain("item_number           text primary key");
    expect(body).toContain("content_hash");
    expect(body).toContain("check (content_hash ~ '^[0-9a-f]{64}$')");
    expect(body).toContain("is_displayable        boolean not null default true");
    expect(body).toContain("hierarchy_path        jsonb");
  });

  it("keys hierarchy by code path and sync state by a single-row id", () => {
    const hierarchy = tableBody("abc_catalog_hierarchy");
    expect(hierarchy).toContain("path_key      text primary key");
    expect(hierarchy).toContain("levels        jsonb not null");
    const state = tableBody("abc_catalog_sync_state");
    expect(state).toContain("id                    text primary key default 'abc-catalog' check (id = 'abc-catalog')");
    expect(state).toContain("last_successful_run_id uuid references public.abc_catalog_sync_runs (id) on delete set null");
    const runs = tableBody("abc_catalog_sync_runs");
    expect(runs).toContain("check (kind in ('full', 'delta'))");
    expect(runs).toContain("check (status in ('running', 'succeeded', 'failed', 'partial'))");
    expect(runs).toContain("checkpoint_page");
  });

  it("adds the trigram search and hierarchy-path indexes", () => {
    expect(migration).toContain("create extension if not exists pg_trgm");
    expect(migration).toContain("abc_catalog_items_search_trgm_idx");
    expect(migration).toContain("gin_trgm_ops");
    expect(migration).toContain("abc_catalog_items_hierarchy_path_idx");
    expect(migration).toContain("using gin (hierarchy_path)");
    expect(migration).toContain("abc_catalog_hierarchy_levels_idx");
  });

  it("forces RLS on every catalog table with global read and ingestion-only writes", () => {
    for (const table of catalogTables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
      expect(migration).toContain(`create policy ${table}_select_policy on public.${table}`);
      expect(migration).toContain(`create policy ${table}_ingest_insert_policy on public.${table}`);
      expect(migration).toContain(`create policy ${table}_ingest_update_policy on public.${table}`);
    }
    expect(migration).toContain("current_app_abc_catalog_ingestion()");
    expect(migration).toContain("public.current_app_org_id() is not null");
    // No DELETE policy on any catalog table: rows are soft-deactivated.
    // PostgreSQL clause order is CREATE POLICY <name> ON <table> FOR
    // <command>: inspect each catalog policy statement in that order and
    // reject FOR DELETE, FOR ALL, or an omitted command (which defaults
    // to ALL). Every catalog policy must be explicitly SELECT, INSERT, or
    // UPDATE. Four tables x (global SELECT + ingest SELECT/INSERT/UPDATE)
    // = 16 catalog policies.
    const catalogPolicyCommands = [
      ...migration.matchAll(/create policy\s+\S+\s+on\s+public\.abc_catalog_\w+\s+for\s+(\w+)/g),
    ].map((match) => match[1]);
    expect(catalogPolicyCommands).toHaveLength(16);
    for (const command of catalogPolicyCommands) {
      expect(["select", "insert", "update"]).toContain(command);
    }
    expect(migration).not.toMatch(/create policy\s+\S+\s+on\s+public\.abc_catalog_\w+\s+for\s+(delete|all)\b/);
  });

  it("seeds one global org-less ABC Supply supplier row, readable by any org", () => {
    expect(migration).toContain("suppliers_global_api_key_unique_idx");
    expect(migration).toContain("create policy suppliers_global_select_policy on public.suppliers");
    expect(migration).toContain("org_id is null and public.current_app_org_id() is not null");
    expect(migration).toContain("'73500001-0000-4000-8000-000000000001'");
    expect(migration).toContain("on conflict (api_integration_key) where org_id is null do nothing");
  });
});
