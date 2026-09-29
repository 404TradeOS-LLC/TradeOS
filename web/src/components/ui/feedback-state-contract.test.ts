import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("shared feedback taxonomy encodes the canonical eight product state types", async () => {
  const source = await readSource("./feedback-state.tsx");

  for (const state of [
    "loading",
    "empty",
    "filtered-empty",
    "partial",
    "restricted",
    "not-found",
    "mutation-failure",
    "unknown",
  ]) {
    assert.match(source, new RegExp('"' + state + '"'));
  }
  assert.match(source, /export const TRADEOS_STATE_TAXONOMY/);
});

test("FeedbackState distinguishes urgent recovery from calm boundary states", async () => {
  const source = await readSource("./feedback-state.tsx");

  assert.match(source, /const isUrgent = kind === "error" \|\| kind === "mutation-failure"/);
  assert.match(source, /role=\{isUrgent \? "alert" : "status"\}/);
  assert.match(source, /aria-live=\{isUrgent \? "assertive" : "polite"\}/);
  assert.match(source, /data-state-kind=\{kind\}/);
});

test("filtered empty is a distinct state instead of a genuine EmptyState", async () => {
  const source = await readSource("./feedback-state.tsx");
  const catalog = await readSource("../costbook/materials-catalog.tsx");
  const page = await readSource("../../app/(app)/costbook/materials/page.tsx");

  assert.match(source, /data-state-kind="filtered-empty"/);
  assert.match(source, /Filters active/);
  assert.match(catalog, /isFiltered \? \(/);
  assert.match(catalog, /<FilteredEmptyState/);
  assert.match(catalog, /No materials match these filters/);
  assert.match(catalog, /Clear filters/);
  assert.match(catalog, /<EmptyState\s+title="No materials yet"/);
  assert.match(page, /isFiltered=\{Boolean\(query\.q \|\| query\.active \|\| query\.supplierId\)\}/);
});

test("Material load failure is recovery state and does not masquerade as empty data", async () => {
  const page = await readSource("../../app/(app)/costbook/materials/page.tsx");

  assert.match(page, /<FeedbackState\s+kind="error"/);
  assert.match(page, /No Costbook data was changed/);
  assert.match(page, /Try again/);
  assert.match(page, /Back to Costbook/);
  assert.doesNotMatch(page, /<EmptyState title="Couldn't load materials"/);
});

test("Costbook import separates access verification failure from restricted permission", async () => {
  const page = await readSource("../../app/(app)/costbook/import/page.tsx");

  assert.match(page, /kind="error"\s+title="Couldn't verify Costbook import access"/);
  assert.match(page, /kind="restricted"\s+title="Costbook import is restricted"/);
  assert.match(page, /No import was started and no Costbook data was changed/);
  assert.match(page, /production benchmark imports require Costbook manager permission/);
  assert.doesNotMatch(page, /description=\{accessError\}/);
  assert.doesNotMatch(page, /<EmptyState/);
});
