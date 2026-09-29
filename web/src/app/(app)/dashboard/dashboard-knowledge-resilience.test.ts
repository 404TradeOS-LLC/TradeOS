import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Knowledge Runtime remains optional where it is still used. The canonical
// Today refactor deliberately removed the Knowledge Runtime diagnostic from
// the landing command center, so Today must not fetch stats merely to support
// a hidden/duplicate dashboard module. AI Estimate Assist still owns its
// separate graceful-degradation contract.

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("Today does not load Knowledge Runtime stats for the removed diagnostic card", () => {
  const source = readSource("page.tsx");
  assert.doesNotMatch(source, /getKnowledgeStats/);
  assert.doesNotMatch(source, /Knowledge Runtime Coverage/);
  assert.doesNotMatch(source, /knowledge-coverage/);
});

test("AI Estimate Assist page's getKnowledgeStats/getKnowledgeTrades calls are guarded against rejection", () => {
  const source = readSource("../projects/[id]/estimates/[estimateId]/assist/page.tsx");
  assert.match(source, /getKnowledgeStats\(token\)\.catch\(\(\) => null\)/);
  assert.match(source, /getKnowledgeTrades\(token\)\.catch\(\(\) => \[\]\)/);
});
