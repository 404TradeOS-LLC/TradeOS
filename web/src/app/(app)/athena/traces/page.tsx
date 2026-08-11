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
  toSingleQueryValue,
  type AthenaTraceFilterInput,
} from "@/lib/athena-trace-query";
import { athenaKernelStates, searchAthenaTraces, type AthenaKernelState } from "@/lib/api";

export const metadata: Metadata = {
  title: "Athena Traces | TradeOS",
  description: "Search and inspect Athena request execution traces.",
};

const PAGE_LIMIT = 25;

// Next.js's searchParams type: every key may arrive as a string, a string[]
// (repeated query key), or undefined - see toSingleQueryValue's doc comment
// in athena-trace-query.ts for why that matters here.
type AthenaTracesRawSearchParams = Partial<Record<keyof AthenaTraceFilterInput | "cursor", string | string[] | undefined>>;

function isAthenaKernelState(value: string | undefined): value is AthenaKernelState {
  return value != null && (athenaKernelStates as readonly string[]).includes(value);
}

export default async function AthenaTracesPage({ searchParams }: { searchParams: Promise<AthenaTracesRawSearchParams> }) {
  const [access, rawQuery] = await Promise.all([getAthenaOperatorContext(), searchParams]);

  if (!access.granted) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Athena Traces" backHref="/athena" backLabel="Athena" description="Search and inspect Athena request execution traces." />
        <AthenaStatePanel state={access.state} />
      </div>
    );
  }

  const query = {
    traceId: toSingleQueryValue(rawQuery.traceId),
    requestId: toSingleQueryValue(rawQuery.requestId),
    executionId: toSingleQueryValue(rawQuery.executionId),
    status: toSingleQueryValue(rawQuery.status),
    toolId: toSingleQueryValue(rawQuery.toolId),
    model: toSingleQueryValue(rawQuery.model),
    provider: toSingleQueryValue(rawQuery.provider),
    actorUserId: toSingleQueryValue(rawQuery.actorUserId),
    from: toSingleQueryValue(rawQuery.from),
    to: toSingleQueryValue(rawQuery.to),
    cursor: toSingleQueryValue(rawQuery.cursor),
  };

  // A status value that isn't one of the canonical AthenaKernelState values
  // (bad manual URL, stale bookmark, etc.) is dropped rather than trusted
  // and cast - it's treated the same as "no status filter" instead of being
  // forwarded to the backend or blowing up the `as AthenaKernelState` cast.
  const validatedStatus = isAthenaKernelState(query.status) ? query.status : undefined;

  const filters: AthenaTraceFilterInput = {
    traceId: query.traceId,
    requestId: query.requestId,
    executionId: query.executionId,
    status: validatedStatus,
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
      status: validatedStatus,
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
