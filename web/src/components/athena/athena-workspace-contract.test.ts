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
  assert.match(opsPage, /Promise\.allSettled/);
  assert.match(opsPage, /alertsLoadState/);
  assert.match(opsPage, /AthenaSectionTabs active="overview"/);
  assert.match(tabs, /href: "\/athena\/ops", label: "Overview"/);
  assert.match(tabs, /href: "\/athena\/approvals"/);
  assert.match(tabs, /href: "\/athena\/traces"/);
});

test("Athena kernel client preserves typed terminal envelopes through the authenticated proxy", async () => {
  const client = await readSource("../../lib/athena-client.ts");

  assert.match(client, /fetch\("\/api\/proxy\/athena\/chat"/);
  assert.match(client, /if \(isAthenaKernelResult\(body\)\) return body/);
  assert.match(client, /selectedScope: input\.selectedScope/);
  assert.match(client, /conversationId: input\.conversationId/);
  assert.match(client, /idempotencyKey: input\.idempotencyKey/);
  assert.match(client, /channel: input\.channel \?\? "text"/);
  assert.match(client, /platform: "web"/);
  assert.doesNotMatch(client, /clientFetch<AthenaKernelResult>/);
  assert.doesNotMatch(client, /\/api\/v1\/(jobs|projects|estimates|invoices|customers)\//);
});

test("Athena workspace renders truthful kernel states without inventing context or approval execution", async () => {
  const workspace = await readSource("./athena-workspace.tsx");

  assert.match(workspace, /"needs_clarification"/);
  assert.match(workspace, /followUp\.kind === "question"\)\.slice\(0, 1\)/);
  assert.match(workspace, /"awaiting_approval"/);
  assert.match(workspace, /"degraded"/);
  assert.match(workspace, /"denied"/);
  assert.match(workspace, /What Athena could not fully verify/);
  assert.match(workspace, /The contractor confirmation card is not connected in this workspace yet/);
  assert.match(workspace, /does not yet return a provider-by-provider “context used” list/);
  assert.match(workspace, /This workspace does not invent one/);
  assert.doesNotMatch(workspace, /conversationId:/);
  assert.match(workspace, /Business changes remain behind registered Athena tools and existing service permissions/);
  assert.doesNotMatch(workspace, /result\.error\?\.retryable/);
  assert.match(workspace, /server outcome is genuinely ambiguous/);
  assert.match(workspace, /setRetrySubmission\(\{ message: trimmed, idempotencyKey \}\)/);
  assert.match(workspace, /idempotencyKey: retrySubmission\.idempotencyKey/);
  assert.match(workspace, /addUserTurn: false/);
  assert.match(workspace, /Retry safely/);
  assert.doesNotMatch(workspace, /<main className=/);
  assert.match(workspace, /<section aria-labelledby="athena-workspace-heading"/);
  assert.doesNotMatch(workspace, /clientFetch\(|fetch\("\/api\/v1\/(jobs|projects|estimates|invoices|customers)/);
});

test("Athena navigation is feature-gated and retries one transient capability failure", async () => {
  const nav = await readSource("../shared/app-nav.tsx");
  const layout = await readSource("../../app/(app)/layout.tsx");

  assert.match(nav, /href: "\/athena"/);
  assert.match(nav, /athenaEnabled = false/);
  assert.match(nav, /athenaCapabilityRetryKey = null/);
  assert.match(nav, /clientFetch<\{ kernelEnabled\?: unknown \}>\("\/api\/v1\/athena\/capabilities"/);
  assert.match(nav, /const effectiveAthenaEnabled = athenaCapabilityRetryKey/);
  assert.match(nav, /clientAthenaCapability\?\.key === athenaCapabilityRetryKey/);
  assert.match(nav, /ATHENA_CAPABILITY_RETRY_TIMEOUT_MS/);
  assert.match(nav, /setClientAthenaCapability\(\{ key: retryKey, enabled:/);
  assert.match(layout, /getAthenaCapabilities/);
  assert.match(layout, /return \{ enabled: capabilities\.kernelEnabled === true, retryOnClient: false \}/);
  assert.match(layout, /return \{ enabled: false, retryOnClient: true \}/);
  assert.match(layout, /athenaCapability\.retryOnClient \? randomUUID\(\) : null/);
  assert.doesNotMatch(layout, /getOrganizationSettings|isAthenaOperatorRole|canViewAthena/);
});

test("Athena root scope normalizes repeated query params and never blocks on operator discovery", async () => {
  const rootPage = await readSource("../../app/(app)/athena/page.tsx");

  assert.match(rootPage, /type SearchParamValue = string \| string\[\] \| undefined/);
  assert.match(rootPage, /function firstQueryValue\(value: SearchParamValue\)/);
  assert.match(rootPage, /Array\.isArray\(value\) \? value\[0\] : value/);
  assert.match(rootPage, /UUID_PATTERN/);
  assert.match(rootPage, /customerId: validUuid\(query\.customerId\)/);
  assert.match(rootPage, /projectId: validUuid\(query\.projectId\)/);
  assert.match(rootPage, /jobId: validUuid\(query\.jobId\)/);
  assert.match(rootPage, /estimateId: validUuid\(query\.estimateId\)/);
  assert.match(rootPage, /invoiceId: validUuid\(query\.invoiceId\)/);
  assert.match(rootPage, /firstQueryValue\(query\.page\)\?\.trim\(\)\.slice\(0, 200\)/);
  assert.doesNotMatch(rootPage, /getAthenaOperatorContext/);
  assert.match(rootPage, /<AthenaWorkspace selectedScope=\{buildSelectedScope\(query\)\} \/>/);
});
