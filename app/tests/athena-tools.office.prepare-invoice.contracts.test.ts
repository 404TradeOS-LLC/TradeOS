import fs from "node:fs";
import path from "node:path";
import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createInvoicePrepareTool } from "../modules/athena-tools/office/prepareInvoice.tool";
import type { InvoicePrepareToolDeps } from "../modules/athena-tools/office/prepareInvoice.tool";

const VALID_ESTIMATE_ID = "66666666-6666-4666-8666-666666666666";

type InvoiceRow = Awaited<ReturnType<InvoicePrepareToolDeps["invoices"]["listByProject"]>>[number];

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
      taxPct: 0,
      taxAmount: 0,
      costAfterOverhead: 1100,
      preTaxTotalPrice: 1200,
      totalPrice: 1200,
      lineItems: [
        { id: "li-1", estimateId: id, costItemId: "ci-1", assemblyId: null, description: "Labor", quantity: 10, unitOfMeasure: "hr", unitCost: 50, lineCost: 500, sortOrder: 1, sourceKey: null, section: "General", costType: "labor" as const, taxable: false },
        { id: "li-2", estimateId: id, costItemId: "ci-2", assemblyId: null, description: "Materials", quantity: 1, unitOfMeasure: "ea", unitCost: 500, lineCost: 500, sortOrder: 2, sourceKey: null, section: "General", costType: "material" as const, taxable: true },
      ],
    })),
  };
}

function invoiceRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    projectId: "project-1",
    estimateId: VALID_ESTIMATE_ID,
    proposalId: null,
    invoiceNumber: 1,
    type: "full",
    status: "draft",
    percentComplete: null,
    amount: 1200,
    subtotal: 1200,
    taxPct: 0,
    taxAmount: 0,
    dueDate: null,
    sentAt: null,
    paidAt: null,
    createdAt: new Date("2026-08-11T12:00:00.000Z"),
    paidAmount: 0,
    balanceDue: 1200,
    payments: [],
    deliveries: [],
    ...overrides,
  };
}

function createFakeInvoices(existing: InvoiceRow[] = []): InvoicePrepareToolDeps["invoices"] {
  return {
    listByProject: jest.fn(async () => existing),
  };
}

function runtimeImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const staticImport = /^\s*import\s+(?!type\b)[^;\n]*?\sfrom\s+["']([^"']+)["']/gm;
  const sideEffectImport = /^\s*import\s+["']([^"']+)["']/gm;
  const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
  const requireImport = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [staticImport, sideEffectImport, dynamicImport, requireImport]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

describe("athena-tools office: prepare-invoice", () => {
  describeAthenaToolContract(createInvoicePrepareTool({ estimateEngine: createFakeEstimateEngine(), invoices: createFakeInvoices() }), {
    validInput: { estimateId: VALID_ESTIMATE_ID },
    invalidInputs: [{}, { estimateId: "not-a-uuid" }, { estimateId: 123 }],
  });

  it("keeps the prepare-invoice implementation behind injected service boundaries", () => {
    const toolPath = path.resolve(__dirname, "../modules/athena-tools/office/prepareInvoice.tool.ts");
    const source = fs.readFileSync(toolPath, "utf8");
    const imports = runtimeImportSpecifiers(source);

    expect(imports).not.toContain("@prisma/client");
    expect(imports.some((specifier) => /(?:^|\/)db\/(?:client|requestSession)$/.test(specifier))).toBe(false);
    expect(imports.some((specifier) => /(?:^|\/)invoices\/service$/.test(specifier))).toBe(false);
    expect(imports.some((specifier) => /(?:^|\/)estimate-engine\/service$/.test(specifier))).toBe(false);
  });

  it("composes a preview-only draft from the estimate's line items and flags an existing invoice", async () => {
    const estimateEngine = createFakeEstimateEngine();
    const invoices = createFakeInvoices([invoiceRow()]);
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
