import test from "node:test";
import assert from "node:assert/strict";
import { isTeamTimeEnabled } from "./team-time-config.ts";

test("Team & Time requires an explicit feature flag", () => {
  assert.equal(isTeamTimeEnabled({}), false);
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "false" }), false);
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "true" }), true);
});

test("Team & Time remains disabled in Vercel Production", () => {
  assert.equal(isTeamTimeEnabled({ TEAM_TIME_ENABLED: "true", VERCEL_ENV: "production" }), false);
});
