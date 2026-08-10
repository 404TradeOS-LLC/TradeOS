import { getRolePermissions } from "../../domain";
import type { CanonicalRole } from "../../domain";
import { AthenaToolDefinition, AthenaToolRisk } from "./types";

// Deterministic, non-LLM permission/risk gate for tool dispatch (docs/athena/
// roadmap/A2-tool-registry-implementation-plan.md "Permission And
// Risk-Classification Enforcement Outside The LLM"). Derives permissions
// from the actor's role itself via getRolePermissions() rather than trusting
// a caller-supplied permissions list - the same MEDIUM-2 lesson
// athena-kernel/policy.ts already applies for A1. AthenaToolExecutionContext
// deliberately carries no permissions field for this reason: this module is
// the only place a tool's access decision may be made.
export interface AthenaToolPolicyDecision {
  decision: "allow" | "deny";
  role: CanonicalRole;
  evaluatedPermissions: string[];
  evaluatedRisk: AthenaToolRisk;
}

export function hasAllRequiredPermissions(role: CanonicalRole, requiredPermissions: readonly string[]): boolean {
  const granted = getRolePermissions(role) as readonly string[];
  return requiredPermissions.every((permission) => granted.includes(permission));
}

export function hasAllRequiredFeatureFlags(required: readonly string[] | undefined, actorFlags: readonly string[]): boolean {
  if (!required || required.length === 0) return true;
  return required.every((flag) => actorFlags.includes(flag));
}

export function evaluateAthenaToolPolicy(role: CanonicalRole, tool: Pick<AthenaToolDefinition, "permissions" | "risk">): AthenaToolPolicyDecision {
  const granted = getRolePermissions(role) as readonly string[];
  const allowed = hasAllRequiredPermissions(role, tool.permissions);
  return {
    decision: allowed ? "allow" : "deny",
    role,
    evaluatedPermissions: [...granted],
    evaluatedRisk: tool.risk,
  };
}
