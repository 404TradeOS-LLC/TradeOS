import { stagingRuntimeIdentityResponse } from "@/lib/staging-runtime-identity";

export const dynamic = "force-dynamic";

export function GET() {
  // Direct NEXT_PUBLIC access retains Next's build-time substitution, matching
  // the value used by the deployed auth clients rather than a runtime-only claim.
  return stagingRuntimeIdentityResponse({
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    BACKEND_API_URL: process.env.BACKEND_API_URL,
  });
}
