import test from "node:test";
import assert from "node:assert/strict";
import { parseServiceAddressForm } from "./service-address-form.ts";

test("address submission preserves only trimmed CRM fields and selected primary flag", () => {
  const data = new FormData();
  data.set("label", " Shop ");
  data.set("addressLine1", " 10 Main St ");
  data.set("city", " Terre Haute ");
  data.set("state", " IN ");
  data.set("postalCode", " 47802 ");
  data.set("isPrimary", "on");
  data.set("customerId", "not-an-address-field");

  assert.deepEqual(parseServiceAddressForm(data), {
    input: {
      label: "Shop", addressLine1: "10 Main St", addressLine2: "",
      city: "Terre Haute", state: "IN", postalCode: "47802", isPrimary: true,
    },
  });
});

test("missing required street, city, state, or postal code cannot reach the address API", () => {
  for (const missing of ["addressLine1", "city", "state", "postalCode"]) {
    const data = new FormData();
    for (const key of ["addressLine1", "city", "state", "postalCode"]) data.set(key, key === missing ? "  " : "valid");
    assert.deepEqual(parseServiceAddressForm(data), { error: "Street, city, state, and postal code are required." });
  }
});
