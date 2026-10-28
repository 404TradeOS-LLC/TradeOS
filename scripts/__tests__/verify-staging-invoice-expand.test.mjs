import test from "node:test";
import assert from "node:assert/strict";
import { assertEquivalentSql, executableSql } from "../verify-staging-invoice-expand.mjs";

const sample = "alter table invoice_line_items add column unit_price numeric(12,4);\nupdate invoice_line_items set unit_price = unit_cost;";

test("comment-only differences cannot create a false migration mismatch", () => {
  assert.doesNotThrow(() => assertEquivalentSql(
    "-- External executor comment\n" + sample,
    "-- Repository history comment\n\n" + sample,
  ));
});

test("real SQL differences refuse the history reconciliation", () => {
  assert.throws(() => assertEquivalentSql(
    sample.replace("numeric(12,4)", "numeric(10,2)"),
    sample,
  ), /differs/);
  assert.throws(() => assertEquivalentSql("", sample), /empty/);
  assert.throws(() => assertEquivalentSql(sample, "  -- only a comment"), /differs/);
});

test("SQL comparison preserves statement order and string literal content", () => {
  assert.throws(() => assertEquivalentSql(
    "update invoice_line_items set unit_price = unit_cost; alter table invoice_line_items add column unit_price numeric(12,4);",
    sample,
  ), /differs/);
  assert.notEqual(executableSql("select 'a';"), executableSql("select 'b';"));
});
