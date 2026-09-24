import { evaluateStagingAuth, STAGING_AUTH } from "../domain";

const staging = {
  TRADEOS_AUTH_BYPASS: "true",
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_AUTH.supabaseRef}.supabase.co`,
  SUPABASE_URL: `https://${STAGING_AUTH.supabaseRef}.supabase.co`,
  DATABASE_URL: `postgresql://tradeos_app.${STAGING_AUTH.supabaseRef}:placeholder@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
};

describe("staging authentication environment guard", () => {
  it("leaves normal authentication unchanged when disabled", () => {
    expect(evaluateStagingAuth({ ...staging, TRADEOS_AUTH_BYPASS: "false" }, "api")).toEqual({ enabled: false, blocked: false });
  });
  it("allows only an explicitly staged Preview with matching database and Supabase project", () => {
    expect(evaluateStagingAuth(staging, "api")).toEqual({ enabled: true, blocked: false });
    expect(evaluateStagingAuth(staging, "web")).toEqual({ enabled: true, blocked: false });
  });
  it.each([
    { ...staging, VERCEL_ENV: "production" },
    { ...staging, VERCEL_ENV: undefined },
    { ...staging, DATABASE_URL: "postgresql://tradeos_app.kssaceuetdjwfqnbzhly:placeholder@aws-0-us-east-1.pooler.supabase.com/postgres" },
    { ...staging, SUPABASE_URL: "https://kssaceuetdjwfqnbzhly.supabase.co" },
  ])("fails closed for production or an unproved staging data plane", (env) => {
    expect(evaluateStagingAuth(env, "api").blocked).toBe(true);
  });
});
