const mockPrisma = {
  estimate: {
    findFirst: jest.fn(),
  },
};

const mockKnowledgeRuntime = {
  matchScope: jest.fn(),
};

const mockEstimateEngine = {
  addLineItem: jest.fn(),
};

const mockAssembliesDatabase = {
  getById: jest.fn(),
  search: jest.fn(),
};

const mockCostDatabase = {
  getById: jest.fn(),
  search: jest.fn(),
};

jest.mock("../db/client", () => ({ prisma: mockPrisma }));
jest.mock("../modules/knowledge-runtime/service", () => ({
  KnowledgeRuntimeService: jest.fn().mockImplementation(() => mockKnowledgeRuntime),
}));
jest.mock("../modules/estimate-engine/service", () => ({
  EstimateEngineService: jest.fn().mockImplementation(() => mockEstimateEngine),
}));
jest.mock("../modules/assemblies-database/service", () => ({
  AssembliesDatabaseService: jest.fn().mockImplementation(() => mockAssembliesDatabase),
}));
jest.mock("../modules/cost-database/service", () => ({
  CostDatabaseService: jest.fn().mockImplementation(() => mockCostDatabase),
}));

import { AIEstimateAssistService } from "../modules/ai-estimate-assist/service";

const DEFAULT_SCOPE =
  "Tear out and replace 250 sq ft of cracked concrete driveway, 4 inch slab, broom finish, include sawcut edges, haul-off, and final cleanup.";

describe("AIEstimateAssistService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("falls back to the default scope when the estimate and request both omit scope text", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      project: { simpleScope: null },
    });
    mockKnowledgeRuntime.matchScope.mockReturnValue({
      detectedTrade: "Concrete",
      confidenceScore: 88,
      assumptions: ["Assume standard driveway access."],
      rationale: ["Matched on driveway and concrete keywords."],
      missingInformation: ["thickness"],
      reviewWarnings: ["Confirm slab thickness before pricing."],
      matchedAssemblies: [
        {
          id: "assembly-1",
          type: "assembly",
          name: "Residential Driveway Base Package",
          category: "Concrete",
          trade: "Concrete",
          unitOfMeasure: "CY",
          description: "",
          confidence: 92,
          matchedKeywords: ["driveway"],
          rationale: "Strong driveway assembly match.",
          metadata: {},
        },
      ],
      matchedCostItems: [],
      missingInputs: ["thickness"],
      humanReviewWarnings: ["Confirm slab thickness before pricing."],
    });
    mockAssembliesDatabase.getById.mockRejectedValue(new Error("not found"));
    mockAssembliesDatabase.search.mockResolvedValue([
      {
        id: "assembly-db-1",
        orgId: "org-1",
        code: "TPL-DRIVEWAY-BASE",
        name: "Residential Driveway Base Package",
        unitOfMeasure: "CY",
        description: "",
        isTemplate: true,
        isActive: true,
      },
    ]);

    const result = await new AIEstimateAssistService().generateSuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      scopeOfWork: "",
    });

    expect(result.scopeOfWork).toBe(DEFAULT_SCOPE);
    expect(result.knowledgeMatch.detectedTrade).toBe("Concrete");
    expect(result.suggestions[0]?.resolution.status).toBe("resolved");
  });

  it("applies only accepted suggestions through the estimate engine", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      status: "draft",
    });
    mockEstimateEngine.addLineItem.mockResolvedValue({
      id: "line-item-1",
    });

    const result = await new AIEstimateAssistService().applySuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      suggestions: [
        {
          id: "accepted-1",
          kind: "assembly",
          title: "Driveway package",
          quantity: 12,
          status: "accepted",
          description: "Driveway package",
          targetId: "assembly-db-1",
          targetKind: "assembly",
        },
        {
          id: "rejected-1",
          kind: "costItem",
          title: "Extra cleanup",
          quantity: 1,
          status: "rejected",
        },
        {
          id: "pending-1",
          kind: "costItem",
          title: "Drain adjustment",
          quantity: 1,
          status: "pending",
        },
      ],
    });

    expect(mockEstimateEngine.addLineItem).toHaveBeenCalledTimes(1);
    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ suggestionId: "rejected-1", reason: "Rejected during human review." }),
        expect.objectContaining({ suggestionId: "pending-1", reason: "Left pending during human review." }),
      ])
    );
  });

  it("skips accepted suggestions that do not have a resolved estimate target", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      status: "draft",
    });

    const result = await new AIEstimateAssistService().applySuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      suggestions: [
        {
          id: "accepted-1",
          kind: "costItem",
          title: "Tree debris haul-away",
          quantity: 1,
          status: "accepted",
        },
      ],
    });

    expect(mockEstimateEngine.addLineItem).not.toHaveBeenCalled();
    expect(result.applied).toHaveLength(0);
    expect(result.skipped[0]?.reason).toContain("No estimate-engine target was selected");
  });
});
