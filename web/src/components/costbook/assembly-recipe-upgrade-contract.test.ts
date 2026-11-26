import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("installed recipe updates require review and explicit confirmation with the reviewed token", async () => {
  const [view, detail] = await Promise.all([
    readFile(new URL("./assembly-recipe-upgrade.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/(app)/costbook/assemblies/[id]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(detail, /assembly\.installedRecipeId \? \(/);
  assert.match(detail, /<AssemblyRecipeUpgrade assembly=\{assembly\} canUpgrade=\{canUpgrade\}/);
  assert.match(view, /Installed version \{assembly\.installedRecipeVersion\} · Catalog version/);
  assert.match(view, /onClick=\{loadReview\}/);
  assert.match(view, /onClick=\{confirmUpgrade\}/);
  assert.match(view, /reviewToken: review\.reviewToken/);
  assert.match(view, /disabled=\{busy \|\| required\.some/);
  assert.match(view, /mappingLabels\[change\.mapping\]/);
  assert.match(view, /review\.history\.map/);
  // The search-picker dropdown is absolute-positioned inside this card, so
  // the card must not clip it at its own boundary.
  assert.match(view, /<Card className="overflow-visible">/);
  assert.doesNotMatch(view, /useEffect\(/);
});
