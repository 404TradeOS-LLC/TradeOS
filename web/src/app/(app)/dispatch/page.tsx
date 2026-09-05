import type { Metadata } from "next";
import { DispatchFilterBar } from "@/components/dispatch/dispatch-filter-bar";
import { DispatchPagination } from "@/components/dispatch/dispatch-pagination";
import { DispatchSummaryStrip } from "@/components/dispatch/dispatch-summary-strip";
import { DispatchWorkQueueTable } from "@/components/dispatch/dispatch-work-queue-table";
import { DispatchObservabilityPanel } from "@/components/dispatch/dispatch-observability-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  ApiClientError,
  getDispatchSummary,
  getOrganizationSettings,
  listActivityEvents,
  listJobsForDispatch,
  toInclusiveEndBoundary,
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
  view?: string;
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

// Builds a /dispatch URL preserving every current filter except the ones
// explicitly overridden - used by pagination so Previous/Next never drop
// the active status/scheduled/assigned/search/view filters.
function buildDispatchHref(query: DispatchSearchParams, overrides: Partial<DispatchSearchParams>): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.view && merged.view !== "attention") params.set("view", merged.view);
  if (merged.status) params.set("status", merged.status);
  if (merged.scheduled && merged.scheduled !== "all") params.set("scheduled", merged.scheduled);
  if (merged.assigned && merged.assigned !== "all") params.set("assigned", merged.assigned);
  if (merged.q) params.set("q", merged.q);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/dispatch?${qs}` : "/dispatch";
}

export default async function DispatchPage({ searchParams }: { searchParams: Promise<DispatchSearchParams> }) {
  const [token, query] = await Promise.all([getSessionToken(), searchParams]);

  let summary: DispatchSummary | null = null;
  let loadError: string | null = null;
  let canManageInvoiceReadiness = false;
  let activity: Awaited<ReturnType<typeof listActivityEvents>> = [];
  let activityError: string | null = null;

  if (!token) {
    loadError = "You need to be signed in to view the dispatch workspace.";
  } else {
    try {
      const [dispatchSummary, settings] = await Promise.all([getDispatchSummary(token), getOrganizationSettings(token)]);
      summary = dispatchSummary;
      canManageInvoiceReadiness = ["owner", "admin", "dispatcher"].includes(settings.currentRole);
      try {
        activity = await listActivityEvents(token, { entityType: "job", limit: 8 });
      } catch (error) {
        activityError = toErrorMessage(error, "Unable to load recent dispatch activity.");
      }
    } catch (error) {
      loadError = toErrorMessage(error, "Unable to load the dispatch summary from the backend.");
    }
  }

  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Dispatchers land on "jobs needing attention" by default - this is the
  // whole point of the workspace (see the page copy and summary strip
  // below) - not every unarchived job in the org. The default is explicit
  // (visible and changeable via the "View" filter, not a hidden default),
  // shareable via ?view=all, and there is always a reachable way back to
  // the full queue: the View select itself, and the empty state's "Clear
  // filters" action, which points at ?view=all rather than looping back to
  // this same default.
  const view = query.view === "all" || query.view === "invoice-ready" ? query.view : "attention";

  const params: DispatchJobListParams = { page, pageSize: PAGE_SIZE };
  if (view === "attention") params.needsAttention = true;
  if (view === "invoice-ready") {
    params.status = "completed";
    params.readyForInvoice = false;
  }
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
      view !== "all" ||
      query.status ||
      query.q ||
      (query.assigned && query.assigned !== "all") ||
      (query.scheduled && query.scheduled !== "all") ||
      page > 1
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dispatch"
        description="Real jobs needing dispatcher attention - scheduling, assignment, and overdue status, pulled live from the backend. Nothing on this page is fabricated: an empty organization shows as empty here."
      />

      {loadError ? (
        <EmptyState
          title="Couldn't load dispatch data"
          description={loadError}
        />
      ) : (
        <>
          {summary ? <DispatchSummaryStrip summary={summary} /> : null}

          {summary ? <DispatchObservabilityPanel summary={summary} activity={activity} activityError={activityError} /> : null}

          <DispatchFilterBar view={view} status={query.status} scheduled={query.scheduled} assigned={query.assigned} q={query.q} />

          <DispatchWorkQueueTable jobs={jobs} isFiltered={isFiltered} total={total} timezone={summary?.timezone.value ?? "UTC"} canManageInvoiceReadiness={canManageInvoiceReadiness} />

          <DispatchPagination page={page} pageSize={PAGE_SIZE} total={total} buildHref={(targetPage) => buildDispatchHref(query, { page: String(targetPage) })} />
        </>
      )}
    </div>
  );
}
