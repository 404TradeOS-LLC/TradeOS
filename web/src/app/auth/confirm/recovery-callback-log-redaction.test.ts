import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeUrl = new URL("./route.ts", import.meta.url);

test("malformed recovery callbacks never log recovery query credentials", async () => {
  const source = await readFile(routeUrl, "utf8");
  const fallbackStart = source.indexOf("} else {");
  const fallbackEnd = source.indexOf('return resetRedirect(request, "invalid-link");', fallbackStart);

  assert.notEqual(fallbackStart, -1, "expected unrecognized recovery-parameter branch");
  assert.notEqual(fallbackEnd, -1, "expected invalid-link redirect");

  const fallback = source.slice(fallbackStart, fallbackEnd);
  assert.match(fallback, /console\.error\("Password recovery callback missing recognized recovery parameters"\)/);
  assert.doesNotMatch(fallback, /requestUrl\.search/);
  assert.doesNotMatch(fallback, /console\.error\([^\n]*(?:tokenHash|code)/);
});
