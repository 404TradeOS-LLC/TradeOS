import { createTestContextProvider } from "../modules/athena-context-engine/fixtures/testContextProvider";
import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";

// Backs the athena:contracts gate alongside athena-kernel.contracts.test.ts
// and athena-tool-registry.contracts.test.ts (docs/athena/roadmap/
// A3-context-engine-implementation-plan.md "CI Validation Gates": "one
// athena:contracts gate covering... the context engine"). Exercises the
// exact production validators, not test-only duplicates.
describe("athena:contracts - context provider definition (C010)", () => {
  it("accepts a conforming provider definition", () => {
    expect(() => assertValidProviderDefinition(createTestContextProvider())).not.toThrow();
  });

  it("rejects a definition with an invalid id", () => {
    expect(() => assertValidProviderDefinition({ ...createTestContextProvider(), id: "Not Valid" })).toThrow(/id/);
  });

  it("rejects a definition with a non-semver version", () => {
    expect(() => assertValidProviderDefinition({ ...createTestContextProvider(), version: "latest" })).toThrow(/version/);
  });

  it("rejects a definition with an unrecognized section", () => {
    expect(() => assertValidProviderDefinition({ ...createTestContextProvider(), section: "invoices" as never })).toThrow(/section/);
  });

  it("rejects a definition missing an owner", () => {
    expect(() => assertValidProviderDefinition({ ...createTestContextProvider(), owner: "" })).toThrow(/owner/);
  });
});

describe("athena:contracts - context provider fetch result (C010 fetch boundary)", () => {
  function validResult() {
    return { data: { echoed: true }, itemCount: 1, omittedFields: [] };
  }

  it("accepts a conforming fetch result", () => {
    expect(() => assertValidContextProviderFetchResult(validResult())).not.toThrow();
  });

  it("accepts a fetch result with optional sourceVersion/sourceHash", () => {
    expect(() => assertValidContextProviderFetchResult({ ...validResult(), sourceVersion: "v1", sourceHash: "abc123" })).not.toThrow();
  });

  it("rejects a result missing the data key", () => {
    const { data: _data, ...rest } = validResult();
    expect(() => assertValidContextProviderFetchResult(rest)).toThrow(/data/);
  });

  it("rejects a negative itemCount", () => {
    expect(() => assertValidContextProviderFetchResult({ ...validResult(), itemCount: -1 })).toThrow(/itemCount/);
  });

  it("rejects a non-numeric itemCount", () => {
    expect(() => assertValidContextProviderFetchResult({ ...validResult(), itemCount: "one" as unknown as number })).toThrow(/itemCount/);
  });

  it("rejects omittedFields that is not an array of strings", () => {
    expect(() => assertValidContextProviderFetchResult({ ...validResult(), omittedFields: [1, 2] as unknown as string[] })).toThrow(/omittedFields/);
  });

  it("rejects a non-string sourceVersion", () => {
    expect(() => assertValidContextProviderFetchResult({ ...validResult(), sourceVersion: 1 as unknown as string })).toThrow(/sourceVersion/);
  });
});
