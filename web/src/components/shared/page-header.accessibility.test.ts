import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headerUrl = new URL("./page-header.tsx", import.meta.url);

test("PageHeader ancestor and back navigation links expose a visible keyboard focus ring", async () => {
  const source = await readFile(headerUrl, "utf8");
  const links = [...source.matchAll(/<Link\\b[\\s\\S]*?<\\/Link>/g)].map(match => match[0]);
  assert.equal(links.length, 2, "both breadcrumb and back links must remain keyboard accessible");
  for (const link of links) {
    assert.match(link, /focus-visible:ring-3/, "keyboard focus must not rely on text-color change alone");
    assert.match(link, /focus-visible:ring-ring\\/50/);
  }
});
