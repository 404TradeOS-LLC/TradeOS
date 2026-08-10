import { getRolePermissions, normalizeRole } from "../../domain";
import type { CanonicalRole } from "../../domain";
import { JobsService } from "../jobs/service";
import { resolveJobResourceScope } from "./resourceScope";
import { AthenaCapabilityRequest, AthenaPermissionDecision } from "./types";

// Deterministic A4 permission adapter (docs/athena/09-security/README.md
// "Permission Enforcement Path": "Before a tool calls an application
// service, Athena must run a deterministic permission adapter that maps
// actor, organization, role, capability, resource scope, risk, and
// organization policy to a decision"). Normalizes the role itself rather
// than trusting an upstream-supplied role, the same MEDIUM-2 lesson every
// other Athena policy adapter already applies. Async (unlike the three
// sibling policy.ts files) because object-scope resolution needs a real
// JobsService.getById() call for technician-scoped job requests.
export interface AthenaPermissionPolicyInput {
  rawRole: string;
  orgId: string;
  userId: string;
  request: AthenaCapabilityRequest;
  jobsService?: Pick<JobsService, "getById">;
}

function baseDecision(role: CanonicalRole, orgId: string, userId: string, request: AthenaCapabilityRequest): AthenaPermissionDecision {
  return {
    version: "1.0.0",
    orgId,
    userId,
    role,
    permissions: [...getRolePermissions(role)],
    capability: request.id,
    deniedFields: [],
    decision: "deny",
    reasonCode: "athena_permission_denied_missing_permission",
  };
}

export async function evaluateAthenaPermission(input: AthenaPermissionPolicyInput): Promise<AthenaPermissionDecision> {
  const role = normalizeRole(input.rawRole);
  const { request } = input;
  const decision = baseDecision(role, input.orgId, input.userId, request);

  const granted = getRolePermissions(role) as readonly string[];
  const missing = request.requiredPermissions.filter((permission) => !granted.includes(permission));
  if (missing.length > 0) {
    decision.deniedFields = [...missing];
    decision.reasonCode = "athena_permission_denied_missing_permission";
    return decision;
  }

  if (request.resourceRequest) {
    const { entityType, entityId } = request.resourceRequest;
    // TypeScript already narrows entityType to the literal "job", but this
    // module's own contract is the authorization boundary for any caller
    // that reaches it with unchecked/deserialized input - never widen
    // access for an entity type this module doesn't actually understand.
    if ((entityType as string) !== "job") {
      decision.resourceScope = { entityType, entityId, relationship: "none" };
      decision.reasonCode = "athena_permission_object_scope_unsupported_entity";
      return decision;
    }

    const jobsService = input.jobsService ?? new JobsService();
    const scope = await resolveJobResourceScope(jobsService, input.orgId, { userId: input.userId, role }, entityId);
    decision.resourceScope = { entityType, entityId, relationship: scope.relationship };
    if (scope.relationship === "none") {
      decision.reasonCode = "athena_permission_object_scope_denied";
      return decision;
    }
  }

  if (request.kind !== "tool") {
    // Reads (context_provider) and A1's two narrow capabilities carry no
    // risk concept of their own - AthenaNonToolCapabilityRequest has no
    // risk field at all, not merely an unused one.
    decision.decision = "allow";
    decision.reasonCode = "athena_permission_allowed";
    return decision;
  }

  // risk is required at the type level for AthenaToolCapabilityRequest, but
  // this module's own contract is the authorization boundary for any caller
  // that reaches it with unchecked/deserialized input - never default a
  // missing or invalid risk classification to "low" and silently allow (a
  // review finding on this PR flagged exactly this fail-open path when risk
  // was still optional). medium/high risk maps to approval_required, not
  // deny: C007's sibling C005 Action contract already documents "high-risk
  // actions require approval ID before running," i.e. approval-gated, not
  // permanently blocked. No A6 approval executor exists yet, so
  // approval_required and deny both currently mean "does not execute" -
  // this only gets the classification right for when A6 lands.
  if (request.risk !== "low" && request.risk !== "medium" && request.risk !== "high") {
    decision.reasonCode = "athena_permission_missing_risk_classification";
    return decision;
  }
  if (request.risk === "low") {
    decision.decision = "allow";
    decision.reasonCode = "athena_permission_allowed";
  } else {
    decision.decision = "approval_required";
    decision.reasonCode = request.risk === "high" ? "athena_permission_approval_required_risk_high" : "athena_permission_approval_required_risk_medium";
  }

  return decision;
}
