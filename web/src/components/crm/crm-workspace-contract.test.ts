import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("CRM composes existing organization reads instead of creating a parallel CRM store", async () => {
  const page = await readSource("../../app/(app)/crm/page.tsx");
  const overview = await readSource("./crm-overview.tsx");

  assert.match(page, /listProjects\(token\)/);
  assert.match(page, /listCustomers\(token\)/);
  assert.match(page, /listOrganizationProjectTasks\(token/);
  assert.match(page, /listProposalQueue\(token/);
  assert.match(page, /eventType: "site_visit\.created"/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(overview, /No parallel CRM stage is stored/);
  assert.match(overview, /CRM is an operating view over Customers, Projects, Project Tasks, Site Visits, and Proposals/);
});

test("CRM pipeline derives milestones from canonical Project Site Visit and Proposal state", async () => {
  const overview = await readSource("./crm-overview.tsx");

  assert.match(overview, /project\.status === "lead"/);
  assert.match(overview, /project\.status === "estimating"/);
  assert.match(overview, /project\.status === "awarded"/);
  assert.match(overview, /proposal\.status === "sent"/);
  assert.match(overview, /proposal\.status === "viewed"/);
  assert.match(overview, /siteVisitProjectIds\.has\(project\.id\)/);
  assert.match(overview, /label: "Ready to Estimate"/);
  assert.match(overview, /label: "Proposal Sent"/);
});

test("CRM follow-ups remain Project Tasks and navigation exposes the first-class route", async () => {
  const page = await readSource("../../app/(app)/crm/page.tsx");
  const overview = await readSource("./crm-overview.tsx");
  const nav = await readSource("../shared/app-nav.tsx");
  const proxy = await readSource("../../proxy.ts");

  assert.match(page, /includeCompleted: false/);
  assert.match(overview, /Existing incomplete Project Tasks due next/);
  assert.match(overview, /href=\{\`\/projects\/\$\{task\.projectId\}\`\}/);
  assert.match(nav, /href: "\/crm", label: "CRM"/);
  assert.match(proxy, /"\/crm\/:path\*"/);
});

test("CRM overview degrades individual data sources without hiding healthy sources", async () => {
  const page = await readSource("../../app/(app)/crm/page.tsx");

  assert.match(page, /Projects are temporarily unavailable/);
  assert.match(page, /Customers are temporarily unavailable/);
  assert.match(page, /Follow-ups are temporarily unavailable/);
  assert.match(page, /Proposal pipeline status is temporarily unavailable/);
  assert.match(page, /Site-visit milestones are temporarily unavailable/);
});
