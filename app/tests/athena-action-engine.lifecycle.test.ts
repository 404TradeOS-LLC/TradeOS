import { athenaActionStates, AthenaActionState } from "../modules/athena-action-engine/types";
import { ATHENA_ACTION_LIFECYCLE_TRANSITIONS, AthenaActionLifecycleError, assertActionTransition, canTransitionAction, isTerminalActionState } from "../modules/athena-action-engine/lifecycle";

const terminalStates: AthenaActionState[] = ["succeeded", "failed", "denied", "expired", "cancelled"];

describe("athena action engine lifecycle", () => {
  it("marks exactly the documented C005 terminal states as terminal", () => {
    for (const state of athenaActionStates) {
      expect(isTerminalActionState(state)).toBe(terminalStates.includes(state));
    }
  });

  it("treats terminal states as immutable: no outgoing transitions at all", () => {
    for (const state of terminalStates) {
      for (const target of athenaActionStates) {
        expect(canTransitionAction(state, target)).toBe(false);
      }
    }
  });

  it("allows every documented forward edge for every state (full pairwise matrix)", () => {
    for (const from of athenaActionStates) {
      for (const to of athenaActionStates) {
        expect(canTransitionAction(from, to)).toBe(ATHENA_ACTION_LIFECYCLE_TRANSITIONS[from].includes(to));
      }
    }
  });

  it("allows every non-terminal state to escape to failed/cancelled/expired", () => {
    for (const state of athenaActionStates) {
      if (isTerminalActionState(state)) continue;
      expect(canTransitionAction(state, "failed")).toBe(true);
      expect(canTransitionAction(state, "cancelled")).toBe(true);
      expect(canTransitionAction(state, "expired")).toBe(true);
    }
  });

  it("rejects skipping straight from created to running - never move an action into an executable state without passing through pending/awaiting_approval", () => {
    expect(canTransitionAction("created", "running")).toBe(false);
  });

  it("rejects skipping straight from created to succeeded", () => {
    expect(canTransitionAction("created", "succeeded")).toBe(false);
  });

  it("rejects pending -> denied - a denial is decided at created, not discovered later during input/idempotency checks", () => {
    expect(canTransitionAction("pending", "denied")).toBe(false);
  });

  it("assertActionTransition throws AthenaActionLifecycleError for illegal transitions", () => {
    expect(() => assertActionTransition("succeeded", "failed")).toThrow(AthenaActionLifecycleError);
    expect(() => assertActionTransition("created", "running")).toThrow(AthenaActionLifecycleError);
    expect(() => assertActionTransition("denied", "succeeded")).toThrow(AthenaActionLifecycleError);
  });

  it("assertActionTransition does not throw for legal transitions", () => {
    expect(() => assertActionTransition("created", "pending")).not.toThrow();
    expect(() => assertActionTransition("pending", "running")).not.toThrow();
    expect(() => assertActionTransition("running", "succeeded")).not.toThrow();
  });
});
