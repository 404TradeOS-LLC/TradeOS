import assert from "node:assert/strict";
import test from "node:test";
import { withJobRevision } from "./job-revision.ts";

test("field and schedule payloads retain the displayed revision without mutating caller data", () => {
  const revision = "2026-11-13T04:00:00.123Z";
  const schedule = { scheduledStart: "2026-11-14T12:00:00Z", scheduledEnd: "2026-11-14T13:00:00Z", overrideConflict: false };
  assert.deepEqual(withJobRevision(revision, { reason: "Waiting for access" }), { reason: "Waiting for access", expectedUpdatedAt: revision });
  assert.deepEqual(withJobRevision(revision, schedule), { ...schedule, expectedUpdatedAt: revision });
  assert.equal("expectedUpdatedAt" in schedule, false);
  assert.equal(withJobRevision(revision, { expectedUpdatedAt: "newer-untrusted-token" }).expectedUpdatedAt, revision);
});

test("missing or malformed revision fails before an unguarded write can be built", () => {
  for (const revision of [undefined, null, "", "not-a-date", 123]) {
    assert.throws(() => withJobRevision(revision, {}), /Refresh this workspace/);
  }
});
