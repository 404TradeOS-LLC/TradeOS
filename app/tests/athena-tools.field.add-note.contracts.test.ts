import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createJobAddNoteTool } from "../modules/athena-tools/field/addJobNote.tool";
import type { JobAddNoteToolDeps } from "../modules/athena-tools/field/addJobNote.tool";

// A12 Business Tool Rollout, Field Technician domain contract test
// (docs/athena/roadmap/A12-business-tool-rollout-implementation-plan.md
// steps 7-8). Fake CrmService dep is a plain jest.fn(), matching the repo
// convention already established by athena-tool-sdk.contracts.test.ts's
// createFakeMemoryService - not app/tests/helpers/
// fakeAthenaObservabilityDb.ts, which is unrelated.

function createFakeCrmService(): JobAddNoteToolDeps["crm"] {
  return {
    createNote: jest.fn(async (_orgId: string, authorUserId: string, input: { entityType: "customer" | "job"; entityId: string; body: string }) =>
      Promise.resolve({
        id: "note-1",
        orgId: "org-1",
        entityType: input.entityType,
        entityId: input.entityId,
        parentCommentId: null,
        body: input.body,
        authorUserId,
        mentionsJson: null,
        reactionsJson: null,
        resolvedAt: null,
        createdAt: new Date("2026-08-11T00:00:00.000Z"),
        updatedAt: new Date("2026-08-11T00:00:00.000Z"),
      })
    ),
  };
}

const validInput = { jobId: "11111111-1111-1111-1111-111111111111", body: "Replaced capacitor, unit running normally." };

describe("athena-tools field: add-note", () => {
  describeAthenaToolContract(createJobAddNoteTool({ crm: createFakeCrmService() }), {
    validInput,
    invalidInputs: [{ ...validInput, body: "" }, { ...validInput, jobId: "not-a-uuid" }, {}],
  });

  it("calls CrmService.createNote with entityType job, and never fabricates an event", async () => {
    const crm = createFakeCrmService();
    const tool = createJobAddNoteTool({ crm });
    const result = await tool.execute(validInput, {} as never, {
      executionId: "exec-1",
      requestId: "req-1",
      traceId: "trace-1",
      orgId: "org-1",
      actor: { type: "user", id: "user-1" },
      role: "technician",
      deadline: new Date(Date.now() + 1000),
      cancellationSignal: new AbortController().signal,
      featureFlags: [],
    });

    expect(crm.createNote).toHaveBeenCalledWith("org-1", "user-1", {
      entityType: "job",
      entityId: validInput.jobId,
      body: validInput.body,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      id: "note-1",
      jobId: validInput.jobId,
      body: validInput.body,
      authorUserId: "user-1",
      createdAt: "2026-08-11T00:00:00.000Z",
    });
    expect(result.events).toEqual([]);
  });
});
