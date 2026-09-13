import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

test("composite import rejects cross-origin mutations before reading the session", () => {
  const originCheck = source.indexOf("shouldRejectProxyMutation(");
  const sessionRead = source.indexOf("await getSessionToken()");

  assert.ok(originCheck >= 0, "the dedicated proxy must use the canonical mutation-origin guard");
  assert.ok(sessionRead >= 0, "the dedicated proxy must still require a server-side session");
  assert.ok(originCheck < sessionRead, "origin validation must happen before the HttpOnly session is read");
});
