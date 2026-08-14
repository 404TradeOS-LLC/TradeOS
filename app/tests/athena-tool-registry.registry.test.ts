import { createAthenaToolRegistry } from "../modules/athena-tool-registry/registry";
import { createEchoFixtureTool } from "../modules/athena-tool-registry/fixtures/echoFixtureTool";
import type { AthenaToolDefinition } from "../modules/athena-tool-registry/types";

function fixtureWith(overrides: Partial<AthenaToolDefinition>): AthenaToolDefinition {
  return { ...createEchoFixtureTool(), ...overrides } as AthenaToolDefinition;
}

describe("athena tool registry", () => {
  describe("registration", () => {
    it("registers a tool and resolves it by id and version", () => {
      const registry = createAthenaToolRegistry();
      const tool = createEchoFixtureTool();
      registry.register(tool);
      const resolution = registry.resolve(tool.id, tool.version);
      expect(resolution.outcome).toBe("found");
      expect(resolution.outcome === "found" && resolution.definition.id).toBe(tool.id);
      expect(resolution.outcome === "found" && resolution.definition.name).toBe("Echo Fixture");
      expect(resolution.outcome === "found" && resolution.definition.category).toBe("fixture");
      expect(resolution.outcome === "found" && resolution.definition.outputSchema).toBe("AthenaToolResult");
    });

    it("rejects duplicate registration of the same id@version", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool());
      expect(() => registry.register(createEchoFixtureTool())).toThrow(/already registered/);
    });

    it("allows two distinct versions of the same tool id to coexist", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool({ version: "1.0.0" }));
      registry.register(createEchoFixtureTool({ version: "2.0.0" }));
      expect(registry.resolve("tradeos.athena.fixture.echo", "1.0.0").outcome).toBe("found");
      expect(registry.resolve("tradeos.athena.fixture.echo", "2.0.0").outcome).toBe("found");
    });

    it("rejects registration without an owner", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ owner: "" }))).toThrow(/owner/);
    });

    it("rejects an invalid explicit category", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ category: "billing" as never }))).toThrow(/category/);
    });

    it("rejects registration without a declared idempotency policy", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ idempotency: undefined as never }))).toThrow(/idempotency/);
    });

    it("rejects registration with an invalid risk value", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ risk: "extreme" as never }))).toThrow(/risk/);
    });

    it("rejects registration with a non-positive timeoutMs", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ timeoutMs: 0 }))).toThrow(/timeoutMs/);
    });

    it("rejects registration whose inputSchema is not Zod-like", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ inputSchema: {} }))).toThrow(/inputSchema/);
    });

    it("rejects registration with an invalid compensationPolicy", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.register(fixtureWith({ compensationPolicy: "undo_everything" as never }))).toThrow(/compensationPolicy/);
    });

    describe("id format", () => {
      it.each(["Tradeos.Athena.Fixture.Echo", "tradeos athena fixture echo", "", "   ", "tradeosathenafixtureecho", ".tradeos.athena", "tradeos.athena.", "tradeos..athena", "tradeos.athena_fixture", "tradeos.athena/fixture"])("rejects an invalid id: %j", (id) => {
        const registry = createAthenaToolRegistry();
        expect(() => registry.register(fixtureWith({ id }))).toThrow(/id/);
      });

      it("accepts a lowercase reverse-domain-style id with hyphenated segments", () => {
        const registry = createAthenaToolRegistry();
        expect(() => registry.register(fixtureWith({ id: "tradeos.athena.fixture.needs-billing" }))).not.toThrow();
      });
    });

    describe("version format", () => {
      it.each(["latest", "v1", "1", "1.0", "", "   ", "1.0.0 "])("rejects a non-semver version: %j", (version) => {
        const registry = createAthenaToolRegistry();
        expect(() => registry.register(fixtureWith({ version }))).toThrow(/semver/);
      });

      it("accepts a semver version with pre-release metadata", () => {
        const registry = createAthenaToolRegistry();
        expect(() => registry.register(fixtureWith({ version: "1.0.0-beta.1" }))).not.toThrow();
      });
    });
  });

  describe("resolution", () => {
    it("returns tool_not_found for a completely unknown id", () => {
      const registry = createAthenaToolRegistry();
      expect(registry.resolve("tradeos.athena.fixture.nope", "1.0.0")).toEqual({ outcome: "tool_not_found" });
    });

    it("returns tool_version_not_found for a known id with an unregistered version, carrying the other known active versions", () => {
      const registry = createAthenaToolRegistry();
      const tool = createEchoFixtureTool({ version: "1.0.0" });
      registry.register(tool);
      const resolution = registry.resolve("tradeos.athena.fixture.echo", "9.9.9");
      expect(resolution.outcome).toBe("tool_version_not_found");
      expect(resolution.outcome === "tool_version_not_found" && resolution.knownVersions).toEqual([tool]);
    });

    it("returns tool_removed for a version that was registered then removed, distinct from never having existed", () => {
      const registry = createAthenaToolRegistry();
      const tool = createEchoFixtureTool();
      registry.register(tool);
      registry.remove(tool.id, tool.version);
      expect(registry.resolve(tool.id, tool.version)).toEqual({ outcome: "tool_removed" });
    });

    it("throws when removing a tool that was never registered", () => {
      const registry = createAthenaToolRegistry();
      expect(() => registry.remove("tradeos.athena.fixture.nope", "1.0.0")).toThrow(/never registered/);
    });
  });

  describe("discovery", () => {
    it("excludes a tool the actor's role lacks the required permission for", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.needs-billing", permissions: ["billing.write"] }));
      const discovered = registry.discover({ role: "technician", featureFlags: [] });
      expect(discovered.map((t) => t.id)).not.toContain("tradeos.athena.fixture.needs-billing");
    });

    it("includes a tool the actor's role satisfies", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.needs-billing", permissions: ["billing.write"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: [] });
      expect(discovered.map((t) => t.id)).toContain("tradeos.athena.fixture.needs-billing");
    });

    it("hides a tool with unmet requiredFeatureFlags", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.flagged", requiredFeatureFlags: ["athena_fixture_flag"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: [] });
      expect(discovered.map((t) => t.id)).not.toContain("tradeos.athena.fixture.flagged");
    });

    it("includes a flagged tool once the actor's context carries every required flag", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool({ id: "tradeos.athena.fixture.flagged", requiredFeatureFlags: ["athena_fixture_flag"] }));
      const discovered = registry.discover({ role: "owner", featureFlags: ["athena_fixture_flag"] });
      expect(discovered.map((t) => t.id)).toContain("tradeos.athena.fixture.flagged");
    });

    it("keeps a tool with no feature-flag requirement discoverable regardless of actor flags", () => {
      const registry = createAthenaToolRegistry();
      registry.register(createEchoFixtureTool());
      const discovered = registry.discover({ role: "technician", featureFlags: [] });
      expect(discovered.map((t) => t.id)).toContain("tradeos.athena.fixture.echo");
      expect(discovered.find((t) => t.id === "tradeos.athena.fixture.echo")).toEqual(
        expect.objectContaining({
          name: "Echo Fixture",
          category: "fixture",
          outputSchema: "AthenaToolResult",
        })
      );
    });

    it("excludes a removed tool from discovery", () => {
      const registry = createAthenaToolRegistry();
      const tool = createEchoFixtureTool();
      registry.register(tool);
      registry.remove(tool.id, tool.version);
      const discovered = registry.discover({ role: "owner", featureFlags: [] });
      expect(discovered.map((t) => t.id)).not.toContain(tool.id);
    });
  });
});
