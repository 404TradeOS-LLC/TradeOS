const runWithRequiredCanonicalEvents = jest.fn(
  async (_requiredTypes: readonly string[], operation: () => Promise<unknown>) => operation()
);

jest.mock("../modules/athena-events/transactionalContext", () => ({
  runWithRequiredCanonicalEvents,
}));

import { EstimateEngineService } from "../modules/estimate-engine/service";
import { JobsService } from "../modules/jobs/service";
import { ProposalsService } from "../modules/proposals/service";
import {
  TransactionalEstimateEngineService,
  TransactionalJobsService,
  TransactionalProposalsService,
} from "../modules/athena-events/transactionalPublishers";

describe("transactional publisher service contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [TransactionalEstimateEngineService, EstimateEngineService.prototype, "create", "EstimateStarted", [{ projectId: "project-1", orgId: "org-1" }]],
    [TransactionalEstimateEngineService, EstimateEngineService.prototype, "finalize", "EstimateCompleted", ["estimate-1", "org-1"]],
    [TransactionalJobsService, JobsService.prototype, "schedule", "JobScheduled", ["job-1", { orgId: "org-1" }]],
    [TransactionalJobsService, JobsService.prototype, "addAssignment", "TechnicianAssigned", ["job-1", { orgId: "org-1" }]],
    [TransactionalJobsService, JobsService.prototype, "complete", "WorkCompleted", ["job-1", { orgId: "org-1" }]],
    [TransactionalProposalsService, ProposalsService.prototype, "send", "ProposalSent", ["proposal-1", "org-1", "owner-1"]],
  ])("wraps %p.%s with required event %s", async (ServiceClass, basePrototype, methodName, eventType, args) => {
    const result = { ok: true };
    const baseMethod = jest.spyOn(basePrototype as never, methodName as never).mockResolvedValue(result as never);
    const ServiceConstructor = ServiceClass as unknown as new () => Record<
      string,
      (...methodArgs: unknown[]) => Promise<unknown>
    >;
    const service = new ServiceConstructor();

    await expect(service[methodName as string](...(args as unknown[]))).resolves.toBe(result);

    expect(runWithRequiredCanonicalEvents).toHaveBeenCalledWith([eventType], expect.any(Function));
    expect(baseMethod).toHaveBeenCalledWith(...args);

    baseMethod.mockRestore();
  });
});
