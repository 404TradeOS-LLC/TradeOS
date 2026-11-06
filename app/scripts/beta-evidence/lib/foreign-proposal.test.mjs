import assert from "node:assert/strict";
import test from "node:test";
import { verifyForeignProposalIsolation } from "./foreign-proposal.mjs";

const proposalId = "1643d999-509c-4742-8d68-46c6a9129d55";
const smokeOrgId = "11111111-1111-4111-8111-111111111111";
const ownerOrgId = "22222222-2222-4222-8222-222222222222";
const baseUrl = "https://tradeos-costbook-web-fixture.vercel.app";
const response = (status, body) => ({ status: () => status, json: async () => body });
function fixture(options = {}) {
  const calls = [];
  let detailReads = 0;
  const smokeRequest = { get: async url => {
    calls.push(`smoke:${new URL(url).pathname}`);
    return url.endsWith("/settings") ? response(200, { orgId: smokeOrgId }) : response(options.denialStatus ?? 404);
  } };
  const ownerRequest = { get: async url => {
    calls.push(`owner:${new URL(url).pathname}`);
    if (url.endsWith("/settings")) return response(options.settingsStatus ?? 200, { orgId: options.actualOrg ?? ownerOrgId, currentRole: options.role ?? "owner" });
    detailReads++;
    return response(detailReads > 1 ? (options.afterStatus ?? 200) : (options.detailStatus ?? 200), { id: options.actualId ?? proposalId });
  } };
  return { calls, input: { baseUrl, proposalId, expectedOwnerOrgId: ownerOrgId, smokeRequest, ownerRequest } };
}
test("proves distinct owner membership and existing Proposal before and after smoke denial", async () => {
  const f = fixture();
  const result = await verifyForeignProposalIsolation(f.input);
  assert.equal(result.passed, true);
  assert.equal(result.fixtureVerified, true);
  assert.equal(result.apiStatus, 404);
  assert.equal(result.ownerOrgId, ownerOrgId);
  assert.equal(result.smokeOrgId, smokeOrgId);
  assert.deepEqual(f.calls, ["smoke:/api/proxy/settings", "owner:/api/proxy/settings", `owner:/api/proxy/proposals/${proposalId}`, `smoke:/api/documents/proposals/${proposalId}/pdf`, `owner:/api/proxy/proposals/${proposalId}`]);
});
for (const [name, options] of [
  ["missing or deleted Proposal", { detailStatus: 404 }],
  ["owner session expired", { settingsStatus: 401 }],
  ["owner tenant mismatch", { actualOrg: smokeOrgId }],
  ["foreign account lacks owner/admin role", { role: "technician" }],
  ["wrong Proposal returned", { actualId: ownerOrgId }],
  ["readable foreign PDF", { denialStatus: 200 }],
  ["login redirect", { denialStatus: 302 }],
  ["deleted during probe", { afterStatus: 404 }],
]) {
  test(`refuses isolation PASS: ${name}`, async () => {
    const f = fixture(options);
    await assert.rejects(verifyForeignProposalIsolation(f.input));
    if (options.detailStatus || options.settingsStatus || options.actualOrg || options.actualId) {
      assert.equal(f.calls.some(c => c.includes("/api/documents/")), false);
    }
  });
}
test("same-tenant owner cannot be used as foreign fixture authority", async () => {
  const f = fixture({ actualOrg: smokeOrgId });
  await assert.rejects(verifyForeignProposalIsolation({ ...f.input, expectedOwnerOrgId: smokeOrgId }));
});

test("accepts explicit 403 only after a verified fixture", async () => {
  const f = fixture({ denialStatus: 403 });
  assert.equal((await verifyForeignProposalIsolation(f.input)).apiStatus, 403);
});
test("does not expose authenticated request diagnostics in errors", async () => {
  const f = fixture();
  f.input.ownerRequest.get = async () => { throw new Error("Cookie: secret-session-value"); };
  await assert.rejects(verifyForeignProposalIsolation(f.input), error => !error.message.includes("secret-session-value"));
});
