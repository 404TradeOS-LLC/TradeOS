import { jobStatuses } from "../domain/contracts";
import { JOB_ACTION_RULES, JOB_STATUS_TRANSITIONS, isAllowedJobAction, isAllowedJobStatusTransition } from "../modules/jobs/lifecycle";

describe("canonical Job lifecycle contract", () => {
  it("defines exactly the persisted canonical statuses", () => {
    expect(Object.keys(JOB_STATUS_TRANSITIONS).sort()).toEqual([...jobStatuses].sort());
  });

  it.each([
    ["unscheduled", "scheduled"],
    ["scheduled", "scheduled"],
    ["scheduled", "dispatched"],
    ["dispatched", "scheduled"],
    ["dispatched", "traveling"],
    ["traveling", "on_site"],
    ["on_site", "paused"],
    ["on_site", "completed"],
    ["paused", "on_site"],
    ["paused", "cancelled"],
    ["scheduled", "cancelled"],
    ["dispatched", "cancelled"],
    ["completed", "unscheduled"],
    ["completed", "scheduled"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(isAllowedJobStatusTransition(from, to)).toBe(true);
  });

  it.each([
    ["unscheduled", "dispatched"],
    ["scheduled", "traveling"],
    ["traveling", "completed"],
    ["paused", "completed"],
    ["on_site", "cancelled"],
    ["completed", "cancelled"],
    ["cancelled", "scheduled"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(isAllowedJobStatusTransition(from, to)).toBe(false);
  });

  it("keeps action guards aligned with the status graph", () => {
    for (const [action, rule] of Object.entries(JOB_ACTION_RULES)) {
      for (const status of jobStatuses) {
        expect(isAllowedJobAction(action as keyof typeof JOB_ACTION_RULES, status)).toBe(rule.allowedFrom.includes(status as never));
      }
    }
  });

  it("keeps completion restricted to on_site", () => {
    expect(JOB_ACTION_RULES.complete).toEqual({ allowedFrom: ["on_site"], target: "completed" });
  });
});
