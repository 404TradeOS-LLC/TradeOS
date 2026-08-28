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

  it("never echoes the connection string, which carries credentials", () => {
    const secretUrl = `postgresql://postgres:SUPERSECRET@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`;
    const result = evaluateSeedGuard({ DATABASE_URL: secretUrl });
    expect(result.reasons.join(" ")).not.toContain("SUPERSECRET");
    expect(result.reasons.join(" ")).not.toContain(secretUrl);
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
