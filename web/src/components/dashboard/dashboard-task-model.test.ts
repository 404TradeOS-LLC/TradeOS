import test from "node:test";
import assert from "node:assert/strict";
import { formatTaskDueLabel } from "./dashboard-task-model";

test("date-only task deadlines stay on the stored calendar day west of UTC", () => {
  const now = new Date("2026-08-10T16:00:00.000Z");
  const task = { dueDate: "2026-08-10T00:00:00.000Z", status: "todo" as const };

  assert.equal(formatTaskDueLabel(task, now, "America/New_York"), "Due today · Aug 10");
  assert.equal(formatTaskDueLabel(task, now, "America/Los_Angeles"), "Due today · Aug 10");
});

test("date-only task deadlines become overdue only after the local calendar day passes", () => {
  const task = { dueDate: "2026-08-10T00:00:00.000Z", status: "todo" as const };

  assert.equal(formatTaskDueLabel(task, new Date("2026-08-11T16:00:00.000Z"), "America/New_York"), "Overdue · Aug 10");
});
