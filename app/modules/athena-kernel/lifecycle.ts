import { athenaKernelStates, AthenaKernelState } from "./types";

// Terminal states per docs/athena/05-runtime/README.md lifecycle table: these
// five rows list "none" under "Allowed next states".
const terminalStates = new Set<AthenaKernelState>(["succeeded", "failed", "denied", "expired", "cancelled"]);

export function isTerminalState(state: AthenaKernelState): boolean {
  return terminalStates.has(state);
}

// States that exist for A2-A6 forward compatibility (docs/athena/roadmap/
// A1-ai-kernel-implementation-plan.md: "A1 must not enter executing,
// awaiting_approval, or partially_succeeded for production business
// actions"). A1's own transition table below never routes through them.
const a1ExcludedStates = new Set<AthenaKernelState>(["executing", "awaiting_approval", "partially_succeeded"]);

export function isA1ReachableState(state: AthenaKernelState): boolean {
  return !a1ExcludedStates.has(state);
}

// Every non-terminal state can escape to failed/cancelled/expired at any
// point (deadline expiry, client disconnect, shutdown, or an unrecoverable
// error can occur during any phase - see "Timeout, Cancellation, And
// Shutdown Behavior" in the A1 plan).
const escapeStates: readonly AthenaKernelState[] = ["failed", "cancelled", "expired"];

// A1-specific forward edges. This intentionally diverges from the full
// 15-state table in docs/athena/05-runtime/README.md at exactly one point:
// policy_check -> succeeded. The Bible's full table only reaches succeeded
// via executing (approved tool/action steps running), but A1 has no
// executing phase - its policy_check stage produces the final draft/no-op
// response directly. The A1 implementation plan's own required-states table
// (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md) lists succeeded
// as reachable while explicitly excluding executing, so this edge is the
// narrowest change that reconciles the two documents for A1's scope. A2-A6
// re-introduce executing and must route policy_check -> executing ->
// succeeded for any real tool call.
const a1ForwardEdges: Partial<Record<AthenaKernelState, readonly AthenaKernelState[]>> = {
  created: ["context_building"],
  context_building: ["routing", "degraded"],
  routing: ["planning", "needs_clarification"],
  planning: ["policy_check", "needs_clarification"],
  policy_check: ["succeeded", "denied"],
  degraded: ["routing", "planning"],
  needs_clarification: ["context_building"],
};

function buildA1Transitions(): Record<AthenaKernelState, readonly AthenaKernelState[]> {
  const table = {} as Record<AthenaKernelState, readonly AthenaKernelState[]>;
  for (const state of athenaKernelStates) {
    table[state] = isTerminalState(state) ? [] : [...(a1ForwardEdges[state] ?? []), ...escapeStates];
  }
  return table;
}

export const ATHENA_A1_LIFECYCLE_TRANSITIONS: Readonly<Record<AthenaKernelState, readonly AthenaKernelState[]>> = buildA1Transitions();

export class AthenaLifecycleError extends Error {
  constructor(
    public readonly from: AthenaKernelState,
    public readonly to: AthenaKernelState
  ) {
    super(`Illegal Athena kernel transition: ${from} -> ${to}`);
  }
}

export function canTransition(from: AthenaKernelState, to: AthenaKernelState): boolean {
  if (isTerminalState(from)) return false;
  return ATHENA_A1_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: AthenaKernelState, to: AthenaKernelState): void {
  if (!canTransition(from, to)) {
    throw new AthenaLifecycleError(from, to);
  }
}

// Bounded clarification/degraded round-trip cap (MEDIUM-3,
// docs/athena/reviews/A1-parallel-readiness-review.md): nothing in the
// documented state table stops a request from bouncing between
// needs_clarification/degraded and their upstream states indefinitely.
export const ATHENA_DEFAULT_MAX_ROUND_TRIPS = 2;

export function getMaxRoundTrips(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ATHENA_MAX_LIFECYCLE_ROUND_TRIPS;
  if (!raw) return ATHENA_DEFAULT_MAX_ROUND_TRIPS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : ATHENA_DEFAULT_MAX_ROUND_TRIPS;
}

export function isRoundTripState(state: AthenaKernelState): boolean {
  return state === "needs_clarification" || state === "degraded";
}

// Called whenever the kernel is about to enter needs_clarification or
// degraded. Returns the incremented count when still within budget, or
// throws once the request has cycled through too many round trips - the
// caller must force failed/cancelled instead of re-entering the state.
export function nextRoundTripCount(currentCount: number, maxRoundTrips: number = getMaxRoundTrips()): number {
  const next = currentCount + 1;
  if (next > maxRoundTrips) {
    throw new AthenaRoundTripBudgetExceededError(next, maxRoundTrips);
  }
  return next;
}

export class AthenaRoundTripBudgetExceededError extends Error {
  constructor(
    public readonly attempted: number,
    public readonly max: number
  ) {
    super(`Athena kernel exceeded the clarification/degraded round-trip budget (${attempted} > ${max})`);
  }
}
