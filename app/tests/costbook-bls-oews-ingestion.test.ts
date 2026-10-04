const mockCandidateCreate = jest.fn();
const mockFindExisting = jest.fn();
const mockExecuteRaw = jest.fn();

const mockTransaction = {
  $executeRaw: mockExecuteRaw,
  costbookResearchCandidate: { findFirst: mockFindExisting },
};

jest.mock("../db/client", () => ({ basePrisma: {} }));
jest.mock("../db/requestSession", () => ({
  runInDatabaseTransaction: jest.fn((_client, operation: (tx: typeof mockTransaction) => unknown) => operation(mockTransaction)),
}));
jest.mock("../modules/costbook/candidateCostItemService", () => ({
  CostbookCandidateService: jest.fn().mockImplementation(() => ({ create: mockCandidateCreate })),
}));

import { ingestTerreHauteBlsOewsCandidates } from "../modules/costbook/blsOewsIngestion";
import { buildTerreHauteBlsOewsLaborCandidates } from "../modules/costbook/blsOewsTerreHaute";

const ownerAuth = {
  userId: "user-a",
  orgId: "org-a",
  membershipId: "membership-a",
  role: "owner",
} as any;

describe("Terre Haute BLS OEWS governed ingestion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(0);
    mockCandidateCreate.mockImplementation(async (_auth, input) => ({
      id: `candidate-${input.sourceIdentifier}`,
      sourceIdentifier: input.sourceIdentifier,
    }));
  });

  it("submits source-backed benchmark candidates only through the existing review queue", async () => {
    mockFindExisting.mockResolvedValue(null);

    const result = await ingestTerreHauteBlsOewsCandidates(ownerAuth, "2026-10-02T12:00:00.000Z");

    expect(result.created).toHaveLength(10);
    expect(result.skipped).toHaveLength(0);
    expect(mockCandidateCreate).toHaveBeenCalledTimes(10);
    for (const [, candidate] of mockCandidateCreate.mock.calls) {
      expect(candidate.laborRateAssumption).toBeUndefined();
      expect(candidate.laborHours).toBeUndefined();
      expect(candidate.provenanceStatus).toBe("documented");
    }
  });

  it("is idempotent only when the stored source evidence matches", async () => {
    const candidates = buildTerreHauteBlsOewsLaborCandidates("2026-10-02T12:00:00.000Z");
    mockFindExisting.mockImplementation(async ({ where }) => {
      const candidate = candidates.find((row) => row.sourceIdentifier === where.sourceIdentifier);
      if (!candidate) return null;
      return {
        id: `existing-${where.sourceIdentifier}`,
        ...candidate,
        description: candidate.description ?? null,
        materialCostLow: candidate.materialCostLow ?? null,
        materialCostHigh: candidate.materialCostHigh ?? null,
        laborHours: candidate.laborHours ?? null,
        laborRateAssumption: candidate.laborRateAssumption ?? null,
        sourceUrl: candidate.sourceUrl ?? null,
        researchNotes: candidate.researchNotes ?? null,
      };
    });

    const result = await ingestTerreHauteBlsOewsCandidates(ownerAuth, "2026-10-03T12:00:00.000Z");

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(10);
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });

  it("rejects a reused source identifier when the stored BLS evidence differs", async () => {
    const candidate = buildTerreHauteBlsOewsLaborCandidates("2026-10-02T12:00:00.000Z")[0];
    mockFindExisting.mockResolvedValue({
      id: "existing-conflict",
      ...candidate,
      description: candidate.description ?? null,
      materialCostLow: candidate.materialCostLow ?? null,
      materialCostHigh: candidate.materialCostHigh ?? null,
      laborHours: candidate.laborHours ?? null,
      laborRateAssumption: candidate.laborRateAssumption ?? null,
      sourceUrl: candidate.sourceUrl ?? null,
      researchNotes: "different published wage evidence",
    });

    await expect(
      ingestTerreHauteBlsOewsCandidates(ownerAuth, "2026-10-03T12:00:00.000Z")
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });

  it("fails closed before ingestion for a role without costbook.write", async () => {
    await expect(ingestTerreHauteBlsOewsCandidates({ ...ownerAuth, role: "viewer" }))
      .rejects.toThrow("does not have costbook.write");
    expect(mockFindExisting).not.toHaveBeenCalled();
    expect(mockCandidateCreate).not.toHaveBeenCalled();
  });
});
