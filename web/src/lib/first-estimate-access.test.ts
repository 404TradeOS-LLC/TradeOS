import assert from "node:assert/strict";
import test from "node:test";
import { canStartFirstEstimate } from "./first-estimate-access.ts";

test("first-estimate presentation follows existing canonical CRM write roles", () => {
  for (const role of ["owner", "admin", "dispatcher", "estimator"]) assert.equal(canStartFirstEstimate(role), true, role);
  for (const role of ["technician", "viewer", "unknown", "", null, undefined]) assert.equal(canStartFirstEstimate(role), false, String(role));
});
