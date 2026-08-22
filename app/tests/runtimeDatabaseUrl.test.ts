import { resolveRuntimeDatabaseUrl } from "../db/runtimeDatabaseUrl";

describe("resolveRuntimeDatabaseUrl", () => {
  const sessionUrl =
    "postgresql://tradeos_app:p%40ss@aws-0-us-west-2.pooler.supabase.com:5432/postgres?schema=public&sslmode=require&sslaccept=strict";

  it("moves a Vercel Supabase session-pool URL to bounded transaction mode", () => {
    const resolved = resolveRuntimeDatabaseUrl(sessionUrl, true);
    const parsed = new URL(resolved!);

    expect(parsed.hostname).toBe("aws-0-us-west-2.pooler.supabase.com");
    expect(parsed.port).toBe("6543");
    expect(parsed.username).toBe("tradeos_app");
    expect(parsed.password).toBe("p%40ss");
    expect(parsed.searchParams.get("schema")).toBe("public");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.get("pgbouncer")).toBe("true");
    expect(parsed.searchParams.get("connection_limit")).toBe("1");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.has("sslaccept")).toBe(false);
  });

  it("bounds an already-transaction-mode Supabase URL", () => {
    const resolved = resolveRuntimeDatabaseUrl(
      "postgresql://user:pass@aws-0-us-west-2.pooler.supabase.com:6543/postgres?connection_limit=8&sslaccept=strict",
      true,
    );
    const parsed = new URL(resolved!);

    expect(parsed.port).toBe("6543");
    expect(parsed.searchParams.get("pgbouncer")).toBe("true");
    expect(parsed.searchParams.get("connection_limit")).toBe("1");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.has("sslaccept")).toBe(false);
  });

  it("does not alter non-Vercel database URLs", () => {
    expect(resolveRuntimeDatabaseUrl(sessionUrl, false)).toBe(sessionUrl);
  });

  it("does not alter direct or non-Supabase database URLs", () => {
    const direct = "postgresql://user:pass@db.example.com:5432/app?schema=public";
    const supabaseDirect = "postgresql://user:pass@db.project.supabase.co:5432/postgres";

    expect(resolveRuntimeDatabaseUrl(direct, true)).toBe(direct);
    expect(resolveRuntimeDatabaseUrl(supabaseDirect, true)).toBe(supabaseDirect);
  });

  it("does not alter malformed or absent configuration", () => {
    expect(resolveRuntimeDatabaseUrl("not a database URL", true)).toBe("not a database URL");
    expect(resolveRuntimeDatabaseUrl(undefined, true)).toBeUndefined();
  });
});
