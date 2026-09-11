import type { AthenaInteractionContext } from "../athena-kernel/types";
import type { AthenaToolRegistry } from "../athena-tool-registry/registry";

/**
 * Request-scoped read view over the existing A2/A12 registry. Voice can only
 * discover and resolve low-risk tools. This wrapper deliberately does not
 * execute confirmation logic: confirmation must be resolved by the kernel
 * before A6/idempotency so a no-op challenge can never be persisted as a
 * successful action result.
 */
export function createChannelAwareAthenaToolRegistry(
  base: Pick<AthenaToolRegistry, "discover" | "resolve">,
  interaction?: AthenaInteractionContext,
): Pick<AthenaToolRegistry, "discover" | "resolve"> {
  if (interaction?.channel !== "voice") return base;

  return {
    discover(actor) {
      return base.discover(actor).filter((definition) => definition.risk === "low");
    },
    resolve(id, version) {
      const resolution = base.resolve(id, version);
      if (resolution.outcome !== "found") return resolution;
      return resolution.definition.risk === "low" ? resolution : { outcome: "tool_not_found" };
    },
  };
}
