import { Prisma } from "@prisma/client";
import { basePrisma, prisma } from "../../db/client";
import { runWithBackgroundDatabaseSession } from "../../db/requestSession";
import { getEventHealth, getModelMetrics, getOverviewMetrics, getToolMetrics } from "./metricsService";
import { AthenaAlertEvaluation, AthenaAlertRecord, AthenaAlertRuleId, AthenaAlertSeverity, AthenaAlertStatus, AthenaModelMetric, AthenaOverviewMetrics, AthenaToolMetric } from "./types";

// A10 alert evaluation (docs/athena/roadmap/A10-observability-implementation-plan.md
// "Alerting"). Alerts are derived entirely from already-persisted C011
// telemetry / A1 execution / A8 event tables - evaluateAthenaAlerts never
// writes anything, and applyAthenaAlertEvaluations is the only place that
// touches athena_alerts. Every threshold below is env-var overridable with
// a conservative default (favor missing a borderline case over paging on
// normal jitter).
//
// IMPORTANT caller contract: evaluateAthenaAlerts reads athena_telemetry_records,
// athena_executions, athena_events, athena_event_dead_letters, and
// athena_alerts (to resolve rules that stopped firing) through the ambient
// `prisma` proxy (app/db/client.ts) - it does not open its own RLS session.
// The caller must already be running inside an active database session
// (an HTTP request's runWithDatabaseSession, or - for a script/cron
// caller - its own runWithBackgroundDatabaseSession) before calling this,
// or every query will silently see zero rows under RLS. See
// scripts/run-athena-observability-alerts.ts for the sanctioned background
// caller shape.

// Spike/regression rules look at a fixed trailing window: short enough to
// page on an active incident, long enough that a handful of requests don't
// dominate the sample.
export const ALERT_EVALUATION_WINDOW_MINUTES = 15;

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envInt(name: string, fallback: number): number {
  return Math.trunc(envFloat(name, fallback));
}

// Below this many samples in the window, a rate-based rule does not fire -
// one or two calls hitting 100% failure is noise, not a spike.
const MIN_SAMPLE_SIZE = envInt("ATHENA_ALERT_MIN_SAMPLE_SIZE", 5);

const ERROR_RATE_THRESHOLD = envFloat("ATHENA_ALERT_ERROR_RATE_THRESHOLD", 0.2);
const TOOL_FAILURE_RATE_THRESHOLD = envFloat("ATHENA_ALERT_TOOL_FAILURE_RATE_THRESHOLD", 0.3);
const PROVIDER_FAILURE_RATE_THRESHOLD = envFloat("ATHENA_ALERT_PROVIDER_FAILURE_RATE_THRESHOLD", 0.3);
const LATENCY_P95_MS_THRESHOLD = envInt("ATHENA_ALERT_LATENCY_P95_MS_THRESHOLD", 5000);
const TRACE_COMPLETENESS_THRESHOLD = envFloat("ATHENA_ALERT_TRACE_COMPLETENESS_THRESHOLD", 0.7);
const EVENT_DEAD_LETTER_THRESHOLD = envInt("ATHENA_ALERT_EVENT_DEAD_LETTER_THRESHOLD", 5);
const EVENT_PENDING_RETRY_THRESHOLD = envInt("ATHENA_ALERT_EVENT_PENDING_RETRY_THRESHOLD", 50);
const COST_SPIKE_USD_THRESHOLD = envFloat("ATHENA_ALERT_COST_SPIKE_USD_THRESHOLD", 10);
// unauthorized_execution counts *correctly denied* approval spans - the
// policy layer is working as intended when these occur. A single denial is
// normal; a burst can indicate probing, a compromised account, or a
// misconfigured caller, so the default threshold is deliberately higher
// than 1.
const UNAUTHORIZED_EXECUTION_THRESHOLD = envInt("ATHENA_ALERT_UNAUTHORIZED_EXECUTION_THRESHOLD", 5);
// approval_bypass_attempt is a proxy for a real security incident (see the
// rule's own doc comment below for exact scope/gaps) - any occurrence is
// significant, so the default threshold is 1.
const APPROVAL_BYPASS_THRESHOLD = envInt("ATHENA_ALERT_APPROVAL_BYPASS_THRESHOLD", 1);

function toAlertRecord(row: {
  id: string;
  orgId: string;
  ruleId: string;
  dedupeKey: string;
  severity: string;
  status: string;
  summary: string;
  metadataJson: Prisma.JsonValue;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}): AthenaAlertRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    ruleId: row.ruleId as AthenaAlertRuleId,
    dedupeKey: row.dedupeKey,
    severity: row.severity as AthenaAlertSeverity,
    status: row.status as AthenaAlertStatus,
    summary: row.summary,
    metadata: (row.metadataJson as Record<string, unknown> | null) ?? {},
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

export async function listAthenaAlerts(params: { orgId: string; status?: AthenaAlertStatus }): Promise<AthenaAlertRecord[]> {
  const rows = await prisma.athenaAlert.findMany({
    where: { orgId: params.orgId, ...(params.status ? { status: params.status } : {}) },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(toAlertRecord);
}

// ---------------------------------------------------------------------------
// Individual rule evaluators. Each singleton (per-org) rule always returns
// exactly one evaluation, firing or not, so applyAthenaAlertEvaluations can
// resolve a previously-active alert the moment the condition clears.
// Multi-instance rules (one per tool / provider+model) additionally resolve
// any previously-active alert for an instance that is no longer observed in
// the current window via resolveStaleAlerts - a tool/provider that simply
// stops being called should not stay "active" forever.
// ---------------------------------------------------------------------------

function evaluateErrorSpike(overview: AthenaOverviewMetrics): AthenaAlertEvaluation {
  const firing = overview.requestCount >= MIN_SAMPLE_SIZE && overview.errorRate > ERROR_RATE_THRESHOLD;
  return {
    ruleId: "athena_error_spike",
    dedupeKey: "athena_error_spike",
    firing,
    severity: "high",
    summary: firing
      ? `Error rate ${(overview.errorRate * 100).toFixed(1)}% over ${(ERROR_RATE_THRESHOLD * 100).toFixed(0)}% threshold across ${overview.requestCount} requests in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
      : `Error rate ${(overview.errorRate * 100).toFixed(1)}% within threshold`,
    metadata: { errorRate: overview.errorRate, requestCount: overview.requestCount, threshold: ERROR_RATE_THRESHOLD, minSampleSize: MIN_SAMPLE_SIZE, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
  };
}

async function resolveStaleAlerts(orgId: string, ruleId: AthenaAlertRuleId, seenDedupeKeys: ReadonlySet<string>): Promise<AthenaAlertEvaluation[]> {
  const active = await prisma.athenaAlert.findMany({
    where: { orgId, ruleId, status: "active" },
    select: { dedupeKey: true },
  });
  return active
    .filter((row) => !seenDedupeKeys.has(row.dedupeKey))
    .map((row) => ({
      ruleId,
      dedupeKey: row.dedupeKey,
      firing: false,
      severity: "low" as AthenaAlertSeverity,
      summary: `${ruleId} target no longer observed in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`,
      metadata: { resolvedReason: "not_observed_in_window", windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
    }));
}

async function evaluateToolFailureSpike(orgId: string, tools: readonly AthenaToolMetric[]): Promise<AthenaAlertEvaluation[]> {
  const evaluations: AthenaAlertEvaluation[] = [];
  const seenDedupeKeys = new Set<string>();

  for (const tool of tools) {
    const dedupeKey = `tool_failure_spike:${tool.toolId}`;
    seenDedupeKeys.add(dedupeKey);
    const failureRate = tool.invocationCount > 0 ? tool.failureCount / tool.invocationCount : 0;
    const firing = tool.invocationCount >= MIN_SAMPLE_SIZE && failureRate > TOOL_FAILURE_RATE_THRESHOLD;
    evaluations.push({
      ruleId: "tool_failure_spike",
      dedupeKey,
      firing,
      severity: "medium",
      summary: firing
        ? `Tool ${tool.toolId} failure rate ${(failureRate * 100).toFixed(1)}% over ${tool.invocationCount} calls in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
        : `Tool ${tool.toolId} failure rate within threshold`,
      metadata: { toolId: tool.toolId, invocationCount: tool.invocationCount, failureCount: tool.failureCount, failureRate, threshold: TOOL_FAILURE_RATE_THRESHOLD, minSampleSize: MIN_SAMPLE_SIZE, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
    });
  }

  evaluations.push(...(await resolveStaleAlerts(orgId, "tool_failure_spike", seenDedupeKeys)));
  return evaluations;
}

async function evaluateProviderFailureSpike(orgId: string, models: readonly AthenaModelMetric[]): Promise<AthenaAlertEvaluation[]> {
  const evaluations: AthenaAlertEvaluation[] = [];
  const seenDedupeKeys = new Set<string>();

  for (const model of models) {
    const dedupeKey = `provider_failure_spike:${model.provider}:${model.model}`;
    seenDedupeKeys.add(dedupeKey);
    const failureRate = model.invocationCount > 0 ? model.failureCount / model.invocationCount : 0;
    const firing = model.invocationCount >= MIN_SAMPLE_SIZE && failureRate > PROVIDER_FAILURE_RATE_THRESHOLD;
    evaluations.push({
      ruleId: "provider_failure_spike",
      dedupeKey,
      firing,
      severity: "high",
      summary: firing
        ? `Provider ${model.provider}/${model.model} failure rate ${(failureRate * 100).toFixed(1)}% over ${model.invocationCount} calls in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
        : `Provider ${model.provider}/${model.model} failure rate within threshold`,
      metadata: { provider: model.provider, model: model.model, invocationCount: model.invocationCount, failureCount: model.failureCount, failureRate, threshold: PROVIDER_FAILURE_RATE_THRESHOLD, minSampleSize: MIN_SAMPLE_SIZE, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
    });
  }

  evaluations.push(...(await resolveStaleAlerts(orgId, "provider_failure_spike", seenDedupeKeys)));
  return evaluations;
}

// Simple absolute-threshold version (acceptable minimum per the milestone
// spec): fires when p95 latency in the window exceeds the threshold. Does
// not compare against the prior window - a window-over-window regression
// comparison was left out to keep this rule's behavior easy to reason about
// for the initial security review; the absolute threshold is the safer,
// more conservative starting point.
function evaluateLatencyRegression(overview: AthenaOverviewMetrics): AthenaAlertEvaluation {
  const p95 = overview.latencyMsP95;
  const firing = p95 !== null && overview.requestCount >= MIN_SAMPLE_SIZE && p95 > LATENCY_P95_MS_THRESHOLD;
  return {
    ruleId: "latency_regression",
    dedupeKey: "latency_regression",
    firing,
    severity: "medium",
    summary: firing
      ? `p95 latency ${p95}ms over ${LATENCY_P95_MS_THRESHOLD}ms threshold across ${overview.requestCount} requests in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
      : `p95 latency ${p95 ?? "n/a"}ms within threshold`,
    metadata: { latencyMsP95: p95, requestCount: overview.requestCount, threshold: LATENCY_P95_MS_THRESHOLD, minSampleSize: MIN_SAMPLE_SIZE, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
  };
}

function evaluateTraceCompletenessDrop(overview: AthenaOverviewMetrics): AthenaAlertEvaluation {
  const score = overview.averageTraceCompleteness;
  const firing = score !== null && overview.requestCount >= MIN_SAMPLE_SIZE && score < TRACE_COMPLETENESS_THRESHOLD;
  return {
    ruleId: "trace_completeness_drop",
    dedupeKey: "trace_completeness_drop",
    firing,
    severity: "low",
    summary: firing
      ? `Average trace completeness ${score !== null ? (score * 100).toFixed(1) : "n/a"}% below ${(TRACE_COMPLETENESS_THRESHOLD * 100).toFixed(0)}% threshold in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
      : `Average trace completeness ${score !== null ? (score * 100).toFixed(1) : "n/a"}% within threshold`,
    metadata: { averageTraceCompleteness: score, requestCount: overview.requestCount, threshold: TRACE_COMPLETENESS_THRESHOLD, minSampleSize: MIN_SAMPLE_SIZE, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
  };
}

function evaluateEventDlqGrowth(eventHealth: Awaited<ReturnType<typeof getEventHealth>>): AthenaAlertEvaluation {
  const firing = eventHealth.deadLetterCount > EVENT_DEAD_LETTER_THRESHOLD || eventHealth.pendingRetryCount > EVENT_PENDING_RETRY_THRESHOLD;
  return {
    ruleId: "event_dlq_growth",
    dedupeKey: "event_dlq_growth",
    firing,
    severity: "medium",
    summary: firing
      ? `Event health: ${eventHealth.deadLetterCount} dead letters (threshold ${EVENT_DEAD_LETTER_THRESHOLD}), ${eventHealth.pendingRetryCount} pending retries (threshold ${EVENT_PENDING_RETRY_THRESHOLD}) in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
      : `Event health within thresholds (${eventHealth.deadLetterCount} dead letters, ${eventHealth.pendingRetryCount} pending retries)`,
    metadata: {
      deadLetterCount: eventHealth.deadLetterCount,
      pendingRetryCount: eventHealth.pendingRetryCount,
      deadLetterThreshold: EVENT_DEAD_LETTER_THRESHOLD,
      pendingRetryThreshold: EVENT_PENDING_RETRY_THRESHOLD,
      windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES,
    },
  };
}

function evaluateCostSpike(overview: AthenaOverviewMetrics): AthenaAlertEvaluation {
  const firing = overview.totalCostUsd > COST_SPIKE_USD_THRESHOLD;
  return {
    ruleId: "cost_spike",
    dedupeKey: "cost_spike",
    firing,
    severity: "medium",
    summary: firing
      ? `Total cost $${overview.totalCostUsd.toFixed(2)} over $${COST_SPIKE_USD_THRESHOLD.toFixed(2)} threshold in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m`
      : `Total cost $${overview.totalCostUsd.toFixed(2)} within threshold`,
    metadata: { totalCostUsd: overview.totalCostUsd, threshold: COST_SPIKE_USD_THRESHOLD, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
  };
}

async function evaluateUnauthorizedExecution(orgId: string, from: Date, to: Date): Promise<AthenaAlertEvaluation> {
  const deniedApprovalCount = await prisma.athenaTelemetryRecordRow.count({
    where: { orgId, spanType: "approval", status: "denied", createdAt: { gte: from, lt: to } },
  });
  const firing = deniedApprovalCount > UNAUTHORIZED_EXECUTION_THRESHOLD;
  return {
    ruleId: "unauthorized_execution",
    dedupeKey: "unauthorized_execution",
    firing,
    severity: "high",
    summary: firing
      ? `${deniedApprovalCount} denied approval spans over ${UNAUTHORIZED_EXECUTION_THRESHOLD} threshold in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m - the policy layer correctly blocked these, but a burst can indicate probing or a misconfigured caller`
      : `${deniedApprovalCount} denied approval spans, within threshold`,
    metadata: { deniedApprovalCount, threshold: UNAUTHORIZED_EXECUTION_THRESHOLD, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES },
  };
}

function readMetadataString(metadataJson: unknown, key: string): string | null {
  if (metadataJson && typeof metadataJson === "object" && key in (metadataJson as Record<string, unknown>)) {
    const value = (metadataJson as Record<string, unknown>)[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }
  return null;
}

// approval_bypass_attempt - SECURITY-SENSITIVE. Read this comment in full
// before trusting or tuning this rule; it is a proxy over persisted
// telemetry, not a live authorization check, and its scope is deliberately
// narrow to keep false positives low. Flagged for security review.
//
// What it catches: a C011 "action" span (docs/athena/contracts/README.md
// C011) whose metadata carries a stepId, for which no earlier "approval"
// span exists in the *same executionId*, with the *same stepId*, whose
// metadata.decision is present and is not "deny". Today's kernel
// (modules/athena-kernel/service.ts) only ever emits an "action" span
// immediately after emitting a matching "approval" span for the same
// stepId with decision "allow" or "approval_required" (never "deny" - a
// "deny" decision returns before any action span is emitted) - see the
// emitSpan("approval", ...) call sites directly above each
// emitSpan("action", ...) call in service.ts. So under the current,
// single, first-party execution path, this rule should never fire; a fire
// here means either a bug in that invariant or an execution path this
// rule's author did not anticipate.
//
// What it does NOT catch (documented gaps, not silently swallowed as a
// false negative):
//   - An "action" span whose metadata never carries a stepId: it is
//     skipped, not treated as a pass, because there is no reliable way to
//     tie it to a specific approval decision with today's metadata shape.
//     Any future action span shape that omits stepId is invisible to this
//     rule.
//   - Any code path that dispatches real work without ever calling
//     recordAthenaTelemetry for either span type: telemetry is
//     best-effort and swallows its own write errors by design
//     (modules/athena-kernel/telemetry.ts's recordAthenaTelemetry catch
//     block), so a telemetry write failure, or a caller that skips
//     telemetry entirely, leaves no trace here at all.
//   - This rule reads within a single trailing window; an approval and its
//     matching action that straddle a window boundary at the exact instant
//     of an evaluation run are read together here because both queries use
//     the same [from, to) bounds, but an approval slightly *before* `from`
//     for an action inside the window would be missed and could produce a
//     false positive. This is judged an acceptable, rare edge (a step
//     approved right at window open, then executed) rather than a security
//     gap, but it is not zero.
// A zero count from this rule must never be read as proof that no bypass
// occurred - only that this specific, narrow signal did not detect one.
async function evaluateApprovalBypassAttempt(orgId: string, from: Date, to: Date): Promise<AthenaAlertEvaluation> {
  const [actionSpans, approvalSpans] = await Promise.all([
    prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId, spanType: "action", createdAt: { gte: from, lt: to } },
      select: { id: true, executionId: true, metadataJson: true, createdAt: true },
    }),
    prisma.athenaTelemetryRecordRow.findMany({
      where: { orgId, spanType: "approval", createdAt: { gte: from, lt: to } },
      select: { executionId: true, metadataJson: true, createdAt: true },
    }),
  ]);

  const suspects: { spanId: string; executionId: string; stepId: string }[] = [];
  for (const action of actionSpans) {
    const stepId = readMetadataString(action.metadataJson, "stepId");
    if (!stepId) continue; // undetectable with current signal - documented gap above, not a false positive

    const hasAuthorizingApproval = approvalSpans.some((approval) => {
      if (approval.executionId !== action.executionId) return false;
      if (approval.createdAt > action.createdAt) return false;
      if (readMetadataString(approval.metadataJson, "stepId") !== stepId) return false;
      const decision = readMetadataString(approval.metadataJson, "decision");
      return decision !== null && decision !== "deny";
    });

    if (!hasAuthorizingApproval) {
      suspects.push({ spanId: action.id, executionId: action.executionId, stepId });
    }
  }

  const firing = suspects.length >= APPROVAL_BYPASS_THRESHOLD;
  return {
    ruleId: "approval_bypass_attempt",
    dedupeKey: "approval_bypass_attempt",
    firing,
    severity: "critical",
    summary: firing
      ? `${suspects.length} action span(s) with no matching authorizing approval span found in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m - proxy detection, see code comment in alerts.ts for exact scope; requires security review`
      : `No unmatched action spans found in the last ${ALERT_EVALUATION_WINDOW_MINUTES}m (proxy detection only, see code comment in alerts.ts)`,
    metadata: { suspectCount: suspects.length, suspects: suspects.slice(0, 20), threshold: APPROVAL_BYPASS_THRESHOLD, windowMinutes: ALERT_EVALUATION_WINDOW_MINUTES, detectionScope: "proxy_stepId_match_only" },
  };
}

// telemetry_write_failure is INTENTIONALLY NOT IMPLEMENTED. There is no
// direct signal for a telemetry write failure: recordAthenaTelemetry
// validates its record shape first (throws loudly on a malformed record,
// which is a caller bug, not a write failure) but then swallows every
// persistence error inside persistTelemetryRecord by design - see
// modules/athena-kernel/telemetry.ts's recordAthenaTelemetry, which has no
// catch block around persistTelemetryRecord at all, i.e. a DB error there
// would throw out of the kernel's request path entirely rather than being
// silently dropped and observable here. Concretely: either the write
// succeeds and is fully observable, or it throws synchronously in the
// original request (which the caller/HTTP layer handles), or - in a
// hypothetical future where a caller wraps this in its own try/catch and
// swallows the error - there is no row, no counter, and no other
// persisted signal left behind to evaluate against. A proxy such as
// "transition count looks low relative to baseline" would not actually
// measure telemetry write failures; it would measure execution shape
// (short executions legitimately have fewer transitions), producing a
// rule that looks like it's checking something real but isn't. Per this
// milestone's instructions, that kind of misleading proxy is worse than no
// rule at all, so evaluateAthenaAlerts below skips this ruleId entirely
// rather than emitting a fabricated evaluation for it.

export async function evaluateAthenaAlerts(orgId: string, now: Date = new Date()): Promise<AthenaAlertEvaluation[]> {
  const to = now;
  const from = new Date(now.getTime() - ALERT_EVALUATION_WINDOW_MINUTES * 60_000);
  const window = { orgId, from: from.toISOString(), to: to.toISOString() };

  const [overview, tools, models, eventHealth] = await Promise.all([getOverviewMetrics(window), getToolMetrics(window), getModelMetrics(window), getEventHealth(window)]);

  const evaluations: AthenaAlertEvaluation[] = [];
  evaluations.push(evaluateErrorSpike(overview));
  evaluations.push(...(await evaluateToolFailureSpike(orgId, tools)));
  evaluations.push(...(await evaluateProviderFailureSpike(orgId, models)));
  evaluations.push(evaluateLatencyRegression(overview));
  evaluations.push(evaluateTraceCompletenessDrop(overview));
  evaluations.push(evaluateEventDlqGrowth(eventHealth));
  evaluations.push(evaluateCostSpike(overview));
  evaluations.push(await evaluateUnauthorizedExecution(orgId, from, to));
  evaluations.push(await evaluateApprovalBypassAttempt(orgId, from, to));
  // athenaAlertRuleIds also includes "telemetry_write_failure" - deliberately
  // skipped, see the doc comment directly above this function.

  return evaluations;
}

// Upserts athena_alerts by (orgId, dedupeKey) per the three-way rule the
// milestone spec defines:
//   firing && no active row (none, or previously resolved)  -> create/reactivate, reset firstSeenAt
//   firing && active row exists                              -> bump lastSeenAt + metadataJson only
//   !firing && active row exists                              -> resolve (status, resolvedAt)
//   !firing && no active row                                  -> no-op
// Runs inside its own background database session (accepts userId for that
// reason) so RLS's owner/admin-only write policy on athena_alerts is
// satisfied by a real, membership-backed session - never bypassed.
export async function applyAthenaAlertEvaluations(orgId: string, userId: string, evaluations: AthenaAlertEvaluation[]): Promise<AthenaAlertRecord[]> {
  return runWithBackgroundDatabaseSession(basePrisma, { jobName: "athena-observability-alerts-apply", orgId, userId }, async () => {
    const now = new Date();
    const results: AthenaAlertRecord[] = [];

    for (const evaluation of evaluations) {
      const key = { orgId_dedupeKey: { orgId, dedupeKey: evaluation.dedupeKey } };
      const existing = await prisma.athenaAlert.findUnique({ where: key });

      if (evaluation.firing) {
        if (!existing || existing.status !== "active") {
          const row = await prisma.athenaAlert.upsert({
            where: key,
            create: {
              orgId,
              ruleId: evaluation.ruleId,
              dedupeKey: evaluation.dedupeKey,
              severity: evaluation.severity,
              status: "active",
              summary: evaluation.summary,
              metadataJson: evaluation.metadata as Prisma.InputJsonValue,
              firstSeenAt: now,
              lastSeenAt: now,
              resolvedAt: null,
            },
            update: {
              severity: evaluation.severity,
              status: "active",
              summary: evaluation.summary,
              metadataJson: evaluation.metadata as Prisma.InputJsonValue,
              firstSeenAt: now,
              lastSeenAt: now,
              resolvedAt: null,
            },
          });
          results.push(toAlertRecord(row));
        } else {
          const row = await prisma.athenaAlert.update({
            where: key,
            data: { lastSeenAt: now, metadataJson: evaluation.metadata as Prisma.InputJsonValue },
          });
          results.push(toAlertRecord(row));
        }
      } else if (existing && existing.status === "active") {
        const row = await prisma.athenaAlert.update({
          where: key,
          data: { status: "resolved", resolvedAt: now },
        });
        results.push(toAlertRecord(row));
      }
      // else: !firing && (no row || already resolved) -> no-op, nothing to report.
    }

    return results;
  });
}
