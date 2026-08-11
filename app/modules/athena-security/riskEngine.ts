import { detectPromptInjectionDeep } from "./promptInjection";
import { detectSecrets } from "./secretProtection";
import { evaluateToolTrustGate } from "./toolTrust";
import type { AthenaSecurityDecision, AthenaSecurityReasonCode, AthenaSecurityRiskLevel } from "./types";

// A11 cross-cutting risk evaluation (task brief "Subagent 2 - Security
// Policy and Risk Engine"). Sits between A4's permission decision and A6's
// execution, exactly where the task brief's layered-defense diagram places
// "Risk Evaluation" - it consumes the already-computed
// AthenaPermissionDecision (athena-permissions/policy.ts) and the resolved
// AthenaToolDefinition (athena-tool-registry/types.ts), and it never
// re-derives or overrides what A4 decided about permissions/roles.
//
// This function can only narrow an already-permitted path further, never
// widen one: every branch below either passes an existing decision/risk
// through unchanged (raised to a security riskLevel and audited) or adds a
// *new* "deny" for a small, explicit, unambiguous set of cross-cutting
// abuse signals A4/A2 do not themselves check (cross-tenant object
// reference, secret-shaped tool input, an embedded instruction-override
// pattern present in the exact payload about to execute). If none of those
// signals fire, the returned decision always mirrors whatever the
// permission layer already decided.
export interface AthenaSecurityRiskToolInput {
  id: string;
  owner: string;
  risk: "low" | "medium" | "high";
  deprecated?: { sunsetAt?: string };
}

export interface AthenaSecurityRiskInput {
  orgId: string;
  tool: AthenaSecurityRiskToolInput;
  toolInput: unknown;
  permissionDecision: { decision: "allow" | "deny" | "approval_required"; reasonCode: string };
  // The org a resource embedded in toolInput claims to belong to, when a
  // caller has already resolved one (e.g. a `targetOrgId` field on the
  // validated input). Undefined means "nothing to check" - this function
  // never guesses at which input field might be an org reference.
  referencedOrgId?: string;
  // Whether the calling deployment has explicitly enabled this
  // experimental/restricted-trust tool for this org (a config/feature-flag
  // concern this pure function cannot resolve itself - see
  // toolTrust.ts's evaluateToolTrustGate comment).
  toolTrustExplicitlyEnabled?: boolean;
}

const TOOL_RISK_TO_SECURITY_RISK: Record<"low" | "medium" | "high", AthenaSecurityRiskLevel> = { low: "low", medium: "medium", high: "high" };

function escalate(current: AthenaSecurityRiskLevel, candidate: AthenaSecurityRiskLevel): AthenaSecurityRiskLevel {
  const order: AthenaSecurityRiskLevel[] = ["low", "medium", "high", "critical"];
  return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
}

export function evaluateAthenaSecurityRisk(input: AthenaSecurityRiskInput): AthenaSecurityDecision {
  const reasons: AthenaSecurityReasonCode[] = [];
  const requiredControls: string[] = [];
  const metadata: Record<string, unknown> = {};
  let riskLevel: AthenaSecurityRiskLevel = TOOL_RISK_TO_SECURITY_RISK[input.tool.risk];
  let decision: AthenaSecurityDecision["decision"] = "allow";

  if (input.permissionDecision.decision === "deny") {
    // Defense in depth only - the kernel is expected to already have
    // returned its own denied result before ever calling this function for
    // a "deny" decision (mirroring every sibling module's posture). This
    // branch exists so a caller that reaches here anyway (a future
    // integration, a test) cannot get an "allow" out of this function for
    // an already-denied permission decision.
    decision = "deny";
    riskLevel = escalate(riskLevel, "high");
    reasons.push("athena_security_flagged_permission_layer_denied");
  } else if (input.permissionDecision.decision === "approval_required") {
    requiredControls.push("approval_required");
    reasons.push("athena_security_flagged_permission_layer_approval_required");
  }

  if (input.referencedOrgId !== undefined && input.referencedOrgId !== input.orgId) {
    decision = "deny";
    riskLevel = "critical";
    reasons.push("athena_security_denied_cross_tenant_reference");
    metadata.referencedOrgId = input.referencedOrgId;
  }

  const secretScan = detectSecrets(input.toolInput);
  if (secretScan.detected) {
    decision = "deny";
    riskLevel = "critical";
    reasons.push("athena_security_denied_secret_shaped_input");
    metadata.secretDetectorNames = secretScan.detectorNames;
  }

  // Scans the exact validated payload about to execute, not raw context -
  // see this module's own comment: this is the narrow, "confirmed" case
  // (a literal instruction-override pattern already made it all the way
  // into a tool's input), distinct from athena-security/contextTrust.ts's
  // scanContextSectionForInjection, which only ever produces an advisory
  // warning over retrieved content that is not (yet) about to execute.
  const injectionScan = detectPromptInjectionDeep(input.toolInput);
  if (injectionScan.suspicious) {
    decision = "deny";
    riskLevel = "critical";
    reasons.push("athena_security_denied_confirmed_prompt_injection");
    metadata.injectionPatternNames = injectionScan.matchedPatternNames;
  }

  const trustGate = evaluateToolTrustGate(input.tool);
  metadata.toolTrustLevel = trustGate.trustLevel;
  if (trustGate.requiresExplicitFeatureFlag && !input.toolTrustExplicitlyEnabled) {
    decision = "deny";
    riskLevel = escalate(riskLevel, "high");
    reasons.push("athena_security_flagged_untrusted_tool_trust_tier");
  }

  if (reasons.length === 0) {
    reasons.push("athena_security_allowed");
  }

  return { version: "1.0.0", decision, riskLevel, reasons, requiredControls, metadata };
}
