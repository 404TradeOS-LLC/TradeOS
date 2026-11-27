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
  // DES-4: the contractor confirmation card IS connected now. Awaiting
  // approval routes to the real approvals queue, and a job-scoped succeeded
  // result can be saved as a job note only after the contractor confirms it
  // in the card. The old dead-end copy must not come back.
  assert.doesNotMatch(workspace, /The contractor confirmation card is not connected in this workspace yet/);
  assert.match(workspace, /AthenaConfirmationCard/);
  assert.match(workspace, /Save as job note/);
  assert.match(workspace, /jobWriteTarget/);
  assert.match(workspace, /onSaveJobNote/);
  assert.match(workspace, /Nothing is written until you confirm it/);
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
  // The 1500ms retry aborted on the same slow production API that aborted
  // the server lookup (2026-11-25), so the retry never got its chance to
  // recover Athena. The retry budget must match the layout's advisory
  // budgets (5000ms).
  const retryBudget = nav.match(/ATHENA_CAPABILITY_RETRY_TIMEOUT_MS = (\d+)/);
  assert.ok(retryBudget, "app-nav must define the capability retry timeout");
  assert.ok(Number(retryBudget[1]) >= 5000, `capability retry timeout must be >= 5000ms, got ${retryBudget[1]}`);
  assert.match(nav, /setClientAthenaCapability\(\{ key: retryKey, enabled:/);
  // The layout resolves capabilities through the request-cached getter
  // (Fluid plan 2.2) so the shell and Today share one backend call.
  assert.match(layout, /getCachedAthenaCapabilities/);
  assert.match(layout, /return \{ enabled: capabilities\.kernelEnabled === true, retryOnClient: false \}/);
  assert.match(layout, /return \{ enabled: false, retryOnClient: true \}/);
  assert.match(layout, /athenaCapability\.retryOnClient \? randomUUID\(\) : null/);
  const athenaResolver = layout.match(/async function resolveAthenaEnabled[\s\S]*?(?=\nasync function|\nexport default)/)?.[0];
  assert.ok(athenaResolver);
  assert.doesNotMatch(athenaResolver, /getOrganizationSettings|currentRole/);
  assert.doesNotMatch(layout, /isAthenaOperatorRole|canViewAthena/);
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
  assert.match(rootPage, /selectedScope=\{buildSelectedScope\(query\)\}/);
  assert.match(rootPage, /getAthenaEstimateHandoffAuth\(\)/);
  assert.match(rootPage, /estimateHandoffIdentity=\{handoff\.identity\}/);
  assert.match(rootPage, /canCreateEstimate=\{handoff\.canCreateEstimate\}/);
});


test("authenticated app header exposes one-tap, feature-gated Athena access at phone widths", async () => {
  const nav = await readSource("../shared/app-nav.tsx");
  assert.match(nav, /\{effectiveAthenaEnabled \? \(\s*<Link/);
  assert.match(nav, /href=\{buildUniversalCreateHref\("athena", pathname\)\}/);
  assert.match(nav, /aria-label="Ask Athena"/);
  assert.match(nav, /min-h-11 min-w-11/);
  assert.match(nav, /aria-current=\{pathname === "\/athena" \? "page" : undefined\}/);
});

test("job-scoped Athena route gates by DES-4 roles and wires Confirm Write to the Job note service", async () => {
  const routePage = await readSource("../../app/(app)/projects/[id]/jobs/[jobId]/athena/page.tsx");
  const wrapper = await readSource("../../app/(app)/projects/[id]/jobs/[jobId]/athena/job-athena-workspace.tsx");
  const access = await readSource("../../lib/athena-job-access.ts");
  const jobPage = await readSource("../../app/(app)/projects/[id]/jobs/[jobId]/page.tsx");
  const fieldPage = await readSource("../../app/(app)/field/page.tsx");

  // The route decides access with the DES-4 role table, never with the
  // operator-only gate that owns /athena.
  assert.match(routePage, /canUseJobAthena/);
  assert.match(routePage, /getFieldJob/);
  assert.match(routePage, /job\.assignedTechnicians/);
  assert.match(routePage, /technician_not_assigned/);
  assert.match(routePage, /\/field\?job=/);
  assert.match(routePage, /canReviewAthenaApprovals/);
  assert.match(routePage, /JobAthenaWorkspace/);
  assert.doesNotMatch(routePage, /getAthenaOperatorContext|getAthenaObservabilityOverview/);

  // The write goes through the existing Job note service via the
  // authenticated proxy; the workspace itself never fetches.
  assert.match(wrapper, /clientFetch\(`\/api\/v1\/jobs\/\$\{jobId\}\/notes`/);
  assert.match(wrapper, /method: "POST"/);
  assert.match(wrapper, /router\.refresh\(\)/);
  assert.match(wrapper, /jobWriteTarget/);
  assert.match(wrapper, /onSaveJobNote/);
  assert.doesNotMatch(wrapper, /\/api\/v1\/athena/);

  // DES-4 roles: owner/admin/dispatcher for any job, technician only when
  // assigned; the approvals-queue link is owner/admin only.
  assert.match(access, /"owner", "admin", "dispatcher"/);
  assert.match(access, /role === "technician"/);
  assert.match(access, /assignedTechnicianUserIds\.includes\(currentUserId\)/);
  assert.match(access, /technician_not_assigned/);
  assert.match(access, /canReviewAthenaApprovals/);

  // Both entry points link to the route.
  assert.match(jobPage, /\/projects\/\$\{projectId\}\/jobs\/\$\{jobId\}\/athena/);
  assert.match(fieldPage, /\/projects\/\$\{selectedJob\.project\.id\}\/jobs\/\$\{selectedJob\.id\}\/athena/);

  // Capability gate (Codex review on this PR): the entry points and the
  // route follow the app-shell navigation's getAthenaCapabilities gate — no
  // link advertises a workspace the kernel cannot serve, and direct route
  // access renders an unavailable state when the kernel is disabled.
  assert.match(routePage, /getAthenaCapabilities/);
  assert.match(routePage, /kernelEnabled === false/);
  assert.match(routePage, /Athena isn't enabled for this workspace yet/);
  assert.match(routePage, /EmptyState/);
  assert.match(jobPage, /getAthenaCapabilities/);
  assert.match(jobPage, /athenaEnabled/);
  assert.match(fieldPage, /getAthenaCapabilities/);
  assert.match(fieldPage, /athenaEnabled/);

  // CodeRabbit Minor 1 (this PR): the accepted-baseline Estimate detail only
  // renders when the scope carries the estimate id, so the route passes the
  // baseline's estimate id through to the workspace scope.
  assert.match(routePage, /estimateId=\{approved\?\.estimateId \?\? undefined\}/);
  assert.match(wrapper, /selectedScope=\{\{ jobId, projectId, customerId, estimateId \}\}/);

  // Canonical context rail (Figma 289:2): the project's latest change order
  // rides in the selected-context rows with the job, customer, and estimate.
  // The route lists the project's change orders (fail-soft) and describes
  // the latest; the workspace renders the row only when a detail is
  // supplied, in rail order after Customer and before Estimate.
  assert.match(routePage, /listChangeOrdersByProject/);
  assert.match(routePage, /describeLatestChangeOrder/);
  assert.match(routePage, /"Change order"/);
  const workspace = await readSource("./athena-workspace.tsx");
  assert.match(workspace, /details\?\.\["Change order"\]/);
});

test("Athena confirmation card covers the BUILD READY write states without fetching", async () => {
  const card = await readSource("./athena-confirmation-card.tsx");

  assert.match(card, /Confirm & save/);
  assert.match(card, /Edit/);
  assert.match(card, /Not now/);
  assert.match(card, /Saving/);
  assert.match(card, /Saved to the job notes/);
  assert.match(card, /Could not save/);
  assert.match(card, /Retry/);
  assert.match(card, /mode: "confirm-write"/);
  assert.match(card, /mode: "awaiting-approval"/);
  assert.match(card, /\/athena\/approvals/);
  assert.match(card, /MAX_NOTE_LENGTH = 5_000/);
  assert.match(card, /onConfirm: \(body: string\) => Promise<SaveJobNoteResult>/);
  assert.doesNotMatch(card, /clientFetch\(|fetch\(/);
  // CodeRabbit Minor 2 (this PR): the 5,000-character cap is enforced before
  // saving, not just by the textarea's maxLength — an oversized summary
  // returns to editing instead of posting above the cap.
  assert.match(card, /body\.length > MAX_NOTE_LENGTH/);
  assert.match(card, /Keep notes to 5,000 characters or fewer\./);
});

test("Athena workspace keeps an in-flight note save visible until it completes", async () => {
  const workspace = await readSource("./athena-workspace.tsx");

  // CodeRabbit Minor 3 (this PR): a new chat request must not replace the
  // confirmation card while its note POST is in flight — the composer stays
  // disabled until the save completes, then normal replacement resumes.
  assert.match(workspace, /isSavingNote/);
  assert.match(workspace, /if \(!trimmed \|\| isSending \|\| isSavingNote\) return;/);
  assert.match(workspace, /disabled=\{isSending \|\| isSavingNote \|\| draft\.trim\(\)\.length === 0\}/);
  assert.match(workspace, /onConfirm=\{saveJobNote\}/);
});
