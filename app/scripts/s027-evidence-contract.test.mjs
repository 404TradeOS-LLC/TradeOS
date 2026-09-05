import test from "node:test";
import assert from "node:assert/strict";
import { assertCostbookPage, COSTBOOK_ROUTES, hasVisibleFocusIndicator } from "./s027-evidence-contract.mjs";

const valid = { pathname: "/costbook", expectedPath: "/costbook", status: 200, bodyText: "Costbook No Costbook catalog records yet", scrollWidth: 390, clientWidth: 390 };
test("accepts a truthful empty catalog, and requires all nine canonical routes", () => {
  assert.doesNotThrow(() => assertCostbookPage(valid));
  assert.equal(COSTBOOK_ROUTES.length, 9);
  assert.equal(new Set(COSTBOOK_ROUTES.map(route => route.path)).size, 9);
});
test("rejects login redirects and HTTP 200 application error shells", () => {
  assert.throws(() => assertCostbookPage({ ...valid, pathname: "/login" }));
  for (const bodyText of ["Couldn't load materials", "Sign in required", "Manage access required", "Application error", "This page could not be found", ""]) {
    assert.throws(() => assertCostbookPage({ ...valid, bodyText }));
  }
});
test("rejects failed responses and missing or overflowing dimensions", () => {
  assert.throws(() => assertCostbookPage({ ...valid, status: 500 }));
  assert.throws(() => assertCostbookPage({ ...valid, scrollWidth: 420 }));
  assert.throws(() => assertCostbookPage({ ...valid, clientWidth: undefined }));
});
test("accepts outline, shadow, or focus-induced visual style changes", () => {
  const base = {
    color: "rgb(100, 100, 100)", backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopColor: "rgb(0, 0, 0)", borderRightColor: "rgb(0, 0, 0)", borderBottomColor: "rgb(0, 0, 0)", borderLeftColor: "rgb(0, 0, 0)",
    textDecorationLine: "none", textDecorationColor: "rgb(100, 100, 100)", textDecorationThickness: "auto",
    outlineStyle: "none", outlineWidth: "0px", boxShadow: "none",
  };
  assert.equal(hasVisibleFocusIndicator(base, { ...base, outlineStyle: "solid", outlineWidth: "2px" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, boxShadow: "rgb(0, 0, 0) 0px 0px 0px 2px" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base, color: "rgb(20, 20, 20)" }), true);
  assert.equal(hasVisibleFocusIndicator(base, { ...base }), false);
});