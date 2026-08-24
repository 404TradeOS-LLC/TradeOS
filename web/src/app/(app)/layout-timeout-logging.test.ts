import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

test("AppLayout treats its deliberate Athena settings abort as a warning", () => {
  assert.match(layoutSource, /error instanceof Error && error\.name === "AbortError"/);
  assert.match(layoutSource, /console\.warn\("AppLayout: Athena nav visibility lookup timed out; hiding Athena navigation"\)/);
});

test("AppLayout still reports unexpected Athena nav lookup failures as errors", () => {
  assert.match(layoutSource, /console\.error\("AppLayout: failed to resolve Athena nav visibility", error\)/);
});
