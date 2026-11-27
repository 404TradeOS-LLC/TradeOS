import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

// Regression coverage for Fluid PR-2 (PR #1149) Codex findings: the proxy
// serves allowlisted GETs with `private, max-age`, and a TanStack
// invalidation cannot clear the browser HTTP cache. Post-mutation
// refreshes must therefore bypass that cache, and switching assemblies
// must not leave the pagination button permanently disabled.

test("post-mutation estimate refreshes bypass the browser HTTP cache", async () => {
  const builder = await readSource("./builder.tsx");
  const assist = await readSource(
    "../../../../../../components/estimate-assist/ai-estimate-assist.tsx",
  );

  // The shared refresh helper fetches with `cache: "no-store"` and writes
  // the result into the query cache directly.
  assert.match(
    builder,
    /async function refreshEstimateQuery\(queryClient: QueryClient, estimateId: string\) \{/,
  );
  assert.match(
    builder,
    /clientFetch<EstimateDetail>\(`\/estimates\/\$\{estimateId\}`, \{ cache: "no-store" \}\)/,
  );
  assert.match(builder, /queryClient\.setQueryData\(\["estimate", estimateId\], fresh\)/);

  // invalidate() refreshes through that helper on both paths (priced and
  // unpriced), never through a plain invalidation that would refetch the
  // HTTP-cached pre-mutation response.
  assert.match(builder, /const refetch = refreshEstimateQuery\(queryClient, estimateId\);/);
  assert.match(builder, /void refreshEstimateQuery\(queryClient, estimateId\)\.catch\(\(\) => undefined\);/);
  assert.doesNotMatch(builder, /invalidateQueries\(\{ queryKey: estimateKey \}\)/);
  assert.doesNotMatch(builder, /invalidateQueries\(\{ queryKey: \["estimate", estimateId\] \}\)/);

  // The review-checklist save uses the same bypass (it mutates the
  // estimate too): the fire-and-forget refresh appears once in
  // invalidate() and once in saveReview's onSuccess.
  assert.equal(
    builder.match(/void refreshEstimateQuery\(queryClient, estimateId\)\.catch\(\(\) => undefined\);/g)?.length,
    2,
    "invalidate() fallback path + ReviewReadinessChecklist saveReview",
  );

  // The AI-apply verification read happens after a write, so it must also
  // bypass the cache — verifying against the pre-apply response would
  // falsely report the apply as unverified. The fetch takes the full
  // EstimateDetail (a narrow identity type would corrupt the builder's
  // cache) and writes it into ["estimate", estimateId], so reopening the
  // builder within its 30 s staleTime shows the applied lines.
  assert.match(
    assist,
    /clientFetch<EstimateDetail>\(`\/estimates\/\$\{estimateId\}`, \{ cache: "no-store" \}\)/,
  );
  assert.match(assist, /queryClient\.setQueryData\(\["estimate", estimateId\], estimate\)/);
});

test("assembly selection resets pagination loading state", async () => {
  const catalog = await readSource(
    "../../../../../../components/costbook/assembly-catalog.tsx",
  );

  // Switching assemblies while a "Load more" request is in flight must
  // clear the flag: the in-flight request's completion guard skips
  // clearing it once the selection has moved.
  const selectAssembly = catalog.match(/function selectAssembly\(id: string\) \{[^}]*\}/s);
  assert.ok(selectAssembly, "selectAssembly exists");
  assert.match(selectAssembly[0], /setLoadingMore\(false\)/);
});

test("post-mutation assembly unit-cost refreshes bypass the browser HTTP cache", async () => {
  const catalog = await readSource(
    "../../../../../../components/costbook/assembly-catalog.tsx",
  );

  // The unit-cost GET is allowlisted at 60 s, so the post-save refetch
  // must bypass the HTTP cache the same way the estimate refresh does.
  assert.match(
    catalog,
    /clientFetch<AssemblyCost>\(`\/costbook\/assemblies\/\$\{requestAssemblyId\}\/unit-cost`, \{ cache: "no-store" \}\)/,
  );
  assert.match(
    catalog,
    /queryClient\.setQueryData\(\["assembly-unit-cost", requestAssemblyId\], fresh\)/,
  );
  assert.doesNotMatch(catalog, /invalidateQueries\(\{ queryKey: \["assembly-unit-cost"/);
});

test("post-mutation refreshes apply only when still the latest request", async () => {
  const builder = await readSource("./builder.tsx");
  const catalog = await readSource(
    "../../../../../../components/costbook/assembly-catalog.tsx",
  );

  // Saves are not serialized, and cancelQueries cannot cancel the direct
  // clientFetch: without an ordering check an older response landing last
  // would overwrite the newer total (or unit cost).
  assert.match(builder, /const estimateRefreshSequences = new Map<string, number>\(\);/);
  assert.match(
    builder,
    /const sequence = \(estimateRefreshSequences\.get\(estimateId\) \?\? 0\) \+ 1;/,
  );
  assert.match(builder, /if \(estimateRefreshSequences\.get\(estimateId\) !== sequence\) return;/);
  assert.match(catalog, /const unitCostRefreshSequences = new Map<string, number>\(\);/);
  assert.match(
    catalog,
    /const sequence = \(unitCostRefreshSequences\.get\(requestAssemblyId\) \?\? 0\) \+ 1;/,
  );
  assert.match(catalog, /if \(unitCostRefreshSequences\.get\(requestAssemblyId\) !== sequence\) return;/);
});

test("brand-studio preview refetch after save bypasses the browser HTTP cache", async () => {
  const brandStudioConsole = await readSource(
    "../../../../../../components/brand-studio/brand-studio-console.tsx",
  );

  // The preview GET is allowlisted at 300 s; saveAll must refetch it
  // no-store or a save renders the pre-save preview for five minutes.
  assert.match(
    brandStudioConsole,
    /clientFetch<BrandStudioSettingsBundle\["preview"\]>\("\/brand-studio\/preview", \{ cache: "no-store" \}\)/,
  );
});
