import { athenaKernelStates, AthenaKernelState } from "../modules/athena-kernel/types";
import {
  AthenaLifecycleError,
  AthenaRoundTripBudgetExceededError,
  ATHENA_A1_LIFECYCLE_TRANSITIONS,
  ATHENA_DEFAULT_MAX_ROUND_TRIPS,
  assertTransition,
  canTransition,
  getMaxRoundTrips,
  isA1ReachableState,
  isRoundTripState,
  isTerminalState,
  nextRoundTripCount,
} from "../modules/athena-kernel/lifecycle";

const terminalStates: AthenaKernelState[] = ["succeeded", "failed", "denied", "expired", "cancelled"];
const a1ExcludedStates: AthenaKernelState[] = ["executing", "awaiting_approval", "partially_succeeded"];

describe("athena kernel lifecycle", () => {
  it("marks exactly the documented terminal states as terminal", () => {
    for (const state of athenaKernelStates) {
      expect(isTerminalState(state)).toBe(terminalStates.includes(state));
    }
  });

  it("excludes executing/awaiting_approval/partially_succeeded from A1-reachable states", () => {
    for (const state of a1ExcludedStates) {
      expect(isA1ReachableState(state)).toBe(false);
    }
    for (const state of athenaKernelStates) {
      if (!a1ExcludedStates.includes(state)) {
        expect(isA1ReachableState(state)).toBe(true);
      }
    }
  });

  it("never allows a transition into an A1-excluded state", () => {
    for (const from of athenaKernelStates) {
      for (const excluded of a1ExcludedStates) {
        expect(canTransition(from, excluded)).toBe(false);
      }
    }
  });

  it("allows every documented forward edge for every state (full pairwise matrix)", () => {
    for (const from of athenaKernelStates) {
      for (const to of athenaKernelStates) {
        const expected = ATHENA_A1_LIFECYCLE_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("treats terminal states as immutable: no outgoing transitions at all", () => {
    for (const state of terminalStates) {
      for (const target of athenaKernelStates) {
        expect(canTransition(state, target)).toBe(false);
      }
    }
  });

  it("assertTransition throws AthenaLifecycleError for illegal transitions", () => {
    expect(() => assertTransition("succeeded", "failed")).toThrow(AthenaLifecycleError);
    expect(() => assertTransition("created", "succeeded")).toThrow(AthenaLifecycleError);
    expect(() => assertTransition("created", "executing")).toThrow(AthenaLifecycleError);
  });

  it("assertTransition does not throw for legal transitions", () => {
    expect(() => assertTransition("created", "context_building")).not.toThrow();
    expect(() => assertTransition("policy_check", "succeeded")).not.toThrow();
    expect(() => assertTransition("routing", "cancelled")).not.toThrow();
  });

  it("allows every non-terminal state to escape to failed/cancelled/expired", () => {
    for (const state of athenaKernelStates) {
      if (isTerminalState(state)) continue;
      expect(canTransition(state, "failed")).toBe(true);
      expect(canTransition(state, "cancelled")).toBe(true);
      expect(canTransition(state, "expired")).toBe(true);
    }
  });

  it("identifies needs_clarification and degraded as round-trip states", () => {
    expect(isRoundTripState("needs_clarification")).toBe(true);
    expect(isRoundTripState("degraded")).toBe(true);
    expect(isRoundTripState("routing")).toBe(false);
  });

  it("defaults the round-trip cap to 2 and reads ATHENA_MAX_LIFECYCLE_ROUND_TRIPS", () => {
    expect(getMaxRoundTrips({} as NodeJS.ProcessEnv)).toBe(ATHENA_DEFAULT_MAX_ROUND_TRIPS);
    expect(getMaxRoundTrips({ ATHENA_MAX_LIFECYCLE_ROUND_TRIPS: "5" } as NodeJS.ProcessEnv)).toBe(5);
    expect(getMaxRoundTrips({ ATHENA_MAX_LIFECYCLE_ROUND_TRIPS: "not-a-number" } as NodeJS.ProcessEnv)).toBe(ATHENA_DEFAULT_MAX_ROUND_TRIPS);
  });

  it("allows round trips within budget and forces a hard stop once exceeded", () => {
    expect(nextRoundTripCount(0, 2)).toBe(1);
    expect(nextRoundTripCount(1, 2)).toBe(2);
    expect(() => nextRoundTripCount(2, 2)).toThrow(AthenaRoundTripBudgetExceededError);
  });
});
