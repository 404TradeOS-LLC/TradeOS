import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("web Material DTO accepts the nullable classification fields from the merged backend", async () => {
  const api = await readSource("../../../lib/api.ts");

  const materialContract = api.slice(
    api.indexOf("export interface CostbookMaterial {"),
    api.indexOf("export interface CostbookMaterialInput {")
  );

  assert.match(materialContract, /omniclass23\?: string \| null/);
  assert.match(materialContract, /unspsc\?: string \| null/);
});

test("Material catalog surfaces read-only classification on desktop and mobile", async () => {
  const source = await readSource("../../../components/costbook/materials-catalog.tsx");

  assert.match(source, /<th scope="col" className="px-4 py-3 font-medium">Classification<\/th>/);
  assert.equal((source.match(/<MaterialClassification/g) ?? []).length, 2);
  assert.equal((source.match(/unspsc=\{material\.unspsc\}/g) ?? []).length, 2);
  assert.equal((source.match(/omniclass23=\{material\.omniclass23\}/g) ?? []).length, 2);
  assert.match(source, /supplierName=\{material\.supplierName\}/);
  assert.match(source, /lastPriceUpdate=\{material\.lastPriceUpdate\}/);

  const payloadStart = source.indexOf("function toPayload(");
  const payloadEnd = source.indexOf("function formatCurrency(", payloadStart);
  const payload = source.slice(payloadStart, payloadEnd);
  assert.doesNotMatch(payload, /unspsc|omniclass23/);
});

test("classification UI never converts a code into a verification or price claim", async () => {
  const source = await readSource("../../../components/costbook/material-classification.tsx");

  assert.match(source, /unspsc\?\.trim\(\) \|\| null/);
  assert.match(source, /omniclass23\?\.trim\(\) \|\| null/);
  assert.match(source, /data-material-classification=\{hasCodes \? "recorded" : "unmapped"\}/);
  assert.match(source, /No classification codes recorded/);
  assert.match(source, /UNSPSC/);
  assert.match(source, /OmniClass 23/);
  assert.match(source, /A code does not verify supplier identity, unit compatibility, or pricing/);
  assert.doesNotMatch(source, /clientFetch|fetch\(|unitCost\s*=|confidenceScore/);
});
