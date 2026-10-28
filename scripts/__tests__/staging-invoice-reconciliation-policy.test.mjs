import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reconciliation = readFileSync(".github/workflows/reconcile-staging-invoice-expand.yml", "utf8");
const deployment = readFileSync(".github/workflows/deploy-staging-migrations.yml", "utf8");

test("invoice history reconciliation is manual, stage-only, approved and one-migration scoped", () => {
  assert.match(reconciliation, /workflow_dispatch:/);
  assert.match(reconciliation, /environment: staging/);
  assert.match(reconciliation, /group: deploy-migrations-staging/);
  assert.match(reconciliation, /refs\/heads\/main/);
  assert.match(reconciliation, /db\.[^ ]+supabase\.co/);
  assert.match(reconciliation, /RECONCILE_INVOICE_EXPAND_ONLY/);
  assert.match(reconciliation, /verify-staging-invoice-expand\.mjs/);
  assert.match(reconciliation, /prisma migrate resolve --applied 20260902193000_rename_invoice_line_price_columns/);
  assert.doesNotMatch(reconciliation, /npx prisma migrate deploy/);
  assert.doesNotMatch(reconciliation, /supabase db push|DROP TABLE|drop column unit_cost|drop column line_cost/i);
});

test("ordinary staging migration deployment fails closed on invoice contract without approval", () => {
  assert.match(deployment, /environment: staging/);
  assert.match(deployment, /refs\/heads\/main/);
  assert.match(deployment, /STAGING_INVOICE_WRITERS_RETIRED_SHA/);
  assert.match(deployment, /APPROVE_INVOICE_CONTRACT/);
  assert.match(deployment, /APPROVED_RETIREMENT_SHA.*GITHUB_SHA/);
  assert.match(deployment, /Invoice contract migration remains pending/);
  assert.match(deployment, /deploy-migrations-staging/);
});
