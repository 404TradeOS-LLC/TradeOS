import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const workflow = fs.readFileSync(
  path.resolve(__dirname, "../../.github/workflows/seed-costbook-supplier-prices-47802.yml"),
  "utf8"
);
const restrictedRoleCommand = workflow.match(/DATABASE_URL="\$\(node -e '([^']+)'\)"/)?.[1];

function derivedUrl(admin: string, role: string): URL {
  if (!restrictedRoleCommand) throw new Error("Missing guarded restricted-role fallback in seed workflow");
  return new URL(execFileSync(process.execPath, ["-e", restrictedRoleCommand], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_ADMIN_URL: admin,
      APP_DB_ROLE_NAME: role,
      APP_DB_ROLE_PASSWORD: "test-restricted-password",
    },
  }));
}

describe("production supplier seed restricted database credentials", () => {
  it("derives a role-specific URL without changing host/database/schema", () => {
    const url = derivedUrl(
      "postgresql://postgres:admin-test@db.example.invalid:5432/tradeos?schema=public",
      "tradeos_app"
    );
    expect(url.username).toBe("tradeos_app");
    expect(url.password).toBe("test-restricted-password");
    expect(url.hostname).toBe("db.example.invalid");
    expect(url.pathname).toBe("/tradeos");
    expect(url.searchParams.get("schema")).toBe("public");
  });

  it("preserves the Supavisor project suffix for restricted session-pooler connections", () => {
    const url = derivedUrl(
      "postgresql://postgres.exampleprojectref:admin@aws-1-us-west-2.pooler.supabase.com:5432/tradeos?schema=public",
      "tradeos_app"
    );
    expect(url.username).toBe("tradeos_app.exampleprojectref");
    expect(url.hostname).toBe("aws-1-us-west-2.pooler.supabase.com");
    expect(url.port).toBe("5432");
    expect(url.password).toBe("test-restricted-password");
  });

  it("fails closed rather than guessing a project suffix for a malformed pooler username", () => {
    expect(() => derivedUrl(
      "postgresql://postgres:admin@aws-1-us-west-2.pooler.supabase.com:5432/tradeos",
      "tradeos_app"
    )).toThrow();
  });

  it("rejects use of the administrative identity as the application role", () => {
    expect(() => derivedUrl("postgresql://postgres:admin@db.example.invalid/db", "postgres")).toThrow();
    expect(() => derivedUrl("postgresql://admin:admin@db.example.invalid/db", "admin")).toThrow();
  });

  it("defaults to tradeos_app when the optional role override is blank", () => {
    const url = derivedUrl("postgresql://postgres:admin@db.example.invalid/db", "");
    expect(url.username).toBe("tradeos_app");
  });

  it("rejects invalid role names and non-Postgres URL protocols", () => {
    expect(() => derivedUrl("postgresql://postgres:admin@db.example.invalid/db", "bad role")).toThrow();
    expect(() => derivedUrl("https://postgres:admin@db.example.invalid/db", "tradeos_app")).toThrow();
  });

  it("retains the absent-secret and admin-URL fail-closed guards", () => {
    expect(workflow).toContain('-z "${APP_DB_ROLE_PASSWORD:-}"');
    expect(workflow).toContain('"$DATABASE_URL" == "$DATABASE_ADMIN_URL"');
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("IMPORT_47802_SUPPLIER_EVIDENCE");
  });
});
