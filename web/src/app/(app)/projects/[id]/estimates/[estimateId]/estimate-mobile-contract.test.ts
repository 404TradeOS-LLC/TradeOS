import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("estimate uses one responsive workflow without a duplicate desktop editor", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /<section className="space-y-4" aria-label="Estimate workflow"/);
  assert.match(builder, /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(280px,0.42fr\)\]/);
  assert.equal((builder.match(/<EstimateScopeEditor/g) ?? []).length, 1);
  assert.equal((builder.match(/<LineItemPicker/g) ?? []).length, 1);
  for (const stage of ["scope", "items", "price", "review"]) {
    assert.ok(builder.includes(`hidden={activeStage !== "${stage}"}`), "inactive forms retain unsaved state without exposing controls");
  }
  assert.match(builder, /if \(!active\) return;/);
});

test("mobile estimate keeps the canonical four-stage workflow", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /type EstimateStage = "scope" \| "items" \| "price" \| "review"/);
  assert.match(builder, /label: "Scope"/);
  assert.match(builder, /label: "Items"/);
  assert.match(builder, /label: "Price"/);
  assert.match(builder, /label: "Review"/);
  assert.match(builder, /Continue to items/);
  assert.match(builder, /Continue to price/);
  assert.match(builder, /Continue to review/);
  assert.match(builder, /safe-area-inset-bottom/);
});


test("mobile stages expose native sequential step navigation instead of an incomplete tab widget", async () => {
  const builder = await readSource("./builder.tsx");
  const navigation = builder.slice(
    builder.indexOf('<nav aria-label="Estimate stages">'),
    builder.indexOf('<div hidden={activeStage !== "scope"}')
  );
  assert.ok(navigation.startsWith('<nav aria-label="Estimate stages">'), "stage navigation must be present");
  assert.match(navigation, /<ol className="grid grid-cols-4/);
  assert.match(navigation, /<li key=\{stage.id\} className="min-w-0">/);
  assert.match(navigation, /type="button"/);
  assert.match(navigation, /aria-current=\{activeStage === stage.id \? "step" : undefined\}/);
  assert.match(navigation, /<span className="sr-only">Step \{index \+ 1\} of \{stages.length\}: <\/span>/);
  assert.match(navigation, /focus-visible:outline/);
  assert.doesNotMatch(navigation, /role="tablist"|role="tab"|aria-selected=/);
  // Native buttons support Tab focus and Enter/Space activation; unlike ARIA tabs
  // they do not promise roving focus or ArrowLeft/ArrowRight handling.
});

test("stage navigation preserves fail-closed asynchronous scope-save transitions", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /if \(stage === activeStage \|\| scopeSavePending\) return;/);
  assert.match(builder, /if \(activeStage === "scope" && isDraft && scopeDirty\)/);
  assert.match(builder, /const saved = await onSaveScope\(\);\s*if \(!saved\) return;\s*\}\s*focusOnStageChange\.current = true;\s*onStageChange\(stage\);/);
  assert.match(builder, /if \(!focusOnStageChange\.current\) return;/);
  assert.match(builder, /stageHeadingRefs\.current\[activeStage\]\?\.focus\(\)/);
  assert.match(builder, /tabIndex=\{-1\}/);
  assert.match(builder, /onClick=\{\(\) => void goToStage\(stage.id\)\}/);
  assert.match(builder, /disabled=\{scopeSavePending && activeStage === "scope" && stage.id !== "scope"\}/);
  assert.match(builder, /min-h-11 w-full/);
  assert.match(builder, /<section className="space-y-4" aria-label="Estimate workflow">/);
});

test("estimate Scope persists through the existing partial Project update contract", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /projects\/.*projectId/);
  assert.match(builder, /method: "PATCH"/);
  assert.match(builder, /simpleScope: scope/);
  assert.match(builder, /const \[persistedScope, setPersistedScope\] = useState\(simpleScope \?\? ""\)/);
  assert.match(builder, /onSuccess: \(_data, savedScope\) => setPersistedScope\(savedScope\)/);
  assert.match(builder, /await saveScope\.mutateAsync\(scopeDraft\.trim\(\)\)/);
  assert.match(builder, /scopeDirty=\{scopeDraft\.trim\(\) !== persistedScope\.trim\(\)\}/);
  assert.match(builder, /activeStage === "scope" && isDraft && scopeDirty/);
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
  assert.match(builder, /activeStage !== "items"/);
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
  assert.match(builder, /Source: organization Costbook assembly with current resolved component costs, not a live supplier quote/);
  assert.match(builder, /Setup required before this assembly can be priced or added\./);
  assert.match(builder, /Map each starter recipe slot to an active, compatible Costbook item/);
  assert.match(builder, /TradeOS will not invent those mappings or a price/);
  assert.match(builder, /\[item\.kind === "costItem" \? "costItemId" : "assemblyId"\]/);
  assert.match(builder, /onSuccess: \(\) => \{[\s\S]*onAdded\(\)/);
});

test("starter assembly setup stays inline and requires install before estimate add", async () => {
  const builder = await readSource("./builder.tsx");

  assert.match(builder, /assessCostItemMapping/);
  assert.match(builder, /StarterAssemblySetup/);
  assert.match(builder, /StarterComponentMappingPicker/);
  assert.match(builder, /\/costbook\/cost-items\/search\?q=/);
  assert.match(builder, /\/costbook\/cost-items\/\$\{item\.id\}\/unit-cost/);
  assert.match(builder, /\/assemblies\/starter-catalog\/install/);
  assert.match(builder, /componentMappings: template\.components\.map/);
  assert.match(builder, /Use a different Costbook item for each recipe slot/);
  assert.match(builder, /Installation creates the tenant assembly only\. Review its resolved cost, then use the separate Add action to write the estimate line\./);
  assert.match(builder, /onInstalled=\{\(assembly\) => \{[\s\S]*setSelected\(\{ \.\.\.assembly, kind: "assembly" \}\)/);
  assert.match(builder, /disabled=\{!canAddReviewedLine\}/);
  assert.match(builder, /disabled=\{install\.isPending \|\| !mappingComplete \|\| duplicateMapping \|\| Boolean\(incompatibleComponent\) \|\| !previewReady\}/);
  assert.match(builder, /const resultsId = useId\(\)/);
  assert.doesNotMatch(builder, /Math\.random\(\)/);
});

test("Costbook picker selects on Enter, never inserts an unreviewed search highlight", async () => {
  const builder = await readSource("./builder.tsx");
  const search = builder.slice(builder.indexOf('id="item-search"'), builder.indexOf('<Label htmlFor="costbook-section">'));
  assert.match(search, /setSelected\(activeResult\)/);
  assert.doesNotMatch(search, /commitLineItem\(/);
  assert.match(builder, /const target = item \?\? selected;/);
  assert.match(builder, /disabled=\{!canAddReviewedLine\}/);
  assert.match(builder, /onClick=\{\(\) => commitLineItem\(\)\}/);
  assert.match(builder, /Review the selected item's current Costbook cost before adding/);
});

test("selected Costbook items resolve source cost for review before a persisted Add", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /\/costbook\/cost-items\/\$\{selectedCostItemId\}\/unit-cost/);
  assert.match(builder, /costItemPreview\.totalUnitCost/);
  assert.match(builder, /canAddReviewedEstimateCatalogItem/);
  assert.match(builder, /stored Costbook cost, not a live supplier quote/);
  assert.match(builder, /const previewReady = !preview\.isLoading && !preview\.isFetching && !preview\.isError/);
  assert.match(builder, /if \(!previewReady\) throw new Error/);
});


test("Price groups only persisted line costs and keeps customer sell total separate", async () => {
  const builder = await readSource("./builder.tsx");
  assert.equal(builder.split("<EstimateDirectCostBreakdown lineItems={estimate.lineItems} />").length - 1, 1);
  assert.match(builder, /aria-label="Internal direct cost breakdown"/);
  assert.match(builder, /groupSavedDirectCosts\(lineItems\)/);
  assert.match(builder, /excluding markup, overhead and tax\. Not a customer proposal/);
  assert.match(builder, /formatCurrency\(runningTotals\.totalPrice\)/);
  assert.match(builder, /Internal estimate review/);
  assert.doesNotMatch(builder, /Customer-facing review/);
});

test("failed finalization preserves the saved estimate and offers a retry without inventing success", async () => {
  const builder = await readSource("./builder.tsx");
  assert.match(builder, /method: "POST"/);
  assert.match(builder, /\/estimates\/\$\{estimateId\}\/finalize/);
  assert.match(builder, /finalizeError=\{finalize\.isError/);
  assert.match(builder, /finalizeError: string \| null/);
  assert.match(builder, /EstimateFinalizationError message=\{finalizeError\}/);
  assert.match(builder, /Finalization failed\. \{message\}/);
  assert.match(builder, /ref=\{noticeRef\}/);
  assert.match(builder, /notice\.focus\(\{ preventScroll: true \}\)/);
  assert.match(builder, /notice\.scrollIntoView\(\{ block: "center", behavior: "instant" \}\)/);
  assert.match(builder, /getClientRects\(\)\.length === 0/);
  assert.match(builder, /tabIndex=\{-1\}/);
  assert.match(builder, /finalize\.error instanceof Error/);
  assert.match(builder, /Retry finalization/);
  assert.match(builder, /Your saved draft remains available/);
  assert.match(builder, /role="alert"/);
});

test("proposal handoff follows backend-finalized state and does not send on review", async () => {
  const builder = await readSource("./builder.tsx");
  const proposalForm = await readSource("../../proposals/new/form.tsx");
  assert.match(builder, /isDraft \? \(/);
  assert.match(builder, /Finalizing locks this reviewed estimate version/);
  assert.match(builder, /Nothing is sent to the customer by finalizing/);
  assert.match(builder, /Review proposal draft/);
  assert.match(builder, /proposals\/new\?estimateId=/);
  assert.match(proposalForm, /state\?\.error/);
  assert.match(proposalForm, /isPending \? "Creating…" : "Create proposal"/);
});
test("Athena stays review-first and Review preserves finalize-before-proposal lifecycle", async () => {
  const builder = await readSource("./builder.tsx");
  const assistPage = await readSource("./assist/page.tsx");
  const assist = await readSource("../../../../../../components/estimate-assist/ai-estimate-assist.tsx");
  const contextualAthena = await readSource("../../../../../../components/estimate-assist/contextual-athena-panel.tsx");

  assert.match(builder, /Athena review/);
  assert.match(assistPage, /Athena Estimate Review/);
  assert.doesNotMatch(assistPage, />AI Estimate Assist</);
  assert.doesNotMatch(assist, /AI Estimate Assist/);
  assert.match(assist, /Athena review pipeline/);
  assert.match(builder, /Finalizing locks this reviewed estimate version\. The next step is creating the customer proposal\./);
  assert.match(builder, /Finalize estimate/);
  assert.match(builder, /Create proposal/);
  assert.doesNotMatch(builder, />Send proposal</);
  const contextualPanelBlocks = builder.split("<ContextualAthenaPanel").slice(1).map((block) => block.slice(0, 420));
  assert.equal(contextualPanelBlocks.length, 1);
  assert.ok(contextualPanelBlocks.every((block) => block.includes("isDraft={isDraft}")));
  assert.ok(contextualAthena.includes("isDraft: boolean"));
  assert.ok(contextualAthena.includes("isDraft && suggestion.resolution.target"));
});


test("desktop and mobile share a labeled scope editor with retained failure input", async () => {
  const builder = await readSource("./builder.tsx");
  assert.equal((builder.match(/<EstimateScopeEditor/g) ?? []).length, 1);
  assert.match(builder, /value=\{simpleScope\}[\s\S]*onChange=\{onScopeChange\}/);
  assert.match(builder, /htmlFor=\{inputId\}/);
  assert.match(builder, /aria-busy=\{pending\}/);
  assert.match(builder, /Your scope is still in the editor/);
  assert.match(builder, /Item removal was not confirmed/);
});
