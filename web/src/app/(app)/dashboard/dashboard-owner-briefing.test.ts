import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("owner briefing is backed by live read-only TradeOS signals", () => {
  const source = readSource("../../../components/dashboard/owner-briefing-panel.tsx");

  assert.match(source, /getDispatchSummary\(token\)/);
  assert.match(source, /listOrganizationProjectTasks\(token/);
  assert.match(source, /getCurrentWeekPaymentLedger\(token\)/);
  assert.match(source, /buildDashboardTaskSnapshot/);
  assert.match(source, /Deterministic summary of live TradeOS signals/);
});

test("owner briefing does not claim Athena business-tool execution", () => {
  const source = readSource("../../../components/dashboard/owner-briefing-panel.tsx");

  assert.match(source, /No AI-generated facts or autonomous actions/);
  assert.match(source, /Athena execution stays off here until business-tool rollout/);
  assert.doesNotMatch(source, /\/api\/v1\/athena/);
  assert.doesNotMatch(source, /method:\s*["']POST["']/);
});

test("legacy dashboard import resolves to the live briefing instead of placeholder copy", () => {
  const source = readSource("../../../components/dashboard/ai-assistant-placeholder-panel.tsx");

  assert.match(source, /OwnerBriefingPanel as AIAssistantPlaceholderPanel/);
  assert.doesNotMatch(source, /Not connected/);
  assert.doesNotMatch(source, /disabled dashboard foundation slot/);
});
