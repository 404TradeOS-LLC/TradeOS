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
  // falsely report the apply as unverified.
  assert.match(
    assist,
    /clientFetch<EstimateDetailForVerification>\(`\/estimates\/\$\{estimateId\}`, \{ cache: "no-store" \}\)/,
  );
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
