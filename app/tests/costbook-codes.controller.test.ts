import { costbookCodesController } from "../backend/controllers/costbookCodes.controller";

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
  it("allows a read-only Costbook member to research cited local rules", async () => {
    const res = response();
    await costbookCodesController.list(request({ state: "IN", county: "Vigo", topic: "signage" }) as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    const result = res.json.mock.calls[0][0];
    expect(result.status).toBe("advisory");
    expect(result.items.some((item: { citation: string }) => item.citation === "Vigo County UZO §16")).toBe(true);
  });

  it("denies unauthenticated reads before parsing query", async () => {
    await expect(costbookCodesController.list({ query: { state: "IN" } } as never, response() as never))
      .rejects.toThrow("Organization context is required");
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
