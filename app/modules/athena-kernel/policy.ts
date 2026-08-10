import { getRolePermissions, normalizeRole } from "../../domain";
import { AthenaCapability, AthenaPermissionDecision } from "./types";

// Deterministic A1 policy adapter (docs/athena/09-security/README.md
// "Permission Enforcement Path"). Deliberately does not import
// app/backend/requestContext.ts: requireOrgId/requirePermissions/
// requireRoles/requireOrgAccess all take an Express Request, which Athena
// execution contexts never carry (MEDIUM-1, A1 parallel readiness review).
// This adapter only uses the portable domain helpers, and normalizes the
// role itself rather than trusting an optional upstream
// AuthContext.canonicalRole (MEDIUM-2, same review).
export interface AthenaPolicyInput {
  rawRole: string;
  orgId: string;
  userId: string;
  capability: AthenaCapability;
}

// A1 has exactly one allowed capability: producing a draft/no-op response.
// Every other capability - including any request that reads as asking
// Athena to mutate a business record - is denied. Real capability-specific
// policy (object scope, approval requirements, risk classification) is A4
// work; this is intentionally the smallest deterministic gate that proves
// mutation requests are refused before any tool registry exists.
export function evaluateAthenaPolicy(input: AthenaPolicyInput): AthenaPermissionDecision {
  const role = normalizeRole(input.rawRole);
  const permissions = getRolePermissions(role);

  const decision: AthenaPermissionDecision = {
    version: "1.0.0",
    orgId: input.orgId,
    userId: input.userId,
    role,
    permissions: [...permissions],
    capability: input.capability,
    deniedFields: [],
    decision: "deny",
    reasonCode: "athena_capability_not_available",
  };

  if (input.capability === "draft_response") {
    decision.decision = "allow";
    decision.reasonCode = "athena_a1_draft_response_allowed";
  }

  return decision;
}

// Deterministic, keyword-based capability classification for A1's routing
// stage. There is no model-driven intent router until A5
// (docs/athena/roadmap/A1-ai-kernel-implementation-plan.md "Deferred to
// A5"); this only has to distinguish "produce a draft/no-op response" from
// "asks Athena to change a business record" so mutation requests are denied
// deterministically rather than silently drafted.
//
// Only action verbs, not business-object nouns: "invoice" was deliberately
// removed (a read-only "which invoices are overdue?" is not a mutation
// request, and any genuine invoice-mutation request already pairs with an
// actual verb below - "send"/"create"/"pay"/"charge" the invoice). Matching
// is word-boundary, not substring - plain .includes() previously matched
// "sign" inside "design" and "pay" inside "payment", denying unrelated
// read-only questions.
const mutationKeywords = ["send", "delete", "remove", "cancel", "approve", "reject", "charge", "pay", "schedule", "dispatch", "assign", "create", "update", "sign", "book"];

const mutationKeywordPattern = new RegExp(`\\b(?:${mutationKeywords.join("|")})\\b`, "i");

export function classifyAthenaCapability(message: string): AthenaCapability {
  return mutationKeywordPattern.test(message) ? "mutate_business_record" : "draft_response";
}
