import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headerUrl = new URL("./page-header.tsx", import.meta.url);

test("PageHeader ancestor and back navigation links expose a visible keyboard focus ring", async () => {
  const source = await readFile(headerUrl, "utf8");
  const links = source.split("\\n").filter(line =>
    line.includes('className="') && line.includes("outline-none") && line.includes("focus-visible:text-foreground")
  );
  assert.equal(links.length, 2, "breadcrumb and back links must both retain a focus indicator");
  for (const link of links) {
    assert.ok(link.includes("focus-visible:ring-3"), "focus must not rely only on text color");
    assert.ok(link.includes("focus-visible:ring-ring/50"));
  }
});
