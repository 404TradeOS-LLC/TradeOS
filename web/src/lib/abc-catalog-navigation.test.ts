import assert from "node:assert/strict";
import test from "node:test";
import { buildAbcCatalogProductHref, parseAbcCatalogSource } from "./abc-catalog-navigation.ts";

test("a catalog product link carries no product attributes or pricing", () => {
  const href = buildAbcCatalogProductHref("03CTLP4MN", {
    page: 2, q: "roofing shingle", searchBy: "itemDescription", familyId: "PFam_100",
  });
  const url = new URL(href, "https://app.example.test");
  assert.equal(url.pathname, "/costbook/abc-catalog/03CTLP4MN");
  assert.equal(url.searchParams.get("sourcePage"), "2");
  assert.equal(url.searchParams.get("q"), "roofing shingle");
  assert.equal(url.searchParams.get("familyId"), "PFam_100");
  assert.equal(url.searchParams.has("price"), false);
  assert.deepEqual(parseAbcCatalogSource(Object.fromEntries(url.searchParams)), {
    page: 2, q: "roofing shingle", familyId: "PFam_100", searchBy: "itemDescription",
  });
});

test("exact item numbers retain leading zeroes and search context", () => {
  const href = buildAbcCatalogProductHref("003002", { page: 1, searchBy: "itemNumber", q: "003002" });
  assert.equal(href, "/costbook/abc-catalog/003002?sourcePage=1&q=003002&searchBy=itemNumber");
});

test("invalid or oversized page hints fail closed without scanning the catalog", () => {
  for (const sourcePage of [undefined, "0", "-1", "100001", "Infinity", "1.5", "1/other", "99999999"]) {
    assert.equal(parseAbcCatalogSource({ sourcePage }), null);
  }
});

test("query context is bounded and unexpected search modes are ignored", () => {
  const source = parseAbcCatalogSource({ sourcePage: "3", q: "x".repeat(200), familyId: "y".repeat(200), searchBy: "unknown" });
  assert.equal(source?.q?.length, 120);
  assert.equal(source?.familyId?.length, 120);
  assert.equal(source?.searchBy, "itemDescription");
});
