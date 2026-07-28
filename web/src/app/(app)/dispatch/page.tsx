import type { Metadata } from "next";
import { DispatchFilterBar } from "@/components/dispatch/dispatch-filter-bar";
import { DispatchSummaryStrip } from "@/components/dispatch/dispatch-summary-strip";
import { DispatchWorkQueueTable } from "@/components/dispatch/dispatch-work-queue-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ApiClientError,
  getDispatchSummary,
  listJobsForDispatch,
  type DispatchJobListParams,
  type DispatchSummary,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";

export const metadata: Metadata = {
  title: "Dispatch | TradeOS",
  description: "Real jobs needing dispatcher attention - scheduling, assignment, and overdue status pulled live from the backend.",
};

const PAGE_SIZE = 25;

interface DispatchSearchParams {
  status?: string;
  scheduled?: string;
  assigned?: string;
  q?: string;
  page?: string;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return error.message || fallback;
  return fallback;
}

// Converts an exclusive UTC boundary (start of the next day/window, as
// returned by the backend's todayRangeUtc.end/weekRangeUtc.end) into the
// inclusive boundary that GET /api/v1/jobs's `scheduledTo` filter expects.
function toInclusiveEndBoundary(exclusiveEndIso: string): string {
  return new Date(new Date(exclusiveEndIso).getTime() - 1).toISOString();
}

export default async function DispatchPage({ searchParams }: { searchParams: Promise<DispatchSearchParams> }) {
  const [token, query] = await Promise.all([getSessionToken(), searchParams]);

  let summary: DispatchSummary | null = null;
  let loadError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view the dispatch workspace.";
  } else {
    try {
      summary = await getDispatchSummary(token);
    } catch (error) {
      loadError = toErrorMessage(error, "Unable to load the dispatch summary from the backend.");
    }
  }

  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const params: DispatchJobListParams = { page, pageSize: PAGE_SIZE };
  if (query.status) params.status = query.status;
  if (query.q) params.search = query.q;
  if (query.assigned === "unassigned") params.unassigned = true;
  if (query.assigned === "assigned") params.unassigned = false;

  // Never compute "today"/"this week" boundaries in the frontend - always
  // use the backend-provided ranges from the summary call, which already
  // account for the organization's timezone (or the UTC fallback).
  //
  // dispatchRules.getOrgDayBoundaryUtc/getRollingWindowUtc document `end` as
  // an EXCLUSIVE upper bound (the start of the next day/window), matching
  // how JobsService.getDispatchSummary itself queries `scheduledStart: { lt:
  // todayEnd }`. But GET /api/v1/jobs's `scheduledTo` filter
  // (buildJobWhere's `scheduledStart: { lte: filters.scheduledTo }`) is
  // INCLUSIVE. Passing the exclusive boundary straight through would let a
  // job scheduled at exactly local midnight of the next day slip into
  // "today"/"this week", even though the summary strip's own counts
  // correctly exclude it. Subtract 1ms to convert the exclusive boundary
  // into the inclusive one this endpoint actually expects.
  if (summary && query.scheduled === "today") {
    params.scheduledFrom = summary.todayRangeUtc.start;
    params.scheduledTo = toInclusiveEndBoundary(summary.todayRangeUtc.end);
  } else if (summary && query.scheduled === "week") {
    params.scheduledFrom = summary.weekRangeUtc.start;
    params.scheduledTo = toInclusiveEndBoundary(summary.weekRangeUtc.end);
  }

  let jobs: Awaited<ReturnType<typeof listJobsForDispatch>>["items"] = [];
  let total = 0;

  if (token && !loadError) {
    try {
      const result = await listJobsForDispatch(token, params);
      jobs = result.items;
      total = result.total;
    } catch (error) {
      loadError = toErrorMessage(error, "Unable to load jobs from the backend.");
    }
  }

  const isFiltered = Boolean(
    query.status || query.q || (query.assigned && query.assigned !== "all") || (query.scheduled && query.scheduled !== "all") || page > 1
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dispatch</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Real jobs needing dispatcher attention - scheduling, assignment, and overdue status, pulled live from the backend. Nothing on this page
          is fabricated: an empty organization shows as empty here.
        </p>
      </div>

      {loadError ? (
        <EmptyState
          title="Couldn't load dispatch data"
          description={loadError}
        />
      ) : (
        <>
          {summary ? <DispatchSummaryStrip summary={summary} /> : null}

          <DispatchFilterBar status={query.status} scheduled={query.scheduled} assigned={query.assigned} q={query.q} />

          <DispatchWorkQueueTable jobs={jobs} isFiltered={isFiltered} total={total} />
        </>
      )}
    </div>
  );
}
