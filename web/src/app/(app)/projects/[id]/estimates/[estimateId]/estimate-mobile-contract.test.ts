import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("estimate editing stays visible when the mobile workflow hides at lg", async () => {
  const builder = await readSource("./builder.tsx");
  const desktopClass = builder.match(/<div className="([^"]+)"[^>]*>\s*<div className="space-y-5">/)?.[1];

  assert.ok(desktopClass, "desktop editing workspace must exist");
  assert.match(builder, /<section className="space-y-4 lg:hidden" aria-label="Mobile estimate workflow"/);
  assert.ok(desktopClass.split(/\s+/).includes("lg:grid"), "desktop editing must become visible at the same lg breakpoint");
  assert.ok(!desktopClass.split(/\s+/).includes("grid"), "desktop editing must remain hidden below lg");
});

test("mobile estimate keeps the canonical four-stage workflow", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /type MobileEstimateStage = "scope" \| "items" \| "price" \| "review"/);
  assert.match(builder, /label: "Scope"/);
  assert.match(builder, /label: "Items"/);
  assert.match(builder, /label: "Price"/);
  assert.match(builder, /label: "Review"/);
  assert.match(builder, /Continue to items/);
  assert.match(builder, /Continue to price/);
  assert.match(builder, /Continue to review/);
  assert.match(builder, /safe-area-inset-bottom/);
});

test("estimate Scope persists through the existing partial Project update contract", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /projects\/.*projectId/);
  assert.match(builder, /method: "PATCH"/);
  assert.match(builder, /simpleScope: scopeDraft\.trim\(\)/);
  assert.match(builder, /const \[persistedScope, setPersistedScope\] = useState\(simpleScope \?\? ""\)/);
  assert.match(builder, /onSuccess: \(\) => setPersistedScope\(scopeDraft\.trim\(\)\)/);
  assert.match(builder, /await saveScope\.mutateAsync\(\)/);
  assert.match(builder, /scopeDirty=\{scopeDraft\.trim\(\) !== persistedScope\.trim\(\)\}/);
  assert.match(builder, /mobileStage === "scope" && isDraft && scopeDirty/);
  assert.match(builder, /const saved = await onSaveScope\(\);[\s\S]*if \(!saved\) return;[\s\S]*onStageChange\(stage\)/);
  assert.match(builder, /aria-label="Estimate scope"/);
  assert.match(builder, /Save scope/);
  assert.match(builder, /scopeOfWork=\{simpleScope\}/);
  assert.match(builder, /Nothing is added automatically; open Athena review for deeper scope analysis\./);
  assert.doesNotMatch(builder, /one-question clarification loop is not yet a production capability/i);
});

test("mobile Items reuse the authoritative edit and delete path while exposing only persisted source identity", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /costItemId: string \| null/);
  assert.match(builder, /assemblyId: string \| null/);
  assert.match(builder, /mobileStage === "items"/);
  assert.match(builder, /<EditableLineItem/);
  assert.match(builder, /onRemove=\{\(\) => onRemoveLineItem\(lineItem\.id\)\}/);
  assert.match(builder, /line-items\/\$\{lineItem\.id\}/);
  assert.match(builder, /method: "PATCH"/);
  assert.match(builder, /method: "DELETE"/);
  assert.match(builder, /Assembly source/);
  assert.match(builder, /Costbook source/);
  assert.match(builder, /Custom item/);
});

test("embedded assembly picker previews installed assemblies and gates unmapped starters", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /\/assemblies\/starter-catalog/);
  assert.match(builder, /kind: "costItem" \| "assembly" \| "starterAssembly"/);
  assert.match(builder, /\/assemblies\/\$\{selectedAssemblyId\}\/unit-cost/);
  assert.match(builder, /\/assemblies\/\$\{selectedAssemblyId\}\/items\?limit=6&sort=sortOrder&order=asc/);
  assert.match(builder, /Current Costbook recipe\. Estimate Engine captures the pricing snapshot and assembly source when you explicitly add it\./);
  assert.match(builder, /Estimated job cost for/);
  assert.match(builder, /Provenance: organization Costbook assembly \+ live component pricing/);
  assert.match(builder, /Setup required before this assembly can be priced or added\./);
  assert.match(builder, /Map each starter recipe slot to an active Costbook item/);
  assert.match(builder, /TradeOS will not invent those mappings or a price/);
  assert.match(builder, /\[item\.kind === "costItem" \? "costItemId" : "assemblyId"\]/);
  assert.match(builder, /onSuccess: \(\) => \{[\s\S]*onAdded\(\)/);
});

test("Athena stays review-first and Review preserves finalize-before-proposal lifecycle", async () => {
  const builder = await readSource("./builder.tsx");
  const assistPage = await readSource("./assist/page.tsx");
  const assist = await readSource("../../../../../../components/estimate-assist/ai-estimate-assist.tsx");

  assert.match(builder, /Athena review/);
  assert.match(assistPage, /Athena Estimate Review/);
  assert.doesNotMatch(assistPage, />AI Estimate Assist</);
  assert.doesNotMatch(assist, /AI Estimate Assist/);
  assert.match(assist, /Athena review pipeline/);
  assert.match(builder, /Finalizing locks this reviewed estimate version\. The next step is creating the customer proposal\./);
  assert.match(builder, /Finalize estimate/);
  assert.match(builder, /Create proposal/);
  assert.doesNotMatch(builder, />Send proposal</);
});
