---
status: current
owner: platform
last_verified: 2026-08-09
source_of_truth: true
---

# Athena Platform Contracts

All Athena contracts are versioned. Compatible additions are optional fields.
Breaking changes require a new major version and migration notes. Runtime
validation must reject undocumented arbitrary response shapes.

## Standard Tool Result Envelope

All tools return this envelope. No tool may return an undocumented arbitrary
shape.

```ts
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

export interface AthenaToolError {
  code: string;
  category: "validation" | "authorization" | "conflict" | "timeout" | "provider" | "service" | "unknown";
  retryable: boolean;
  safeSummary: string;
  correlationId: string;
}
```

```json
{
  "success": true,
  "summary": "Prepared a draft estimate for review.",
  "data": { "draftId": "draft_123" },
  "events": [{ "type": "EstimateStarted", "id": "evt_123" }],
  "warnings": [{ "code": "missing_dimension", "message": "Ceiling height is unknown." }],
  "followUps": [{ "kind": "question", "label": "Ask for ceiling height" }],
  "telemetry": { "traceId": "trace_123", "toolRunId": "toolrun_456" }
}
```

Error behavior: failed tools set `success: false`, provide a user-safe summary,
return `data: null` unless a documented partial shape is safe, and include a
stable `error` object. Security: summaries, errors, and warnings must not leak
inaccessible data, secrets, raw prompts, or unnecessary PII.

## C001 AI Context v1.0.0

Purpose: immutable request context snapshot.

```ts
export interface AthenaAIContext {
  version: "1.0.0";
  request: AthenaRequestContext;
  organization: AthenaOrganizationContext;
  user: AthenaUserContext;
  permissions: AthenaPermissionSnapshot;
  selectedScope: AthenaSelectedScope;
  budget: AthenaContextBudget;
  conversation?: AthenaConversationContext;
  weather?: AthenaProviderSection;
  calendar?: AthenaProviderSection;
  dispatch?: AthenaProviderSection;
  customers?: AthenaProviderSection;
  costbook?: AthenaProviderSection;
  knowledgeEngine?: AthenaProviderSection;
  inventory?: AthenaProviderSection;
  notifications?: AthenaProviderSection;
  memory?: AthenaProviderSection;
  telemetry: AthenaTelemetryContext;
}

export interface AthenaProviderSection<TData = unknown> {
  status: "available" | "degraded" | "omitted" | "unavailable" | "denied";
  freshness: AthenaFreshnessEvidence;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  source: AthenaSourceReference;
  data: TData;
  omittedFields: string[];
  maxItems: number;
  maxBytes: number;
  estimatedTokens?: number;
  truncationReason?: string;
}

export interface AthenaFreshnessEvidence {
  status: "live" | "fresh" | "stale" | "unavailable";
  fetchedAt: string;
  expiresAt?: string;
  ttlMs?: number;
  cacheHit: boolean;
  sourceVersion?: string;
  sourceHash?: string;
  revalidatedAt?: string;
}

export interface AthenaSelectedScope {
  customerId?: string;
  projectId?: string;
  jobId?: string;
  estimateId?: string;
  invoiceId?: string;
  page?: string;
}

export interface AthenaContextBudget {
  maxBytes: number;
  maxEstimatedTokens: number;
  maxProviderCount: number;
}
```

Shape: object with `version`, `request`, `organization`, `user`,
`permissions`, `selectedScope`, `budget`, and `telemetry` required; provider
sections are optional and must include `freshness`, `source`, `status`,
`sensitivity`, and size limits when present. Validation: reject mutable provider
values, missing org/user IDs, provider data without freshness evidence, missing
tenant scope for tenant data, and outputs that exceed budget. Compatibility:
optional provider sections may be added. Example: context with
`knowledgeEngine.status: "available"` and `weather.status: "omitted"`. Error
behavior: context assembly failure stops dependent actions. Security: never use
request body/header tenant IDs as authority; high-PII sections are lazy and
intent-gated by default.

## C002 Tool v1.0.0

Purpose: registered executable capability.

```ts
export interface AthenaToolDefinition {
  id: string;
  version: string;
  owner: string;
  name: string;
  category: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
  description: string;
  permissions: string[];
  risk: "low" | "medium" | "high";
  confirmationPolicy: "never" | "contextual" | "always";
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  inputSchema: Record<string, unknown>;
  outputSchema: "AthenaToolResult";
}

export interface AthenaToolExecutionContext {
  executionId: string;
  requestId: string;
  traceId: string;
  orgId: string;
  actor: { type: "user" | "system"; id: string };
  role: "owner" | "admin" | "dispatcher" | "technician";
  deadline: string;
  cancellationSignal: AbortSignal;
  approvalId?: string;
  featureFlags: string[];
}
```

Required: `id`, `version`, `owner`, `name`, `category`, `permissions`, `risk`,
`confirmationPolicy`, `timeoutMs`, `idempotency`, `inputSchema`,
`outputSchema`, and `compensationPolicy`. Optional: feature flag,
deprecation, plugin ID. Execution requires both AI Context and
`AthenaToolExecutionContext`; tools must not infer authority from model output.
Validation: unknown tools, invalid schemas, and permissionless mutating tools
fail closed. Compatibility: breaking input changes require a new major version.
Example: `tradeos.estimate.prepareDraft@1.0.0`. Error: registry returns
structured not-found/unauthorized/deprecated errors. Security: tool execution is
allowed only after policy evaluation and must honor deadline/cancellation.

## C003 Tool Result v1.0.0

Purpose: standard tool output envelope.

Typed example: see [Standard Tool Result Envelope](#standard-tool-result-envelope).
Required: `success`, `summary`, `data`, `events`, `warnings`, `followUps`,
`telemetry`. Optional: tool-specific fields only inside documented `data`.
Validation: extra top-level keys are rejected unless added compatibly to this
contract. Compatibility: `data` can evolve per tool version; envelope shape is
stable. Error: failures still return the envelope. Security: redact inaccessible
record names and sensitive metadata.

## C004 Planner v1.0.0

Purpose: hidden plan shape produced before execution.

```ts
export interface AthenaPlan {
  version: "1.0.0";
  planId: string;
  status: "draft" | "needs_clarification" | "awaiting_approval" | "ready" | "superseded" | "cancelled";
  intent: string;
  risk: "low" | "medium" | "high";
  steps: AthenaPlanStep[];
  requiredApprovals: string[];
  assumptions: string[];
}
```

Required: version, plan ID, status, intent, risk, steps. Optional: assumptions,
alternatives, missing information. Validation: every step must reference a
registered tool/version or a user question; planners cannot execute steps.
Compatibility: new step metadata is optional. Example: plan to prepare a draft
estimate, then ask for approval before applying. Error: unsafe or unresolved
plans produce a clarification or approval request. Security: hidden reasoning is
not shown to users or plugins.

## C005 Action v1.0.0

Purpose: approved executable unit.

```ts
export interface AthenaAction {
  id: string;
  version: "1.0.0";
  orgId: string;
  actorUserId: string;
  name: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  risk: "low" | "medium" | "high";
  approvalRequirement: "not_required" | "required";
  approvalId?: string;
  idempotencyKey: string;
  status:
    | "created"
    | "pending"
    | "running"
    | "awaiting_approval"
    | "partially_succeeded"
    | "succeeded"
    | "failed"
    | "denied"
    | "expired"
    | "cancelled";
  attempt: number;
  executor: {
    kind: "tool";
    name: string;
    category: "system" | "estimator" | "dispatcher" | "office" | "field" | "costbook" | "fixture";
    toolId: string;
    toolVersion: string;
  };
  checkpoint?: Record<string, unknown>;
  compensationPolicy: "none" | "compensating_action" | "service_transaction" | "draft_only";
  lastError?: AthenaToolError;
}
```

Required: action ID, org, actor, action name, tool, risk, approval requirement,
idempotency key, status, attempt, executor, and compensation policy. Optional: approval, checkpoint, and last
error. Validation: high-risk actions require approval ID before running; terminal
states are immutable; resume requires a checkpoint and fresh policy check.
Compatibility: statuses may only be added with documented terminal/non-terminal
semantics. Example: approved invoice-send action. Error: failed actions preserve
result envelope and audit state. Security: actor/org are server-derived.

## C006 Memory v1.0.0

Purpose: durable attributed memory record.

```ts
export interface AthenaMemoryRecord {
  id: string;
  version: "1.0.0";
  orgId: string;
  scope: "user" | "organization" | "project" | "job" | "conversation";
  subjectId: string;
  kind: string;
  value: unknown;
  source: AthenaSourceReference;
  confidence: number;
  retention: AthenaRetentionPolicy;
  status: "active" | "corrected" | "deleted";
}

// Referenced but not previously spelled out in this catalog; defined here by
// the A7 implementation (docs/athena/roadmap/A7-memory-implementation-plan.md)
// from 08-memory/README.md's "Source Attribution And Confidence" (valid
// source kinds) and "Retention, Deletion, And Correction" sections.
export interface AthenaSourceReference {
  kind: "user_message" | "approved_action" | "application_record" | "event" | "document" | "admin_policy";
  id?: string;
  trusted: boolean;
  description?: string;
}

export interface AthenaRetentionPolicy {
  tier: "short_term" | "standard" | "long_term";
  expiresAt?: string;
  legalHold?: boolean;
}
```

Required: ID, org, scope, subject, kind, value, source, confidence, retention,
status. Optional: supersedes, visibility, legal hold. 08-memory/README.md's
"Required Fields" additionally names created/updated actor and audit
metadata beyond this minimal wire shape; the A7 implementation carries those
as additive fields on the same record rather than a second parallel type.
Validation: no unattributed memory; confidence is 0-1. Compatibility: new
scopes require this Bible update. Example: user prefers concise morning
summaries. Error: deleted/corrected memory is excluded from planning.
Security: untrusted content cannot write memory without trusted confirmation.

## C007 Permission v1.0.0

Purpose: capability and RBAC policy decision.

```ts
export interface AthenaPermissionDecision {
  version: "1.0.0";
  orgId: string;
  userId: string;
  role: "owner" | "admin" | "dispatcher" | "technician";
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
```

Required: version, org, user, role, permissions, capability, decision,
reasonCode, and denied fields. Optional: approval policy and resource scope for
non-object actions. Validation: role must be canonical; field technician and
resource-scoped decisions must include service-derived scope where applicable.
Compatibility: new decisions require explicit semantics. Example:
`billing.write` allowed but `send_invoice` approval required. Error: denial
returns safe reason. Security: decisions are service/policy-owned, not LLM-owned.

## C008 Event v1.0.0

Purpose: canonical business event.

```ts
export interface AthenaBusinessEvent<TPayload = unknown> {
  id: string;
  type: string;
  version: string;
  orgId: string;
  entity: { type: string; id: string };
  actor: { type: "user" | "system" | "athena"; id: string | null };
  occurredAt: string;
  payload: TPayload;
  correlationId: string;
  idempotencyKey: string;
}
```

Required: all fields above. Optional: replay metadata, causation ID. Validation:
type/version pair must be registered; payload must match schema. Compatibility:
optional payload fields only within major version. Example: `WorkCompleted`.
Error: failed publication enters retry/dead-letter policy. Security: event
payloads carry minimum safe business metadata.

## C009 Conversation v1.0.0

Purpose: user-visible exchange state.

```ts
export interface AthenaConversationState {
  id: string;
  version: "1.0.0";
  orgId: string;
  participants: string[];
  visibleMessages: AthenaVisibleMessage[];
  pendingApprovals: string[];
  memoryRefs: string[];
}
```

Required: ID, org, participants, visible messages. Optional: approvals, memory
refs, channel metadata. Validation: hidden planner traces are not conversation
messages. Compatibility: channel-specific metadata is optional. Example:
dispatcher asks Athena to prep tomorrow's board. Error: unavailable
conversation history degrades to current message. Security: do not expose hidden
tool prompts or inaccessible records.

## C010 Context Provider v1.0.0

Purpose: adapter that contributes a context section.

```ts
export interface AthenaContextProviderDefinition {
  id: string;
  version: string;
  owner: string;
  section: string;
  permissions: string[];
  activation: "eager_minimal" | "lazy_intent" | "explicit_only";
  allowedIntents: string[];
  freshnessTtlMs: number;
  timeoutMs: number;
  maxItems: number;
  maxBytes: number;
  sensitivity: "public" | "internal" | "confidential" | "restricted";
  cacheKeyPolicy: "none" | "tenant_actor_permission_input";
  criticality: "critical" | "important" | "optional";
  failureBehavior: "stop" | "degrade" | "omit";
}
```

Required: ID, version, owner, section, permissions, freshness, timeout,
activation, sensitivity, output limits, cache policy, criticality, and failure
behavior. Optional: plugin ID. Validation: provider output must include status,
freshness evidence, sensitivity, source, and size metadata. Cached tenant data
must use a tenant-, actor-, permission-, provider-version-, and input-qualified
cache key. Compatibility: new sections are optional in C001. Example: weather
provider for scheduled exterior jobs. Error: failure follows declared behavior.
Security: provider permissions and object scope are checked before fetching.

## C011 Telemetry v1.0.0

Purpose: observability record.

```ts
export interface AthenaTelemetryRecord {
  id: string;
  version: "1.0.0";
  orgId: string;
  requestId: string;
  traceId: string;
  executionId: string;
  spanType: "kernel" | "context" | "planner" | "tool" | "action" | "approval" | "memory" | "event" | "model";
  status: "ok" | "error" | "denied" | "degraded";
  durationMs: number;
  redaction: "none" | "metadata_only" | "field_redacted" | "payload_omitted";
  cost?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedUsd?: number;
  };
  metadata: Record<string, unknown>;
}
```

Required: ID, version, org, request, trace, execution, span type, status,
duration, redaction, and metadata. Optional: model/provider/cost, error code,
sampled flag. Validation: redact metadata, omit restricted payloads by default,
and never store private chain-of-thought. Compatibility: new span types require
this catalog update. Example: tool execution span for
`tradeos.estimate.prepareDraft`. Error: telemetry failure must not complete a
business action falsely. Security: no secrets, raw payment data, raw prompts, or
unnecessary PII.

## C012 Plugin v1.0.0

Purpose: future third-party extension package.

```ts
export interface AthenaPluginManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  athenaContractVersion: string;
  tools: string[];
  contextProviders: string[];
  eventsConsumed: string[];
  eventsPublished: string[];
  permissions: string[];
  dataUse: Record<string, unknown>;
}
```

Required: ID, name, version, publisher, contract version, permissions, data use.
Optional: tools/providers/events when absent, support URL, network policy.
Validation: manifest schema, publisher trust, capability review, compatibility.
Compatibility: plugins pin contract major versions. Example: governed weather
risk plugin. Error: incompatible plugins do not load. Security: sandboxed,
least-privilege, revocable.
