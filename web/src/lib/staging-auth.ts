import { evaluateStagingAuth } from "@/domain";

export function stagingAuthDecision() {
  const decision = evaluateStagingAuth({
    TRADEOS_AUTH_BYPASS: process.env.TRADEOS_AUTH_BYPASS,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    APP_ENVIRONMENT: process.env.APP_ENVIRONMENT,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }, "web");
  if (decision.blocked) console.error("tradeos.auth_bypass.blocked", decision.reason);
  return decision;
}
