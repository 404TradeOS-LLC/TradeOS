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

  it("propagates the Knowledge Engine match's provenanceStatus onto the suggestion", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      project: { simpleScope: null },
    });
    mockKnowledgeRuntime.matchScope.mockReturnValue({
      detectedTrade: "Tree Service",
      confidenceScore: 80,
      assumptions: [],
      rationale: ["Matched tree removal keywords."],
      missingInformation: [],
      reviewWarnings: ["Matched pricing includes placeholder Knowledge Engine data that has not been through the documented provenance/review pipeline; confirm current market costs before relying on it."],
      matchedAssemblies: [],
      matchedCostItems: [
        {
          id: "tree-cost-item-1",
          type: "costItem",
          name: "Tree Removal Labor",
          category: "Tree Service",
          trade: "Tree Service",
          unitOfMeasure: "HR",
          description: "",
          confidence: 70,
          matchedKeywords: ["tree"],
          rationale: "Tree Service match.",
          metadata: {},
          provenanceStatus: "placeholder",
        },
      ],
      missingInputs: [],
      humanReviewWarnings: [],
    });
    mockCostDatabase.getById.mockRejectedValue(new Error("not found"));
    mockCostDatabase.search.mockResolvedValue([]);

    const result = await new AIEstimateAssistService().generateSuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      scopeOfWork: "Remove a large oak tree and grind the stump.",
    });

    expect(result.suggestions[0]?.provenanceStatus).toBe("placeholder");
  });

  it("defaults a suggestion's provenanceStatus to unverified-legacy when the match omits it", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      project: { simpleScope: null },
    });
    mockKnowledgeRuntime.matchScope.mockReturnValue({
      detectedTrade: "Concrete",
      confidenceScore: 80,
      assumptions: [],
      rationale: ["Matched concrete keywords."],
      missingInformation: [],
      reviewWarnings: [],
      matchedAssemblies: [],
      matchedCostItems: [
        {
          id: "concrete-cost-item-1",
          type: "costItem",
          name: "Concrete Slab Pour",
          category: "Concrete",
          trade: "Concrete",
          unitOfMeasure: "CY",
          description: "",
          confidence: 70,
          matchedKeywords: ["concrete"],
          rationale: "Concrete match.",
          metadata: {},
          // provenanceStatus intentionally omitted, as a legacy caller might.
        },
      ],
      missingInputs: [],
      humanReviewWarnings: [],
    });
    mockCostDatabase.getById.mockRejectedValue(new Error("not found"));
    mockCostDatabase.search.mockResolvedValue([]);

    const result = await new AIEstimateAssistService().generateSuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      scopeOfWork: "Pour a new concrete slab.",
    });

    expect(result.suggestions[0]?.provenanceStatus).toBe("unverified-legacy");
  });

  it("surfaces the matched cost item's source citation as provenanceDetail", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      project: { simpleScope: null },
    });
    mockKnowledgeRuntime.matchScope.mockReturnValue({
      detectedTrade: "Concrete",
      confidenceScore: 80,
      assumptions: [],
      rationale: ["Matched concrete keywords."],
      missingInformation: [],
      reviewWarnings: [],
      matchedAssemblies: [],
      matchedCostItems: [
        {
          id: "concrete-cost-item-2",
          type: "costItem",
          name: "Concrete Slab Pour",
          category: "Concrete",
          trade: "Concrete",
          unitOfMeasure: "CY",
          description: "",
          confidence: 70,
          matchedKeywords: ["concrete"],
          rationale: "Concrete match.",
          metadata: {
            provenanceStatus: "documented",
            sourceName: "RS Means-independent regional survey",
            sourceUrl: "https://example.gov/regional-cost-survey",
            sourceDate: "2026-06-01",
            retrievedAt: "2026-09-10T00:00:00Z",
            confidence: "high",
          },
          provenanceStatus: "documented",
        },
      ],
      missingInputs: [],
      humanReviewWarnings: [],
    });
    mockCostDatabase.getById.mockRejectedValue(new Error("not found"));
    mockCostDatabase.search.mockResolvedValue([]);

    const result = await new AIEstimateAssistService().generateSuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      scopeOfWork: "Pour a new concrete slab.",
    });

    expect(result.suggestions[0]?.provenanceDetail).toEqual({
      sourceName: "RS Means-independent regional survey",
      sourceUrl: "https://example.gov/regional-cost-survey",
      sourceDate: "2026-06-01",
      retrievedAt: "2026-09-10T00:00:00Z",
      confidence: "high",
    });
  });

  it("omits provenanceDetail when the matched record carries no source citation", async () => {
    mockPrisma.estimate.findFirst.mockResolvedValue({
      id: "estimate-1",
      orgId: "org-1",
      project: { simpleScope: null },
    });
    mockKnowledgeRuntime.matchScope.mockReturnValue({
      detectedTrade: "Concrete",
      confidenceScore: 80,
      assumptions: [],
      rationale: ["Matched concrete keywords."],
      missingInformation: [],
      reviewWarnings: [],
      matchedAssemblies: [],
      matchedCostItems: [
        {
          id: "concrete-cost-item-3",
          type: "costItem",
          name: "Concrete Slab Pour",
          category: "Concrete",
          trade: "Concrete",
          unitOfMeasure: "CY",
          description: "",
          confidence: 70,
          matchedKeywords: ["concrete"],
          rationale: "Concrete match.",
          metadata: {},
          provenanceStatus: "unverified-legacy",
        },
      ],
      missingInputs: [],
      humanReviewWarnings: [],
    });
    mockCostDatabase.getById.mockRejectedValue(new Error("not found"));
    mockCostDatabase.search.mockResolvedValue([]);

    const result = await new AIEstimateAssistService().generateSuggestions({
      estimateId: "estimate-1",
      orgId: "org-1",
      scopeOfWork: "Pour a new concrete slab.",
    });

    expect(result.suggestions[0]?.provenanceDetail).toBeUndefined();
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
