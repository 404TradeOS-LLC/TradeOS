import type { AthenaTelemetrySpanType } from "../athena-kernel/types";
import type { AthenaKernelState } from "../athena-kernel/types";
import type { AthenaTelemetrySpan, AthenaTraceCompleteness } from "./types";

// Trace completeness algorithm (docs/athena/roadmap/
// A10-observability-implementation-plan.md "Trace completeness").
//
// Ground truth is limited to what the system actually persists: the
// execution's final AthenaKernelState and the set of C011 span types
// recorded under its traceId. There is no persisted AthenaPlan or
// AthenaAction record (A6's action engine is in-memory only - see
// athena-action-engine/engine.ts), so completeness cannot be computed
// against "the plan's expected steps"; it is computed against what the
// kernel's own current lifecycle wiring (athena-kernel/lifecycle.ts's
// a1ForwardEdges + service.ts's emitSpan call sites) guarantees for a given
// terminal state. This keeps the algorithm honest: it never requires a span
// type the current implementation could not possibly have emitted for that
// terminal state (the roadmap's "do not require impossible spans" rule).
//
// Basis for each rule, traced to the exact code that makes it true today:
//   - "context" is required for every execution: created -> context_building
//     is the only edge out of "created" (lifecycle.ts's a1ForwardEdges), and
//     service.ts emits a "context" span during that stage.
//   - "kernel" is required for every execution: service.ts's finally-path
//     always calls emitSpan("kernel", ...) exactly once before returning,
//     regardless of outcome.
//   - "approval" is required only when the terminal state is "succeeded" or
//     "denied": a1ForwardEdges only reaches either of those two states from
//     "policy_check", and every policy_check pass emits at least one
//     "approval" span (service.ts lines ~254-498). "failed"/"expired"/
//     "cancelled" are escape states reachable from any non-terminal state
//     (lifecycle.ts's escapeStates), so approval is never guaranteed there.
//   - "action" is required only when at least one already-observed
//     "approval" span for this trace carries a stepId in its metadata - that
//     is the kernel's own signal that a plan step was authorized and hence
//     actually dispatched to the action engine (service.ts's per-step
//     emitSpan("approval", ..., { stepId, toolId, ... }) always precedes the
//     matching emitSpan("action", ...)). Without this check, "action" would
//     be wrongly required for every succeeded execution even though A2 has
//     no production tools registered yet, so most succeeded traces
//     legitimately have zero plan steps.
//   - "model" is required whenever the terminal state is "succeeded": every
//     succeeded path falls through to the draft-response stage, which always
//     calls the model adapter and emits a "model" span (service.ts's
//     produceDraftResponse wiring).
//   - "memory" and "event" are never required: neither is wired to any
//     production caller yet (athena-memory/athena-events integration is
//     dark by default - see docs/CURRENT_STATE.md's A7/A8 entries), so their
//     absence is always expected, never a completeness gap.
//   - "planner" and "tool" are never required as distinct span types: the
//     kernel has no separate emitSpan call for either - planner work is
//     folded into the "kernel"/"approval" spans' own metadata (intent,
//     planId), and tool dispatch is folded into the "action" span. Treating
//     them as always-optional avoids inventing a requirement the current
//     instrumentation cannot satisfy (see the A10 doc's "Known limitations"
//     for the case this undersells).

const ALWAYS_REQUIRED: readonly AthenaTelemetrySpanType[] = ["kernel", "context"];
const APPROVAL_REQUIRED_STATES: ReadonlySet<AthenaKernelState> = new Set(["succeeded", "denied"]);
const MODEL_REQUIRED_STATES: ReadonlySet<AthenaKernelState> = new Set(["succeeded"]);

function spanHasStepId(span: AthenaTelemetrySpan): boolean {
  return typeof span.metadata?.stepId === "string" && span.metadata.stepId.length > 0;
}

export function computeTraceCompleteness(finalState: AthenaKernelState, spans: readonly AthenaTelemetrySpan[]): AthenaTraceCompleteness {
  const observedSpanTypes = Array.from(new Set(spans.map((span) => span.spanType))) as AthenaTelemetrySpanType[];
  const observedSet = new Set(observedSpanTypes);

  const expected = new Set<AthenaTelemetrySpanType>(ALWAYS_REQUIRED);

  if (APPROVAL_REQUIRED_STATES.has(finalState)) {
    expected.add("approval");
  }

  const approvedAStep = spans.some((span) => span.spanType === "approval" && spanHasStepId(span));
  if (approvedAStep) {
    expected.add("action");
  }

  if (MODEL_REQUIRED_STATES.has(finalState)) {
    expected.add("model");
  }

  const expectedSpanTypes = Array.from(expected);
  const missingSpanTypes = expectedSpanTypes.filter((spanType) => !observedSet.has(spanType));
  const score = expectedSpanTypes.length === 0 ? 1 : (expectedSpanTypes.length - missingSpanTypes.length) / expectedSpanTypes.length;

  return {
    expectedSpanTypes,
    observedSpanTypes,
    missingSpanTypes,
    score,
  };
}
