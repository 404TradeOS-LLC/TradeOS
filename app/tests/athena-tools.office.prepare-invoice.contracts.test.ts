import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createInvoicePrepareTool } from "../modules/athena-tools/office/prepareInvoice.tool";
import type { InvoicePrepareToolDeps } from "../modules/athena-tools/office/prepareInvoice.tool";

// A12 Office Manager contract tests (docs/athena/roadmap/
// A12-business-tool-rollout-implementation-plan.md section 8, step 8).
// Follows app/tests/athena-tool-sdk.contracts.test.ts's pattern: hand-rolled
// jest.fn()-based fake services matching this tool's own
// Pick<EstimateEngineService, "getById"> /
// Pick<InvoicesService, "listByProject"> deps shapes, never
// tests/helpers/fakeAthenaObservabilityDb.ts (unrelated suite).
//
// Invoice.Prepare's most important boundary (see the tool file's own module
// comment): it must never call any invoice-creating/writing method and must
// perform zero database writes. The fake `invoices` object below is
// declared with exactly the `InvoicePrepareToolDeps["invoices"]` type (=
// Pick<InvoicesService, "listByProject">) - adding a `create`/`send`/
// `markPaid`/`void` method to that object literal would fail to typecheck
// (excess-property check on a directly-typed object literal), which is what
// makes it structurally impossible for the tool to reach a write method
// through `deps`, not merely a convention this test happens to follow.

const VALID_ESTIMATE_ID = "66666666-6666-4666-8666-666666666666";

function createFakeEstimateEngine(): InvoicePrepareToolDeps["estimateEngine"] {
  return {
    getById: jest.fn(async (id: string, orgId?: string) => ({
      id,
      orgId: orgId ?? null,
      projectId: "project-1",
      version: 2,
      status: "ready" as const,
      overheadPct: 10,
      profitPct: 20,
      targetMarginPct: null,
      subtotalCost: 1000,
      totalPrice: 1200,
      lineItems: [
        { id: "li-1", estimateId: id, costItemId: "ci-1", assemblyId: null, description: "Labor", quantity: 10, unitOfMeasure: "hr", unitCost: 50, lineCost: 500, sortOrder: 1, sourceKey: null },
        { id: "li-2", estimateId: id, costItemId: "ci-2", assemblyId: null, description: "Materials", quantity: 1, unitOfMeasure: "ea", unitCost: 500, lineCost: 500, sortOrder: 2, sourceKey: null },
      ],
    })),
  };
}

function createFakeInvoices(existing: unknown[] = []): InvoicePrepareToolDeps["invoices"] {
  return {
    listByProject: jest.fn(async () => existing as never),
  };
}

describe("athena-tools office: prepare-invoice", () => {
  describeAthenaToolContract(createInvoicePrepareTool({ estimateEngine: createFakeEstimateEngine(), invoices: createFakeInvoices() }), {
    validInput: { estimateId: VALID_ESTIMATE_ID },
    invalidInputs: [{}, { estimateId: "not-a-uuid" }, { estimateId: 123 }],
  });

  it("has no write-capable methods on its fake deps - only listByProject/getById are reachable", () => {
    const invoices = createFakeInvoices();
    const estimateEngine = createFakeEstimateEngine();
    expect((invoices as Record<string, unknown>).create).toBeUndefined();
    expect((invoices as Record<string, unknown>).send).toBeUndefined();
    expect((invoices as Record<string, unknown>).markPaid).toBeUndefined();
    expect((invoices as Record<string, unknown>).void).toBeUndefined();
    expect(Object.keys(invoices)).toEqual(["listByProject"]);
    expect(Object.keys(estimateEngine)).toEqual(["getById"]);
  });

  it("composes a preview-only draft from the estimate's line items, flags an existing invoice, and never calls a write method", async () => {
    const estimateEngine = createFakeEstimateEngine();
    const invoices = createFakeInvoices([{ id: "inv-1" }]);
    const tool = createInvoicePrepareTool({ estimateEngine, invoices });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-1", requestId: "req-1", traceId: "trace-1", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(estimateEngine.getById).toHaveBeenCalledWith(VALID_ESTIMATE_ID, "org-1");
    expect(invoices.listByProject).toHaveBeenCalledWith("project-1", "org-1");
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      preview: true,
      estimateId: VALID_ESTIMATE_ID,
      projectId: "project-1",
      subtotal: 1000,
      suggestedAmount: 1200,
      existingInvoiceCount: 1,
    });
    expect(result.data?.lineItems).toHaveLength(2);
    expect(result.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["athena_invoice_preview_only", "athena_invoice_already_exists"]));
  });

  it("still returns the preview-only warning when no existing invoice is found", async () => {
    const tool = createInvoicePrepareTool({ estimateEngine: createFakeEstimateEngine(), invoices: createFakeInvoices([]) });
    const result = await tool.execute(
      { estimateId: VALID_ESTIMATE_ID },
      {} as never,
      { executionId: "exec-2", requestId: "req-2", traceId: "trace-2", orgId: "org-1", actor: { type: "user", id: "user-1" }, role: "owner", deadline: new Date(Date.now() + 1000), cancellationSignal: new AbortController().signal, featureFlags: [] }
    );

    expect(result.data?.existingInvoiceCount).toBe(0);
    expect(result.warnings.map((w) => w.code)).toEqual(["athena_invoice_preview_only"]);
    expect(result.events).toEqual([]);
  });
});
