import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Customer workspace uses bounded Project detail fan-out and discloses partial data", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /const CUSTOMER_PROJECT_DETAIL_LIMIT = 8/);
  assert.match(source, /Promise\.allSettled\(selected\.map\(\(project\) => getProject\(token, project\.id\)\)\)/);
  assert.match(source, /failedCount: results\.length - items\.length/);
  assert.match(source, /bounded: customer\.projects\.length > selected\.length/);
  assert.match(source, /<FeedbackState\s+kind="partial"/);
  assert.match(source, /Loaded work remains safe and actionable/);
});

test("Customer workspace derives money from canonical Invoice amounts and excludes voided invoices", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /const activeInvoices = invoices\.filter\(\(invoice\) => invoice\.status !== "voided"\)/);
  assert.match(source, /invoice\.paidAmount/);
  assert.match(source, /invoice\.balanceDue/);
  assert.match(source, /invoice\.amount/);
  assert.match(source, /Recorded payments on loaded projects/);
  assert.match(source, /Non-voided invoices on loaded projects/);
});

test("Customer Needs You contains only supported human-attention signals", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /getStaleProposalCutoffIso/);
  assert.match(source, /invoice\.status === "overdue" && invoice\.balanceDue > 0/);
  assert.match(source, /\["sent", "viewed"\]\.includes\(proposal\.status\)/);
  assert.match(source, /!proposal\.respondedAt/);
  assert.match(source, /task\.status === "blocked"/);
  assert.match(source, /Customer work waiting on a human decision/);
  assert.doesNotMatch(source, /No estimate.*Needs You|draft estimate.*Needs You/i);
});

test("Upcoming customer work uses dispatcher customer scope and real technician assignments", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /listJobsForDispatch\(token, \{/);
  assert.match(source, /customerId,/);
  assert.match(source, /scheduledTo: toInclusiveEndBoundary\(summary\.weekRangeUtc\.end\)/);
  assert.match(source, /job\.assignedTechnicians\.map\(\(tech\) => tech\.name\)/);
  assert.match(source, /formatScheduleInZone\(job\.scheduledStart, schedule\.timezone\)/);
  assert.doesNotMatch(source, /progress.*%|64%/i);
});

test("Customer activity is composed only from real Project document and intake timestamps", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /Proposal viewed/);
  assert.match(source, /Proposal sent/);
  assert.match(source, /Payment recorded/);
  assert.match(source, /Site Visit captured/);
  assert.match(source, /File added/);
  assert.doesNotMatch(source, /Message received|communication history/i);
});

test("Customer file rows route through Project Documents instead of exposing raw storage URLs", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /\/projects\/\$\{file\.projectId\}\?tab=documents/);
  assert.doesNotMatch(source, /href=\{file\.fileUrl\}/);
});

test("Customer contact and administration reuse existing actions without inventing messaging", async () => {
  const source = await readSource("./page.tsx");

  assert.match(source, /href=\{\`tel:\$\{customer\.phone\}\`\}/);
  assert.match(source, /href=\{\`mailto:\$\{customer\.email\}\`\}/);
  assert.match(source, /<EditCustomerForm customer=\{customer\} \/>/);
  assert.match(source, /<CustomerPortalLink customerId=\{customer\.id\} \/>/);
  assert.match(source, /form action=\{deleteCustomerAction\}/);
  assert.doesNotMatch(source, /sms:|sendMessage|Create message|Ask Athena|\/athena\?/);
});

test("Customer Athena affordance remains deferred until contractor Athena is authoritative on main", async () => {
  const source = await readSource("./page.tsx");

  assert.doesNotMatch(source, /Ask Athena/);
  assert.doesNotMatch(source, /href=.*\/athena/);
});
