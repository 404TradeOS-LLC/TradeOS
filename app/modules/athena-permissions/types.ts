import type { CanonicalRole, DomainPermission } from "../../domain";

// A4 Permission contracts (docs/athena/roadmap/A4-permission-policy-implementation-plan.md,
// C007 in docs/athena/contracts/README.md). This is the first shared
// deterministic permission adapter across kernel/tool-registry/context-engine
// call sites - the A3 context-engine policy.ts comment explicitly deferred
// building one "until a third consumer actually needs one." A4 is that third
// consumer, so this module owns the canonical C007 shape; the three sibling
// policy.ts files keep their own narrow role/permission checks (they are not
// rewritten to import this module - see policy.ts's module comment for why).

export type AthenaPermissionRisk = "low" | "medium" | "high";

// Closed union, not a generic string: "tool" carries risk-based approval
// classification, the other three do not. New kinds require a deliberate
// type change here, not a silent runtime fallthrough.
export type AthenaNonToolCapabilityKind = "draft_response" | "mutate_business_record" | "context_provider";

// entityType is a 1-value closed union, not string, so extending
// object-scope resolution to a new entity (customers, invoices, ...) is a
// visible type change here and in resourceScope.ts, not a silent runtime
// fallthrough. Job is the only entity with a real object-scope precedent
// today (JobsService/scopedJobAccessWhere/jobs_select_policy RLS, reused by
// athena-context-engine/providers/dispatchProvider.ts). Every other entity
// remains blocked on the still-unresolved HIGH-P3 object-scope prerequisite
// from the A3 plan and must not be silently granted access here.
export interface AthenaResourceRequest {
  entityType: "job";
  entityId: string;
}

// A discriminated union, not one interface with an optional `risk?`: a
// review finding on this PR correctly flagged that an optional risk field
// let a caller construct a `kind: "tool"` request with no risk
// classification, which the original implementation defaulted to "low" and
// allowed - a fail-open default for exactly the field this module exists to
// gate on. Making risk required for "tool" at the type level closes that
// gap for every well-typed caller; policy.ts additionally fails closed at
// runtime for a caller that bypasses the type system (deserialized/untyped
// input), the same defensive posture already applied to
// resourceRequest.entityType.
export interface AthenaToolCapabilityRequest {
  kind: "tool";
  id: string;
  requiredPermissions: readonly DomainPermission[];
  risk: AthenaPermissionRisk;
  resourceRequest?: AthenaResourceRequest;
}

export interface AthenaNonToolCapabilityRequest {
  kind: AthenaNonToolCapabilityKind;
  id: string;
  requiredPermissions: readonly DomainPermission[];
  // Reads and A1's two narrow capabilities carry no risk concept of their
  // own; risk is not a field on this variant at all, not merely unused.
  resourceRequest?: AthenaResourceRequest;
}

export type AthenaCapabilityRequest = AthenaToolCapabilityRequest | AthenaNonToolCapabilityRequest;

// C007 Permission v1.0.0, verbatim shape from docs/athena/contracts/README.md.
export interface AthenaPermissionDecision {
  version: "1.0.0";
  orgId: string;
  userId: string;
  role: CanonicalRole;
  permissions: string[];
  capability: string;
  resourceScope?: {
    entityType: string;
    entityId: string;
    relationship: "owner" | "assignee" | "member" | "viewer" | "none";
  };
  deniedFields: string[];
  decision: "allow" | "deny" | "approval_required";
  reasonCode: string;
}
