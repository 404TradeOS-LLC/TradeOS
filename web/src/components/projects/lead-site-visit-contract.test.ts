import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Project detail only uses the canonical Lead overview for supported pre-estimate states", async () => {
  const page = await readSource("../../app/(app)/projects/[id]/page.tsx");

  assert.match(page, /const showCanonicalLeadOverview =/);
  assert.match(page, /activeTab === "overview"/);
  assert.match(page, /project\.estimates\.length === 0/);
  assert.match(page, /project\.proposals\.length === 0/);
  assert.match(page, /project\.contracts\.length === 0/);
  assert.match(page, /project\.jobs\.length === 0/);
  assert.match(page, /project\.status === "lead"/);
  assert.match(page, /project\.status === "estimating" && project\.siteVisits\.length > 0/);
  assert.match(page, /<LeadOverview/);
});

test("Lead overview stays Project-backed and does not invent a separate qualification model", async () => {
  const source = await readSource("./lead-overview.tsx");

  assert.match(source, /Project-backed lead/);
  assert.match(source, /qualification is not a separate Lead-stage field/);
  assert.match(source, /Lead progress/);
  assert.match(source, /label="Inquiry"/);
  assert.match(source, /label="Site Visit"/);
  assert.match(source, /label="Estimate"/);
  assert.match(source, /label="Won"/);
  assert.doesNotMatch(source, /leadId|opportunityId|crmStage/);
});

test("Ready-to-estimate state uses the real Site Visit evidence and existing Estimate action", async () => {
  const source = await readSource("./lead-overview.tsx");

  assert.match(source, /const readyToEstimate = Boolean\(latestVisit && estimates\.length === 0\)/);
  assert.match(source, /Ready to Estimate/);
  assert.match(source, /createEstimateAction/);
  assert.match(source, /Create Estimate/);
  assert.match(source, /Site Visit findings remain attached here for estimator review/);
  assert.match(source, /does not claim they are automatically converted into priced line items/);
});

test("Site Visit form is capture-first with advanced details progressively disclosed", async () => {
  const source = await readSource("./site-visit-form.tsx");

  assert.match(source, /Site Visit Capture/);
  assert.match(source, /Quick capture/);
  assert.match(source, /name="photos"/);
  assert.match(source, /capture="environment"/);
  assert.match(source, /name="squareFeet"/);
  assert.match(source, /name="linearFeet"/);
  assert.match(source, /name="fixtureCount"/);
  assert.match(source, /name="notes"/);
  assert.match(source, /<details className=/);
  assert.match(source, /More visit details/);
  assert.match(source, /name="gps"/);
  assert.match(source, /name="transcript"/);
  assert.match(source, /name="customerNotes"/);
  assert.match(source, /Finish Visit/);
});

test("Site Visit intake hands off to Estimate instead of skipping to Proposal", async () => {
  const source = await readSource("../../app/(app)/projects/[id]/intake/page.tsx");

  assert.match(source, /Estimate handoff/);
  assert.match(source, /createEstimateAction/);
  assert.match(source, /Create Estimate/);
  assert.match(source, /Open Estimate/);
  assert.match(source, /they are not silently converted into priced line items/);
  assert.doesNotMatch(source, /Continue to proposal draft|\/proposals\/new/);
});

test("Site Visit intake renders current missing-information analysis without fabricating active-session state", async () => {
  const source = await readSource("../../app/(app)/projects/[id]/intake/page.tsx");

  assert.match(source, /What still needs captured\?/);
  assert.match(source, /missingInfo\.slice\(0, 4\)/);
  assert.match(source, /aiQuestions\.slice\(0, 3\)/);
  assert.match(source, /Saving another Site Visit refreshes it/);
  assert.doesNotMatch(source, /VISIT ACTIVE|active visit session/i);
});

test("intake confidence is treated as the stored 0-100 score", async () => {
  const lead = await readSource("./lead-overview.tsx");
  const intake = await readSource("../../app/(app)/projects/[id]/intake/page.tsx");

  assert.match(lead, /Math\.round\(latestVisit\.confidenceScore\)/);
  assert.doesNotMatch(lead, /confidenceScore \* 100/);
  assert.match(intake, /AIProgressIndicator label="Intake readiness" value=\{latestVisit\?\.confidenceScore \?\? 0\}/);
});
