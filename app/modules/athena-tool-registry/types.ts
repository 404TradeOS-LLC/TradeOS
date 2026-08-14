import type { CanonicalRole } from "../../domain";
import type { AthenaAIContext, AthenaFollowUp, AthenaTelemetryReference, AthenaToolError, AthenaWarning } from "../athena-kernel/types";

export type { AthenaAIContext, AthenaToolError };

// A2 Tool Registry contracts (docs/athena/roadmap/A2-tool-registry-implementation-plan.md
// "Minimal Tool Registry Contract/Interfaces"), narrowed from C002/C003 in
// docs/athena/contracts/README.md the same way A1's athena-kernel/types.ts
// narrowed C001. Types reused from athena-kernel/types.ts below are
// type-only imports (erased at compile time) - that module has no
// database/Prisma imports either way, so reusing it does not weaken this
// module's import boundary (see fixtures/ and the athena-tool-registry
// import-boundary test).

export type AthenaToolRisk = "low" | "medium" | "high";
export type AthenaToolConfirmationPolicy = "never" | "contextual" | "always";
export type AthenaToolIdempotency = "required" | "optional" | "not_supported";
export type AthenaToolCompensationPolicy = "none" | "compensating_action" | "service_transaction" | "draft_only";
export type AthenaToolCategory = "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
export type AthenaToolOutputSchema = "AthenaToolResult";

export interface AthenaToolDeprecation {
  replacementId?: string;
  sunsetAt?: string;
  note: string;
}

export interface AthenaEventReference {
  type: string;
  id: string;
}

export interface AthenaToolResult<TData = unknown> {
  success: boolean;
  summary: string;
  data: TData | null;
  events: AthenaEventReference[];
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: AthenaTelemetryReference;
  error?: AthenaToolError;
}

export interface AthenaToolExecutionContext {
  executionId: string;
  requestId: string;
  traceId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: CanonicalRole;
  deadline: Date;
  cancellationSignal: AbortSignal;
  approvalId?: string;
  featureFlags: string[];
  // Deliberately excludes any Prisma client, request-scoped transaction
  // handle, or getRequestDatabaseClient() reference (see the A2 plan's "No
  // Ambient Request Transaction" section). Real tools reach application
  // services only, starting at A6 - never the database directly.
}

export interface AthenaToolDefinition<TInput = unknown, TData = unknown> {
  id: string;
  version: string;
  owner: string;
  name?: string;
  category?: AthenaToolCategory;
  description: string;
  permissions: string[];
  risk: AthenaToolRisk;
  confirmationPolicy: AthenaToolConfirmationPolicy;
  timeoutMs: number;
  idempotency: AthenaToolIdempotency;
  compensationPolicy: AthenaToolCompensationPolicy;
  // A2 requires this to be a Zod schema (schema.safeParse(...)); the
  // `unknown` type matches C002's cross-framework contract shape, but the
  // registry/dispatcher implementation only supports Zod, consistent with
  // the rest of the app's validation approach.
  inputSchema: unknown;
  outputSchema?: AthenaToolOutputSchema;
  requiredFeatureFlags?: string[];
  deprecated?: AthenaToolDeprecation;
  execute(input: TInput, aiContext: AthenaAIContext, execution: AthenaToolExecutionContext): Promise<AthenaToolResult<TData>>;
}

export interface AthenaRegisteredToolDefinition<TInput = unknown, TData = unknown>
  extends Omit<AthenaToolDefinition<TInput, TData>, "name" | "category" | "outputSchema"> {
  name: string;
  category: AthenaToolCategory;
  outputSchema: AthenaToolOutputSchema;
}

export type AthenaToolResolution =
  | { outcome: "found"; definition: AthenaRegisteredToolDefinition }
  | { outcome: "tool_not_found" }
  // Carries the other active (non-removed) versions registered under this
  // id so the dispatcher can decide whether the caller is authorized to
  // know this id exists at all before exposing the more specific
  // tool_version_not_found shape (see dispatcher.ts's "Hide version
  // resolution from unauthorized callers" fix).
  | { outcome: "tool_version_not_found"; knownVersions: AthenaRegisteredToolDefinition[] }
  | { outcome: "tool_removed" };

export interface AthenaToolDiscoveryActor {
  role: CanonicalRole;
  featureFlags: string[];
}

export type AthenaToolDispatchReasonCode =
  | "dispatched"
  | "tool_not_found"
  | "tool_version_not_found"
  | "tool_removed"
  | "authorization_denied"
  | "approval_required"
  | "invalid_input"
  | "timeout"
  | "cancelled"
  | "invalid_result_envelope"
  | "unexpected_error";

export interface AthenaToolDispatchAudit {
  reasonCode: AthenaToolDispatchReasonCode;
  toolId: string;
  version: string;
  toolName?: string;
  toolCategory?: AthenaToolCategory;
  evaluatedRole?: CanonicalRole;
  evaluatedPermissions?: string[];
  evaluatedRisk?: AthenaToolRisk;
  // A11 (athena-security/audit.ts's buildAthenaSecurityAuditMetadata):
  // present only when reasonCode === "authorization_denied" for a
  // risk-engine denial specifically, not an ordinary A4 permission denial -
  // see dispatcher.ts's security-gate call site. Lets an operator
  // distinguish "the security gate blocked this and why" from a generic
  // permission denial, both of which otherwise collapse to the same
  // reasonCode/public not-found shape.
  securityMetadata?: Record<string, unknown>;
}

export interface AthenaToolDispatchOutcome<TData = unknown> {
  result: AthenaToolResult<TData>;
  audit: AthenaToolDispatchAudit;
}
