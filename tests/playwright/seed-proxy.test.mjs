import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Regression test for the MCP seed's proxy forwarding (Codex P2 on #1013).
//
// When TRADEOS_MCP_FIREFOX_USER_DATA_DIR is set, tests/playwright/seed.spec.ts
// overrides the context fixture and calls playwright.firefox
// .launchPersistentContext() directly. That call builds its own options and
// does NOT inherit the `proxy` from the config's `use`, so the resolved env
// proxy must be forwarded into it explicitly — otherwise the interactive
// page runs unconfigured on any machine whose proxy exists only in the
// environment. The same applies to the standard context built for
// non-Firefox projects.
//
// A live test of this path needs a browser, the app, and a proxy, so this
// guards the wiring at the source level: both context constructions must
// forward the resolved proxy.
const seedPath = join(dirname(fileURLToPath(import.meta.url)), "seed.spec.ts");
const source = readFileSync(seedPath, "utf8");

function callBlock(marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `expected ${marker} in seed.spec.ts`);
  const end = source.indexOf("});", start);
  assert.notEqual(end, -1, `expected ${marker} call to close in seed.spec.ts`);
  return source.slice(start, end);
}

test("persistent Firefox context forwards the resolved env proxy", () => {
  const block = callBlock("launchPersistentContext(");
  assert.match(
    block,
    /proxy:\s*mcpProxy/,
    "launchPersistentContext must forward mcpProxy",
  );
});

test("standard non-Firefox context forwards the resolved env proxy", () => {
  const block = callBlock("browser.newContext({");
  assert.match(block, /proxy:\s*mcpProxy/, "newContext must forward mcpProxy");
});

test("the proxy is resolved from the environment at module load", () => {
  assert.match(source, /const mcpProxy = resolveMcpProxy\(process\.env\);/);
});
