import { getRolePermissions } from "../../domain";
import type { CanonicalRole } from "../../domain";

// Deterministic, non-LLM permission/feature-flag gate for context providers
// (docs/athena/roadmap/A3-context-engine-implementation-plan.md "Context
// Minimization, Sensitivity, And Redaction"). Deliberately not shared with
// athena-tool-registry/policy.ts even though the logic is structurally
// similar - the A3 plan's own non-goals reject a generic provider/tool
// abstraction "until a third consumer actually needs one," and importing
// across these two sibling modules would couple them for no real benefit.
export function hasAllRequiredPermissions(role: CanonicalRole, requiredPermissions: readonly string[]): boolean {
  const granted = getRolePermissions(role) as readonly string[];
  return requiredPermissions.every((permission) => granted.includes(permission));
}

export function hasAllRequiredFeatureFlags(required: readonly string[] | undefined, actorFlags: readonly string[]): boolean {
  if (!required || required.length === 0) return true;
  return required.every((flag) => actorFlags.includes(flag));
}
