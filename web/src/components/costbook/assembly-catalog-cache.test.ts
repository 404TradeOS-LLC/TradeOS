import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// TanStack Query migration (Fluid plan Lever 2, change 2.3) + conservative
// staleTime raises (change 2.4). Components cannot be rendered under plain
// node:test (no jsdom in this repo's suite), so — like the other
// *-contract.test.ts files — these tests pin the query wiring in source:
// keys, staleTimes, invalidation after mutations, and the absence of the
// old uncached useEffect reads.

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("assembly detail reads use cached queries instead of the mount effect", async () => {
  const source = await readSource("./assembly-catalog.tsx");

  assert.match(source, /import \{ useQuery, useQueryClient \} from "@tanstack\/react-query"/);
  assert.match(source, /queryKey: \["assembly-items", selectedId\]/);
  assert.match(source, /queryKey: \["assembly-unit-cost", selectedId\]/);
  // The items page must not refetch on mount: "Load more" appends pages
  // into the cached page-1 payload, and a background refetch would
  // replace those appended pages with page 1 alone.
  const itemsQuery = source.slice(source.indexOf('queryKey: ["assembly-items"'));
  assert.match(itemsQuery, /staleTime: 60_000,\n    refetchOnMount: false,/);
  assert.match(source, /const unitCost = unitCostQuery\.data\?\.unitCost \?\? null;/);
  // The old effect (Promise.all items + unit-cost on every selection) is gone.
  assert.doesNotMatch(source, /Promise\.all\(\[\n\s+clientFetch<AssemblyItemsPage>/);
  assert.doesNotMatch(source, /setItems\(rows\.items\)/);
  assert.doesNotMatch(source, /setUnitCost\(cost\.unitCost\)/);
});

test("assembly mutations update the query cache instead of refetching by hand", async () => {
  const source = await readSource("./assembly-catalog.tsx");

  // Load-more appends into the cached page; add/remove patch the cached
  // page (or refetch it when nothing is cached yet); all three refresh
  // the unit cost through refreshSelectedUnitCost, which fetches with
  // `cache: "no-store"` and writes the result into the query cache — a
  // plain invalidation would refetch the allowlisted (60 s) GET from the
  // browser HTTP cache and return the pre-save cost.
  assert.match(source, /queryClient\.setQueryData<AssemblyItemsPage>\(\["assembly-items", requestAssemblyId\]/);
  assert.match(source, /refreshSelectedUnitCost\(requestAssemblyId\)/);
  assert.match(source, /queryClient\.invalidateQueries\(\{ queryKey: \["assembly-items", requestAssemblyId\] \}\)/);
  assert.match(source, /async function refreshSelectedUnitCost\(requestAssemblyId: string\) \{\n    await queryClient\.cancelQueries\(\{ queryKey: \["assembly-unit-cost", requestAssemblyId\], exact: true \}\);/);
  assert.match(source, /clientFetch<AssemblyCost>\(`\/costbook\/assemblies\/\$\{requestAssemblyId\}\/unit-cost`, \{ cache: "no-store" \}\)/);
  assert.match(source, /queryClient\.setQueryData\(\["assembly-unit-cost", requestAssemblyId\], fresh\)/);
  assert.doesNotMatch(source, /invalidateQueries\(\{ queryKey: \["assembly-unit-cost"/);
  assert.doesNotMatch(source, /setItems\(\(current\)/);
  assert.doesNotMatch(source, /setItemsTotal\(/);
  assert.doesNotMatch(source, /setUnitCost\(null\)/);
});

test("starter catalog, cost preview, and reuse sources use cached queries", async () => {
  const source = await readSource("./assembly-catalog.tsx");

  assert.match(source, /queryKey: \["starter-catalog"\],\n    queryFn: \(\) =>\n      clientFetch<\{ catalogVersion/);
  assert.match(source, /staleTime: 5 \* 60_000,\n  \}\);/);
  assert.match(source, /queryKey: \["assembly-catalog-cost-preview", selected\?\.id \?\? "", \.\.\.mappedIds\]/);
  // Distinct from the builder's ["starter-assembly-cost-preview", ...]
  // key: the payload shape differs (a per-item record here, a resolved
  // total there) — sharing the key would serve one shape to the other.
  assert.doesNotMatch(source, /queryKey: \["starter-assembly-cost-preview"/);
  assert.match(source, /queryKey: \["starter-reuse-sources", reuseRefreshKey\]/);
  // First recipe is still selected once on load; a later explicit clear
  // (filter reset) must not re-select it.
  assert.match(source, /initialSelectionAppliedRef/);
  assert.doesNotMatch(source, /setTemplates\(result\.items\)/);
  assert.doesNotMatch(source, /setReuseSources\(items\)/);
});

test("cost-item search picker uses a cached query keyed by picker kind", async () => {
  const source = await readSource("./assembly-catalog.tsx");

  assert.match(source, /queryKey: \["item-search", "cost-item-picker", debouncedQuery\]/);
  assert.match(source, /enabled: open,\n    staleTime: 5 \* 60_000,/);
  // The key segment differs from the builder's catalogKind values, so the
  // picker's CostItemCatalogRecord[] never collides with the builder's
  // { items: PickerResult[] } payload.
  assert.doesNotMatch(source, /queryKey: \["item-search", catalogKind, debouncedQuery\]/);
  assert.doesNotMatch(source, /setOptions\(items\)/);
});

test("app-nav dispatch badge uses an org-keyed cached query, not an uncached mount fetch", async () => {
  const source = await readSource("../shared/app-nav.tsx");

  // AppNav sits outside the tenant provider, so its QueryClient is the
  // root one that survives workspace switches: the key must carry orgId.
  assert.match(source, /queryKey: \["dispatch-summary-attention", currentOrgId \?\? "unknown"\]/);
  assert.match(source, /staleTime: 30_000,/);
  assert.doesNotMatch(source, /clientFetch<\{ needsAttention\?: unknown \}>\("\/api\/v1\/jobs\/dispatch-summary", \{\n      signal: controller\.signal,\n      cache: "no-store",/);
  assert.doesNotMatch(source, /setClientDispatchAttentionCount\(/);
  // The one-shot Athena capability retry is untouched: it is a bounded
  // retry after a failed server lookup, not a repeated read.
  assert.match(source, /athenaCapabilityRetryKey/);
});

test("conservative staleTime raises (plan 2.4) leave the other windows alone", async () => {
  const hints = await readSource("../estimate/estimate-codes-hints.tsx");
  const builder = await readSource(
    "../../app/(app)/projects/[id]/estimates/[estimateId]/builder.tsx",
  );

  assert.match(hints, /staleTime: 60_000,/);
  assert.doesNotMatch(hints, /staleTime: 30_000,/);
  assert.match(builder, /staleTime: 30_000,\n  \}\);/);
  assert.doesNotMatch(builder, /staleTime: 15_000,/);
  // Item search stays at 5 min and previews at 60 s.
  assert.match(builder, /queryKey: \["item-search", catalogKind, debouncedQuery\]/);
  assert.match(builder, /staleTime: 5 \* 60_000,/);
  assert.match(builder, /queryKey: \["cost-item-preview", selectedCostItemId\]/);
  assert.match(builder, /staleTime: 60_000,/);
});
