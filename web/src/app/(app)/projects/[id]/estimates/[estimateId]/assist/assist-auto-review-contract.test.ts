import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readPageSource(): Promise<string> {
  return readFile(new URL("./page.tsx", import.meta.url), "utf8");
}

test("assist page auto-runs Athena review only when the landing carries autoReview=1 (DES-3 slice 3)", async () => {
  const page = await readPageSource();
  // The onboarding completion lands here with ?autoReview=1; every other
  // landing (including the builder's manual "Athena review" button) omits
  // it, so the review stays manual there.
  assert.match(page, /searchParams: Promise<\{ autoReview\?: string \}>/);
  assert.match(page, /await Promise\.all\(\[params, searchParams\]\)/);
  assert.match(page, /autoRunReview=\{autoReview === "1"\}/);
  // Exact-match only: any other value (including "true" or "yes") is a
  // manual landing, never an auto-run.
  assert.doesNotMatch(page, /autoReview === "true"/);
  assert.doesNotMatch(page, /autoRunReview=\{true\}/);
});

test("assist page still gates on a saved scope and starts with no draft", async () => {
  const page = await readPageSource();
  assert.match(page, /if \(initialScope === null\) notFound\(\);/);
  assert.match(page, /initialStructuredDraft=\{null\}/);
  assert.match(page, /initialScopeOfWork=\{initialScope\}/);
});
