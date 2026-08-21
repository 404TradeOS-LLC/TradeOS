import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./page.tsx", import.meta.url);

async function readDashboardSource() {
  return readFile(sourceUrl, "utf8");
}

test("paired dashboard work queues preserve fulfilled siblings", async () => {
  const source = await readDashboardSource();

  assert.match(source, /Promise\.allSettled\(\[\s*listInvoiceQueue/);
  assert.match(source, /Promise\.allSettled\(\[\s*listProposalQueue/);
  assert.match(source, /overdueResult\.status === "fulfilled" \? overdueResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /unpaidResult\.status === "fulfilled" \? unpaidResult\.value : emptyQueue<InvoiceQueueItem>\(\)/);
  assert.match(source, /staleResult\.status === "fulfilled" \? staleResult\.value : emptyQueue<ProposalQueueItem>\(\)/);
  assert.match(source, /unsignedResult\.status === "fulfilled" \? unsignedResult\.value : emptyQueue<ProposalQueueItem>\(\)/);
});

test("invoice KPI fallback depends only on the unpaid total request", async () => {
  const source = await readDashboardSource();

  assert.match(source, /const unpaidFailed = unpaidResult\.status === "rejected"/);
  assert.match(source, /return \{ overdue, unpaid, unpaidFailed, error \}/);
  assert.match(source, /invoiceAttentionQueues\.unpaidFailed \? fallbackInvoicesWaiting : invoiceAttentionQueues\.unpaid\.total/);
});

test("partial paired-request failures remain visible to the Needs Attention UI", async () => {
  const source = await readDashboardSource();

  assert.match(source, /overdueFailed \|\| unpaidFailed/);
  assert.match(source, /staleResult\.status === "rejected" \|\| unsignedResult\.status === "rejected"/);
  assert.match(source, /invoicesError=\{invoiceAttentionQueues\.error\}/);
  assert.match(source, /proposalsError=\{proposalAttentionQueues\.error\}/);
});
