import test from "node:test";
import assert from "node:assert/strict";
import { splitProjectSiteAddress } from "./job-address.ts";

test("prefills separate street, city, state and ZIP from a comma-delimited project site address", () => {
  assert.deepEqual(splitProjectSiteAddress("4050 S State Road 63, Terre Haute, IN 47802"), {
    addressLine1: "4050 S State Road 63",
    city: "Terre Haute",
    state: "IN",
    postalCode: "47802",
  });
});

test("accepts newline separated addresses and extended ZIP codes", () => {
  assert.deepEqual(splitProjectSiteAddress("12 Main Street\nTerre Haute, IN 47802-1234"), {
    addressLine1: "12 Main Street",
    city: "Terre Haute",
    state: "IN",
    postalCode: "47802-1234",
  });
});

test("recognizes addresses with no comma between city and state", () => {
  assert.deepEqual(splitProjectSiteAddress("12 Main Street, Terre Haute IN 47802"), {
    addressLine1: "12 Main Street", city: "Terre Haute", state: "IN", postalCode: "47802",
  });
});

test("never guesses a city or state from an ambiguous address", () => {
  for (const value of ["123 Main Street", "123 Main Street Terre Haute IN 47802", "123 Main St, Elsewhere, ZZ 12345", "123 Main St, Terre Haute, IN 123"]) {
    assert.deepEqual(splitProjectSiteAddress(value), {
      addressLine1: value, city: "", state: "", postalCode: "",
    });
  }
});

test("empty project address leaves all fields empty", () => {
  assert.deepEqual(splitProjectSiteAddress(null), {
    addressLine1: "", city: "", state: "", postalCode: "",
  });
});
