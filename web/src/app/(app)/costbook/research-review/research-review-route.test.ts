import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readSource(relativePath: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return fs.readFileSync(path.join(here, relativePath), "utf8");
}

test("research review page loads the authenticated Costbook workspace and real candidate data", () => {
  const source = readSource("page.tsx");
  assert.match(source, /title:\s*"Research Review \| Costbook \| TradeOS"/);
  assert.match(source, /getCostbookWorkspace\(token\)/);
  assert.match(source, /listCostbookCandidates\(token,/);
  assert.match(source, /getCostbookCandidateSummary\(token\)/);
  assert.match(source, /getCostbookKnowledgeCorpusReport\(token\)/);
  assert.match(source, /Couldn't load research candidates/);
});

test("summary counts come from the backend, never from hardcoded figures", () => {
  const source = readSource("page.tsx");
  assert.match(source, /value=\{String\(summary\.pendingReview\)\}/);
  assert.match(source, /value=\{String\(summary\.approved\)\}/);
  assert.match(source, /value=\{String\(summary\.promoted\)\}/);
  assert.match(source, /value=\{String\(summary\.rejected\)\}/);
  assert.match(source, /value=\{corpus\.totalItems\}/);
  assert.match(source, /value=\{corpus\.candidateReady\}/);
});

test("decision controls are gated behind the manage capability seam", () => {
  const source = readSource("page.tsx");
  assert.match(source, /getResearchReviewCapabilities\(data\.canWrite, data\.canManage\)/);
  assert.match(source, /capabilities\.showActions \? \(/);
  // A read-only viewer must be told the truth about what they cannot do.
  assert.match(source, /You have read-only Costbook access/);
  assert.match(source, /restricted to Costbook managers/);
});

test("approve, reject, and promote post through the audited server actions", () => {
  const source = readSource("page.tsx");
  assert.match(source, /action=\{reviewCostbookCandidateAction\}/);
  assert.match(source, /action=\{promoteCostbookCandidateAction\}/);
  assert.match(source, /name="decision"\s+value="approved"/);
  assert.match(source, /name="decision"\s+value="rejected"/);
  // The reviewer identity is never submitted from the browser; the API records
  // the authenticated caller's own id.
  assert.doesNotMatch(source, /name="reviewedBy"/);
  assert.doesNotMatch(source, /name="reviewedByUserId"/);
  assert.doesNotMatch(source, /name="orgId"/);
});

test("review and promote controls only render for a candidate in the right state", () => {
  const source = readSource("page.tsx");
  assert.match(source, /const open = isOpenForReview\(candidate\)/);
  assert.match(source, /const promotable = isPromotable\(candidate\)/);
  assert.match(source, /\{open \? \(/);
  assert.match(source, /\{promotable \? \(/);
});

test("the detail panel surfaces complete provenance evidence", () => {
  const source = readSource("page.tsx");
  for (const field of ["sourceName", "sourceDate", "retrievedAt", "regionalBasis", "confidence", "provenanceStatus"]) {
    assert.match(source, new RegExp(`candidate\\.${field}`), `${field} must be shown to the reviewer`);
  }
  assert.match(source, /provenanceExplanation\(candidate\.provenanceStatus\)/);
  assert.match(source, /freshnessLabel\(candidate\.sourceDate\)/);
});

test("the detail panel shows current Costbook price and the difference, not just the proposal", () => {
  const source = readSource("page.tsx");
  assert.match(source, /matchStatusLabel\(match\.status\)/);
  assert.match(source, /match\.bestMatch\.currentUnitCost/);
  assert.match(source, /formatPriceDelta\(match\.bestMatch\.priceDelta, match\.bestMatch\.priceDeltaPct\)/);
});

test("promotion copy states that historical documents keep their captured prices", () => {
  const source = readSource("page.tsx");
  assert.match(source, /Existing estimates, proposals, contracts, and\s*\n?\s*invoices keep the prices they already captured/);
});

test("the empty queue explains why unsourced research cannot appear", () => {
  const source = readSource("page.tsx");
  assert.match(source, /No research candidates yet/);
  assert.match(source, /without a source cannot enter this queue/);
});

test("research review loading route exposes an accessible loading summary", () => {
  const source = readSource("loading.tsx");
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /Loading research review queue/);
  assert.match(source, /aria-label="Loading review queue summary"/);
});

test("costbook navigation links include the research review surface", () => {
  const source = readSource("../page.tsx");
  assert.match(source, /href="\/costbook\/research-review"/);
  assert.match(source, /Research Review/);
});

test("server actions never accept a caller-supplied reviewer or organization", () => {
  const source = readSource("../../../actions/costbook-candidates.ts");
  assert.match(source, /"use server"/);
  assert.match(source, /getSessionToken\(\)/);
  assert.match(source, /revalidatePath\(RESEARCH_REVIEW_PATH\)/);
  assert.match(source, /decision !== "approved" && decision !== "rejected"/);
  assert.doesNotMatch(source, /formData\.get\("reviewedBy"\)/);
  assert.doesNotMatch(source, /formData\.get\("orgId"\)/);
});

test("promotion revalidates the catalog and price-history surfaces it affects", () => {
  const source = readSource("../../../actions/costbook-candidates.ts");
  assert.match(source, /revalidatePath\("\/costbook\/cost-items"\)/);
  assert.match(source, /revalidatePath\("\/costbook\/price-history"\)/);
});
