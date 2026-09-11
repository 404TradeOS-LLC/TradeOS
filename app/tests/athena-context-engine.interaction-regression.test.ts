import { assembleAthenaContext } from "../modules/athena-context-engine/assembler";
import { createAthenaContextRegistry } from "../modules/athena-context-engine/registry";
import type { AthenaContextProviderInput } from "../modules/athena-context-engine/types";

describe("Athena context interaction propagation", () => {
  it("passes request interaction metadata to activated context providers", async () => {
    let capturedInput: AthenaContextProviderInput | undefined;
    const registry = createAthenaContextRegistry();

    registry.register({
      id: "tradeos.athena.context.interaction-regression",
      version: "1.0.0",
      owner: "athena-context-engine",
      name: "Interaction Regression Fixture",
      priority: 1,
      section: "mobile",
      description: "Verifies request interaction metadata reaches context providers.",
      permissions: [],
      activation: "eager_minimal",
      allowedIntents: [],
      freshnessTtlMs: 0,
      timeoutMs: 1_000,
      maxItems: 1,
      maxBytes: 1_024,
      sensitivity: "internal",
      cacheKeyPolicy: "none",
      criticality: "optional",
      failureBehavior: "degrade",
      async provide(input) {
        capturedInput = input;
        return {
          data: { channel: input.interaction?.channel ?? null },
          itemCount: 1,
          omittedFields: [],
        };
      },
    });

    const interaction = {
      channel: "mobile" as const,
      platform: "ios" as const,
      viewportClass: "compact" as const,
      connectivity: "degraded" as const,
    };

    await assembleAthenaContext(registry, {
      orgId: "org-1",
      actor: { userId: "user-1", role: "owner" },
      permissions: [],
      selectedScope: {},
      interaction,
      featureFlags: [],
      requestedIntents: [],
      explicitSections: [],
    });

    expect(capturedInput?.interaction).toEqual(interaction);
  });
});
