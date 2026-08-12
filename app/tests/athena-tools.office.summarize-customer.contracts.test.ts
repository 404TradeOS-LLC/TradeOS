import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCustomerSummarizeTool } from "../modules/athena-tools/office/summarizeCustomer.tool";
import type { CustomerSummarizeToolDeps } from "../modules/athena-tools/office/summarizeCustomer.tool";
import type { CrmService } from "../modules/crm/service";

// A12 Office Manager contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).
// Follows app/tests/athena-tool-sdk.contracts.test.ts's pattern: a
// hand-rolled jest.fn()-based fake service matching this tool's own
// Pick<CrmService, "getCustomer" | "listNotes"> deps shape, never
// tests/helpers/fakeAthenaObservabilityDb.ts (unrelated suite).
//
// CrmService's methods return full Prisma row shapes (not narrow DTOs), so
// the fakes below are typed via Awaited<ReturnType<...>> rather than
// hand-guessed. Notably, CrmService.getCustomer()'s own return value
// shadows the Customer row's plain-text `notes` field with a Comment[] (see
// modules/crm/service.ts's `return { ...row, notes };`) - the fake below
// reflects that real shape rather than a simplified one, which is exactly
// why the tool itself never reads `customer.notes` as text (see
// summarizeCustomer.tool.ts's module comment).

const VALID_CUSTOMER_ID = "44444444-4444-4444-8444-444444444444";

type CustomerDetail = Awaited<ReturnType<CrmService["getCustomer"]>>;
type NoteRow = Awaited<ReturnType<CrmService["listNotes"]>>[number];

function fakeNote(overrides: Partial<NoteRow> = {}): NoteRow {
  return {
    id: "n1",
    orgId: "org-1",
    entityType: "customer",
    entityId: VALID_CUSTOMER_ID,
    parentCommentId: null,
    body: "Called about scheduling",
    authorUserId: "user-1",
    mentionsJson: null,
    reactionsJson: null,
    resolvedAt: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function createFakeCrm(): CustomerSummarizeToolDeps["crm"] {
  const notes: NoteRow[] = [fakeNote(), fakeNote({ id: "n2", body: "Follow up next week", authorUserId: "user-2", createdAt: new Date("2026-08-05T00:00:00Z") })];

  return {
    getCustomer: jest.fn(
      async (_orgId: string, customerId: string): Promise<CustomerDetail> => ({
        id: customerId,
        orgId: "org-1",
        name: "Jane Contractor",
        email: "jane@example.com",
        phone: "555-1234",
        address: "123 Main St",
        billingAddress: "PO Box 1",
        deletedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        notes,
        projects: [],
        serviceAddresses: [],
        equipmentAssets: [],
      })
    ),
    listNotes: jest.fn(async (): Promise<NoteRow[]> => notes),
  };
}

describe("athena-tools office: summarize-customer", () => {
  describeAthenaToolContract(createCustomerSummarizeTool({ crm: createFakeCrm() }), {
    validInput: { customerId: VALID_CUSTOMER_ID },
    invalidInputs: [{}, { customerId: "not-a-uuid" }, { customerId: 123 }],
  });

  it("composes a customer profile + recent notes from getCustomer/listNotes without inventing fields", async () => {
    const crm = createFakeCrm();
    const tool = createCustomerSummarizeTool({ crm });
    const result = await tool.execute(
      { customerId: VALID_CUSTOMER_ID },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(crm.getCustomer).toHaveBeenCalledWith("org-1", VALID_CUSTOMER_ID);
    expect(crm.listNotes).toHaveBeenCalledWith("org-1", "customer", VALID_CUSTOMER_ID);
    expect(result.success).toBe(true);
    expect(result.data?.customer).toMatchObject({
      id: VALID_CUSTOMER_ID,
      name: "Jane Contractor",
      projectCount: 0,
      serviceAddressCount: 0,
      equipmentCount: 0,
    });
    expect(result.data?.customer).not.toHaveProperty("notes");
    expect(result.data?.recentNotes).toEqual([
      { id: "n1", body: "Called about scheduling", authorUserId: "user-1", createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "n2", body: "Follow up next week", authorUserId: "user-2", createdAt: "2026-08-05T00:00:00.000Z" },
    ]);
  });
});
