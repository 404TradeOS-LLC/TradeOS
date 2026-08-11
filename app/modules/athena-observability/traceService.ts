import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { computeTraceCompleteness } from "./completeness";
import type { AthenaKernelState, AthenaTelemetryCost, AthenaTelemetryRedaction, AthenaTelemetrySpanType, AthenaTelemetryStatus } from "../athena-kernel/types";
import type { AthenaTelemetrySpan, AthenaTraceDetail, AthenaTraceExecutionSummary, AthenaTraceSearchFilters, AthenaTraceSearchResult, AthenaTraceSearchResultRow, AthenaTraceTransition } from "./types";

// A10 trace query service (docs/athena/roadmap/A10-observability-implementation-plan.md
// "Trace query service"). This is a read model only - it never writes to
// athena_executions/athena_execution_transitions/athena_telemetry_records
// (those are owned by athena-kernel/executionStore.ts) and it never imports
// basePrisma: every query goes through the request-scoped RLS session via
// app/db/client.ts's prisma proxy, with orgId also passed explicitly in
// every where clause as defense in depth (this repo's standing convention -
// see executionStore.ts).

const DEFAULT_SEARCH_LIMIT = 50;
const MAX_SEARCH_LIMIT = 200;

type AthenaExecutionRow = {
  id: string;
  orgId: string;
  requestId: string;
  traceId: string;
  actorUserId: string;
  canonicalRole: string;
  requestSource: string;
  state: string;
  roundTrips: number;
  safeSummary: string | null;
  safeErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

type AthenaExecutionTransitionRow = {
  fromState: string | null;
  toState: string;
  reasonCode: string;
  createdAt: Date;
};

type AthenaTelemetryRecordRowShape = {
  id: string;
  orgId: string;
  executionId: string;
  requestId: string;
  traceId: string;
  spanType: string;
  status: string;
  durationMs: number;
  redaction: string;
  costJson: unknown;
  metadataJson: unknown;
  createdAt: Date;
};

function toExecutionSummary(execution: AthenaExecutionRow): AthenaTraceExecutionSummary {
  return {
    executionId: execution.id,
    orgId: execution.orgId,
    requestId: execution.requestId,
    traceId: execution.traceId,
    actorUserId: execution.actorUserId,
    canonicalRole: execution.canonicalRole,
    requestSource: execution.requestSource,
    state: execution.state as AthenaKernelState,
    roundTrips: execution.roundTrips,
    safeSummary: execution.safeSummary,
    safeErrorCode: execution.safeErrorCode,
    createdAt: execution.createdAt.toISOString(),
    updatedAt: execution.updatedAt.toISOString(),
    completedAt: execution.completedAt ? execution.completedAt.toISOString() : null,
  };
}

function toTransition(row: AthenaExecutionTransitionRow): AthenaTraceTransition {
  return {
    fromState: row.fromState as AthenaKernelState | null,
    toState: row.toState as AthenaKernelState,
    reasonCode: row.reasonCode,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSpan(row: AthenaTelemetryRecordRowShape): AthenaTelemetrySpan {
  return {
    id: row.id,
    orgId: row.orgId,
    executionId: row.executionId,
    requestId: row.requestId,
    traceId: row.traceId,
    spanType: row.spanType as AthenaTelemetrySpanType,
    status: row.status as AthenaTelemetryStatus,
    durationMs: row.durationMs,
    redaction: row.redaction as AthenaTelemetryRedaction,
    cost: (row.costJson as AthenaTelemetryCost | null | undefined) ?? null,
    metadata: (row.metadataJson as Record<string, unknown> | null | undefined) ?? {},
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadTraceDetail(execution: AthenaExecutionRow): Promise<AthenaTraceDetail> {
  const [transitionRows, spanRows] = await Promise.all([
    prisma.athenaExecutionTransition.findMany({
      where: { orgId: execution.orgId, executionId: execution.id },
      orderBy: { createdAt: "asc" },
    }),
    // Spans are looked up by traceId, not executionId: types.ts's
    // AthenaTraceDetail comment documents traceId as the join key for trace
    // reconstruction ("every C011 span recorded under its traceId"). The two
    // are 1:1 with executions today, but this keeps the lookup key the one
    // the contract actually names.
    prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId: execution.orgId, traceId: execution.traceId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const spans = (spanRows as AthenaTelemetryRecordRowShape[]).map(toSpan);

  return {
    execution: toExecutionSummary(execution),
    transitions: (transitionRows as AthenaExecutionTransitionRow[]).map(toTransition),
    spans,
    completeness: computeTraceCompleteness(execution.state as AthenaKernelState, spans),
  };
}

export async function getTrace(orgId: string, traceId: string): Promise<AthenaTraceDetail | null> {
  const execution = await prisma.athenaExecution.findFirst({ where: { orgId, traceId } });
  if (!execution) return null;
  return loadTraceDetail(execution as AthenaExecutionRow);
}

export async function getTraceByRequest(orgId: string, requestId: string): Promise<AthenaTraceDetail | null> {
  // requestId is not a unique key the same way traceId is meant to be
  // (AthenaTraceSearchFilters' comment in types.ts) - today the kernel
  // creates exactly one execution per HTTP request, but this does not rely
  // on that beyond picking one deterministic match: the most recently
  // created execution for this (orgId, requestId) pair.
  const execution = await prisma.athenaExecution.findFirst({
    where: { orgId, requestId },
    orderBy: { createdAt: "desc" },
  });
  if (!execution) return null;
  return loadTraceDetail(execution as AthenaExecutionRow);
}

function clampSearchLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_SEARCH_LIMIT);
}

// toolId lives on "action" span metadata; model/provider live on "model"
// span metadata (service.ts's emitSpan call sites - see the milestone
// prompt). A search that names both a toolId and a model/provider filter
// therefore intersects two independent span-type queries, not a single
// query with both JSON paths on one row - those metadata fields never
// appear on the same span. Returns null when no span-level filter was
// requested (meaning "no additional restriction"), or a (possibly empty)
// set of matching execution ids otherwise.
async function resolveSpanFilterExecutionIds(filters: AthenaTraceSearchFilters): Promise<Set<string> | null> {
  const sets: Set<string>[] = [];

  if (filters.toolId) {
    const rows = await prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId: filters.orgId, spanType: "action", metadataJson: { path: ["toolId"], equals: filters.toolId } },
      select: { executionId: true },
      distinct: ["executionId"],
    });
    sets.push(new Set(rows.map((row) => row.executionId)));
  }

  if (filters.model || filters.provider) {
    const modelConditions: Prisma.AthenaTelemetryRecordRowWhereInput[] = [];
    if (filters.provider) modelConditions.push({ metadataJson: { path: ["provider"], equals: filters.provider } });
    if (filters.model) modelConditions.push({ metadataJson: { path: ["model"], equals: filters.model } });
    const rows = await prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId: filters.orgId, spanType: "model", AND: modelConditions },
      select: { executionId: true },
      distinct: ["executionId"],
    });
    sets.push(new Set(rows.map((row) => row.executionId)));
  }

  if (sets.length === 0) return null;
  return sets.reduce((acc, next) => new Set([...acc].filter((id) => next.has(id))));
}

export async function searchTraces(filters: AthenaTraceSearchFilters): Promise<AthenaTraceSearchResult> {
  const limit = clampSearchLimit(filters.limit);

  const spanFilterExecutionIds = await resolveSpanFilterExecutionIds(filters);
  if (spanFilterExecutionIds !== null && spanFilterExecutionIds.size === 0) {
    return { rows: [], nextCursor: null };
  }

  // Each optional predicate is pushed as its own object into a single AND
  // array rather than spread onto one object literal, mirroring
  // modules/jobs/service.ts's buildJobWhere: executionId (a direct filter)
  // and the span-filter id-in-list both use the `id` key, and a plain
  // object spread would let the later one silently clobber the earlier one
  // instead of combining them.
  const conditions: Prisma.AthenaExecutionWhereInput[] = [{ orgId: filters.orgId }];
  if (filters.traceId) conditions.push({ traceId: filters.traceId });
  if (filters.requestId) conditions.push({ requestId: filters.requestId });
  if (filters.executionId) conditions.push({ id: filters.executionId });
  if (filters.status) conditions.push({ state: filters.status });
  if (filters.actorUserId) conditions.push({ actorUserId: filters.actorUserId });
  if (filters.from || filters.to) {
    conditions.push({
      createdAt: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lt: new Date(filters.to) } : {}),
      },
    });
  }
  if (spanFilterExecutionIds !== null) {
    conditions.push({ id: { in: Array.from(spanFilterExecutionIds) } });
  }

  // Cursor pagination: the cursor is the previous page's last execution id,
  // ordered (createdAt desc, id desc). "Strictly after that row's position"
  // means every row that sorts later in that same order, i.e. a strictly
  // smaller createdAt, or an equal createdAt with a strictly smaller id.
  if (filters.cursor) {
    const cursorRow = await prisma.athenaExecution.findFirst({
      where: { orgId: filters.orgId, id: filters.cursor },
      select: { id: true, createdAt: true },
    });
    // A cursor that no longer resolves (deleted row, or - defensively -
    // one from a different org) is treated as absent rather than erroring:
    // callers only ever pass back a cursor this function itself returned
    // for the same orgId, so this only guards against a stale/tampered
    // value, and failing open to "start from the top" is safe since every
    // other filter (starting with orgId) still applies.
    if (cursorRow) {
      conditions.push({
        OR: [{ createdAt: { lt: cursorRow.createdAt } }, { AND: [{ createdAt: cursorRow.createdAt }, { id: { lt: cursorRow.id } }] }],
      });
    }
  }

  const where: Prisma.AthenaExecutionWhereInput = { AND: conditions };

  const executions = (await prisma.athenaExecution.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  })) as AthenaExecutionRow[];

  if (executions.length === 0) {
    return { rows: [], nextCursor: null };
  }

  // Single grouped aggregate over the page's execution ids (not one query
  // per row): spanCount/errorSpanCount/totalCostUsd are all derived from
  // one telemetry findMany, reduced in JS.
  const executionIds = executions.map((execution) => execution.id);
  const telemetryRows = await prisma.athenaTelemetryRecordRow.findMany({
    where: { orgId: filters.orgId, executionId: { in: executionIds } },
    select: { executionId: true, status: true, costJson: true },
  });

  const aggregates = new Map<string, { spanCount: number; errorSpanCount: number; totalCostUsd: number; hasCost: boolean }>();
  for (const row of telemetryRows as { executionId: string; status: string; costJson: unknown }[]) {
    const aggregate = aggregates.get(row.executionId) ?? { spanCount: 0, errorSpanCount: 0, totalCostUsd: 0, hasCost: false };
    aggregate.spanCount += 1;
    if (row.status === "error") aggregate.errorSpanCount += 1;
    const cost = row.costJson as AthenaTelemetryCost | null | undefined;
    if (cost && typeof cost.estimatedUsd === "number") {
      aggregate.totalCostUsd += cost.estimatedUsd;
      aggregate.hasCost = true;
    }
    aggregates.set(row.executionId, aggregate);
  }

  const rows: AthenaTraceSearchResultRow[] = executions.map((execution) => {
    const aggregate = aggregates.get(execution.id);
    return {
      execution: toExecutionSummary(execution),
      spanCount: aggregate?.spanCount ?? 0,
      errorSpanCount: aggregate?.errorSpanCount ?? 0,
      totalCostUsd: aggregate?.hasCost ? aggregate.totalCostUsd : null,
    };
  });

  const nextCursor = executions.length === limit ? executions[executions.length - 1].id : null;

  return { rows, nextCursor };
}
