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
//
// A4 (docs/athena/roadmap/A4-permission-policy-implementation-plan.md) adds
// "approval_required" here: a tool's declared risk was previously computed
// (evaluatedRisk) but never used to gate dispatch - any tool with sufficient
// permissions executed regardless of risk. C005 (docs/athena/contracts/
// README.md) already documents "high-risk actions require approval ID
// before running," so a permission-granted medium/high-risk tool must not
// silently behave like a low-risk one. This rule is kept inline here rather
// than delegated to app/modules/athena-permissions - the only actually
// shared logic (permission-subset checking) is already getRolePermissions,
// reused by both; importing across sibling modules for one risk-tier `if`
// would recreate the coupling athena-context-engine/policy.ts's own comment
// deliberately avoided.
export interface AthenaToolPolicyDecision {
  decision: "allow" | "deny" | "approval_required";
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
  const decision: AthenaToolPolicyDecision["decision"] = !allowed ? "deny" : tool.risk === "low" ? "allow" : "approval_required";
  return {
    decision,
    role,
    evaluatedPermissions: [...granted],
    evaluatedRisk: tool.risk,
  };
}
