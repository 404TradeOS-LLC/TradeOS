import assert from "node:assert/strict";
import test from "node:test";
import { verifyProposalPdfDownload } from "./proposal-pdf.mjs";

const id = "1643d999-509c-4742-8d68-46c6a9129d55";
const bytes = Buffer.from("%PDF-1.3\nsynthetic transport fixture\n%%EOF\n");
function response({ status = 200, type = "application/pdf", body = bytes } = {}) {
  return { status: () => status, headers: () => ({ "content-type": type }), body: async () => body };
}

test("uses the authenticated same-origin document route with redirects disabled", async () => {
  let observed;
  const result = await verifyProposalPdfDownload({
    request: { get: async (...args) => { observed = args; return response(); } },
    baseUrl: "https://tradeos-costbook-web-fixture.vercel.app",
    proposalId: id,
  });
  assert.deepEqual(observed, [`https://tradeos-costbook-web-fixture.vercel.app/api/documents/proposals/${id}/pdf`, { maxRedirects: 0, timeout: 60_000 }]);
  assert.equal(result.bytes, bytes.length);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.buffer, bytes);
});

for (const [name, override] of [
  ["login redirect", { status: 302 }],
  ["forbidden", { status: 403 }],
  ["HTML response", { type: "text/html" }],
  ["HTML disguised as PDF", { body: Buffer.from("<html>Login</html>") }],
  ["truncated PDF", { body: Buffer.from("%PDF-1.3\nmissing trailer") }],
]) {
  test(`rejects ${name} rather than retaining false PDF evidence`, async () => {
    await assert.rejects(verifyProposalPdfDownload({
      request: { get: async () => response(override) },
      baseUrl: "https://tradeos-costbook-web-fixture.vercel.app", proposalId: id,
    }));
  });
}

test("invalid proposal identity fails before sending an authenticated request", async () => {
  await assert.rejects(verifyProposalPdfDownload({
    request: { get: () => assert.fail("must not fetch") },
    baseUrl: "https://tradeos-costbook-web-fixture.vercel.app", proposalId: "../other",
  }));
});
