import { assertApprovedRcUrl } from "./rc-target.mjs";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function verifyForeignProposalIsolation({ baseUrl, proposalId, expectedOwnerOrgId, smokeRequest, ownerRequest }) {
  const origin = assertApprovedRcUrl(baseUrl);
  if (!UUID.test(proposalId ?? "") || !UUID.test(expectedOwnerOrgId ?? "")) {
    throw new Error("Foreign Proposal and expected owner organization UUIDs are required.");
  }
  async function get(request, route) {
    try { return await request.get(new URL(route, origin).href, { maxRedirects: 0, timeout: 60_000 }); }
    catch { throw new Error("Foreign Proposal evidence request failed; verify nonproduction connectivity and sessions."); }
  }
  async function read(request, route, label) {
    const response = await get(request, route);
    if (response.status() !== 200) throw new Error(`${label} could not be verified (HTTP ${response.status()}).`);
    try { return await response.json(); }
    catch { throw new Error(`${label} did not return a valid JSON response.`); }
  }
  const smoke = await read(smokeRequest, "/api/proxy/settings", "Smoke tenant identity");
  const owner = await read(ownerRequest, "/api/proxy/settings", "Foreign owner identity");
  if (!UUID.test(smoke?.orgId ?? "") || !UUID.test(owner?.orgId ?? "") ||
      owner.orgId.toLowerCase() !== expectedOwnerOrgId.toLowerCase() ||
      owner.orgId.toLowerCase() === smoke.orgId.toLowerCase() ||
      !["owner", "admin"].includes(owner.currentRole)) {
    throw new Error("Foreign fixture requires a verified owner/admin in the expected distinct tenant.");
  }
  async function verifyExists() {
    const proposal = await read(ownerRequest, `/api/proxy/proposals/${proposalId}`, "Foreign Proposal fixture");
    if (proposal?.id?.toLowerCase() !== proposalId.toLowerCase()) throw new Error("Foreign Proposal fixture identity mismatch.");
  }
  await verifyExists();
  const response = await get(smokeRequest, `/api/documents/proposals/${proposalId}/pdf`);
  const apiStatus = response.status();
  if (apiStatus !== 403 && apiStatus !== 404) throw new Error(`Foreign Proposal PDF was not denied (HTTP ${apiStatus}).`);
  // A disappearing fixture cannot turn a successful not-found response into
  // isolation proof. Keep these reads adjacent to the actual denied request.
  await verifyExists();
  return { passed: true, fixtureVerified: true, proposalId, smokeOrgId: smoke.orgId, ownerOrgId: owner.orgId, apiStatus };
}
