const STAGING_PROJECT_REF = "qfbgdkbamfaasmtjfyru";
const STAGING_SUPABASE_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;
const STAGING_API_ORIGIN = "https://tradeos-costbook-git-staging-billykshowalters.vercel.app";

/** Public configuration evidence only; never reads, decodes or returns credentials. */
export function stagingRuntimeIdentity(env: Record<string, string | undefined>) {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== "staging" ||
      env.VERCEL_TARGET_ENV === "production") {
    return { status: 404, body: { error: "Not found" } };
  }
  const commitSha = env.VERCEL_GIT_COMMIT_SHA;
  if (!commitSha || !/^[a-f0-9]{40}$/.test(commitSha) ||
      env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_SUPABASE_URL ||
      env.BACKEND_API_URL !== STAGING_API_ORIGIN) {
    // A bad value can itself contain credentials; do not echo it or include it in logs.
    return { status: 503, body: { error: "Staging public bindings are not verified" } };
  }
  return {
    status: 200,
    body: {
      status: "configured", commitSha, branch: "staging",
      supabaseProjectRef: STAGING_PROJECT_REF, backendOrigin: STAGING_API_ORIGIN,
      scope: "public_configuration_only",
    },
  };
}

export function stagingRuntimeIdentityResponse(env: Record<string, string | undefined>): Response {
  const { status, body } = stagingRuntimeIdentity(env);
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
