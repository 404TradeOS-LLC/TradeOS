import test from "node:test";
import assert from "node:assert/strict";
import { describeAthenaLoadError, isAthenaOperatorRole } from "./athena-state.ts";

// Mirrors the shape of web/src/lib/api.ts's ApiClientError (message,
// numeric `status`, extends Error) without importing that module directly:
// api.ts is `import "server-only"`-tainted and throws when loaded outside a
// Next server bundle (verified: `require("server-only")` throws
// unconditionally under plain Node), so no test in this codebase imports it
// or anything built on it. athena-state.ts duck-types the same shape for the
// same reason - see its top-of-file comment.
class FakeApiClientError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

test("isAthenaOperatorRole admits only owner and admin", () => {
  assert.equal(isAthenaOperatorRole("owner"), true);
  assert.equal(isAthenaOperatorRole("admin"), true);
  assert.equal(isAthenaOperatorRole("dispatcher"), false);
  assert.equal(isAthenaOperatorRole("technician"), false);
  assert.equal(isAthenaOperatorRole(null), false);
  assert.equal(isAthenaOperatorRole(undefined), false);
  assert.equal(isAthenaOperatorRole(""), false);
});

test("describeAthenaLoadError maps a 404 to the calm not_enabled state (feature flag off)", () => {
  const outcome = describeAthenaLoadError(new FakeApiClientError("Route not found: GET /api/v1/athena/observability/overview", 404));
  assert.deepEqual(outcome, { kind: "not_enabled" });
});

test("describeAthenaLoadError maps a 403 to denied", () => {
  const outcome = describeAthenaLoadError(new FakeApiClientError("Forbidden", 403));
  assert.deepEqual(outcome, { kind: "denied" });
});

test("describeAthenaLoadError maps any other status to an error state carrying the backend's message", () => {
  const outcome = describeAthenaLoadError(new FakeApiClientError("Internal server error", 500));
  assert.deepEqual(outcome, { kind: "error", message: "Internal server error" });
});

test("describeAthenaLoadError falls back to a generic message when the backend sent none", () => {
  const outcome = describeAthenaLoadError(new FakeApiClientError("", 500));
  assert.deepEqual(outcome, { kind: "error", message: "Request to the Athena observability service failed." });
});

test("describeAthenaLoadError treats a plain error (e.g. network failure) as a generic error", () => {
  const outcome = describeAthenaLoadError(new TypeError("fetch failed"));
  assert.deepEqual(outcome, { kind: "error", message: "Unable to reach the Athena observability service." });
});
