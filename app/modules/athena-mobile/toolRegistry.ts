import type { AthenaInteractionContext } from "../athena-kernel/types";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";

function isVoiceSafe(definition: { risk: string; confirmationPolicy: string }): boolean {
  return definition.risk === "low" && definition.confirmationPolicy === "never";
}

/**
 * Request-scoped read view over the existing A2/A12 registry. Voice discovery
 * exposes only low-risk tools that need no confirmation. This is deliberately
 * narrower than A4/A6; it never grants a tool the underlying registry denied.
 * Confirmation-requiring and medium/high-risk actions must hand off to a
 * visual/text surface where the existing approval/confirmation UX can bind the
 * exact action.
 */
export function createChannelAwareAthenaToolRegistry(
  base: Pick<AthenaToolRegistry, "discover" | "resolve">,
  interaction?: AthenaInteractionContext,
): Pick<AthenaToolRegistry, "discover" | "resolve"> {
  if (interaction?.channel !== "voice") return base;

  return {
    discover(actor) {
      return base.discover(actor).filter(isVoiceSafe);
    },
    resolve(id, version) {
      const resolution = base.resolve(id, version);
      if (resolution.outcome !== "found") return resolution;
      return isVoiceSafe(resolution.definition) ? resolution : { outcome: "tool_not_found" };
    },
  };
}
