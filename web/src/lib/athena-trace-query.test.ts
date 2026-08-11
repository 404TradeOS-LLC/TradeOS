import test from "node:test";
import assert from "node:assert/strict";
import {
  athenaDatetimeLocalToIso,
  athenaIsoToDatetimeLocal,
  buildAthenaTracesHref,
  isAthenaTraceFiltered,
} from "./athena-trace-query.ts";

test("isAthenaTraceFiltered is false with no filters set (drives the unfiltered empty-state copy)", () => {
  assert.equal(isAthenaTraceFiltered({}), false);
  assert.equal(isAthenaTraceFiltered({ traceId: "", status: "   " }), false);
});

test("isAthenaTraceFiltered is true as soon as any single filter is set", () => {
  assert.equal(isAthenaTraceFiltered({ status: "failed" }), true);
  assert.equal(isAthenaTraceFiltered({ actorUserId: "11111111-1111-1111-1111-111111111111" }), true);
  assert.equal(isAthenaTraceFiltered({ traceId: "", toolId: "estimate.create" }), true);
});

test("buildAthenaTracesHref omits empty filters and serializes only the set ones", () => {
  assert.equal(buildAthenaTracesHref({}), "/athena/traces");
  assert.equal(buildAthenaTracesHref({ status: "failed", toolId: "" }), "/athena/traces?status=failed");
});

test("buildAthenaTracesHref includes a cursor override for pagination", () => {
  assert.equal(
    buildAthenaTracesHref({ status: "failed" }, "exec-123"),
    "/athena/traces?status=failed&cursor=exec-123"
  );
});

test("athenaDatetimeLocalToIso converts a datetime-local value to a UTC ISO instant", () => {
  assert.equal(athenaDatetimeLocalToIso("2026-08-10T13:00"), "2026-08-10T13:00:00.000Z");
  assert.equal(athenaDatetimeLocalToIso(undefined), undefined);
  assert.equal(athenaDatetimeLocalToIso(""), undefined);
  assert.equal(athenaDatetimeLocalToIso("not-a-date"), undefined);
});

test("athenaIsoToDatetimeLocal is the inverse of athenaDatetimeLocalToIso for well-formed input", () => {
  assert.equal(athenaIsoToDatetimeLocal("2026-08-10T13:00:00.000Z"), "2026-08-10T13:00");
  assert.equal(athenaIsoToDatetimeLocal(undefined), "");
  assert.equal(athenaIsoToDatetimeLocal("garbage"), "");
});
