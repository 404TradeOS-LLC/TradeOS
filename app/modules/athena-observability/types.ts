import type { AthenaKernelState } from "../athena-kernel/types";
import type { AthenaTelemetryCost, AthenaTelemetryRedaction, AthenaTelemetryStatus, AthenaTelemetrySpanType } from "../athena-kernel/types";

// A10 Observability contracts (docs/athena/roadmap/
// A10-observability-implementation-plan.md). Every type here is a read
// model over the existing C011 telemetry / A1 execution / A8 event tables -
// there is no ObservabilityRecordV2 and no second telemetry format. Fields
// are deliberately restricted to IDs, durations, statuses, error codes,
// tool/action references, cost metadata, and safe summaries - never raw
// prompts, model output, or hidden reasoning (docs/athena/09-security/README.md).

export type { AthenaKernelState };

// One row from athena_telemetry_records, reshaped for display. metadata is
// passed through as-is: it is already sanitized at write time by
// athena-kernel/telemetry.ts's sanitizeMetadata()/assertValidTelemetryRecord,
// so this read path does not need to (and must not) re-implement redaction -
// it only ever surfaces what write-time redaction already allowed through.
export interface AthenaTelemetrySpan {
  id: string;
  orgId: string;
  executionId: string;
  requestId: string;
  traceId: string;
  spanType: AthenaTelemetrySpanType;
  status: AthenaTelemetryStatus;
  durationMs: number;
  redaction: AthenaTelemetryRedaction;
  cost: AthenaTelemetryCost | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AthenaTraceExecutionSummary {
  executionId: string;
  orgId: string;
  requestId: string;
  traceId: string;
  actorUserId: string;
  canonicalRole: string;
  requestSource: string;
  state: AthenaKernelState;
  roundTrips: number;
  safeSummary: string | null;
  safeErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AthenaTraceTransition {
  fromState: AthenaKernelState | null;
  toState: AthenaKernelState;
  reasonCode: string;
  createdAt: string;
}

// Full reconstructed trace (docs/athena/roadmap/
// A10-observability-implementation-plan.md "Trace requirements"): the
// execution record, its lifecycle transitions, and every C011 span recorded
// under its traceId, in chronological order. Only stages that actually
// occurred are present - callers must not assume a fixed stage list.
export interface AthenaTraceDetail {
  execution: AthenaTraceExecutionSummary;
  transitions: AthenaTraceTransition[];
  spans: AthenaTelemetrySpan[];
  completeness: AthenaTraceCompleteness;
}

export interface AthenaTraceCompleteness {
  expectedSpanTypes: AthenaTelemetrySpanType[];
  observedSpanTypes: AthenaTelemetrySpanType[];
  missingSpanTypes: AthenaTelemetrySpanType[];
  score: number; // 0..1, observed-expected / expected
}

export interface AthenaTraceSearchFilters {
  orgId: string;
  traceId?: string;
  requestId?: string;
  executionId?: string;
  status?: AthenaKernelState;
  toolId?: string;
  model?: string;
  provider?: string;
  actorUserId?: string;
  from?: string; // ISO timestamp, inclusive
  to?: string; // ISO timestamp, exclusive
  limit?: number; // bounded, default/max enforced by the query layer
  cursor?: string; // opaque, execution id of the last row from the previous page
}

export interface AthenaTraceSearchResultRow {
  execution: AthenaTraceExecutionSummary;
  spanCount: number;
  errorSpanCount: number;
  totalCostUsd: number | null;
}

export interface AthenaTraceSearchResult {
  rows: AthenaTraceSearchResultRow[];
  nextCursor: string | null;
}

// Overview / reliability + latency metrics (docs/athena/roadmap/
// A10-observability-implementation-plan.md "Metrics").
export interface AthenaMetricsWindow {
  from: string;
  to: string;
}

export interface AthenaOverviewMetrics {
  window: AthenaMetricsWindow;
  requestCount: number;
  successRate: number;
  errorRate: number;
  degradedRate: number;
  deniedRate: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
  latencyMsP99: number | null;
  totalCostUsd: number;
  averageTraceCompleteness: number | null;
}

export interface AthenaToolMetric {
  toolId: string;
  invocationCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
}

export interface AthenaModelMetric {
  provider: string;
  model: string;
  invocationCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
}

export interface AthenaCostSummary {
  window: AthenaMetricsWindow;
  totalEstimatedUsd: number;
  costPerRequestUsd: number | null;
  costPerSuccessfulRequestUsd: number | null;
  byProvider: { provider: string; estimatedUsd: number }[];
  byModel: { provider: string; model: string; estimatedUsd: number }[];
}

export interface AthenaEventHealthSummary {
  window: AthenaMetricsWindow;
  eventCount: number;
  deliveryCount: number;
  deliverySuccessRate: number;
  pendingRetryCount: number;
  deadLetterCount: number;
  deadLetterCountByType: { type: string; count: number }[];
}

// Alerts (persisted in athena_alerts - see prisma/schema.prisma). Severity
// and status vocabularies are fixed and enforced by the migration's check
// constraints; this type must stay in sync with them.
export const athenaAlertSeverities = ["critical", "high", "medium", "low"] as const;
export type AthenaAlertSeverity = (typeof athenaAlertSeverities)[number];

export const athenaAlertStatuses = ["active", "resolved"] as const;
export type AthenaAlertStatus = (typeof athenaAlertStatuses)[number];

export const athenaAlertRuleIds = [
  "athena_error_spike",
  "tool_failure_spike",
  "provider_failure_spike",
  "latency_regression",
  "trace_completeness_drop",
  "event_dlq_growth",
  "cost_spike",
  "unauthorized_execution",
  "approval_bypass_attempt",
  "telemetry_write_failure",
] as const;
export type AthenaAlertRuleId = (typeof athenaAlertRuleIds)[number];

export interface AthenaAlertRecord {
  id: string;
  orgId: string;
  ruleId: AthenaAlertRuleId;
  dedupeKey: string;
  severity: AthenaAlertSeverity;
  status: AthenaAlertStatus;
  summary: string;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

// One rule's evaluation over the current window for one org. `firing` false
// with an existing active alert for the same dedupeKey means the evaluator
// should resolve it, not merely skip creating a new one.
export interface AthenaAlertEvaluation {
  ruleId: AthenaAlertRuleId;
  dedupeKey: string;
  firing: boolean;
  severity: AthenaAlertSeverity;
  summary: string;
  metadata: Record<string, unknown>;
}

// Exporters (docs/athena/roadmap/A10-observability-implementation-plan.md
// "Exporters and retention"). An exporter failure must never affect a real
// Athena execution - callers invoke exporters out-of-band (script/cron),
// never inline with request handling.
export interface AthenaObservabilityExportBatch {
  spans: AthenaTelemetrySpan[];
  windowFrom: string;
  windowTo: string;
}

export interface AthenaObservabilityExportResult {
  exporterId: string;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

export interface AthenaObservabilityExporter {
  id: string;
  timeoutMs: number;
  export(batch: AthenaObservabilityExportBatch): Promise<{ succeeded: number; failed: number; errors: string[] }>;
}

export interface AthenaRetentionResult {
  table: "athena_telemetry_records" | "athena_execution_transitions" | "athena_executions";
  scannedBatches: number;
  deletedCount: number;
  cutoff: string;
}
