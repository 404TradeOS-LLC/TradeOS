const runInDatabaseTransaction = jest.fn((_client, operation: () => unknown) => operation());

jest.mock("../db/client", () => ({ prisma: {} }));
jest.mock("../db/requestSession", () => ({ runInDatabaseTransaction }));

import {
  recordCanonicalEventPublished,
  recordCanonicalEventPublishFailure,
  runWithRequiredCanonicalEvents,
} from "../modules/athena-events/transactionalContext";

describe("transactional canonical event requirements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the business result only after every required event is recorded", async () => {
    await expect(
      runWithRequiredCanonicalEvents(["EstimateStarted", "EstimateCompleted"], async () => {
        recordCanonicalEventPublished("EstimateStarted");
        recordCanonicalEventPublished("EstimateCompleted");
        return { id: "estimate-1" };
      })
    ).resolves.toEqual({ id: "estimate-1" });

    expect(runInDatabaseTransaction).toHaveBeenCalledTimes(1);
  });

  it("fails closed when a required event is missing after the mutation returns", async () => {
    await expect(
      runWithRequiredCanonicalEvents(["JobScheduled"], async () => ({ id: "job-1" }))
    ).rejects.toThrow("required canonical event was not persisted: JobScheduled");
  });

  it("rethrows a publish failure even when the business service swallowed it", async () => {
    const publishError = new Error("event insert failed");

    await expect(
      runWithRequiredCanonicalEvents(["ProposalSent"], async () => {
        recordCanonicalEventPublishFailure("ProposalSent", publishError);
        return { id: "proposal-1", status: "sent" };
      })
    ).rejects.toBe(publishError);
  });

  it("does not let an unrelated event satisfy the required event contract", async () => {
    await expect(
      runWithRequiredCanonicalEvents(["WorkCompleted"], async () => {
        recordCanonicalEventPublished("TechnicianAssigned");
        return { id: "job-1" };
      })
    ).rejects.toThrow("required canonical event was not persisted: WorkCompleted");
  });
});
