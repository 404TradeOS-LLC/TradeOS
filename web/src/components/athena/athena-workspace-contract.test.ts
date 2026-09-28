import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("root Athena route is the contractor workspace and operator observability lives under /athena/ops", async () => {
  const rootPage = await readSource("../../app/(app)/athena/page.tsx");
  const opsPage = await readSource("../../app/(app)/athena/ops/page.tsx");
  const tabs = await readSource("./athena-section-tabs.tsx");

  assert.match(rootPage, /AthenaWorkspace/);
  assert.doesNotMatch(rootPage, /getAthenaObservabilityOverview|SummaryMetricCard|AthenaWindowSwitcher/);
  assert.match(opsPage, /getAthenaOperatorContext/);
  assert.match(opsPage, /getAthenaObservabilityOverview/);
  assert.match(opsPage, /AthenaSectionTabs active="overview"/);
  assert.match(tabs, /href: "\/athena\/ops", label: "Overview"/);
  assert.match(tabs, /href: "\/athena\/approvals"/);
  assert.match(tabs, /href: "\/athena\/traces"/);
});

test("Athena kernel client carries selected scope through the one authenticated chat endpoint", async () => {
  const client = await readSource("../../lib/athena-client.ts");

  assert.match(client, /clientFetch<AthenaKernelResult>\("\/api\/v1\/athena\/chat"/);
  assert.match(client, /selectedScope: input\.selectedScope/);
  assert.match(client, /conversationId: input\.conversationId/);
  assert.match(client, /idempotencyKey: input\.idempotencyKey/);
  assert.match(client, /channel: input\.channel \?\? "text"/);
  assert.match(client, /platform: "web"/);
  assert.doesNotMatch(client, /\/api\/v1\/(jobs|projects|estimates|invoices|customers)\//);
});

test("Athena workspace renders truthful kernel states without inventing context or approval execution", async () => {
  const workspace = await readSource("./athena-workspace.tsx");

  assert.match(workspace, /"needs_clarification"/);
  assert.match(workspace, /"awaiting_approval"/);
  assert.match(workspace, /"degraded"/);
  assert.match(workspace, /"denied"/);
  assert.match(workspace, /What Athena could not fully verify/);
  assert.match(workspace, /The contractor confirmation card is not connected in this workspace yet/);
  assert.match(workspace, /does not yet return a provider-by-provider “context used” list/);
  assert.match(workspace, /This workspace does not invent one/);
  assert.match(workspace, /Business changes remain behind registered Athena tools and existing service permissions/);
  assert.doesNotMatch(workspace, /clientFetch\(|fetch\("\/api\/v1\/(jobs|projects|estimates|invoices|customers)/);
});

test("Athena navigation is available to authenticated users without an operator-only shell lookup", async () => {
  const nav = await readSource("../shared/app-nav.tsx");
  const layout = await readSource("../../app/(app)/layout.tsx");

  assert.match(nav, /href: "\/athena"/);
  assert.match(nav, /const primaryLinks = \[\.\.\.PRIMARY_NAV_LINKS, ATHENA_NAV_LINK\]/);
  assert.doesNotMatch(nav, /canViewAthena/);
  assert.doesNotMatch(layout, /resolveCanViewAthena|getOrganizationSettings|isAthenaOperatorRole|canViewAthena/);
  assert.match(layout, /<AppNav email=\{session\.email\} \/>/);
});

test("Athena root scope only accepts valid UUID identifiers and bounded page context", async () => {
  const rootPage = await readSource("../../app/(app)/athena/page.tsx");

  assert.match(rootPage, /UUID_PATTERN/);
  assert.match(rootPage, /customerId: validUuid\(query\.customerId\)/);
  assert.match(rootPage, /projectId: validUuid\(query\.projectId\)/);
  assert.match(rootPage, /jobId: validUuid\(query\.jobId\)/);
  assert.match(rootPage, /estimateId: validUuid\(query\.estimateId\)/);
  assert.match(rootPage, /invoiceId: validUuid\(query\.invoiceId\)/);
  assert.match(rootPage, /query\.page\?\.trim\(\)\.slice\(0, 200\)/);
});
