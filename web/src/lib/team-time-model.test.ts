import test from "node:test";
import assert from "node:assert/strict";
import { calculateShiftHours, normalizeCorrectionInput, selectApprovedHours, serializeApprovedHoursCsv, type Shift } from "./team-time-model.ts";

const shift: Shift = {
  id: "shift-1", org_id: "org-1", worker_user_id: "worker-1", worker_type: "employee", job_id: "job-1",
  started_at: "2026-09-24T08:00:00.000Z", ended_at: "2026-09-24T16:00:00.000Z", break_started_at: null,
  break_minutes: 30, note: null, status: "approved", updated_at: "2026-09-24T16:00:00.000Z",
};

test("shift hour calculation subtracts completed and active breaks once", () => {
  assert.equal(calculateShiftHours(shift), "7.50");
  assert.equal(calculateShiftHours({ ...shift, ended_at: null, break_started_at: "2026-09-24T15:30:00.000Z", break_minutes: 0 }, Date.parse("2026-09-24T16:00:00.000Z")), "7.50");
});

test("payroll selection only returns approved hours for the requested worker type", () => {
  const pending = { ...shift, status: "pending" as const };
  const subcontractor = { ...shift, worker_type: "subcontractor" as const };
  const rows = [
    { worker: "A", type: "employee", job: "J", shift },
    { worker: "B", type: "employee", job: "J", shift: pending },
    { worker: "C", type: "subcontractor", job: "J", shift: subcontractor },
  ];
  assert.deepEqual(selectApprovedHours(rows, "employee").map(({ worker }) => worker), ["A"]);
  assert.deepEqual(selectApprovedHours(rows, "subcontractor").map(({ worker }) => worker), ["C"]);
});

test("correction normalization requires ordered timestamps, bounded break time, and a reason", () => {
  const input = { shiftId: "shift-1", startedAtLocal: "2026-09-24T08:00", endedAtLocal: "2026-09-24T16:00", breakMinutes: 30, reason: "  Missed punch  " };
  assert.deepEqual(normalizeCorrectionInput(input), {
    shiftId: "shift-1", startedAt: new Date(input.startedAtLocal).toISOString(), endedAt: new Date(input.endedAtLocal).toISOString(), breakMinutes: 30, reason: "Missed punch",
  });
  assert.throws(() => normalizeCorrectionInput({ ...input, endedAtLocal: input.startedAtLocal }), /later clock-out/);
  assert.throws(() => normalizeCorrectionInput({ ...input, reason: "  " }), /correction reason/);
  assert.throws(() => normalizeCorrectionInput({ ...input, breakMinutes: 1500 }), /Break minutes/);
});

test("approved-hours CSV quotes values and neutralizes spreadsheet formulas", () => {
  const csv = serializeApprovedHoursCsv([{ worker: "=HYPERLINK(\"bad\")", type: "employee", job: "Deck, repair", shift }]);
  assert.match(csv, /"​=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Deck, repair"/);
  assert.match(csv, /"7\.50"/);
});
