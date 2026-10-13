import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import vm from "node:vm";
import ts from "typescript";

async function readSource(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("web Material DTO accepts the nullable classification fields from the merged backend", async () => {
  const api = await readSource("../../../../lib/api.ts");

  const contractStart = api.indexOf("export interface CostbookMaterial {");
  const contractEnd = api.indexOf("export interface CostbookMaterialInput {");
  assert.ok(contractStart >= 0 && contractEnd > contractStart, "Material contract markers not found");
  const materialContract = api.slice(contractStart, contractEnd);

  assert.match(materialContract, /omniclass23\?: string \| null/);
  assert.match(materialContract, /unspsc\?: string \| null/);
});

test("Material catalog surfaces read-only classification on desktop and mobile", async () => {
  const source = await readSource("../../../../components/costbook/materials-catalog.tsx");

  assert.match(source, /<th scope="col" className="px-4 py-3 font-medium">Classification<\/th>/);
  assert.equal((source.match(/<MaterialClassification/g) ?? []).length, 2);
  assert.equal((source.match(/unspsc=\{material\.unspsc\}/g) ?? []).length, 2);
  assert.equal((source.match(/omniclass23=\{material\.omniclass23\}/g) ?? []).length, 2);
  assert.match(source, /supplierName=\{material\.supplierName\}/);
  assert.match(source, /lastPriceUpdate=\{material\.lastPriceUpdate\}/);

  const payloadStart = source.indexOf("function toPayload(");
  const payloadEnd = source.indexOf("function formatCurrency(", payloadStart);
  assert.ok(payloadStart >= 0 && payloadEnd > payloadStart, "Material payload markers not found");
  const payload = source.slice(payloadStart, payloadEnd);
  assert.doesNotMatch(payload, /unspsc|omniclass23/);
});

test("classification UI never converts a code into a verification or price claim", async () => {
  const source = await readSource("../../../../components/costbook/material-classification.tsx");

  assert.match(source, /unspsc\?\.trim\(\) \|\| null/);
  assert.match(source, /omniclass23\?\.trim\(\) \|\| null/);
  assert.match(source, /data-material-classification=\{classificationStatus\}/);
  assert.match(source, /unspsc === undefined \|\| omniclass23 === undefined/);
  assert.match(source, /\? "unavailable"/);
  assert.match(source, /Classification unavailable/);
  assert.match(source, /Classification fields were not provided by the API/);
  assert.match(source, /Classification unmapped/);
  assert.match(source, /No classification codes recorded/);
  assert.match(source, /UNSPSC/);
  assert.match(source, /OmniClass 23/);
  assert.match(source, /A code does not verify supplier identity, unit compatibility, or pricing/);
  assert.doesNotMatch(source, /clientFetch|fetch\(|unitCost\s*=|confidenceScore/);
});

test("classification status is rendered correctly for recorded, null, blank and omitted fields", async () => {
  // This repo runs node --test on .test.ts files; TSX is not directly loaded by
  // that runner. Compile only this side-effect-free component and render it with
  // the already-installed React server renderer.
  const source = await readSource("../../../../components/costbook/material-classification.tsx");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const runtimeExports: Record<string, unknown> = {};
  vm.runInNewContext(compiled, {
    exports: runtimeExports,
    require(specifier: string) {
      assert.equal(specifier, "react/jsx-runtime");
      return jsxRuntime;
    },
  });

  type ClassificationProps = {
    unspsc?: string | null;
    omniclass23?: string | null;
    compact?: boolean;
  };
  const Component = runtimeExports.MaterialClassification as
    (props: ClassificationProps) => ReturnType<typeof createElement>;
  assert.equal(typeof Component, "function");

  const render = (props: ClassificationProps) =>
    renderToStaticMarkup(createElement(Component, props));

  const both = render({ unspsc: "30103605", omniclass23: "23-01-00" });
  assert.match(both, /data-material-classification="recorded"/);
  assert.match(both, /Classification codes recorded/);
  assert.match(both, /30103605/);
  assert.match(both, /23-01-00/);
  assert.match(both, /A code does not verify supplier identity, unit compatibility, or pricing/);

  const partial = render({ unspsc: "30103605" });
  assert.match(partial, /data-material-classification="recorded"/);
  assert.match(partial, /30103605/);
  assert.match(partial, /OmniClass 23/);
  assert.match(partial, /Unavailable/);
  assert.doesNotMatch(partial, /Classification unmapped/);

  const absent = render({ unspsc: null, omniclass23: null });
  assert.match(absent, /data-material-classification="unmapped"/);
  assert.match(absent, /Classification unmapped/);
  assert.match(absent, /No classification codes recorded/);
  assert.doesNotMatch(absent, /Classification unavailable/);

  const blank = render({ unspsc: " ", omniclass23: "" });
  assert.match(blank, /data-material-classification="unmapped"/);
  assert.match(blank, /No classification codes recorded/);

  const omitted = render({});
  assert.match(omitted, /data-material-classification="unavailable"/);
  assert.match(omitted, /Classification unavailable/);
  assert.match(omitted, /Classification fields were not provided by the API/);
  assert.doesNotMatch(omitted, /Classification unmapped/);

  for (const props of [
    { unspsc: undefined, omniclass23: null },
    { unspsc: null, omniclass23: undefined },
  ]) {
    const markup = render(props);
    assert.match(markup, /data-material-classification="unavailable"/);
    assert.doesNotMatch(markup, /Classification unmapped/);
  }

  const compact = render({ unspsc: "30103605", omniclass23: null, compact: true });
  assert.match(compact, /data-material-classification="recorded"/);
  assert.doesNotMatch(compact, /A code does not verify supplier identity/);
});
