import assert from "node:assert/strict";
import test from "node:test";
import {
  getFieldWorkspaceLabels,
  getProjectFieldJobHref,
  resolveFieldJobLoad,
  resolveFieldJobMembership,
  resolveRequestedFieldJobId,
  resolveSelectedFieldJobId,
} from "./field-workspace.ts";

const TODAY_JOBS = [{ id: "today-1" }, { id: "today-2" }];

test("explicit field job selection wins when today's list omits the requested job", () => {
  assert.equal(resolveSelectedFieldJobId("future-1", TODAY_JOBS), "future-1");
  assert.equal(
    resolveFieldJobMembership({
      requestedJobId: "future-1",
      selectedJobId: "future-1",
      todayJobIds: TODAY_JOBS.map((job) => job.id),
      listFailed: false,
    }),
    "outside_today"
  );
  assert.deepEqual(getFieldWorkspaceLabels("outside_today"), {
    heading: "Field job",
    schedule: "Schedule",
  });
});

test("failed daily list keeps an explicit field job but uses neutral labels", () => {
  assert.equal(resolveSelectedFieldJobId(["future-1", "ignored"], []), "future-1");
  assert.equal(resolveRequestedFieldJobId([" future-1 ", "ignored"]), "future-1");
  assert.equal(
    resolveFieldJobMembership({
      requestedJobId: "future-1",
      selectedJobId: "future-1",
      todayJobIds: [],
      listFailed: true,
    }),
    "unknown"
  );
  assert.deepEqual(getFieldWorkspaceLabels("unknown"), {
    heading: "Field job",
    schedule: "Schedule",
  });
});

test("today membership preserves Today labels", () => {
  assert.equal(
    resolveFieldJobMembership({
      requestedJobId: "today-2",
      selectedJobId: "today-2",
      todayJobIds: TODAY_JOBS.map((job) => job.id),
      listFailed: false,
    }),
    "today"
  );
  assert.deepEqual(getFieldWorkspaceLabels("today"), {
    heading: "Today",
    schedule: "Today on site",
  });
});

test("field job load failures and archived jobs are non-actionable", () => {
  assert.deepEqual(resolveFieldJobLoad({ error: "Not found" }), {
    job: null,
    error: "Not found",
    actionable: false,
  });

  assert.deepEqual(
    resolveFieldJobLoad({ job: { id: "archived-1", archivedAt: "2026-10-01T12:00:00.000Z" } }),
    {
      job: null,
      error: "This job is archived. Open an active assigned job instead.",
      actionable: false,
    }
  );

  const active = { id: "active-1", archivedAt: null };
  assert.deepEqual(resolveFieldJobLoad({ job: active }), {
    job: active,
    error: null,
    actionable: true,
  });
});

test("Project field links are available only to technicians for active jobs", () => {
  const active = { id: "job 1", archivedAt: null };
  const archived = { id: "job-2", archivedAt: "2026-10-01T12:00:00.000Z" };

  assert.equal(getProjectFieldJobHref("technician", active), "/field?job=job%201");
  assert.equal(getProjectFieldJobHref("technician", archived), null);
  assert.equal(getProjectFieldJobHref("dispatcher", active), null);
  assert.equal(getProjectFieldJobHref("owner", active), null);
});
