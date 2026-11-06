import { createHash } from "node:crypto";
import { assertApprovedRcUrl } from "./rc-target.mjs";

// Transport evidence only. Financial content and visual branding still need
// renderer tests and human inspection of the retained synthetic PDF.
export async function verifyProposalPdfDownload({ request, baseUrl, proposalId }) {
  const origin = assertApprovedRcUrl(baseUrl);
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(proposalId ?? "")) {
    throw new Error("A saved Proposal UUID is required for PDF evidence.");
  }
  const response = await request.get(new URL(`/api/documents/proposals/${proposalId}/pdf`, origin).href, {
    maxRedirects: 0, timeout: 60_000,
  });
  if (response.status() !== 200 || !/^application\/pdf(?:;|$)/i.test(response.headers()["content-type"] ?? "")) {
    throw new Error(`Proposal PDF download failed (HTTP ${response.status()}); expected application/pdf.`);
  }
  const buffer = await response.body();
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-" || !buffer.subarray(-1024).includes("%%EOF")) {
    throw new Error("Proposal PDF is missing its signature or end marker.");
  }
  return { buffer, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
}
