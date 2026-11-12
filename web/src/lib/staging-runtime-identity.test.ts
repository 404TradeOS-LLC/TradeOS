import assert from "node:assert/strict";
import test from "node:test";
import { stagingRuntimeIdentity, stagingRuntimeIdentityResponse } from "./staging-runtime-identity.ts";

const env = () => ({
  VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "staging",
  VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: "https://qfbgdkbamfaasmtjfyru.supabase.co",
  BACKEND_API_URL: "https://tradeos-costbook-git-staging-billykshowalters.vercel.app",
});

test("reports only allowlisted public bindings for a pinned staging runtime", () => {
  const result = stagingRuntimeIdentity(env());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    status: "configured", commitSha: "a".repeat(40), branch: "staging",
    supabaseProjectRef: "qfbgdkbamfaasmtjfyru",
    backendOrigin: env().BACKEND_API_URL,
    scope: "public_configuration_only",
  });
});

test("production, local and unrelated preview deployments expose no identity", () => {
  for (const override of [
    { VERCEL_ENV: "production" }, { VERCEL_ENV: "development" },
    { VERCEL_GIT_COMMIT_REF: "main" }, { VERCEL_GIT_COMMIT_REF: "feature/example" },
    { VERCEL_TARGET_ENV: "production" },
  ]) {
    assert.deepEqual(stagingRuntimeIdentity({ ...env(), ...override }), {
      status: 404, body: { error: "Not found" },
    });
  }
});

test("missing, malformed and foreign destinations fail closed without echoing values", () => {
  for (const override of [
    { VERCEL_GIT_COMMIT_SHA: "main" }, { VERCEL_GIT_COMMIT_SHA: "" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://kssaceuetdjwfqnbzhly.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: env().NEXT_PUBLIC_SUPABASE_URL + "/other" },
    { BACKEND_API_URL: "https://secret:password@api.example.com" },
    { BACKEND_API_URL: env().BACKEND_API_URL + "/api/v1" },
    { BACKEND_API_URL: env().BACKEND_API_URL + "?token=sensitive" },
    { BACKEND_API_URL: "" },
  ]) {
    assert.deepEqual(stagingRuntimeIdentity({ ...env(), ...override }), {
      status: 503, body: { error: "Staging public bindings are not verified" },
    });
  }
});

test("credential and unrelated environment values are never serialized", () => {
  const result = stagingRuntimeIdentity({
    ...env(), SUPABASE_SERVICE_ROLE_KEY: "SECRET_SENTINEL", AUTH_JWT_SECRET: "SECRET_SENTINEL",
    DATABASE_URL: "SECRET_SENTINEL", VERCEL_TOKEN: "SECRET_SENTINEL",
  });
  assert.doesNotMatch(JSON.stringify(result), /SECRET_SENTINEL|SERVICE_ROLE|DATABASE_URL|JWT_SECRET|VERCEL_TOKEN/);
});

test("all success and failure responses prevent caching and MIME sniffing", async () => {
  for (const values of [env(), { ...env(), VERCEL_ENV: "production" }, { ...env(), BACKEND_API_URL: "" }]) {
    const response = stagingRuntimeIdentityResponse(values);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(await response.json(), stagingRuntimeIdentity(values).body);
  }
});
