import assert from "node:assert/strict";
import test from "node:test";
import { handleAthenaNavLookupFailure } from "./layout-athena-error.mjs";

test("AppLayout treats its deliberate Athena settings abort as a warning and hides Athena navigation", () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const warnings: unknown[][] = [];
  const errors: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  console.error = (...args: unknown[]) => errors.push(args);

  try {
    const abortError = new Error("timed out");
    abortError.name = "AbortError";

    assert.equal(handleAthenaNavLookupFailure(abortError), false);
    assert.deepEqual(warnings, [["AppLayout: Athena nav visibility lookup timed out; hiding Athena navigation"]]);
    assert.deepEqual(errors, []);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});

test("AppLayout reports unexpected Athena nav lookup failures as errors and hides Athena navigation", () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  const warnings: unknown[][] = [];
  const errors: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnings.push(args);
  console.error = (...args: unknown[]) => errors.push(args);

  try {
    const failure = new Error("settings unavailable");

    assert.equal(handleAthenaNavLookupFailure(failure), false);
    assert.deepEqual(warnings, []);
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "AppLayout: failed to resolve Athena nav visibility");
    assert.equal(errors[0][1], failure);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});
