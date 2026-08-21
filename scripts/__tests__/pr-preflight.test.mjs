import assert from "node:assert/strict";
import test from "node:test";

import { buildPreflight, buildVerificationPlan, parsePreflightArgs } from "../pr-preflight.mjs";

test("parsePreflightArgs supports base, run, and json flags", () => {
  assert.deepEqual(parsePreflightArgs(["--base", "origin/main", "--run", "--json"]), {
    base: "origin/main",
    run: true,
    json: true,
    help: false,
  });
});

test("frontend-only changes plan web verification without app work", () => {
  const plan = buildVerificationPlan(["web/src/app/(app)/dashboard/page.tsx"]);

  assert.equal(plan.appChanged, false);
  assert.equal(plan.webChanged, true);
  assert.equal(plan.integrationSensitive, false);
  assert.deepEqual(
    plan.commands.map((step) => step.label),
    ["Diff whitespace", "Web unit tests", "Web lint", "Web build"]
  );
});

test("ordinary app changes omit local integration by default", () => {
  const plan = buildVerificationPlan(["app/modules/invoices/service.ts"]);

  assert.equal(plan.appChanged, true);
  assert.equal(plan.integrationSensitive, false);
  assert.deepEqual(
    plan.commands.map((step) => step.label),
    ["Diff whitespace", "App unit tests", "App lint/typecheck", "App build"]
  );
});

test("schema, database-session, auth, and RLS-sensitive changes include integration", () => {
  for (const path of [
    "app/prisma/schema.prisma",
    "app/prisma/migrations/20260821000000_example/migration.sql",
    "app/db/requestSession.ts",
    "app/backend/middleware/databaseSession.ts",
    "app/modules/auth/service.ts",
    "app/tests/rls.integration.ts",
  ]) {
    const plan = buildVerificationPlan([path]);
    assert.equal(plan.integrationSensitive, true, path);
    assert.equal(plan.commands.at(-1)?.label, "App integration tests", path);
  }
});

test("buildPreflight exposes missing owner docs before expensive verification", () => {
  const preflight = buildPreflight({
    baseRef: "origin/main",
    changedFiles: ["web/src/app/(app)/dashboard/page.tsx"],
    ownership: {
      requiredDocs: ["docs/CURRENT_STATE.md"],
      missingDocs: ["docs/CURRENT_STATE.md"],
    },
  });

  assert.deepEqual(preflight.requiredDocs, ["docs/CURRENT_STATE.md"]);
  assert.deepEqual(preflight.missingDocs, ["docs/CURRENT_STATE.md"]);
  assert.equal(preflight.verification.webChanged, true);
});
