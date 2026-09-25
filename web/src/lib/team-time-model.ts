export type Job = { id: string; title: string; scheduled_start: string | null; scheduled_end: string | null };
export type Worker = { id: string; name: string; role: string; workerType: "employee" | "subcontractor" | null; active: boolean };
export type Shift = {
  id: string; org_id: string; worker_user_id: string; worker_type: "employee" | "subcontractor";
  job_id: string; started_at: string; ended_at: string | null; break_started_at: string | null;
  break_minutes: number; note?: string | null; status: "open" | "pending" | "approved";
  updated_at: string;
};
export type WorkspaceData = {
  orgId?: string; role?: string; user: { id: string; name: string }; workerType: Worker["workerType"];
  supervisor: boolean; jobs: Job[]; assignedJobIds?: string[]; shifts: Shift[]; workers: Worker[];
  organizations?: Array<{ id: string; name: string; role: string }>; selectOrganization?: boolean;
};
export type ApprovedHoursRow = { worker: string; type: string; job: string; shift: Shift };
export type CorrectionInput = { shiftId: string; startedAtLocal: string; endedAtLocal: string; breakMinutes: number; reason: string };

export function calculateShiftHours(shift: Shift, now = Date.now()): string {
  const end = shift.ended_at ? Date.parse(shift.ended_at) : now;
  const breakNow = shift.break_started_at ? Math.max(0, end - Date.parse(shift.break_started_at)) / 60_000 : 0;
  return (Math.max(0, (end - Date.parse(shift.started_at)) / 60_000 - shift.break_minutes - breakNow) / 60).toFixed(2);
}

function csvCell(value: unknown) {
  const safe = String(value ?? "").replace(/^[=+@-]/, "\u200b$&").replaceAll('"', '""');
  return `"${safe}"`;
}

export function serializeApprovedHoursCsv(rows: ApprovedHoursRow[], now = Date.now()): string {
  return [["Worker", "Worker type", "Job", "Start", "End", "Break minutes", "Hours"], ...rows.map(({ worker, type, job, shift }) => [worker, type, job, shift.started_at, shift.ended_at, shift.break_minutes, calculateShiftHours(shift, now)])]
    .map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function selectApprovedHours(rows: ApprovedHoursRow[], workerType: Shift["worker_type"]): ApprovedHoursRow[] {
  return rows.filter(({ shift }) => shift.status === "approved" && shift.worker_type === workerType);
}

export function normalizeCorrectionInput(input: CorrectionInput) {
  const startedAt = new Date(input.startedAtLocal);
  const endedAt = new Date(input.endedAtLocal);
  const reason = input.reason.trim();
  if (!input.shiftId || !Number.isFinite(startedAt.getTime()) || !Number.isFinite(endedAt.getTime()) || endedAt <= startedAt) {
    throw new Error("Enter a valid clock-in and later clock-out time.");
  }
  if (!Number.isInteger(input.breakMinutes) || input.breakMinutes < 0 || input.breakMinutes > 1440) {
    throw new Error("Break minutes must be between 0 and 1,440.");
  }
  if (!reason || reason.length > 500) throw new Error("Enter a correction reason up to 500 characters.");
  return { shiftId: input.shiftId, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), breakMinutes: input.breakMinutes, reason };
}
