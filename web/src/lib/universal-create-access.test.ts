import assert from "node:assert/strict";
import test from "node:test";
import { canUseUniversalCreate } from "./universal-create-access.ts";
import { universalCreateKinds } from "./universal-create.ts";

const writes = universalCreateKinds.filter((kind) => kind !== "athena");

test("manager and compatible estimator roles retain supported creation workflows", () => {
  for (const role of ["owner", "admin", "dispatcher", "estimator"]) {
    for (const kind of writes) assert.equal(canUseUniversalCreate(kind, role, false), true, `${role}: ${kind}`);
  }
});

test("field/read-only roles cannot enter write workflows from Create", () => {
  for (const role of ["technician", "viewer"]) {
    for (const kind of writes) assert.equal(canUseUniversalCreate(kind, role, true), false, `${role}: ${kind}`);
  }
});

test("missing or unrecognized role never grants a creation workflow", () => {
  for (const role of [undefined, null, "", "manager", {}, 1]) {
    for (const kind of writes) assert.equal(canUseUniversalCreate(kind, role, true), false);
  }
});

test("advisory Athena keeps its independent capability gate for every role", () => {
  for (const role of ["owner", "technician", "viewer", undefined]) {
    assert.equal(canUseUniversalCreate("athena", role, true), true);
    assert.equal(canUseUniversalCreate("athena", role, false), false);
  }
});
