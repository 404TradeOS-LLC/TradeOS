import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("pricing mutations capture the pre-write total before the mutation runs", async () => {
  const builder = await readSource("./builder.tsx");
  const contextualAthena = await readSource("../../../../../../components/estimate-assist/contextual-athena-panel.tsx");

  // invalidate() snapshots the captured total when one is passed, and falls
  // back to the current query record only when no caller captured one.
  assert.match(builder, /const invalidate = \(reason\?: string, previousTotalMinor\?: number \| null\) => \{/);
  assert.match(builder, /previousTotalMinor \?\? toMinorUnits\(estimate\.totalPrice\)/);

  // Every pricing mutation captures its pre-write total in onMutate, before
  // the write runs: a refresh landing between the write and onSuccess must
  // not replace the baseline with the new total.
  const captures = builder.match(/onMutate: \(\) => \(\{\s*previousTotalMinor:/g) ?? [];
  assert.equal(captures.length, 6, "remove, add, custom add, edit, pricing mode, overhead/tax");

  // Each onSuccess threads the captured total into the snapshot call.
  const threaded = builder.match(/(invalidate|onAdded|onUpdated)\("[^"]+", context\?\.previousTotalMinor\)/g) ?? [];
  assert.equal(threaded.length, 6);

  // The captured total reaches each editor through its callback signature
  // and the currentTotalMinor prop.
  assert.equal((builder.match(/onUpdated: \(reason\?: string, previousTotalMinor\?: number \| null\) => void/g) ?? []).length, 3);
  assert.match(builder, /onAdded: \(reason\?: string, previousTotalMinor\?: number \| null\) => void/);
  assert.equal((builder.match(/currentTotalMinor=\{toMinorUnits\(runningTotals\.totalPrice\)\}/g) ?? []).length, 3);

  // The Athena panel is a plain async add, not a mutation, so it captures
  // the total before the POST instead of in onMutate.
  assert.match(contextualAthena, /onAdded\?: \(reason\?: string, previousTotalMinor\?: number \| null\) => void/);
  assert.match(contextualAthena, /currentTotalMinor\?: number \| null/);
  assert.match(contextualAthena, /const previousTotalMinor = currentTotalMinor \?\? null;/);
  assert.match(contextualAthena, /onAdded\?\.\("Athena suggestion added", previousTotalMinor\)/);
});
