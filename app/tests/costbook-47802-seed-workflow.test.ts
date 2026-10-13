import fs from "node:fs";
import path from "node:path";
const { resolveRestrictedDatabaseUrl } = require("../scripts/derive-restricted-database-url.cjs");
const workflow = fs.readFileSync(path.resolve(__dirname,
  "../../.github/workflows/seed-costbook-supplier-prices-47802.yml"), "utf8");
const abcWorkflow = fs.readFileSync(path.resolve(__dirname,
  "../../.github/workflows/backfill-abc-materials.yml"), "utf8");

function resolved(admin: string, role = "tradeos_app"): URL {
  return new URL(resolveRestrictedDatabaseUrl({
    DATABASE_ADMIN_URL: admin, APP_DB_ROLE_NAME: role, APP_DB_ROLE_PASSWORD: "test-restricted-password",
  }));
}

describe("shared restricted-role database URL resolver", () => {
  it("preserves host, schema, and database for direct PostgreSQL", () => {
    const url = resolved("postgresql://postgres:admin@db.example.invalid:5432/tradeos?schema=public");
    expect(url.username).toBe("tradeos_app");
    expect(url.password).toBe("test-restricted-password");
    expect(url.hostname).toBe("db.example.invalid");
    expect(url.pathname).toBe("/tradeos");
    expect(url.searchParams.get("schema")).toBe("public");
  });
  it("preserves the Supavisor session pooler project suffix", () => {
    const url = resolved("postgresql://postgres.exampleprojectref:admin@aws-1-us-west-2.pooler.supabase.com:5432/tradeos");
    expect(url.username).toBe("tradeos_app.exampleprojectref");
    expect(url.hostname).toBe("aws-1-us-west-2.pooler.supabase.com");
    expect(url.port).toBe("5432");
  });
  it("accepts an explicitly restricted application connection", () => {
    const url = resolveRestrictedDatabaseUrl({
      DATABASE_URL: "postgresql://tradeos_app:pw@db.example.invalid:5432/tradeos",
    });
    expect(new URL(url).username).toBe("tradeos_app");
  });
  it("rejects direct admin identities or malformed pooling users", () => {
    expect(() => resolveRestrictedDatabaseUrl({
      DATABASE_URL: "postgresql://postgres:pw@db.example.invalid/tradeos",
    })).toThrow();
    expect(() => resolveRestrictedDatabaseUrl({
      DATABASE_URL: "postgresql://tradeos_app:pw@aws-1.pooler.supabase.com/tradeos",
    })).toThrow();
    expect(() => resolved("postgresql://postgres:pw@aws-1.pooler.supabase.com/tradeos")).toThrow();
    expect(() => resolved("postgresql://postgres:pw@db.example.invalid/tradeos", "postgres")).toThrow();
    expect(() => resolved("postgresql://admin:pw@db.example.invalid/tradeos", "admin")).toThrow();
    expect(() => resolved("https://postgres:pw@db.example.invalid/tradeos")).toThrow();
    expect(() => resolved("postgresql://postgres:pw@db.example.invalid/tradeos", "invalid role")).toThrow();
  });
  it("rejects project-suffix mismatches and missing credentials", () => {
    expect(() => resolveRestrictedDatabaseUrl({
      DATABASE_URL: "postgresql://tradeos_app.otherproject:pw@aws-1.pooler.supabase.com/db",
      DATABASE_ADMIN_URL: "postgresql://postgres.correctproject:pw@aws-1.pooler.supabase.com/db",
    })).toThrow();
    expect(() => resolveRestrictedDatabaseUrl({})).toThrow();
  });
  it("uses the exact shared resolver in both protected workflows", () => {
    for (const content of [workflow, abcWorkflow]) {
      expect(content).toContain("node scripts/derive-restricted-database-url.cjs");
      expect(content).toContain("environment: production");
      expect(content).toContain("persist-credentials: false");
      expect(content).not.toContain("node -e 'const u");
    }
    expect(workflow).toContain("IMPORT_47802_SUPPLIER_EVIDENCE");
    expect(abcWorkflow).toContain("LINK_EXISTING_ABC_MATERIALS");
    expect(abcWorkflow).toContain("default: true");
    expect(abcWorkflow).toContain("tests/backfill-abc-materials.test.ts");
  });
});
