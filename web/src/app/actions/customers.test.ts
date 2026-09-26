import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readCustomerActions(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, "customers.ts"), "utf8");
}

test("customer duplicate lookup requires an authenticated server session before tenant-scoped reads", () => {
  const source = readCustomerActions();
  const actionStart = source.indexOf("export async function createCustomerAction");
  const actionEnd = source.indexOf("export async function updateCustomerAction", actionStart);
  const action = source.slice(actionStart, actionEnd);
  const tokenGuard = action.indexOf("if (!token)");
  const lookup = action.indexOf("listCustomers(token");
  const create = action.indexOf('apiFetch("/api/v1/customers"');

  assert.ok(tokenGuard >= 0 && tokenGuard < lookup, "a missing session must stop before the read");
  assert.ok(lookup >= 0 && lookup < create, "possible matches must be read before a customer is created");
});

test("matching customers are returned for review and creation with matches needs the separate-record intent", () => {
  const source = readCustomerActions();
  const actionStart = source.indexOf("export async function createCustomerAction");
  const actionEnd = source.indexOf("export async function updateCustomerAction", actionStart);
  const action = source.slice(actionStart, actionEnd);

  assert.match(action, /if \(intent === "check"\) return \{ customerInput, customerMatches, customerMatchLookupFailed \}/);
  assert.match(action, /intent !== "create-separate" && requiresSeparateCustomerConfirmation\(customerMatches\.length, false\)/);
});

test("an incomplete advisory lookup blocks creation and asks the contractor to retry", () => {
  const source = readCustomerActions();
  const actionStart = source.indexOf("export async function createCustomerAction");
  const actionEnd = source.indexOf("export async function updateCustomerAction", actionStart);
  const action = source.slice(actionStart, actionEnd);

  assert.match(action, /Promise\.allSettled\(searchTerms\.map/);
  assert.match(action, /if \(intent === "check"\) return \{ customerInput, customerMatches, customerMatchLookupFailed \}/);
  const failedLookupGuard = action.indexOf("if (customerMatchLookupFailed)");
  const create = action.indexOf('apiFetch("/api/v1/customers"');
  assert.ok(failedLookupGuard >= 0 && failedLookupGuard < create);
  assert.match(action, /Customer search is incomplete\. Retry the search before creating this customer\./);
});
