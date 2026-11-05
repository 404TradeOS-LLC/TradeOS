import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOMParser } from "@xmldom/xmldom";
import { Box3, Matrix4 } from "three";
import { markSource, wordSource } from "./logo-sources.ts";
import { createLogoParts } from "./cinema-geometry.ts";
// SVGLoader requests gradient selectors; the official assets use solid fills.
// This shim intentionally supports only these known solid-fill fixtures.
Object.assign(globalThis, {
  DOMParser: class extends DOMParser {
    parseFromString(source: string, type: string) {
      assert.ok(!/<(?:linearGradient|radialGradient)/.test(source));
      const doc = super.parseFromString(source, type);
      Object.assign(doc, { querySelectorAll: () => [] });
      return doc;
    }
  },
});
for (const [name, centerX, centerY, expectedParts, depth, bevel, scale] of [
  ["mark", 141.5, 142, 6, 15, 1.7, 0.016],
  ["logo", 256.5, 65, 7, 5, 0.55, 0.014],
]) {
  test(`official ${name} becomes finite, beveled 3D geometry`, () => {
    const source = readFileSync(
      new URL(
        `../../../public/entry/${name === "logo" ? "wordmark" : name}.svg`,
        import.meta.url,
      ),
      "utf8",
    );
    const parts = createLogoParts(source, { depth, bevel, centerX, centerY });
    assert.equal(parts.length, expectedParts);
    const bounds = new Box3();
    for (const geometry of parts) {
      geometry.computeBoundingBox();
      bounds.union(geometry.boundingBox);
      const positions = geometry.attributes.position.array;
      assert.ok(positions.length > 30);
      assert.ok([...positions].every(Number.isFinite));
      assert.ok(
        geometry.boundingBox.max.z - geometry.boundingBox.min.z > depth,
      );
      geometry.dispose();
    }
    bounds.applyMatrix4(new Matrix4().makeScale(scale, -scale, scale));
    assert.ok(bounds.max.x - bounds.min.x > 3);
    assert.ok(bounds.max.x - bounds.min.x < 8);
    assert.ok(bounds.max.y - bounds.min.y > 1);
    assert.ok(bounds.max.y - bounds.min.y < 5);
  });
}
test("vector fallback preserves the exact supplied logo paths and transforms", async () => {
  const { MARK_PATHS, LOGO_PATHS } = await import("./logo-paths.ts");
  for (const [name, expected] of [
    ["mark", MARK_PATHS],
    ["logo", LOGO_PATHS],
  ]) {
    const doc = new DOMParser().parseFromString(
      readFileSync(
        new URL(
          `../../../public/entry/${name === "logo" ? "wordmark" : name}.svg`,
          import.meta.url,
        ),
        "utf8",
      ),
      "image/svg+xml",
    );
    const actual: { d: string | null; transform: string }[] = [];
    function walk(
      node: ReturnType<DOMParser["parseFromString"]>["documentElement"],
      parent = "",
    ) {
      if (node.nodeType !== 1) return;
      const transform = (
        parent +
        " " +
        (node.getAttribute("transform") || "")
      ).trim();
      if (node.localName === "path")
        actual.push({ d: node.getAttribute("d"), transform });
      for (let child = node.firstChild; child; child = child.nextSibling)
        walk(child, transform);
    }
    walk(doc.documentElement);
    assert.deepEqual(actual, expected);
    actual.length = 0;
    const embedded = new DOMParser().parseFromString(
      name === "mark" ? markSource : wordSource, "image/svg+xml",
    );
    walk(embedded.documentElement);
    assert.deepEqual(actual, expected, "embedded renderer SVG must match official paths");
  }
});
