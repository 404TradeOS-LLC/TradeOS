import type { AthenaInteractionContext } from "../athena-kernel/types";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";
import { evaluateAthenaChannelToolPolicy } from "./policy";

/**
 * Request-scoped read view over the existing A2/A12 registry. Voice can only
 * discover low-risk tools. Confirmation-required low-risk tools are wrapped:
 * the first invocation performs no business mutation and returns a bounded
 * confirmation challenge; an exact tool/version/input-hash proof is required
 * on a subsequent request before the original tool callback is invoked.
 * Medium/high-risk tools stay unavailable to voice and must use visual review.
 */
export function createChannelAwareAthenaToolRegistry(
  base: Pick<AthenaToolRegistry, "discover" | "resolve">,
  interaction?: AthenaInteractionContext,
  env: NodeJS.ProcessEnv = process.env,
): Pick<AthenaToolRegistry, "discover" | "resolve"> {
  if (interaction?.channel !== "voice") return base;

  return {
    discover(actor) {
      return base.discover(actor).filter((definition) => definition.risk === "low");
    },
    resolve(id, version) {
      const resolution = base.resolve(id, version);
      if (resolution.outcome !== "found") return resolution;
      const definition = resolution.definition;
      if (definition.risk !== "low") return { outcome: "tool_not_found" };
      return {
        outcome: "found",
        definition: {
          ...definition,
          async execute(validatedInput, aiContext, execution) {
            const decision = evaluateAthenaChannelToolPolicy({ interaction, tool: definition, validatedInput, env });
            if (decision.decision === "deny") throw new Error(decision.reasonCode);
            if (decision.decision === "confirm") {
              return {
                success: true,
                summary: decision.challenge.prompt,
                data: null,
                events: [],
                warnings: [{ code: decision.reasonCode, message: "No business change was made. Explicit voice confirmation is required." }],
                followUps: [{ kind: "action", label: `Confirm ${decision.challenge.toolId}@${decision.challenge.toolVersion} with input hash ${decision.challenge.inputHash}` }],
                telemetry: { traceId: execution.traceId, executionId: execution.executionId },
              };
            }
            return definition.execute(validatedInput, aiContext, execution);
          },
        },
      };
    },
  };
}
