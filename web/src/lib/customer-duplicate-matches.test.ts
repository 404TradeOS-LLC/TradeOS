import test from "node:test";
import assert from "node:assert/strict";
import {
  customerDuplicateSearchTerms,
  findCustomerDuplicateMatches,
  requiresSeparateCustomerConfirmation,
} from "./customer-duplicate-matches.ts";
import type { Customer } from "./api.ts";

const customers: Customer[] = [
  { id: "one", name: "Smith Family", email: "hello@example.com", phone: "(317) 555-0123", address: null, billingAddress: null, notes: null, createdAt: "2026-01-01" },
  { id: "two", name: "Smith Family", email: "other@example.com", phone: "317.555.0199", address: null, billingAddress: null, notes: null, createdAt: "2026-01-02" },
  { id: "three", name: "Different", email: "different@example.com", phone: "3175550000", address: null, billingAddress: null, notes: null, createdAt: "2026-01-03" },
];

test("search terms are trimmed, de-duplicated, and bounded to name and email", () => {
  assert.deepEqual(customerDuplicateSearchTerms({ name: " Smith Family ", email: " hello@example.com ", phone: "+1 (317) 555-0123" }), [
    "Smith Family", "hello@example.com",
  ]);
});

test("search terms longer than the API bound are skipped instead of blocking customer creation", () => {
  const input = { name: "New Customer", email: "x".repeat(321), phone: "" };
  assert.deepEqual(customerDuplicateSearchTerms(input), ["New Customer"]);
});

test("advisory matching normalizes exact name and email values and explains each match", () => {
  const matches = findCustomerDuplicateMatches(customers, {
    name: "  smith   FAMILY ", email: " HELLO@example.com ", phone: "3175550123",
  });

  assert.deepEqual(matches, [
    { id: "one", name: "Smith Family", email: "hello@example.com", phone: "(317) 555-0123", matchedOn: ["name", "email"] },
    { id: "two", name: "Smith Family", email: "other@example.com", phone: "317.555.0199", matchedOn: ["name"] },
  ]);
});

test("phone-only similarities are not claimed as matches when stored formatting cannot be normalized by bounded search", () => {
  assert.deepEqual(findCustomerDuplicateMatches(customers, {
    name: "New Household", email: "", phone: "3175550123",
  }), []);
});

test("empty contact values do not match and duplicate candidates are returned once", () => {
  const matches = findCustomerDuplicateMatches(customers, { name: "", email: "", phone: "" });
  assert.deepEqual(matches, []);
  assert.equal(findCustomerDuplicateMatches([...customers, customers[0]!], { name: "Smith Family", email: "", phone: "" }).length, 2);
});

test("a possible match requires an explicit separate-record choice before create", () => {
  assert.equal(requiresSeparateCustomerConfirmation(1, false), true);
  assert.equal(requiresSeparateCustomerConfirmation(1, true), false);
  assert.equal(requiresSeparateCustomerConfirmation(0, false), false);
});
