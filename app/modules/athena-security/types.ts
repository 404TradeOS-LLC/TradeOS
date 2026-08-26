// A11 Security Hardening contracts (docs/athena/roadmap/
// A11-security-hardening-implementation-plan.md, docs/athena/09-security/
// README.md). This module adds a security *evaluation, classification, and
// audit* layer over decisions A3 (context), A4 (permissions), A2/A9 (tool
// registry/SDK), A6 (action engine), A7 (memory), A8 (events), and A10
// (observability) already make. It deliberately does not define a second
// permission engine, a second execution engine, or a second telemetry
// system - see each function's own module comment for exactly which
// existing decision it layers over rather than replaces.
//
// AthenaSecurityDecision is a read/audit model plus a small, explicit set
// of unambiguous additive deny reasons (secret-shaped input about to reach
// a tool, a cross-tenant object reference, a confirmed prompt-injection
// pattern about to be treated as an instruction). It never grants a
// permission, never marks an approval satisfied, and never overrides an
// A4/A6 "allow" - it can only ever narrow an already-permitted path
// further, exactly the same fail-closed posture every sibling Athena
// policy module already applies.

export const athenaSecurityRiskLevels = ["low", "medium", "high", "critical"] as const;
export type AthenaSecurityRiskLevel = (typeof athenaSecurityRiskLevels)[number];

export type AthenaSecurityDecisionKind = "allow" | "deny";

export type AthenaSecurityReasonCode =
  | "athena_security_allowed"
  | "athena_security_denied_cross_tenant_reference"
  | "athena_security_denied_secret_shaped_input"
  | "athena_security_denied_confirmed_prompt_injection"
  | "athena_security_flagged_untrusted_tool_trust_tier"
  | "athena_security_flagged_permission_layer_denied"
  | "athena_security_flagged_permission_layer_approval_required";

// requiredControls names an advisory control the security layer believes
// should already be true of the path it observed (e.g. "approval_required")
// - it is never itself the mechanism that enforces that control. A4/A6 own
// enforcement; this field exists purely so an audit reader (a human, or a
// future A10 alert rule) can see what the security layer expected without
// re-deriving it from raw telemetry.
export interface AthenaSecurityDecision {
  version: "1.0.0";
  decision: AthenaSecurityDecisionKind;
  riskLevel: AthenaSecurityRiskLevel;
  reasons: AthenaSecurityReasonCode[];
  requiredControls: string[];
  metadata: Record<string, unknown>;
}

// Context trust taxonomy (docs/athena/09-security/README.md "Prompt
// Injection And Untrusted Content"). Distinguishes "this section is content
// Athena may summarize/cite" from "this section may be treated as an
// instruction" - only "system_instruction" ever may be. Deliberately not
// stored as a new required field on the closed C001 AthenaProviderSection
// contract (athena-kernel/types.ts) - resultValidation-style contracts in
// this codebase reject undocumented top-level keys, and widening a numbered
// contract is a Bible-level change, not an A11 one. classifyContextTrust in
// contextTrust.ts derives this from data A3 already has (section name,
// sensitivity) instead.
export const athenaContextTrustLevels = ["system_instruction", "verified_internal", "organization_content", "external_untrusted"] as const;
export type AthenaContextTrustLevel = (typeof athenaContextTrustLevels)[number];

// Tool trust taxonomy (task brief "Tool trust metadata"). Layered the same
// way as context trust: derived from data A2/A9 already carry (owner,
// declared risk) via evaluateToolTrust in toolTrust.ts, not a new required
// field on the closed C002 AthenaToolDefinition contract.
export const athenaToolTrustTiers = ["internal", "verified", "experimental", "restricted"] as const;
export type AthenaToolTrustTier = (typeof athenaToolTrustTiers)[number];

// Memory classification taxonomy (task brief "Memory classification").
// Derived from a candidate's existing scope/kind/source (memoryClassification.ts)
// rather than added as a new required field on the closed C006
// AthenaMemoryRecord contract - callers that want it persisted can carry it
// under the record's existing open `metadata` field.
export const athenaMemoryClassifications = ["user_preference", "business_fact", "temporary_context", "system_knowledge", "untrusted_information"] as const;
export type AthenaMemoryClassification = (typeof athenaMemoryClassifications)[number];

export interface AthenaSecretDetectionResult {
  detected: boolean;
  detectorNames: string[];
}

export interface AthenaSecretRedactionResult<TData> {
  data: TData;
  redactedFieldPaths: string[];
}

export interface AthenaPromptInjectionScanResult {
  suspicious: boolean;
  matchedPatternNames: string[];
}
