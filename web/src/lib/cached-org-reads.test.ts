import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Layout ↔ Today double-fetch dedupe (Fluid plan Lever 2, change 2.2).
// A behavioral test cannot observe React cache() dedupe in plain node:test:
// cache() only shares a call inside a React Server Component request
// context (verified: two awaits of the same cache()d function in a plain
// Node script run the underlying function twice). Production dedupe comes
// from the request store Next.js provides — the same mechanism the
// existing loadTodayData cache() already relies on. These tests pin the
// wiring that makes the dedupe happen: one token-keyed cache() per getter,
// shared by both call sites.

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("cached org reads wrap each getter in React cache() keyed by token only", async () => {
  const source = await readSource("./cached-org-reads.ts");

  assert.match(source, /import \{ cache \} from "react"/);
  assert.match(source, /const getSettingsFetch = cache\(\(token: string\) => getOrganizationSettings\(token\)\);/);
  assert.match(source, /const getCapabilitiesFetch = cache\(\(token: string\) => getAthenaCapabilities\(token\)\);/);
  assert.match(source, /const getDispatchSummaryFetch = cache\(\(token: string\) => getDispatchSummary\(token\)\);/);
  // The AbortSignal must NOT be part of the cache key: layout and Today
  // create different controllers, so keying on it would defeat the dedupe.
  assert.doesNotMatch(source, /cache\(\(token: string, signal/);
  assert.doesNotMatch(source, /cache\(\(token, signal\)/);
  // Memberships stay out: per-user auth-scoped data, never cached.
  assert.doesNotMatch(source, /getWorkspaceMemberships\(/);
});

test("cached org reads bound the caller's wait by the signal instead of aborting the shared fetch", async () => {
  const source = await readSource("./cached-org-reads.ts");

  // A layout timeout must not kill the fetch Today is about to reuse.
  assert.match(source, /function withSignal<T>\(promise: Promise<T>, signal\?: AbortSignal\)/);
  assert.match(source, /Promise\.race\(\[promise, waitForAbort\(signal\)\]\)/);
  assert.doesNotMatch(source, /getOrganizationSettings\(token, signal\)/);
  assert.doesNotMatch(source, /getAthenaCapabilities\(token, signal\)/);
  assert.doesNotMatch(source, /getDispatchSummary\(token, \{ signal/);
});

test("layout and Today share the cached getters instead of calling the raw getters", async () => {
  const layout = await readSource("../app/(app)/layout.tsx");
  const today = await readSource("./today-data.ts");

  assert.match(layout, /getCachedAthenaCapabilities\(token, controller\.signal\)/);
  assert.match(layout, /getCachedOrganizationSettings\(token, controller\.signal\)/);
  assert.doesNotMatch(layout, /getAthenaCapabilities\(token, controller\.signal\)/);
  assert.doesNotMatch(layout, /getOrganizationSettings\(token, controller\.signal\)/);
  assert.match(today, /getCachedOrganizationSettings\(token\)/);
  assert.match(today, /getCachedDispatchSummary\(token\)/);
  assert.match(today, /getCachedAthenaCapabilities\(token\)/);
  assert.doesNotMatch(today, /getOrganizationSettings\(token\)/);
  assert.doesNotMatch(today, /getDispatchSummary\(token\)/);
  assert.doesNotMatch(today, /getAthenaCapabilities\(token\)/);
});
