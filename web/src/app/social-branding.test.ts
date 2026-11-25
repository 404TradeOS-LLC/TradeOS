import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

function pngDimensions(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${file} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("social image is the master package share art at 1200x630", () => {
  const shareArt = path.join(repoRoot, "web", "public", "brand", "social-share.png");
  assert.ok(existsSync(shareArt), "package social-share.png must be served from web/public/brand");
  assert.deepEqual(pngDimensions(shareArt), { width: 1200, height: 630 });
  assert.ok(
    !existsSync(path.join(here, "opengraph-image.tsx")),
    "the generated opengraph-image route is replaced by the package file"
  );
});

test("root metadata advertises the TradeOS social preview", () => {
  const layout = readFileSync(path.join(here, "layout.tsx"), "utf8");
  assert.match(layout, /openGraph:/);
  assert.match(layout, /twitter:/);
  assert.match(layout, /\/brand\/social-share\.png/);
  assert.match(layout, /width:\s*1200,\s*height:\s*630/);
});
