import assert from "node:assert/strict";
import test from "node:test";
import { assertTestOrgFixture } from "./test-org-fixture.mjs";

const fixture = () => ({
  BETA_USE_TEST_ORG: "true", BETA_EXPECTED_ENVIRONMENT: "staging",
  BETA_SMOKE_ORG_ID: "d86d0874-6ba3-4b06-94b6-bd0ae99fe532",
  BETA_SMOKE_ORG_LABEL: "TEST Org — Delete Me",
});
test("explicit TEST fixture accepts only its verified staging organization", () => {
  assert.doesNotThrow(() => assertTestOrgFixture(fixture()));
  for (const field of Object.keys(fixture())) {
    assert.throws(() => assertTestOrgFixture({ ...fixture(), [field]: "foreign-secret-sentinel" }), /reviewed exact/);
  }
});
test("default legacy fixture remains unchanged and input values never enter errors", () => {
  assert.doesNotThrow(() => assertTestOrgFixture({}));
  assert.doesNotThrow(() => assertTestOrgFixture({ BETA_USE_TEST_ORG: "false" }));
  try { assertTestOrgFixture({ ...fixture(), BETA_SMOKE_ORG_ID: "SECRET_SENTINEL" }); }
  catch (error) { assert.doesNotMatch(error.message, /SECRET_SENTINEL/); }
});
