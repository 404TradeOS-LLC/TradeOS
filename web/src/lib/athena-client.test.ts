import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource() {
  return readFile(new URL("./athena-client.ts", import.meta.url), "utf8");
}

test("Athena browser client uses the authenticated proxy and preserves typed terminal envelopes", async () => {
  const source = await readSource();

  assert.match(source, /fetch\("\/api\/proxy\/athena\/chat"/);
  assert.match(source, /if \(isAthenaKernelResult\(body\)\) return body;/);
  assert.match(source, /terminal\s+non-2xx states such as denied, failed, expired, provider failure, and\s+conflict/);
  assert.match(source, /throw new ClientApiError\(getProxyErrorMessage\(body\), response\.status\)/);
});

test("Athena browser client sends only the public chat request contract", async () => {
  const source = await readSource();

  assert.match(source, /message: input\.message/);
  assert.match(source, /conversationId: input\.conversationId/);
  assert.match(source, /selectedScope: input\.selectedScope/);
  assert.match(source, /channel: input\.channel \?\? "text"/);
  assert.match(source, /platform: "web"/);
  assert.match(source, /viewportClass: input\.viewportClass \?\? "regular"/);
  assert.match(source, /connectivity: "online"/);
  assert.match(source, /idempotencyKey: input\.idempotencyKey/);
  assert.doesNotMatch(source, /\/api\/v1\/(jobs|projects|estimates|invoices|customers)\//);
});

test("Athena browser client validates the complete terminal result shape before returning it", async () => {
  const source = await readSource();

  assert.match(source, /const ATHENA_KERNEL_STATES = new Set<AthenaKernelState>/);
  assert.match(source, /typeof value\.success !== "boolean"/);
  assert.match(source, /typeof value\.executionId !== "string" \|\| typeof value\.traceId !== "string"/);
  assert.match(source, /!ATHENA_KERNEL_STATES\.has\(value\.state as AthenaKernelState\)/);
  assert.match(source, /!Array\.isArray\(value\.warnings\) \|\| !Array\.isArray\(value\.followUps\)/);
  assert.match(source, /typeof value\.telemetry\.traceId !== "string"/);
});

test("Athena browser client keeps safe environment and access failure copy", async () => {
  const source = await readSource();

  assert.match(source, /404\) return "Athena is not enabled in this environment yet\."/);
  assert.match(source, /403\) return "Athena could not perform that request with your current access\."/);
  assert.match(source, /409\) return "Athena found a conflict and did not apply the requested change\."/);
  assert.match(source, /504\) return "Athena timed out before the request could complete\."/);
});
