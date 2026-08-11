import type { Metadata } from "next";
import { AthenaSectionTabs } from "@/components/athena/athena-section-tabs";
import { AthenaStatePanel } from "@/components/athena/athena-state-panel";
import { AthenaTraceFilterBar } from "@/components/athena/athena-trace-filter-bar";
import { AthenaTracePagination } from "@/components/athena/athena-trace-pagination";
import { AthenaTraceResults } from "@/components/athena/athena-trace-results";
import { PageHeader } from "@/components/shared/page-header";
import { getAthenaOperatorContext } from "@/lib/athena-access";
import { describeAthenaLoadError } from "@/lib/athena-state";
import {
  athenaDatetimeLocalToIso,
  buildAthenaTracesHref,
  isAthenaTraceFiltered,
  type AthenaTraceFilterInput,
} from "@/lib/athena-trace-query";
import { searchAthenaTraces, type AthenaKernelState } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Traces | TradeOS",
  description: "Search and inspect Athena request execution traces.",
};

const PAGE_LIMIT = 25;

interface AthenaTracesSearchParams extends AthenaTraceFilterInput {
  cursor?: string;
}

export default async function AthenaTracesPage({ searchParams }: { searchParams: Promise<AthenaTracesSearchParams> }) {
  const [access, query] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Athena Traces" backHref="/athena" backLabel="Athena" description="Search and inspect Athena request execution traces." />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const filters: AthenaTraceFilterInput = {
    traceId: query.traceId,
    requestId: query.requestId,
    executionId: query.executionId,
    status: query.status,
    toolId: query.toolId,
    model: query.model,
    provider: query.provider,
    actorUserId: query.actorUserId,
    from: query.from,
    to: query.to,
  };
  const isFiltered = isAthenaTraceFiltered(filters);

  let rows: Awaited<ReturnType<typeof searchAthenaTraces>>["rows"] = [];
  let nextCursor: string | null = null;
  let loadState: ReturnType<typeof describeAthenaLoadError> | null = null;

  try {
    const result = await searchAthenaTraces(access.token, {
      traceId: filters.traceId || undefined,
      requestId: filters.requestId || undefined,
      executionId: filters.executionId || undefined,
      status: (filters.status as AthenaKernelState) || undefined,
      toolId: filters.toolId || undefined,
      model: filters.model || undefined,
      provider: filters.provider || undefined,
      actorUserId: filters.actorUserId || undefined,
      from: athenaDatetimeLocalToIso(filters.from),
      to: athenaDatetimeLocalToIso(filters.to),
      limit: PAGE_LIMIT,
      cursor: query.cursor || undefined,
    });
    rows = result.rows;
    nextCursor = result.nextCursor;
  } catch (error) {
    loadState = describeAthenaLoadError(error);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Athena Traces" backHref="/athena" backLabel="Athena" description="Search and inspect Athena request execution traces." />
      <AthenaSectionTabs active="traces" />

      {loadState ? (
        <AthenaStatePanel state={loadState} />
      ) : (
        <>
          <AthenaTraceFilterBar filters={filters} />
          <AthenaTraceResults rows={rows} isFiltered={isFiltered} />
          <AthenaTracePagination
            nextHref={nextCursor ? buildAthenaTracesHref(filters, nextCursor) : null}
            hasCursor={Boolean(query.cursor)}
            resetHref={buildAthenaTracesHref(filters)}
          />
        </>
      )}
    </div>
  );
}
