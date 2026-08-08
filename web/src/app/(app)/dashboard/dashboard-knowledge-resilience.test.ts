import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regression coverage for a production incident: GET /api/v1/knowledge/stats
// (and /trades) started failing for every request once an unrelated backend
// fix unblocked JWT verification and this code path actually started
// running (packages/knowledge-engine/ wasn't packaged into the Vercel
// deployment — see app/scripts/vendor-knowledge-engine.js for the real fix).
// Both pages already treat this data as optional (they render "Unavailable"
// / empty states for null), but the fetch calls themselves weren't guarded,
// so a rejection crashed the whole page into the generic error boundary
// ("Minified React error #441") instead of degrading gracefully. These pins
// ensure that guard can't silently be removed.

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("dashboard page's getKnowledgeStats call is guarded against rejection", () => {
  const source = readSource("page.tsx");
  assert.match(source, /getKnowledgeStats\(token\)\.catch\(\(\) => null\)/);
});

test("AI Estimate Assist page's getKnowledgeStats/getKnowledgeTrades calls are guarded against rejection", () => {
  const source = readSource("../projects/[id]/estimates/[estimateId]/assist/page.tsx");
  assert.match(source, /getKnowledgeStats\(token\)\.catch\(\(\) => null\)/);
  assert.match(source, /getKnowledgeTrades\(token\)\.catch\(\(\) => \[\]\)/);
});
