import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createActiveJobsTool } from "../modules/athena-tools/dispatcher/activeJobs.tool";
import type { ActiveJobsToolDeps } from "../modules/athena-tools/dispatcher/activeJobs.tool";
import type { DispatchSummaryDTO, JobSummaryDTO, PaginatedJobsDTO } from "../modules/jobs/types";

function buildFakeDispatchSummary(overrides: Partial<DispatchSummaryDTO> = {}): DispatchSummaryDTO {
  return {
    activeJobs: 5,
    unscheduledJobs: 0,
    scheduledToday: 3,
    overdueActionable: 0,
    needsAttention: 0,
    timezone: { source: "organization", value: "America/Chicago" },
    todayRangeUtc: { start: "2026-08-11T05:00:00.000Z", end: "2026-08-12T05:00:00.000Z" },
    weekRangeUtc: { start: "2026-08-11T05:00:00.000Z", end: "2026-08-18T05:00:00.000Z" },
    generatedAt: "2026-08-11T12:00:00.000Z",
    scope: { source: "organization", role: "owner" },
    ...overrides,
  };
}

function buildFakeJob(overrides: Partial<JobSummaryDTO> = {}): JobSummaryDTO {
  return {
    id: "job-1",
    jobNumber: "JOB-2026-000001",
    title: "Furnace repair",
    jobType: "repair",
    status: "scheduled",
    priority: "medium",
    scheduledStart: "2026-08-11T14:00:00.000Z",
    scheduledEnd: "2026-08-11T16:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

function createFakeJobsService(summary: DispatchSummaryDTO, items: JobSummaryDTO[]): ActiveJobsToolDeps["jobs"] {
  const page: PaginatedJobsDTO = { items, page: 1, pageSize: 25, total: items.length };
  return {
    getDispatchSummary: jest.fn(async () => Promise.resolve(summary)),
    list: jest.fn(async () => Promise.resolve(page)),
  };
}

const validInput = {};

function execution() {
  return {
    executionId: "exec-1",
    requestId: "req-1",
    traceId: "trace-1",
    orgId: "org-1",
    actor: { type: "user", id: "user-1" } as const,
    role: "owner" as const,
    deadline: new Date(Date.now() + 1000),
    cancellationSignal: new AbortController().signal,
    featureFlags: [],
  };
}

describe("athena-tools dispatcher: active-jobs", () => {
  describeAthenaToolContract(createActiveJobsTool({ jobs: createFakeJobsService(buildFakeDispatchSummary(), []) }), {
    validInput,
    invalidInputs: [null, [], "not-an-object"],
  });

  it("reports the dispatch summary's active-jobs count and lists the active jobs", async () => {
    const jobs = createFakeJobsService(buildFakeDispatchSummary(), [
      buildFakeJob(),
      buildFakeJob({ id: "job-2", jobNumber: "JOB-2026-000002", title: "Roof inspection", status: "dispatched" }),
      buildFakeJob({ id: "job-3", jobNumber: "JOB-2026-000003", title: "Old completed job", status: "completed" }),
    ]);
    const tool = createActiveJobsTool({ jobs });

    const result = await tool.execute(validInput, {} as never, execution());

    expect(result.success).toBe(true);
    expect(result.summary).toContain("5 active jobs");
    expect(result.summary).toContain("JOB-2026-000001");
    expect(result.summary).toContain("JOB-2026-000002");
    expect(result.summary).not.toContain("JOB-2026-000003");
    expect(result.data?.activeJobs).toBe(5);
    expect(result.data?.jobs).toHaveLength(2);
  });

  it("reports zero active jobs without listing anything", async () => {
    const jobs = createFakeJobsService(buildFakeDispatchSummary({ activeJobs: 0, scheduledToday: 0 }), []);
    const tool = createActiveJobsTool({ jobs });

    const result = await tool.execute(validInput, {} as never, execution());

    expect(result.success).toBe(true);
    expect(result.summary).toBe("No active jobs.");
    expect(result.data?.activeJobs).toBe(0);
    expect(result.data?.jobs).toEqual([]);
  });

  it("collects active jobs from later pages when the first page is all terminal jobs", async () => {
    // 25 older completed jobs fill page 1 (sorted by scheduledStart asc);
    // the 5 active jobs sit on page 2. Filtering page 1 alone used to
    // produce an empty active list with a "5 active jobs; and 5 more"
    // summary naming none of them.
    const terminalPage = Array.from({ length: 25 }, (_, index) =>
      buildFakeJob({
        id: `old-job-${index}`,
        jobNumber: `JOB-2025-${String(index + 1).padStart(6, "0")}`,
        title: `Old completed job ${index + 1}`,
        status: "completed",
      })
    );
    const activePage = Array.from({ length: 5 }, (_, index) =>
      buildFakeJob({
        id: `active-job-${index}`,
        jobNumber: `JOB-2026-00010${index + 1}`,
        title: `Active job ${index + 1}`,
        status: "scheduled",
      })
    );
    const jobs: ActiveJobsToolDeps["jobs"] = {
      getDispatchSummary: jest.fn(async () => Promise.resolve(buildFakeDispatchSummary())),
      list: jest.fn(async (filters) =>
        Promise.resolve(
          filters.page === 1
            ? { items: terminalPage, page: 1, pageSize: 25, total: 30 }
            : { items: activePage, page: 2, pageSize: 25, total: 30 }
        )
      ),
    };
    const tool = createActiveJobsTool({ jobs });

    const result = await tool.execute(validInput, {} as never, execution());

    expect(result.success).toBe(true);
    expect(result.summary).toContain("5 active jobs");
    expect(result.summary).toContain("JOB-2026-000101");
    expect(result.summary).not.toContain("JOB-2025-000001");
    expect(result.summary).not.toContain("and 5 more");
    expect(result.data?.jobs).toHaveLength(5);
    expect(jobs.list).toHaveBeenCalledTimes(2);
    expect(jobs.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    expect(jobs.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it("scopes the list call to the caller's organization and passes the actor through", async () => {
    const jobs = createFakeJobsService(buildFakeDispatchSummary(), [buildFakeJob()]);
    const tool = createActiveJobsTool({ jobs });

    await tool.execute(validInput, {} as never, execution());

    expect(jobs.getDispatchSummary).toHaveBeenCalledWith("org-1", { userId: "user-1", role: "owner" });
    expect(jobs.list).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "org-1", archived: false, page: 1, pageSize: 25 })
    );
    const listAuth = (jobs.list as jest.Mock).mock.calls[0][0].auth;
    expect(listAuth.userId).toBe("user-1");
    expect(listAuth.orgId).toBe("org-1");
    expect(listAuth.role).toBe("owner");
  });
});
