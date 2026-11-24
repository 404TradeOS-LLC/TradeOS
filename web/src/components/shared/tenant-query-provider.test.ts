import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const providerUrl = new URL("./tenant-query-provider.tsx", import.meta.url);

test("TenantQueryProvider creates one QueryClient per mount, never a shared singleton", async () => {
  const source = await readFile(providerUrl, "utf8");
  // A module-level client would survive workspace switches exactly like the
  // root provider's does; the client must be created by the mount itself so
  // the keyed shell remount discards it.
  assert.match(source, /const \[queryClient\] = useState\(\s*\(\) =>\s*new QueryClient\(/);
  assert.doesNotMatch(source, /^export const queryClient/m);
  assert.doesNotMatch(source, /^const queryClient = new QueryClient/m);
});

test("TenantQueryProvider serves its subtree through QueryClientProvider", async () => {
  const source = await readFile(providerUrl, "utf8");
  assert.match(source, /<QueryClientProvider client=\{queryClient\}>/);
  assert.match(source, /<QueryClientProvider client=\{queryClient\}>\{children\}<\/QueryClientProvider>/);
});

test("TenantQueryProvider keeps the root provider's query defaults", async () => {
  const source = await readFile(providerUrl, "utf8");
  assert.match(source, /staleTime: 30_000/);
  assert.match(source, /gcTime: 5 \* 60_000/);
  assert.match(source, /refetchOnWindowFocus: false/);
  assert.match(source, /retry: 1/);
});
