import type { Metadata } from "next";
import { DispatchFilterBar } from "@/components/dispatch/dispatch-filter-bar";
import { DispatchPagination } from "@/components/dispatch/dispatch-pagination";
import { ScheduleBoard, ScheduleModeNav, type ScheduleMode } from "@/components/dispatch/schedule-board";
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
  type DispatchJob,
  type DispatchJobListParams,
  type DispatchSummary,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { canCaptureSiteVisit } from "@/lib/site-visit-continuity";

export const metadata: Metadata = {
  title: "Schedule | TradeOS",
  description: "Schedule and dispatch real Jobs using organization-timezone windows, technician assignments, and the existing conflict engine.",
};

const PAGE_SIZE = 25;
const BOARD_PAGE_SIZE = 100;

interface DispatchSearchParams {
  mode?: string;
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

function buildDispatchHref(query: DispatchSearchParams, overrides: Partial<DispatchSearchParams>): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.mode && merged.mode !== "day") params.set("mode", merged.mode);
  if (merged.view) params.set("view", merged.view);
  if (merged.status) params.set("status", merged.status);
  if (merged.scheduled && merged.scheduled !== "all") params.set("scheduled", merged.scheduled);
  if (merged.assigned && merged.assigned !== "all") params.set("assigned", merged.assigned);
  if (merged.q) params.set("q", merged.q);
  if (merged.page && merged.page !== "1") params.set("page", merged.page);
  const qs = params.toString();
  return qs ? `/dispatch?${qs}` : "/dispatch";
}

function resolveScheduleMode(query: DispatchSearchParams): ScheduleMode | null {
  const queueRequested = Boolean(query.view || query.status || query.scheduled || query.assigned || query.q || query.page);
  if (queueRequested) return null;
  if (query.mode === "week") return "week";
  if (query.mode === "crew") return "crew";
  return "day";
}

export default async function DispatchPage({ searchParams }: { searchParams: Promise<DispatchSearchParams> }) {
  const [token, query] = await Promise.all([getSessionToken(), searchParams]);
  const scheduleMode = resolveScheduleMode(query);

  let summary: DispatchSummary | null = null;
  let loadError: string | null = null;
  let canManageInvoiceReadiness = false;
  let canCaptureSiteVisits = false;
  let activity: Awaited<ReturnType<typeof listActivityEvents>> = [];
  let activityError: string | null = null;

  let scheduledJobs: DispatchJob[] = [];
  let scheduledTotal = 0;
  let unscheduledJobs: DispatchJob[] = [];
  let unscheduledTotal = 0;

  if (!token) {
    loadError = "You need to be signed in to view the schedule workspace.";
  } else {
    try {
      const [dispatchSummary, settings] = await Promise.all([getDispatchSummary(token), getOrganizationSettings(token)]);
      summary = dispatchSummary;
      canManageInvoiceReadiness = ["owner", "admin", "dispatcher"].includes(settings.currentRole);
      canCaptureSiteVisits = canCaptureSiteVisit(settings.currentRole);

      if (scheduleMode) {
        const range = scheduleMode === "day" ? dispatchSummary.todayRangeUtc : dispatchSummary.weekRangeUtc;
        const scheduledTo = toInclusiveEndBoundary(range.end);
        const [scheduledResult, unscheduledResult] = await Promise.all([
          listJobsForDispatch(token, {
            scheduledFrom: range.start,
            scheduledTo,
            page: 1,
            pageSize: BOARD_PAGE_SIZE,
          }),
          listJobsForDispatch(token, {
            status: "unscheduled",
            page: 1,
            pageSize: BOARD_PAGE_SIZE,
          }),
        ]);

        scheduledJobs = scheduledResult.items;
        scheduledTotal = scheduledResult.total;
        unscheduledJobs = unscheduledResult.items;
        unscheduledTotal = unscheduledResult.total;
      } else {
        try {
          activity = await listActivityEvents(token, { entityType: "job", limit: 8 });
        } catch (error) {
          activityError = toErrorMessage(error, "Unable to load recent dispatch activity.");
        }
      }
    } catch (error) {
      loadError = toErrorMessage(error, "Unable to load scheduling data from the backend.");
    }
  }

  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const view = query.view === "all" || query.view === "invoice-ready" ? query.view : "attention";

  const params: DispatchJobListParams = { page, pageSize: PAGE_SIZE };
  if (!scheduleMode) {
    if (view === "attention") params.needsAttention = true;
    if (view === "invoice-ready") {
      params.status = "completed";
      params.readyForInvoice = false;
    }
    if (query.status) params.status = query.status;
    if (query.q) params.search = query.q;
    if (query.assigned === "unassigned") params.unassigned = true;
    if (query.assigned === "assigned") params.unassigned = false;

    if (summary && query.scheduled === "today") {
      params.scheduledFrom = summary.todayRangeUtc.start;
      params.scheduledTo = toInclusiveEndBoundary(summary.todayRangeUtc.end);
    } else if (summary && query.scheduled === "week") {
      params.scheduledFrom = summary.weekRangeUtc.start;
      params.scheduledTo = toInclusiveEndBoundary(summary.weekRangeUtc.end);
    }
  }

  let jobs: Awaited<ReturnType<typeof listJobsForDispatch>>["items"] = [];
  let total = 0;

  if (token && !loadError && !scheduleMode) {
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Schedule"
        description="Plan real Jobs, technician assignments, and dispatch timing from one workspace. Schedule writes stay on the existing conflict-aware Job contract."
      />

      <ScheduleModeNav mode={scheduleMode ?? (view === "attention" ? "attention" : "queue")} />

      {loadError ? (
        <EmptyState title="Couldn't load schedule data" description={loadError} />
      ) : scheduleMode && summary ? (
        <ScheduleBoard
          mode={scheduleMode}
          scheduledJobs={scheduledJobs}
          scheduledTotal={scheduledTotal}
          unscheduledJobs={unscheduledJobs}
          unscheduledTotal={unscheduledTotal}
          timezone={summary.timezone.value}
          canManageInvoiceReadiness={canManageInvoiceReadiness}
          canCaptureSiteVisits={canCaptureSiteVisits}
        />
      ) : (
        <>
          {summary ? <DispatchSummaryStrip summary={summary} /> : null}
          {summary ? <DispatchObservabilityPanel summary={summary} activity={activity} activityError={activityError} /> : null}
          <DispatchFilterBar view={view} status={query.status} scheduled={query.scheduled} assigned={query.assigned} q={query.q} />
          <DispatchWorkQueueTable
            jobs={jobs}
            isFiltered={isFiltered}
            total={total}
            timezone={summary?.timezone.value ?? "UTC"}
            canManageInvoiceReadiness={canManageInvoiceReadiness}
          />
          <DispatchPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            buildHref={(targetPage) => buildDispatchHref(query, { page: String(targetPage) })}
          />
        </>
      )}
    </div>
  );
}
