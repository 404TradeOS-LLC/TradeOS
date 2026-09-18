const mockPrisma = {
  costbookResearchCandidate: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock("../db/client", () => ({ prisma: mockPrisma, basePrisma: {} }));

const mockCreate = jest.fn();
jest.mock("../modules/costbook/candidateCostItemService", () => {
  const actual = jest.requireActual("../modules/costbook/candidateCostItemService");
  return {
    ...actual,
    CostbookCandidateService: jest.fn().mockImplementation(() => ({ create: mockCreate })),
  };
});

import { ingestJonesAndSonsTerreHauteCandidates } from "../modules/costbook/jonesAndSonsIngestion";
import { TERRE_HAUTE_VERIFIED_RECORDS, JONES_AND_SONS_SOURCE_NAME } from "../modules/costbook/jonesAndSonsTerreHaute";
import type { AuthContext } from "../backend/auth/context";

const owner: AuthContext = { userId: "user-1", orgId: "org-1", role: "owner" };
const technician: AuthContext = { userId: "user-2", orgId: "org-1", role: "technician" };

const RETRIEVED_AT = "2026-09-14T00:00:00.000Z";

describe("ingestJonesAndSonsTerreHauteCandidates", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses to submit candidates for a role without costbook.write, before touching the database", async () => {
    await expect(
      ingestJonesAndSonsTerreHauteCandidates(technician, { retrievedAt: RETRIEVED_AT })
    ).rejects.toThrow(/costbook\.write/);

    expect(mockPrisma.costbookResearchCandidate.findFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits only the two Terre Haute branch-verified records, never the unconfirmed-branch ones", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(async (_auth, input) => ({ id: `candidate-${input.sourceIdentifier}`, ...input }));

    const result = await ingestJonesAndSonsTerreHauteCandidates(owner, { retrievedAt: RETRIEVED_AT });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.created).toHaveLength(2);
    for (const call of mockCreate.mock.calls) {
      const [auth, input] = call;
      expect(auth).toBe(owner);
      expect(input.sourceName).toBe(JONES_AND_SONS_SOURCE_NAME);
      expect(input.confidence).toBe("high");
      expect(input.provenanceStatus).toBe("documented");
    }
    const submittedSkus = mockCreate.mock.calls.map((call) => call[1].sourceIdentifier);
    expect(submittedSkus).toEqual([
      `Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[0].supplierSku}`,
      `Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[1].supplierSku}`,
    ]);
  });

  it("scopes the idempotency lookup to this organization's own candidates", async () => {
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(async (_auth, input) => ({ id: `candidate-${input.sourceIdentifier}`, ...input }));

    await ingestJonesAndSonsTerreHauteCandidates(owner, { retrievedAt: RETRIEVED_AT });

    for (const call of mockPrisma.costbookResearchCandidate.findFirst.mock.calls) {
      expect(call[0].where.orgId).toBe(owner.orgId);
    }
  });

  it("skips a record whose sourceIdentifier this organization already has, rather than creating a duplicate", async () => {
    const existingSku = `Jones & Sons SKU ${TERRE_HAUTE_VERIFIED_RECORDS[0].supplierSku}`;
    mockPrisma.costbookResearchCandidate.findFirst.mockImplementation(async ({ where }: { where: { sourceIdentifier: string } }) =>
      where.sourceIdentifier === existingSku ? { id: "already-there" } : null
    );
    mockCreate.mockImplementation(async (_auth, input) => ({ id: `candidate-${input.sourceIdentifier}`, ...input }));

    const result = await ingestJonesAndSonsTerreHauteCandidates(owner, { retrievedAt: RETRIEVED_AT });

    expect(result.skipped).toEqual([{ sourceIdentifier: existingSku, existingCandidateId: "already-there" }]);
    expect(result.created).toHaveLength(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("never re-creates a candidate that was already reviewed, since the idempotency check is not filtered by review state", async () => {
    // The mock returning a bare {id} regardless of what reviewStatus that row
    // actually has documents the real query's intent: any existing row for
    // this org+sourceIdentifier is enough to skip, whether it was approved,
    // rejected, or still pending - a rejection must stay durable across
    // re-ingestion, not be silently replaced by a fresh reviewable row.
    mockPrisma.costbookResearchCandidate.findFirst.mockResolvedValue({ id: "rejected-candidate" });

    const result = await ingestJonesAndSonsTerreHauteCandidates(owner, { retrievedAt: RETRIEVED_AT });

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
