import { describeAthenaToolContract } from "../modules/athena-tool-sdk";
import { createCostbookCodeReferencesTool } from "../modules/athena-tools/costbook/codeReferences.tool";

const execution = {
  executionId: "exec-1", requestId: "req-1", traceId: "trace-1",
  orgId: "org-1", actor: { type: "user" as const, id: "user-1" },
  role: "owner" as const, deadline: new Date(Date.now() + 10_000),
  cancellationSignal: new AbortController().signal, featureFlags: [],
};

describe("Athena Codes & Permits read-only tool", () => {
  describeAthenaToolContract(createCostbookCodeReferencesTool(), {
    validInput: { state: "IN", county: "Vigo", topic: "signage" },
    invalidInputs: [{}, { state: "" }, { state: "Indiana" }, { state: "IN", topic: "unknown" }],
  });

  it("returns official references, caveats and no legal certification or fees", async () => {
    const tool = createCostbookCodeReferencesTool();
    const result = await tool.execute(
      { state: "IN", county: "Vigo", topic: "signage" },
      {} as never,
      execution
    );
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("advisory");
    expect(result.data?.items.some((reference) => reference.citation === "Vigo County UZO §16")).toBe(true);
    expect(result.data?.items.every((reference) => reference.applicability === "unverified")).toBe(true);
    expect(result.summary).toMatch(/verify/i);
    expect(tool.permissions).toContain("costbook.read");
    expect(tool.confirmationPolicy).toBe("never");
    expect(tool.risk).toBe("low");
  });

  it("fails closed on county scope, never invents missing local ordinances", async () => {
    const tool = createCostbookCodeReferencesTool();
    const result = await tool.execute(
      { state: "IN", county: "Marion", topic: "signage" },
      {} as never,
      execution
    );
    expect(result.success).toBe(true);
    expect(result.data?.items.every((reference) => reference.county === null)).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it("warns when no county is selected, even though statewide citations exist", async () => {
    const result = await createCostbookCodeReferencesTool().execute(
      { state: "IN", topic: "electrical" },
      {} as never,
      execution
    );
    expect(result.data?.items.length).toBeGreaterThan(0);
    expect(result.data?.items.every((reference) => reference.county === null)).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: "athena_costbook_codes_county_not_selected",
    }));
    expect(result.warnings).not.toContainEqual(expect.objectContaining({
      code: "athena_costbook_codes_local_unindexed",
    }));
  });

  it("does not misreport local county coverage just because topic filtering yields statewide citations", async () => {
    const result = await createCostbookCodeReferencesTool().execute(
      { state: "IN", county: "Vigo", topic: "electrical" },
      {} as never,
      execution
    );
    expect(result.data?.items.every((reference) => reference.county === null)).toBe(true);
    expect(result.warnings).not.toContainEqual(expect.objectContaining({
      code: "athena_costbook_codes_local_unindexed",
    }));
    const unindexed = await createCostbookCodeReferencesTool().execute(
      { state: "IN", county: "Marion", topic: "electrical" },
      {} as never,
      execution
    );
    expect(unindexed.warnings).toContainEqual(expect.objectContaining({
      code: "athena_costbook_codes_local_unindexed",
    }));
  });
});
