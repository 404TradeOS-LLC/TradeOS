import { athenaActionStates, AthenaActionState } from "./types";

// A6's own action-level state machine (C005, docs/athena/contracts/README.md).
// Deliberately NOT a change to athena-kernel/lifecycle.ts's
// ATHENA_A1_LIFECYCLE_TRANSITIONS table: that table's own module comment
// already reserves `executing`/`awaiting_approval`/`partially_succeeded` as
// AthenaKernelState values "for A2-A6 forward compatibility" but the kernel
// lifecycle test (athena-kernel.lifecycle.test.ts) asserts, as a structural
// invariant with no flag gate, that no AthenaKernelState transition may ever
// reach those three states. A6 satisfies "A2-A6 re-introduce executing" at
// the ACTION level, in this module, not by loosening the kernel's own
// invariant. The kernel keeps mapping every A6 outcome onto its existing
// legal `policy_check -> succeeded | denied | failed | cancelled | expired`
// edges (see athena-kernel/service.ts) - a completely separate state
// namespace from the one below.
const terminalActionStates = new Set<AthenaActionState>(["succeeded", "failed", "denied", "expired", "cancelled"]);

export function isTerminalActionState(state: AthenaActionState): boolean {
  return terminalActionStates.has(state);
}

// Every non-terminal action state can escape to failed/cancelled/expired at
// any point (a tool timing out, a client disconnecting, or an unrecoverable
// error can occur during any phase), mirroring athena-kernel/lifecycle.ts's
// own escapeStates precedent.
const actionEscapeStates: readonly AthenaActionState[] = ["failed", "cancelled", "expired"];

// Forward edges. `partially_succeeded` is included for C005 contract
// fidelity (multi-step/batch actions) but is never entered by engine.ts in
// this milestone - A6 only ever executes a single tool_call per action
// (docs/athena/roadmap/A6-action-engine-implementation-plan.md "Scope
// exclusions": no autonomous multi-step execution). Its edges are kept
// legal so a future multi-step action engine does not need a lifecycle
// rewrite, the same forward-compatibility posture the kernel table already
// established for A2-A6.
// `failed`/`cancelled`/`expired` are deliberately omitted below even where
// reachable in practice - actionEscapeStates already appends all three to
// every non-terminal state's edges once, so listing them here too would
// only duplicate entries in the built table.
const actionForwardEdges: Partial<Record<AthenaActionState, readonly AthenaActionState[]>> = {
  // pending/awaiting_approval are the only two states reachable from
  // created: either the request is immediately eligible to execute
  // (permission "allow", or "approval_required" with a valid approval
  // already supplied) or it is not yet eligible and must wait
  // (approval_required with no/invalid approval). An immediate "deny"
  // decision also lands here directly - never routed through pending.
  created: ["pending", "awaiting_approval", "denied"],
  // Reached only once eligibility is already established - pending never
  // transitions to denied; a denial is decided at created, not discovered
  // later during input/idempotency checks (those failures are "failed", a
  // system/input problem, not a policy decision).
  pending: ["running"],
  // A later resumption attempt (not exercised by engine.ts's synchronous
  // path in this milestone - see the module comment on partially_succeeded)
  // either supplies a now-valid approval (running) or is denied outright
  // (stale/invalid/expired approval).
  awaiting_approval: ["running", "denied"],
  running: ["succeeded", "partially_succeeded"],
  partially_succeeded: ["running", "succeeded"],
};

function buildActionTransitions(): Record<AthenaActionState, readonly AthenaActionState[]> {
  const table = {} as Record<AthenaActionState, readonly AthenaActionState[]>;
  for (const state of athenaActionStates) {
    table[state] = isTerminalActionState(state) ? [] : [...(actionForwardEdges[state] ?? []), ...actionEscapeStates];
  }
  return table;
}

export const ATHENA_ACTION_LIFECYCLE_TRANSITIONS: Readonly<Record<AthenaActionState, readonly AthenaActionState[]>> = buildActionTransitions();

export class AthenaActionLifecycleError extends Error {
  constructor(
    public readonly from: AthenaActionState,
    public readonly to: AthenaActionState
  ) {
    super(`Illegal Athena action transition: ${from} -> ${to}`);
  }
}

export function canTransitionAction(from: AthenaActionState, to: AthenaActionState): boolean {
  if (isTerminalActionState(from)) return false;
  return ATHENA_ACTION_LIFECYCLE_TRANSITIONS[from].includes(to);
}

// Never silently move an action into an executable state (docs/athena/
// roadmap/A6-action-engine-implementation-plan.md "Action lifecycle":
// "Invalid transitions must fail loudly"). engine.ts calls this before every
// state change it makes; a caller-supplied checkpoint replay that tries to
// skip stages (e.g. created -> running, or any transition out of a terminal
// state) throws instead of proceeding.
export function assertActionTransition(from: AthenaActionState, to: AthenaActionState): void {
  if (!canTransitionAction(from, to)) {
    throw new AthenaActionLifecycleError(from, to);
  }
}
