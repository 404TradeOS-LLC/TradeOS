import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateMatrix } from "../connection-matrix-check.mjs";

const matrix = JSON.parse(fs.readFileSync("docs/testing/FRONTEND_BACKEND_CONNECTION_MATRIX.json", "utf8"));
const copy = () => structuredClone(matrix);

test("S051 matrix maps current release-critical actions to registered backend routes", () => {
  assert.deepEqual(validateMatrix(copy()), []);
});

test("matrix rejects a release-critical journey without an owner", () => {
  const candidate = copy();
  delete candidate.journeys[0].owner;
  assert.ok(validateMatrix(candidate).some((error) => error.includes("owner must be documented")));
});

test("matrix rejects a frontend operation whose route method has drifted", () => {
  const candidate = copy();
  candidate.journeys[0].actions[0].method = "PATCH";
  assert.ok(validateMatrix(candidate).some((error) => error.includes("PATCH / is not registered")));
});

test("matrix rejects a backend router mount that is absent from the server", () => {
  const candidate = copy();
  candidate.journeys[0].actions[0].mount = "/api/v1/unmounted-customers";
  assert.ok(validateMatrix(candidate).some((error) => error.includes("is not mounted")));
});

test("matrix rejects a route remapped to a different backend handler", () => {
  const candidate = copy();
  candidate.journeys[0].actions[0].handler = "crmCustomersController.remove";
  assert.ok(validateMatrix(candidate).some((error) => error.includes("is no longer connected to crmCustomersController.remove")));
});

test("matrix rejects an action whose frontend symbol disappeared", () => {
  const candidate = copy();
  candidate.journeys[0].actions[0].symbol = "removedCustomerAction";
  assert.ok(validateMatrix(candidate).some((error) => error.includes("frontend symbol removedCustomerAction is absent")));
});

test("matrix requires request, response, permission, tenant, refresh, and evidence contracts", () => {
  const candidate = copy();
  delete candidate.journeys[0].actions[0].permission;
  assert.ok(validateMatrix(candidate).some((error) => error.includes("permission must be documented")));
});

test("an intentionally unmapped gap must be explicit", () => {
  const candidate = copy();
  const gapJourney = candidate.journeys.find((journey) => journey.id === "athena-actions");
  delete gapJourney.unmappedGap;
  assert.ok(validateMatrix(candidate).some((error) => error.includes("empty action list must state the concrete unmapped gap")));
});


test("matrix rejects a frontend request target drift while clientFetch remains present", () => {
  const candidate = copy();
  const action = candidate.journeys.find((journey) => journey.id === "scope-estimate").actions.find((item) => item.id === "estimate.line.create");
  action.frontendPath = "/estimates/wrong-target";
  assert.ok(validateMatrix(candidate).some((error) => error.includes("frontend request path /estimates/wrong-target is absent")));
});

test("matrix rejects invalid top-level input without throwing", () => {
  assert.ok(validateMatrix(null).some((error) => error.includes("matrix must be a non-null object")));
});
