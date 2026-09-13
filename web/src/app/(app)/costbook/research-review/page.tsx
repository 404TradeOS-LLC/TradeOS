import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogQueryControls } from "@/components/costbook/catalog-query-controls";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  promoteCostbookCandidateAction,
  reviewCostbookCandidateAction,
} from "@/app/actions/costbook-candidates";
import {
  formatCurrency,
  formatDate,
  formatPriceDelta,
  freshnessLabel,
  getResearchReviewCapabilities,
  isOpenForReview,
  isPromotable,
  matchStatusLabel,
  provenanceExplanation,
  provenanceLabel,
  reviewStatusBadgeToken,
  reviewStatusLabel,
} from "@/components/costbook/research-review-model";
import { getCostbookWorkspace } from "@/lib/api";
import {
  getCostbookCandidateMatch,
  getCostbookCandidateSummary,
  getCostbookKnowledgeCorpusReport,
  listCostbookCandidates,
  type CostbookCandidateMatch,
  type CostbookCandidateReviewStatus,
  type CostbookCandidateSummary,
  type CostbookKnowledgeCorpusReport,
  type CostbookResearchCandidate,
} from "@/lib/costbook-api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = { title: "Research Review | Costbook | TradeOS" };

type ResearchReviewQuery = {
  limit?: string;
  cursor?: string;
  q?: string;
  sort?: string;
  order?: "asc" | "desc";
  reviewStatus?: CostbookCandidateReviewStatus;
  candidateId?: string;
};

type ResearchReviewData = {
  canWrite: boolean;
  canManage: boolean;
  candidates: CostbookResearchCandidate[];
  total: number;
  nextCursor: string | null;
  summary: CostbookCandidateSummary;
  corpus: CostbookKnowledgeCorpusReport;
  selected: CostbookResearchCandidate | null;
  match: CostbookCandidateMatch | null;
};

export default async function CostbookResearchReviewPage({
  searchParams,
}: {
  searchParams: Promise<ResearchReviewQuery>;
}) {
  const token = await getSessionToken();
  const query = await searchParams;
  if (!token) return <EmptyState title="Sign in required" description="You need an authenticated Costbook session." />;

  let data: ResearchReviewData | null = null;
  let loadError: string | null = null;

  try {
    const [workspace, page, summary, corpus] = await Promise.all([
      getCostbookWorkspace(token),
      listCostbookCandidates(token, {
        limit: query.limit ? Number(query.limit) : undefined,
        cursor: query.cursor,
        q: query.q,
        sort: query.sort,
        order: query.order,
        reviewStatus: query.reviewStatus,
      }),
      getCostbookCandidateSummary(token),
      getCostbookKnowledgeCorpusReport(token),
    ]);

    // The detail panel follows ?candidateId=, defaulting to the first row so
    // the page is useful without a click.
    const selected =
      page.items.find((candidate) => candidate.id === query.candidateId) ?? page.items[0] ?? null;

    let match: CostbookCandidateMatch | null = null;
    if (selected) {
      try {
        match = await getCostbookCandidateMatch(token, selected.id);
      } catch {
        // Match analysis is advisory. A failure must not hide the candidate's
        // own provenance evidence, which is the reviewer's primary material.
        match = null;
      }
    }

    data = {
      canWrite: workspace.permissions.canWrite,
      canManage: workspace.permissions.canManage,
      candidates: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
      summary,
      corpus,
      selected,
      match,
    };
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Research candidates are unavailable.";
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Research Review"
          description="Governed review of researched pricing before it can enter the Costbook."
          backHref="/costbook"
          backLabel="Costbook"
        />
        <EmptyState
          title="Couldn't load research candidates"
          description={loadError ?? "Research candidates are unavailable."}
        />
      </div>
    );
  }

  const capabilities = getResearchReviewCapabilities(data.canWrite, data.canManage);
  const { summary, corpus, selected, match } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Research Review"
        description="Researched pricing waiting on a human decision. Nothing here is Costbook pricing until it is explicitly approved and promoted."
        backHref="/costbook"
        backLabel="Costbook"
      />

      <section aria-label="Review queue summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Pending review" value={String(summary.pendingReview)} hint="Awaiting a decision" />
        <SummaryTile label="Approved" value={String(summary.approved)} hint={`${summary.awaitingPromotion} not yet promoted`} />
        <SummaryTile label="Promoted" value={String(summary.promoted)} hint="Now real Cost Items" />
        <SummaryTile label="Rejected" value={String(summary.rejected)} hint="Decision recorded" />
      </section>

      <section
        aria-label="Knowledge Engine corpus provenance"
        className="rounded-lg border border-border/70 bg-card p-4"
      >
        <h2 className="font-semibold">Knowledge Engine corpus</h2>
        <p className="mt-1 text-sm text-muted-foreground">{corpus.interpretation}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CorpusStat label="Total research items" value={corpus.totalItems} />
          <CorpusStat label="Documented" value={corpus.documented} />
          <CorpusStat label="Unverified legacy" value={corpus.unverifiedLegacy} />
          <CorpusStat label="Ready to review" value={corpus.candidateReady} />
        </dl>
      </section>

      {!capabilities.showActions ? (
        <div className="rounded-lg border border-border/70 bg-card p-4 text-sm text-muted-foreground">
          You have read-only Costbook access. You can inspect research candidates and their evidence, but approving,
          rejecting, and promoting are restricted to Costbook managers.
        </div>
      ) : null}

      <CatalogQueryControls
        pathname="/costbook/research-review"
        query={{ q: query.q, sort: query.sort, order: query.order, reviewStatus: query.reviewStatus, limit: query.limit }}
        total={data.total}
        shown={data.candidates.length}
        nextCursor={data.nextCursor}
        sortOptions={[
          { value: "createdAt", label: "Created" },
          { value: "updatedAt", label: "Updated" },
          { value: "reviewStatus", label: "Review status" },
        ]}
        filters={[
          {
            name: "reviewStatus",
            label: "Review status",
            value: query.reviewStatus,
            options: [
              { value: "candidate", label: "New" },
              { value: "needs-review", label: "Needs review" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ],
          },
        ]}
      />

      {data.candidates.length === 0 ? (
        <EmptyState
          title="No research candidates yet"
          description="Researched pricing appears here once it has been submitted with a cited source. Knowledge Engine items without a source cannot enter this queue."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(0,1.4fr)]">
          <CandidateTable candidates={data.candidates} selectedId={selected?.id ?? null} query={query} />
          {selected ? (
            <CandidateDetail candidate={selected} match={match} capabilities={capabilities} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CorpusStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums text-foreground">{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function detailHref(query: ResearchReviewQuery, candidateId: string): string {
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", query.limit);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.q) params.set("q", query.q);
  if (query.sort) params.set("sort", query.sort);
  if (query.order) params.set("order", query.order);
  if (query.reviewStatus) params.set("reviewStatus", query.reviewStatus);
  params.set("candidateId", candidateId);
  return `/costbook/research-review?${params.toString()}`;
}

function CandidateTable({
  candidates,
  selectedId,
  query,
}: {
  candidates: CostbookResearchCandidate[];
  selectedId: string | null;
  query: ResearchReviewQuery;
}) {
  return (
    <section
      aria-label="Research candidates"
      className="overflow-hidden rounded-lg border border-border/70 bg-card"
    >
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="sticky top-16 z-10 border-b border-border bg-card text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Item</th>
              <th scope="col" className="px-4 py-3 font-medium">Trade</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Proposed</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {candidates.map((candidate) => (
              <tr
                key={candidate.id}
                className={candidate.id === selectedId ? "bg-muted" : "transition-colors hover:bg-muted/40"}
              >
                <td className="px-4 py-3">
                  <a className="font-medium text-foreground underline-offset-4 hover:underline" href={detailHref(query, candidate.id)}>
                    {candidate.itemName}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">{provenanceLabel(candidate.provenanceStatus)}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{candidate.trade}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatCurrency(candidate.materialCostTypical)}
                  <span className="ml-1 text-xs text-muted-foreground">/ {candidate.unitOfMeasure}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={reviewStatusBadgeToken(candidate.reviewStatus)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid divide-y divide-border/70 md:hidden">
        {candidates.map((candidate) => (
          <article key={candidate.id} className="grid gap-2 p-4">
            <a className="font-medium text-foreground underline-offset-4 hover:underline" href={detailHref(query, candidate.id)}>
              {candidate.itemName}
            </a>
            <p className="text-xs text-muted-foreground">
              {candidate.trade} · {provenanceLabel(candidate.provenanceStatus)}
            </p>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm tabular-nums">
                {formatCurrency(candidate.materialCostTypical)} / {candidate.unitOfMeasure}
              </span>
              <StatusBadge status={reviewStatusBadgeToken(candidate.reviewStatus)} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CandidateDetail({
  candidate,
  match,
  capabilities,
}: {
  candidate: CostbookResearchCandidate;
  match: CostbookCandidateMatch | null;
  capabilities: ReturnType<typeof getResearchReviewCapabilities>;
}) {
  const open = isOpenForReview(candidate);
  const promotable = isPromotable(candidate);
  const delta = match?.bestMatch ? formatPriceDelta(match.bestMatch.priceDelta, match.bestMatch.priceDeltaPct) : null;

  return (
    <section aria-label="Candidate evidence" className="flex flex-col gap-4 rounded-lg border border-border/70 bg-card p-4">
      <header>
        <h2 className="font-semibold text-foreground">{candidate.itemName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {candidate.trade} · {candidate.category} · {reviewStatusLabel(candidate.reviewStatus)}
        </p>
      </header>

      <div className="rounded-md border border-border/70 p-3">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Proposed pricing</h3>
        <p className="mt-2 font-mono text-lg tabular-nums text-foreground">
          {formatCurrency(candidate.materialCostTypical)} / {candidate.unitOfMeasure}
        </p>
        {candidate.materialCostLow !== null || candidate.materialCostHigh !== null ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Observed range {candidate.materialCostLow !== null ? formatCurrency(candidate.materialCostLow) : "n/a"} –{" "}
            {candidate.materialCostHigh !== null ? formatCurrency(candidate.materialCostHigh) : "n/a"}
          </p>
        ) : null}
      </div>

      <div className="rounded-md border border-border/70 p-3">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Existing Costbook comparison</h3>
        {match === null ? (
          <p className="mt-2 text-sm text-muted-foreground">Match analysis is unavailable right now.</p>
        ) : (
          <>
            <p className="mt-2 text-sm font-medium text-foreground">{matchStatusLabel(match.status)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{match.rationale}</p>
            {match.bestMatch ? (
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <DetailPair label="Matched item" value={`${match.bestMatch.code} · ${match.bestMatch.name}`} />
                <DetailPair
                  label="Current price"
                  value={match.bestMatch.currentUnitCost !== null ? formatCurrency(match.bestMatch.currentUnitCost) : "Not priceable"}
                />
                <DetailPair label="Difference" value={delta ?? "n/a"} />
              </dl>
            ) : null}
          </>
        )}
      </div>

      <div className="rounded-md border border-border/70 p-3">
        <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Provenance</h3>
        <p className="mt-2 text-sm font-medium text-foreground">{provenanceLabel(candidate.provenanceStatus)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{provenanceExplanation(candidate.provenanceStatus)}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <DetailPair label="Source" value={candidate.sourceName} />
          <DetailPair label="Source reference" value={candidate.sourceUrl ?? candidate.sourceIdentifier ?? "n/a"} />
          <DetailPair label="Observed" value={`${formatDate(candidate.sourceDate)} · ${freshnessLabel(candidate.sourceDate)}`} />
          <DetailPair label="Retrieved" value={formatDate(candidate.retrievedAt)} />
          <DetailPair label="Market basis" value={candidate.regionalBasis} />
          <DetailPair label="Confidence" value={candidate.confidence} />
        </dl>
        {candidate.researchNotes ? (
          <p className="mt-3 text-xs text-muted-foreground">{candidate.researchNotes}</p>
        ) : null}
      </div>

      {candidate.reviewedAt ? (
        <div className="rounded-md border border-border/70 p-3">
          <h3 className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Decision</h3>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <DetailPair label="Outcome" value={reviewStatusLabel(candidate.reviewStatus)} />
            <DetailPair label="Decided" value={formatDate(candidate.reviewedAt)} />
            <DetailPair label="Reviewer" value={candidate.reviewedByUserId ?? "n/a"} />
            {candidate.promotedCostItemId ? (
              <DetailPair label="Promoted to Cost Item" value={candidate.promotedCostItemId} />
            ) : null}
          </dl>
          {candidate.reviewNotes ? <p className="mt-3 text-xs text-muted-foreground">{candidate.reviewNotes}</p> : null}
        </div>
      ) : null}

      {capabilities.showActions ? (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
          {open ? (
            <form action={reviewCostbookCandidateAction} className="flex flex-col gap-3">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <label className="text-xs uppercase tracking-[0.14em] text-muted-foreground" htmlFor="reviewNotes">
                Review notes
              </label>
              <textarea
                id="reviewNotes"
                name="reviewNotes"
                rows={3}
                className="rounded-md border border-border bg-background p-2 text-sm"
                placeholder="What evidence supports this decision?"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="approved"
                  className="rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground"
                >
                  Approve
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="rejected"
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
                >
                  Reject
                </button>
              </div>
            </form>
          ) : null}

          {promotable ? (
            <form action={promoteCostbookCandidateAction} className="flex flex-col gap-2">
              <input type="hidden" name="candidateId" value={candidate.id} />
              <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">
                Promote to Costbook
              </button>
              <p className="text-xs text-muted-foreground">
                Creates a new Cost Item in this organization&apos;s Costbook. Existing estimates, proposals, contracts, and
                invoices keep the prices they already captured.
              </p>
            </form>
          ) : null}

          {!open && !promotable ? (
            <p className="text-sm text-muted-foreground">
              {candidate.promotedCostItemId
                ? "This candidate has already been promoted. A candidate can become at most one Cost Item."
                : "This candidate has been decided and needs no further action."}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
