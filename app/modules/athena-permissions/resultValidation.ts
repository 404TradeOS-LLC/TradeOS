import { canonicalRoles } from "../../domain";
import { AthenaPermissionDecision } from "./types";

const REQUIRED_KEYS = ["version", "orgId", "userId", "role", "permissions", "capability", "deniedFields", "decision", "reasonCode"] as const;
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, "resourceScope"]);

const VALID_ROLES = new Set<string>(canonicalRoles);
const VALID_DECISIONS = new Set(["allow", "deny", "approval_required"]);
const VALID_RELATIONSHIPS = new Set(["owner", "assignee", "member", "viewer", "none"]);

// Runtime validator for C007 AthenaPermissionDecision, mirroring the
// "reject undocumented top-level key" posture already established by
// athena-tool-registry/resultEnvelope.ts (C003) and
// athena-context-engine/resultValidation.ts (C010's fetch-result shape).
export function assertValidAthenaPermissionDecision(value: unknown): asserts value is AthenaPermissionDecision {
  if (typeof value !== "object" || value === null) {
    throw new Error("AthenaPermissionDecision must be an object");
  }
  const candidate = value as Record<string, unknown>;

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`AthenaPermissionDecision has an undocumented top-level key: ${key}`);
    }
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in candidate)) {
      throw new Error(`AthenaPermissionDecision is missing required key: ${key}`);
    }
  }

  if (candidate.version !== "1.0.0") {
    throw new Error("AthenaPermissionDecision.version must be \"1.0.0\"");
  }
  if (typeof candidate.orgId !== "string" || candidate.orgId.length === 0) {
    throw new Error("AthenaPermissionDecision.orgId must be a non-empty string");
  }
  if (typeof candidate.userId !== "string" || candidate.userId.length === 0) {
    throw new Error("AthenaPermissionDecision.userId must be a non-empty string");
  }
  if (typeof candidate.role !== "string" || !VALID_ROLES.has(candidate.role)) {
    throw new Error(`AthenaPermissionDecision.role must be a canonical role: ${String(candidate.role)}`);
  }
  if (!Array.isArray(candidate.permissions) || candidate.permissions.some((permission) => typeof permission !== "string")) {
    throw new Error("AthenaPermissionDecision.permissions must be an array of strings");
  }
  if (typeof candidate.capability !== "string" || candidate.capability.length === 0) {
    throw new Error("AthenaPermissionDecision.capability must be a non-empty string");
  }
  if (!Array.isArray(candidate.deniedFields) || candidate.deniedFields.some((field) => typeof field !== "string")) {
    throw new Error("AthenaPermissionDecision.deniedFields must be an array of strings");
  }
  if (typeof candidate.decision !== "string" || !VALID_DECISIONS.has(candidate.decision)) {
    throw new Error(`AthenaPermissionDecision.decision is not a known decision: ${String(candidate.decision)}`);
  }
  if (typeof candidate.reasonCode !== "string" || candidate.reasonCode.length === 0) {
    throw new Error("AthenaPermissionDecision.reasonCode must be a non-empty string");
  }

  if (candidate.resourceScope !== undefined) {
    if (typeof candidate.resourceScope !== "object" || candidate.resourceScope === null) {
      throw new Error("AthenaPermissionDecision.resourceScope must be an object when present");
    }
    const scope = candidate.resourceScope as Record<string, unknown>;
    if (typeof scope.entityType !== "string" || scope.entityType.length === 0) {
      throw new Error("AthenaPermissionDecision.resourceScope.entityType must be a non-empty string");
    }
    if (typeof scope.entityId !== "string" || scope.entityId.length === 0) {
      throw new Error("AthenaPermissionDecision.resourceScope.entityId must be a non-empty string");
    }
    if (typeof scope.relationship !== "string" || !VALID_RELATIONSHIPS.has(scope.relationship)) {
      throw new Error(`AthenaPermissionDecision.resourceScope.relationship is not a known relationship: ${String(scope.relationship)}`);
    }
  }
}
