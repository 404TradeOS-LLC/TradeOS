import type { JobStatus } from "../../domain/contracts";

/**
 * The single backend transition contract for the current Job lifecycle.
 *
 * `schedule` intentionally includes `scheduled -> scheduled`: rescheduling
 * changes schedule fields while retaining the same persisted status.
 * Reopen is represented separately because it accepts one of two explicit
 * targets and is restricted to owners/admins by JobsService.
 */
export const JOB_STATUS_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  unscheduled: ["scheduled"],
  scheduled: ["scheduled", "dispatched", "cancelled"],
  dispatched: ["scheduled", "traveling", "cancelled"],
  traveling: ["on_site"],
  on_site: ["paused", "completed"],
  paused: ["on_site", "cancelled"],
  completed: ["unscheduled", "scheduled"],
  cancelled: [],
};

export const JOB_ACTION_RULES = {
  schedule: { allowedFrom: ["unscheduled", "scheduled", "dispatched"], target: "scheduled" },
  dispatch: { allowedFrom: ["scheduled"], target: "dispatched" },
  startTravel: { allowedFrom: ["dispatched"], target: "traveling" },
  arrive: { allowedFrom: ["traveling"], target: "on_site" },
  pause: { allowedFrom: ["on_site"], target: "paused" },
  resume: { allowedFrom: ["paused"], target: "on_site" },
  complete: { allowedFrom: ["on_site"], target: "completed" },
  cancel: { allowedFrom: ["scheduled", "dispatched", "paused"], target: "cancelled" },
  reopen: { allowedFrom: ["completed"], allowedTo: ["unscheduled", "scheduled"] },
  readyForInvoice: { allowedFrom: ["completed"] },
} as const;

export type JobAction = keyof typeof JOB_ACTION_RULES;

export function isAllowedJobAction(action: JobAction, status: JobStatus): boolean {
  return (JOB_ACTION_RULES[action].allowedFrom as readonly string[]).includes(status);
}

export function isAllowedJobStatusTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from].includes(to);
}
