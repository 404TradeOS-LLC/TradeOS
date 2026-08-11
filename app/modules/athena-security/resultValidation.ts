import { athenaSecurityRiskLevels } from "./types";
import type { AthenaSecurityDecision } from "./types";

// Runtime shape validator for AthenaSecurityDecision, following the same
// "reject undocumented top-level key" convention every sibling module's
// resultValidation.ts already applies (e.g. athena-permissions/
// resultValidation.ts's assertValidAthenaPermissionDecision). Backs
// athena:contracts via athena-security.contracts.test.ts.
const REQUIRED_KEYS = ["version", "decision", "riskLevel", "reasons", "requiredControls", "metadata"] as const;
const KNOWN_KEYS = new Set<string>(REQUIRED_KEYS);
const VALID_DECISIONS = new Set(["allow", "deny"]);

export function assertValidAthenaSecurityDecision(value: unknown): asserts value is AthenaSecurityDecision {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaSecurityDecision must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaSecurityDecision is missing required key: ${key}`);
    }
  }
  for (const key of Object.keys(candidate)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`AthenaSecurityDecision carries an undocumented top-level key: ${key}`);
    }
  }
  if (candidate.version !== "1.0.0") {
    throw new Error("AthenaSecurityDecision.version must be 1.0.0");
  }
  if (!VALID_DECISIONS.has(candidate.decision as string)) {
    throw new Error(`AthenaSecurityDecision.decision must be "allow" or "deny": ${String(candidate.decision)}`);
  }
  if (!(athenaSecurityRiskLevels as readonly string[]).includes(candidate.riskLevel as string)) {
    throw new Error(`AthenaSecurityDecision.riskLevel is not a known risk level: ${String(candidate.riskLevel)}`);
  }
  if (!Array.isArray(candidate.reasons) || candidate.reasons.length === 0 || candidate.reasons.some((r) => typeof r !== "string")) {
    throw new Error("AthenaSecurityDecision.reasons must be a non-empty string array");
  }
  if (!Array.isArray(candidate.requiredControls) || candidate.requiredControls.some((c) => typeof c !== "string")) {
    throw new Error("AthenaSecurityDecision.requiredControls must be a string array");
  }
  if (typeof candidate.metadata !== "object" || candidate.metadata === null || Array.isArray(candidate.metadata)) {
    throw new Error("AthenaSecurityDecision.metadata must be an object");
  }
}
