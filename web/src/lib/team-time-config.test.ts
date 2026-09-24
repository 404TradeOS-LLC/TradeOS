import test from "node:test";
import assert from "node:assert/strict";
import { isTeamTimeEnabled } from "./team-time-config.ts";

test("Team & Time requires an explicit feature flag", () => {
  assert.equal(isTeamTimeEnabled({}), false);
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "false" }), false);
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "true" }), false);
});

test("Team & Time remains disabled in Vercel Production", () => {
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "true", VERCEL_ENV: "production", TEAM_TIME_SUPABASE_PROJECT_REF: "qfbgdkbamfaasmtjfyru", NEXT_PUBLIC_SUPABASE_URL: "https://qfbgdkbamfaasmtjfyru.supabase.co" }), false);
});

test("Team & Time only enables for the explicitly configured staging Supabase project", () => {
  const staging = {
    TEAM_TIME_ENABLED: "true",
    TEAM_TIME_SUPABASE_PROJECT_REF: "qfbgdkbamfaasmtjfyru",
    NEXT_PUBLIC_SUPABASE_URL: "https://qfbgdkbamfaasmtjfyru.supabase.co",
  };
  assert.equal(isTeamTimeEnabled(staging), true);
  assert.equal(isTeamTimeEnabled({ ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://production-project.supabase.co" }), false);
  assert.equal(isTeamTimeEnabled({ ...staging, NEXT_PUBLIC_SUPABASE_URL: "not a url" }), false);
  assert.equal(isTeamTimeEnabled({ ...staging, TEAM_TIME_SUPABASE_PROJECT_REF: "production-project" }), false);
});
