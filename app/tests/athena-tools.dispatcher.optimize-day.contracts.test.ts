import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createOptimizeDayTool } from "../modules/athena-tools/dispatcher/optimizeDay.tool";
import type { OptimizeDayToolDeps } from "../modules/athena-tools/dispatcher/optimizeDay.tool";
import type { DispatchSummaryDTO, ScheduleConflictResultDTO } from "../modules/jobs/types";

// A12 Business Tool Rollout, Dispatcher domain contract test. Fake
// JobsService dep is a plain jest.fn(), matching the repo convention already
// established by athena-tool-sdk.contracts.test.ts's createFakeMemoryService.
// This tool is pure read/analysis - both fakes only ever return canned DTOs,
// never mutate state.

function buildFakeDispatchSummary(overrides: Partial<DispatchSummaryDTO> = {}): DispatchSummaryDTO {
  return {
    activeJobs: 5,
    unscheduledJobs: 0,
    scheduledToday: 3,
    overdueActionable: 0,
    needsAttention: 0,
    timezone: { source: "organization", value: "America/Chicago" },
    todayRangeUtc: { start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" },
    weekRangeUtc: { start: "2026-08-11T00:00:00.000Z", end: "2026-08-18T00:00:00.000Z" },
    generatedAt: "2026-08-11T12:00:00.000Z",
    scope: { source: "organization", role: "owner" },
    ...overrides,
  };
}

function buildFakeConflictResult(overrides: Partial<ScheduleConflictResultDTO> = {}): ScheduleConflictResultDTO {
  return {
    conflicts: [],
    overrideAllowed: true,
    ...overrides,
  };
}

function createFakeJobsService(summary: DispatchSummaryDTO, conflicts: ScheduleConflictResultDTO): OptimizeDayToolDeps["jobs"] {
  return {
    getDispatchSummary: jest.fn(async () => Promise.resolve(summary)),
    getScheduleConflicts: jest.fn(async () => Promise.resolve(conflicts)),
  };
}

const validInput = {};

describe("athena-tools dispatcher: optimize-day", () => {
  describeAthenaToolContract(createOptimizeDayTool({ jobs: createFakeJobsService(buildFakeDispatchSummary(), buildFakeConflictResult()) }), {
    validInput,
    // z.object({}) strips unknown keys and accepts any plain object, so a
    // meaningful "invalid input" here has to fail the object-shape check
    // itself (null/array/primitive), not merely carry an extra field.
    invalidInputs: [null, [], "not-an-object"],
  });

  it("adds a warning and follow-up when schedule conflicts are present", async () => {
    const jobs = createFakeJobsService(
      buildFakeDispatchSummary({ unscheduledJobs: 2, needsAttention: 1 }),
      buildFakeConflictResult({
        conflicts: [
          {
            type: "technician_overlap",
            technicianId: "tech-1",
            technicianName: "Jamie Tech",
            conflictingJobId: "job-2",
            conflictingJobNumber: "JOB-2026-000002",
            conflictingJobTitle: "Furnace repair",
            conflictingScheduledStart: "2026-08-11T14:00:00.000Z",
            conflictingScheduledEnd: "2026-08-11T16:00:00.000Z",
          },
        ],
      })
    );
    const tool = createOptimizeDayTool({ jobs });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    });
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([
      { code: "athena_schedule_conflicts_detected", message: "1 technician schedule conflict(s) detected for today." },
    ]);
    expect(result.followUps).toHaveLength(3);
    expect(result.data?.conflicts.conflicts).toHaveLength(1);
    expect(result.data?.summary.unscheduledJobs).toBe(2);
  });

  it("returns no warnings or follow-ups when the day is clean", async () => {
    const jobs = createFakeJobsService(buildFakeDispatchSummary(), buildFakeConflictResult());
    const tool = createOptimizeDayTool({ jobs });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "owner",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    });
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.followUps).toEqual([]);
    expect(result.events).toEqual([]);
  });
});
