import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..", "..");
const read = (relative: string) => readFileSync(join(webRoot, relative), "utf8");

const GETTERS: Array<{ name: string; namespace: string }> = [
  { name: "listCostbookDivisions", namespace: "costbook-divisions" },
  { name: "listCostbookCategories", namespace: "costbook-categories" },
  { name: "listCostbookSubcategories", namespace: "costbook-subcategories" },
  { name: "listCostbookMaterials", namespace: "costbook-materials" },
  { name: "listCostbookLaborRates", namespace: "costbook-labor-rates" },
  { name: "getKnowledgeStats", namespace: "knowledge-stats" },
  { name: "getKnowledgeTrades", namespace: "knowledge-trades" },
  { name: "getBrandStudioProfile", namespace: "brand-studio-profile" },
  { name: "getBrandStudioAssets", namespace: "brand-studio-assets" },
  { name: "getBrandStudioDocumentSettings", namespace: "brand-studio-document-settings" },
  { name: "getBrandStudioPreview", namespace: "brand-studio-preview" },
];

function getterBody(api: string, name: string): string {
  const start = api.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in api.ts`);
  const nextExport = api.indexOf("\nexport function ", start + 1);
  return api.slice(start, nextExport === -1 ? undefined : nextExport);
}

describe("Data Cache wiring contract (Fluid PR-6, change 2.5)", () => {
  const api = read("src/lib/api.ts");

  for (const { name, namespace } of GETTERS) {
    it(`${name} is served through cachedDataFetch under the ${namespace} namespace with an orgId key`, () => {
      const body = getterBody(api, name);
      assert.ok(
        body.includes(`cachedDataFetch("${namespace}"`),
        `${name} must call cachedDataFetch with namespace ${namespace}`,
      );
      assert.ok(body.includes("resolveDataCacheOrgId(token)"), `${name} must resolve the orgId from the session token`);
      assert.ok(
        body.includes("if (!orgId) return apiFetch"),
        `${name} must fail closed to an uncached fetch when the token carries no org claim`,
      );
    });
  }

  it("memberships stay uncached and no getter uses next: { revalidate } fetch caching", () => {
    const body = getterBody(api, "getWorkspaceMemberships");
    assert.ok(body.includes('cache: "no-store"'), "memberships must stay no-store");
    assert.ok(!body.includes("cachedDataFetch"), "memberships must never go through the Data Cache");
    assert.ok(
      !api.includes("next: { revalidate"),
      "no getter may use fetch-level revalidate (the URL, not the org, would key it)",
    );
  });

  it("the invalidation action resolves the org from the session and uses updateTag, never a bare revalidateTag", () => {
    const action = read("src/app/actions/data-cache.ts");
    assert.ok(action.includes("updateTag"), "the action must invalidate via updateTag");
    assert.ok(!action.includes("revalidateTag("), "no revalidateTag call — use updateTag in Next 16");
    assert.ok(action.includes("resolveDataCacheOrgId"), "the action must resolve the org from the session token");
    assert.ok(action.includes("isDataCacheNamespace"), "the action must reject namespaces outside the allowlist");
    assert.ok(action.includes("if (!orgId) return;"), "no-org sessions must not invalidate any tag");
  });

  it("every costbook client mutation flow revalidates its namespaces after a successful save", () => {
    const hierarchy = read("src/components/costbook/hierarchy-catalog.tsx");
    assert.ok(hierarchy.includes('import { revalidateOrgDataCache } from "@/app/actions/data-cache";'));
    for (const ns of ["costbook-divisions", "costbook-categories", "costbook-subcategories"]) {
      assert.ok(hierarchy.includes(`refreshHierarchyCache("${ns}")`), `hierarchy must revalidate ${ns}`);
    }
    // 1 helper definition + 9 handler call sites (create/update/deactivate x 3 resources).
    assert.equal((hierarchy.match(/refreshHierarchyCache\(/g) ?? []).length, 10);

    const materials = read("src/components/costbook/materials-catalog.tsx");
    assert.ok(materials.includes('import { revalidateOrgDataCache } from "@/app/actions/data-cache";'));
    assert.ok(materials.includes('refreshMaterialsCache();'));
    // 1 helper definition + submit + deactivate.
    assert.equal((materials.match(/refreshMaterialsCache\(/g) ?? []).length, 3);

    const labor = read("src/components/costbook/labor-rates-catalog.tsx");
    assert.ok(labor.includes('import { revalidateOrgDataCache } from "@/app/actions/data-cache";'));
    assert.ok(labor.includes('refreshLaborRatesCache();'));
    // 1 helper definition + submit + deactivate.
    assert.equal((labor.match(/refreshLaborRatesCache\(/g) ?? []).length, 3);
  });

  it("every brand-studio mutation flow revalidates all four brand-studio namespaces", () => {
    const consoleSource = read("src/components/brand-studio/brand-studio-console.tsx");
    assert.ok(consoleSource.includes('import { revalidateOrgDataCache } from "@/app/actions/data-cache";'));
    // The helper revalidates the whole settings bundle: a save or an asset
    // change can affect any of the four getters.
    const helperStart = consoleSource.indexOf("function refreshBrandStudioCache()");
    assert.notEqual(helperStart, -1, "refreshBrandStudioCache helper must exist");
    const helperBody = consoleSource.slice(helperStart, consoleSource.indexOf("}", helperStart) + 1);
    for (const ns of [
      "brand-studio-profile",
      "brand-studio-assets",
      "brand-studio-document-settings",
      "brand-studio-preview",
    ]) {
      assert.ok(helperBody.includes(`"${ns}"`), `brand-studio helper must revalidate ${ns}`);
    }
    // 1 helper definition + saveAll + persistBrandAssetProfile + addAsset + deleteAsset.
    assert.equal((consoleSource.match(/refreshBrandStudioCache\(/g) ?? []).length, 5);
  });

  it("knowledge getters have no invalidation wiring — the snapshot is static per deployment", () => {
    for (const page of [
      "src/app/(app)/dashboard/knowledge-coverage/page.tsx",
      "src/app/(app)/projects/[id]/estimates/[estimateId]/assist/page.tsx",
    ]) {
      assert.ok(!read(page).includes("revalidateOrgDataCache"), `${page} must not revalidate knowledge tags`);
    }
    const action = read("src/app/actions/data-cache.ts");
    assert.ok(
      action.includes("resetKnowledgeRepositoryCache"),
      "the action must document why knowledge has no invalidation wiring",
    );
  });
});
