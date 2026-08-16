import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("owner briefing remains backed by live read-only TradeOS signals", () => {
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

test("legacy primary-dashboard slot is suppressed while the briefing remains available for drill-in", () => {
  const compatibilitySource = readSource("../../../components/dashboard/ai-assistant-placeholder-panel.tsx");
  const briefingSource = readSource("../../../components/dashboard/owner-briefing-panel.tsx");

  assert.match(compatibilitySource, /export function AIAssistantPlaceholderPanel/);
  assert.match(compatibilitySource, /return null/);
  assert.doesNotMatch(compatibilitySource, /OwnerBriefingPanel as AIAssistantPlaceholderPanel/);
  assert.match(briefingSource, /export async function OwnerBriefingPanel/);
});
