import test from "node:test";
import assert from "node:assert/strict";
import { runCreateCustomerWorkflow } from "./create-customer-workflow.ts";
import type { Customer } from "../../lib/api";

const matchingCustomer: Customer = {
  id: "customer-1", name: "Smith Family", email: "hello@example.com", phone: null,
  address: null, billingAddress: null, notes: null, createdAt: "2026-01-01",
};

function form(intent: string): FormData {
  const data = new FormData();
  data.set("name", "Smith Family");
  data.set("email", "hello@example.com");
  data.set("intent", intent);
  return data;
}

function dependencies(overrides: Partial<Parameters<typeof runCreateCustomerWorkflow>[1]> = {}) {
  const creates: unknown[] = [];
  const deps = {
    getSessionToken: async () => "session-token",
    listCustomers: async () => [] as Customer[],
    createCustomer: async (_token: string, input: unknown) => { creates.push(input); },
    onCreated: () => undefined,
    onError: () => "Could not create customer.",
    ...overrides,
  };
  return { deps, creates };
}

test("an incomplete advisory lookup blocks customer creation", async () => {
  const { deps, creates } = dependencies({
    listCustomers: async () => { throw new Error("lookup unavailable"); },
  });

  const result = await runCreateCustomerWorkflow(form("create"), deps);

  assert.equal(result?.customerMatchLookupFailed, true);
  assert.match(result?.error ?? "", /search is incomplete/i);
  assert.deepEqual(creates, []);
});

test("a capped lookup is treated as incomplete because an exact match may be beyond the result limit", async () => {
  const { deps, creates } = dependencies({
    listCustomers: async () => Array.from({ length: 250 }, (_, i) => ({ ...matchingCustomer, id: `candidate-${i}`, name: `Other ${i}` })),
  });

  const result = await runCreateCustomerWorkflow(form("create"), deps);

  assert.equal(result?.customerMatchLookupFailed, true);
  assert.deepEqual(creates, []);
});

test("possible matches require explicit create-separate intent", async () => {
  const { deps, creates } = dependencies({ listCustomers: async () => [matchingCustomer] });

  const review = await runCreateCustomerWorkflow(form("create"), deps);
  assert.deepEqual(review?.customerMatches?.map((match) => match.id), ["customer-1"]);
  assert.deepEqual(creates, []);

  const confirmed = await runCreateCustomerWorkflow(form("create-separate"), deps);
  assert.equal(confirmed, undefined);
  assert.equal(creates.length, 1);
});
