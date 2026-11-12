import { pathToFileURL } from "node:url";

export function assertTestOrgFixture(env) {
  if (!env.BETA_USE_TEST_ORG || env.BETA_USE_TEST_ORG === "false") return;
  if (env.BETA_USE_TEST_ORG !== "true" || env.BETA_EXPECTED_ENVIRONMENT !== "staging" ||
      env.BETA_SMOKE_ORG_ID !== "d86d0874-6ba3-4b06-94b6-bd0ae99fe532" ||
      env.BETA_SMOKE_ORG_LABEL !== "TEST Org — Delete Me") {
    throw new Error("TEST Org fixture requires staging and its reviewed exact organization ID and label.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { assertTestOrgFixture(process.env); }
  catch (error) { console.error(`::error::${error.message}`); process.exit(1); }
}
