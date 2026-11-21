import { listCodeReferencesFromDb } from "../modules/costbook/codes/service";
import { costbookCodesController } from "../backend/controllers/costbookCodes.controller";

// The controller reads the DB-backed service; the service itself is covered
// by costbook-codes-registry.service.test.ts (unit) and
// costbook-codes-registry.rls.integration.ts (live RLS + seed).
jest.mock("../modules/costbook/codes/service", () => ({
  listCodeReferencesFromDb: jest.fn(),
}));

const mockedList = listCodeReferencesFromDb as jest.MockedFunction<typeof listCodeReferencesFromDb>;

const response = () => ({
  json: jest.fn(),
  setHeader: jest.fn(),
});

const request = (query: Record<string, string>, role = "technician") => ({
  query,
  auth: { userId: "staff-1", orgId: "org-1", role },
  orgId: "org-1",
});

describe("Costbook Codes & Permits endpoint", () => {
  beforeEach(() => {
    mockedList.mockResolvedValue({
      status: "advisory",
      disclaimer: "Source links are research leads only.",
      total: 1,
      items: [
        {
          id: "94600003-0000-4000-8000-000000000001",
          title: "Unified Zoning Ordinance — Sign Regulation",
          issuer: "Vigo County Area Planning",
          citation: "Vigo County UZO §16",
          state: "IN",
          county: "Vigo",
          sourceUrl: "https://www.vigocounty.in.gov/egov/docs/1088861399_472198.pdf",
          sourceDate: "1996-10-21",
          reviewedAt: "2026-11-08",
          topics: ["signage", "permits"],
          summary: "The county-published ordinance includes a sign-regulation section.",
          nextAction: "Confirm the current amended ordinance with Vigo County Area Planning.",
          applicability: "unverified",
        },
      ],
    });
  });

  afterEach(() => {
    mockedList.mockReset();
  });

  it("allows a read-only Costbook member to research cited local rules", async () => {
    const res = response();
    await costbookCodesController.list(request({ state: "IN", county: "Vigo", topic: "signage" }) as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(mockedList).toHaveBeenCalledWith({ state: "IN", county: "Vigo", topic: "signage" });
    const result = res.json.mock.calls[0][0];
    expect(result.status).toBe("advisory");
    expect(result.items.some((item: { citation: string }) => item.citation === "Vigo County UZO §16")).toBe(true);
  });

  it("denies unauthenticated reads before parsing query", async () => {
    await expect(costbookCodesController.list({ query: { state: "IN" } } as never, response() as never))
      .rejects.toThrow("Organization context is required");
  });

  it("denies authenticated viewers without Costbook read permission", async () => {
    const res = response();
    await expect(
      costbookCodesController.list(request({ state: "IN" }, "viewer") as never, res as never)
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects unknown topics and arbitrary query keys", async () => {
    await expect(costbookCodesController.list(request({ state: "IN", topic: "guess" }) as never, response() as never))
      .rejects.toThrow();
    await expect(costbookCodesController.list(request({ state: "IN", orgId: "another-org" }) as never, response() as never))
      .rejects.toThrow();
  });

  it("requires an explicit state and never assumes a local jurisdiction", async () => {
    await expect(costbookCodesController.list(request({ county: "Vigo" }) as never, response() as never))
      .rejects.toThrow();
  });
});
