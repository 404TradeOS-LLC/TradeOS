// DES-10-F4 — Figma deck-fixture reconciliation.
//
// Fixture provenance (read 2026-11-24 from the live Figma master file
// xImUa9CYUjx3Cb3zTrkfnY, page 14 Estimates):
//   - Frame 378:441 (Items, [CANONICAL]) — "Deck Replacement", Sarah Johnson,
//     ESTIMATE #1048 / DRAFT. Six priced lines subtotal $6,742; permit
//     allowance $350 + jobsite cleanup $275 = $625; supported subtotal
//     $7,367; DRAFT INVESTMENT $9,037; unexplained difference $1,670.
//   - Frame 378:442 (Price, [CANONICAL]) — same figures, plus the
//     provenance disclosure: "source name, region and date are not recorded
//     in this fixture."
//   - Frame 378:443 (Review, [CANONICAL]) — checklist item "01 Reconcile
//     the $1,670 pricing difference".
//
// Founder decision (Billy, 2026-11-24 ~09:04 EST): the $1,670 difference is
// fixture/sample data, not a real pricing bug. Imported-draft reconciliation
// must NOT be built. These tests pin that verdict in code:
//
//   1. The authoritative engine, given the Figma deck's own supported
//      lines, computes $7,367 — never $9,037. The $1,670 gap is exactly the
//      unsupported remainder (imported draft minus supported subtotal) and
//      has no source in any engine output.
//   2. The same $7,367 agrees across the three workflow surfaces that all
//      read the one stored total: the estimate DTO returned by
//      recalculate() (what the builder Review stage renders), the proposal
//      finalPrice backfilled by finalize(), and the proposal finalPrice
//      inherited by create-from-estimate.
//
// The Figma dollar values below are TEST-ONLY fixture inputs. They are never
// copied into production calculations (see docs/operations/INVITED_BETA.md:
// "do not copy design values into calculations").

const mockPrisma = {
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  estimate: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  proposal: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  costItem: {
    findFirst: jest.fn(),
  },
  assembly: {
    findFirst: jest.fn(),
  },
  estimateLineItem: {
    aggregate: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCostDatabase = {
  getUnitCost: jest.fn(),
};

const mockAssembliesDatabase = {
  getAssemblyUnitCost: jest.fn(),
};

const mockProposalGenerator = {
  generateProposal: jest.fn(),
  generateProjectProposal: jest.fn(),
};

const mockAthenaEventService = {
  publish: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));
jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => mockAssembliesDatabase),
}));
jest.mock("../modules/proposal-generator/service", () => ({
  ProposalGeneratorService: jest.fn().mockImplementation(() => mockProposalGenerator),
}));
jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    record: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("../modules/athena-events/service", () => ({
  getDefaultAthenaEventService: jest.fn(() => mockAthenaEventService),
}));

import { EstimateEngineService } from "../modules/estimate-engine/service";
import { ProposalsService } from "../modules/proposals/service";

// Figma 378:441 line rows, in frame order. Quantities / unit costs are the
// ones the frame prints; LS rows carry their line cost as the unit cost.
// Row 01's description text is not captured here — only the amounts the
// frame prints (1 LS, $650) are asserted, so no label is invented.
const FIGMA_DECK_LINES = [
  { description: "Figma row 01", quantity: 1, unitOfMeasure: "LS", unitCost: 650, lineCost: 650 },
  { description: "Deck framing · PT", quantity: 1, unitOfMeasure: "LS", unitCost: 1892, lineCost: 1892 },
  { description: "Decking · PT 5/4 × 6", quantity: 192, unitOfMeasure: "SF", unitCost: 4.25, lineCost: 816 },
  { description: "Railing system · PT", quantity: 52, unitOfMeasure: "LF", unitCost: 38, lineCost: 1976 },
  { description: "Stairs · PT", quantity: 1, unitOfMeasure: "LS", unitCost: 988, lineCost: 988 },
  { description: "Figma row 06", quantity: 1, unitOfMeasure: "LS", unitCost: 420, lineCost: 420 },
  { description: "Permit allowance", quantity: 1, unitOfMeasure: "LS", unitCost: 350, lineCost: 350 },
  { description: "Jobsite cleanup", quantity: 1, unitOfMeasure: "LS", unitCost: 275, lineCost: 275 },
];

const FIGMA_IMPORTED_DRAFT_TOTAL = 9037;
const FIGMA_SUPPORTED_SUBTOTAL = 7367;
const FIGMA_UNEXPLAINED_DIFFERENCE = 1670;

function fixtureEstimateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "estimate-1",
    orgId: "org-1",
    projectId: "project-1",
    version: 1,
    status: "draft",
    overheadPct: 0,
    profitPct: 0,
    targetMarginPct: null,
    taxPct: 0,
    subtotalCost: 0,
    totalPrice: 0,
    taxAmount: 0,
    exclusionsReviewedAt: new Date("2026-11-23T12:00:00.000Z"),
    priceSourcesReviewedAt: new Date("2026-11-23T12:00:00.000Z"),
    lineItems: FIGMA_DECK_LINES.map((line, index) => ({
      id: `line-${index + 1}`,
      estimateId: "estimate-1",
      lineCost: line.lineCost,
      taxable: false,
    })),
    ...overrides,
  };
}

describe("DES-10-F4 estimate fixture reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAthenaEventService.publish.mockResolvedValue({ event: {} });
  });

  it("reconciles the Figma deck fixture arithmetic before the engine runs", () => {
    const pricedLines = FIGMA_DECK_LINES.slice(0, 6);
    const allowances = FIGMA_DECK_LINES.slice(6);
    expect(pricedLines.reduce((sum, line) => sum + line.lineCost, 0)).toBe(6742);
    expect(allowances.reduce((sum, line) => sum + line.lineCost, 0)).toBe(625);
    expect(FIGMA_DECK_LINES.reduce((sum, line) => sum + line.lineCost, 0)).toBe(FIGMA_SUPPORTED_SUBTOTAL);
    expect(FIGMA_IMPORTED_DRAFT_TOTAL - FIGMA_SUPPORTED_SUBTOTAL).toBe(FIGMA_UNEXPLAINED_DIFFERENCE);
    // The two priced-by-quantity rows multiply out to their printed line costs.
    expect(192 * 4.25).toBe(816);
    expect(52 * 38).toBe(1976);
  });

  it("recalculates the Figma deck lines to the $7,367 supported subtotal, never $9,037", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue(fixtureEstimateRow());
    mockPrisma.estimate.update.mockResolvedValue({
      ...fixtureEstimateRow(),
      subtotalCost: FIGMA_SUPPORTED_SUBTOTAL,
      totalPrice: FIGMA_SUPPORTED_SUBTOTAL,
      taxAmount: 0,
    });

    const dto = await new EstimateEngineService().recalculate("estimate-1", "org-1");

    // recalculate() persists exactly one total, derived from the stored lines.
    expect(mockPrisma.estimate.update).toHaveBeenCalledWith({
      where: { id: "estimate-1" },
      data: { subtotalCost: FIGMA_SUPPORTED_SUBTOTAL, totalPrice: FIGMA_SUPPORTED_SUBTOTAL, taxAmount: 0 },
    });
    // The DTO is what the builder Review stage renders (builder.tsx
    // runningTotals derives subtotalCost / totalPrice / taxAmount from it).
    expect(dto.subtotalCost).toBe(FIGMA_SUPPORTED_SUBTOTAL);
    expect(dto.totalPrice).toBe(FIGMA_SUPPORTED_SUBTOTAL);
    expect(dto.preTaxTotalPrice).toBe(FIGMA_SUPPORTED_SUBTOTAL);
    expect(dto.taxAmount).toBe(0);
    // No engine output equals the imported draft total: the $1,670 gap is
    // exactly the unsupported remainder, with no engine source.
    expect(dto.totalPrice).not.toBe(FIGMA_IMPORTED_DRAFT_TOTAL);
    expect(FIGMA_IMPORTED_DRAFT_TOTAL - dto.totalPrice).toBe(FIGMA_UNEXPLAINED_DIFFERENCE);
  });

  it("carries the same $7,367 through estimate, review, and proposal totals", async () => {
    const draftRow = fixtureEstimateRow();
    const recalculatedRow = {
      ...fixtureEstimateRow(),
      subtotalCost: FIGMA_SUPPORTED_SUBTOTAL,
      totalPrice: FIGMA_SUPPORTED_SUBTOTAL,
      taxAmount: 0,
    };
    const readyRow = { ...recalculatedRow, status: "ready" };
    mockPrisma.estimate.findFirst
      .mockResolvedValueOnce(draftRow)
      .mockResolvedValueOnce(draftRow)
      .mockResolvedValueOnce({ ...readyRow, lineItems: undefined });
    mockPrisma.estimate.update
      .mockResolvedValueOnce(recalculatedRow)
      .mockResolvedValueOnce(readyRow);
    mockPrisma.proposal.create.mockResolvedValue({
      id: "proposal-1",
      projectId: "project-1",
      estimateId: "estimate-1",
      status: "draft",
      companyName: null,
      showLineItemDetail: false,
      scopeOfWork: null,
      assumptions: null,
      exclusions: null,
      timeline: null,
      priceLow: null,
      priceHigh: null,
      finalPrice: FIGMA_SUPPORTED_SUBTOTAL,
      paymentScheduleJson: null,
      pdfUrl: null,
      termsAndConditions: null,
      sentAt: null,
      viewedAt: null,
      respondedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveries: [],
    });

    // Estimate + review: finalize recalculates, then the DTO it returns is
    // the Review stage's total.
    const finalized = await new EstimateEngineService().finalize("estimate-1", "org-1");
    expect(finalized.status).toBe("ready");
    expect(finalized.totalPrice).toBe(FIGMA_SUPPORTED_SUBTOTAL);

    // Finalize backfills the same total into linked proposals.
    expect(mockPrisma.proposal.updateMany).toHaveBeenCalledWith({
      where: { estimateId: "estimate-1", finalPrice: null, priceLow: null, priceHigh: null },
      data: { finalPrice: FIGMA_SUPPORTED_SUBTOTAL },
    });

    // Proposal: create-from-estimate inherits the finalized total with no
    // explicit price override and no range.
    const proposal = await new ProposalsService().create({ orgId: "org-1", estimateId: "estimate-1" });
    expect(mockPrisma.proposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          estimateId: "estimate-1",
          priceLow: undefined,
          priceHigh: undefined,
          finalPrice: FIGMA_SUPPORTED_SUBTOTAL,
        }),
      }),
    );
    expect(proposal.finalPrice).toBe(FIGMA_SUPPORTED_SUBTOTAL);

    // One total across all three surfaces — never the $9,037 draft figure.
    expect(finalized.totalPrice).toBe(proposal.finalPrice);
    expect(finalized.totalPrice).not.toBe(FIGMA_IMPORTED_DRAFT_TOTAL);
  });
});
