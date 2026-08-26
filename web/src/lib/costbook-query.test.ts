import test from "node:test";
import assert from "node:assert/strict";
import { buildCostbookQuery } from "./costbook-query.ts";

test("serializes Costbook catalog query state without leaking empty values", () => {
  assert.equal(
    buildCostbookQuery({ q: "ready mix", limit: 25, cursor: "opaque", active: false, sort: "name", order: "desc", trade: "Electrical" }),
    "?limit=25&cursor=opaque&q=ready+mix&sort=name&order=desc&active=false&trade=Electrical",
  );
  assert.equal(buildCostbookQuery({ q: "", cursor: undefined }), "");
});
