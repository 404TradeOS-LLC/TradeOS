import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const imageRoute = readFileSync(fileURLToPath(new URL("./opengraph-image.tsx", import.meta.url)), "utf8");
const layout = readFileSync(fileURLToPath(new URL("./layout.tsx", import.meta.url)), "utf8");

test("social image retains the canonical TradeOS mark and 1200x630 dimensions", () => {
  assert.match(imageRoute, /MARK_PATHS/);
  assert.match(imageRoute, /width:\s*1200/);
  assert.match(imageRoute, /height:\s*630/);
  assert.match(imageRoute, /BUILT FOR WHAT YOU BUILD/);
});

test("root metadata advertises the TradeOS social preview", () => {
  assert.match(layout, /openGraph:/);
  assert.match(layout, /twitter:/);
  assert.match(layout, /\/opengraph-image/);
});
