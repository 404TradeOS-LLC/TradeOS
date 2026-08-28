import { evaluateSeedGuard, PRODUCTION_SUPABASE_REF } from "../db/seed/productionGuard";

const NON_PROD = "postgresql://app:pw@localhost:55432/tradeos";

describe("destructive seed production guard", () => {
  it("allows a clearly non-production target", () => {
    const result = evaluateSeedGuard({ DATABASE_URL: NON_PROD, NODE_ENV: "development" });
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it("refuses when DATABASE_URL is absent, because the target cannot be identified", () => {
    const result = evaluateSeedGuard({});
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/DATABASE_URL is not set/);
  });

  it("refuses an unparseable DATABASE_URL rather than guessing", () => {
    const result = evaluateSeedGuard({ DATABASE_URL: "not a url" });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/could not be parsed/);
  });

  it("refuses the production Supabase host", () => {
    const result = evaluateSeedGuard({
      DATABASE_URL: `postgresql://postgres:pw@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/known production database host/);
  });

  it("refuses the production project behind a pooler URL, where the ref hides in the username", () => {
    // aws-0-us-east-1.pooler.supabase.com contains no production fragment; the
    // project ref is only present as `postgres.<ref>` in the username.
    const result = evaluateSeedGuard({
      DATABASE_URL: `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/production Supabase project/);
  });

  it("allows a non-production project behind a pooler URL", () => {
    const result = evaluateSeedGuard({
      DATABASE_URL: "postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      NODE_ENV: "development",
    });
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it("refuses a Supabase-managed host whose project ref cannot be determined", () => {
    const result = evaluateSeedGuard({
      DATABASE_URL: "postgresql://someuser:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/could not be determined/);
  });

  it("still recognises the direct db.<ref>.supabase.co form", () => {
    const result = evaluateSeedGuard({
      DATABASE_URL: `postgresql://postgres:pw@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`,
    });
    expect(result.allowed).toBe(false);
  });

  it("never echoes the connection string, which carries credentials", () => {
    const secretUrl = `postgresql://postgres:SUPERSECRET@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`;
    const result = evaluateSeedGuard({ DATABASE_URL: secretUrl });
    expect(result.reasons.join(" ")).not.toContain("SUPERSECRET");
    expect(result.reasons.join(" ")).not.toContain(secretUrl);

    const poolerUrl = `postgresql://postgres.${PRODUCTION_SUPABASE_REF}:POOLERSECRET@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
    const poolerResult = evaluateSeedGuard({ DATABASE_URL: poolerUrl });
    expect(poolerResult.reasons.join(" ")).not.toContain("POOLERSECRET");
  });

  it.each(["NODE_ENV", "APP_ENVIRONMENT", "VERCEL_ENV"] as const)(
    "refuses when %s marks the run as production",
    (variable) => {
      const result = evaluateSeedGuard({ DATABASE_URL: NON_PROD, [variable]: "production" });
      expect(result.allowed).toBe(false);
      expect(result.reasons.join(" ")).toContain(variable);
    },
  );

  it("reports every reason at once instead of only the first", () => {
    const result = evaluateSeedGuard({
      DATABASE_URL: `postgresql://postgres:pw@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`,
      NODE_ENV: "production",
      VERCEL_ENV: "production",
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });
});
