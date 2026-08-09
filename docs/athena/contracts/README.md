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
stable error code in warnings or telemetry. Security: summaries and warnings
must not leak inaccessible data, secrets, raw prompts, or unnecessary PII.

## C001 AI Context v1.0.0

Purpose: immutable request context snapshot.

```ts
export interface AthenaAIContext {
  version: "1.0.0";
  request: AthenaRequestContext;
  organization: AthenaOrganizationContext;
  user: AthenaUserContext;
  permissions: AthenaPermissionSnapshot;
  workspace?: AthenaWorkspaceContext;
  conversation?: AthenaConversationContext;
  dashboard?: AthenaDashboardContext;
  weather?: AthenaProviderSection;
  calendar?: AthenaProviderSection;
  dispatch?: AthenaProviderSection;
  customers?: AthenaProviderSection;
  costbook?: AthenaProviderSection;
  knowledgeEngine?: AthenaProviderSection;
  inventory?: AthenaProviderSection;
  notifications?: AthenaProviderSection;
  telemetry: AthenaTelemetryContext;
}
```

Shape: object with `version`, `request`, `organization`, `user`,
`permissions`, and `telemetry` required; provider sections are optional and must
include `freshness`, `source`, and `status` when present. Validation: reject
mutable provider values, missing org/user IDs, and provider data without
freshness. Compatibility: optional provider sections may be added. Example:
context with `knowledgeEngine.status: "available"` and
`weather.status: "unavailable"`. Error behavior: context assembly failure stops
dependent actions. Security: never use request body/header tenant IDs as
authority.

## C002 Tool v1.0.0

Purpose: registered executable capability.

```ts
export interface AthenaToolDefinition {
  id: string;
  version: string;
  owner: string;
  description: string;
  permissions: string[];
  risk: "low" | "medium" | "high";
  confirmationPolicy: "never" | "contextual" | "always";
  timeoutMs: number;
  idempotency: "required" | "optional" | "not_supported";
  inputSchema: Record<string, unknown>;
  resultSchema: "AthenaToolResult";
}
```

Required: `id`, `version`, `owner`, `permissions`, `risk`, `timeoutMs`,
`inputSchema`, `resultSchema`. Optional: feature flag, deprecation,
rollback mode, plugin ID. Validation: unknown tools, invalid schemas, and
permissionless mutating tools fail closed. Compatibility: breaking input changes
require a new major version. Example: `tradeos.estimate.prepareDraft@1.0.0`.
Error: registry returns structured not-found/unauthorized/deprecated errors.
Security: tool execution is allowed only after policy evaluation.

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
  intent: string;
  risk: "low" | "medium" | "high";
  steps: AthenaPlanStep[];
  requiredApprovals: string[];
  assumptions: string[];
}
```

Required: version, plan ID, intent, risk, steps. Optional: assumptions,
alternatives, missing information. Validation: every step must reference a
registered tool/version or a user question. Compatibility: new step metadata is
optional. Example: plan to prepare a draft estimate, then ask for approval
before applying. Error: unsafe or unresolved plans produce a clarification or
approval request. Security: hidden reasoning is not shown to users or plugins.

## C005 Action v1.0.0

Purpose: approved executable unit.

```ts
export interface AthenaAction {
  id: string;
  version: "1.0.0";
  orgId: string;
  actorUserId: string;
  toolId: string;
  toolVersion: string;
  input: unknown;
  risk: "low" | "medium" | "high";
  approvalId?: string;
  idempotencyKey: string;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
}
```

Required: action ID, org, actor, tool, risk, idempotency key, status. Optional:
approval, rollback action, retry count. Validation: high-risk actions require
approval ID before running. Compatibility: statuses may only be added with
documented terminal/non-terminal semantics. Example: approved invoice-send
action. Error: failed actions preserve result envelope and audit state.
Security: actor/org are server-derived.

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
```

Required: ID, org, scope, subject, kind, value, source, confidence, retention,
status. Optional: supersedes, visibility, legal hold. Validation: no unattributed
memory; confidence is 0-1. Compatibility: new scopes require this Bible update.
Example: user prefers concise morning summaries. Error: deleted/corrected
memory is excluded from planning. Security: untrusted content cannot write
memory without trusted confirmation.

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
  decision: "allow" | "deny" | "approval_required";
  reasonCode: string;
}
```

Required: version, org, user, role, permissions, capability, decision,
reasonCode. Optional: approval policy, denied fields. Validation: role must be
canonical. Compatibility: new decisions require explicit semantics. Example:
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
  freshnessTtlMs: number;
  timeoutMs: number;
  criticality: "critical" | "important" | "optional";
  failureBehavior: "stop" | "degrade" | "omit";
}
```

Required: ID, version, owner, section, permissions, freshness, timeout,
criticality, failure behavior. Optional: cache key, plugin ID. Validation:
provider output must include status and freshness. Compatibility: new sections
are optional in C001. Example: weather provider for scheduled exterior jobs.
Error: failure follows declared behavior. Security: provider permissions are
checked before fetching.

## C011 Telemetry v1.0.0

Purpose: observability record.

```ts
export interface AthenaTelemetryRecord {
  id: string;
  version: "1.0.0";
  orgId: string;
  requestId: string;
  traceId: string;
  spanType: "context" | "planner" | "tool" | "action" | "memory" | "event";
  status: "ok" | "error" | "denied" | "degraded";
  durationMs: number;
  metadata: Record<string, unknown>;
}
```

Required: ID, version, org, request, trace, span type, status, duration.
Optional: model/provider/cost, error code, sampled flag. Validation: redact
metadata. Compatibility: new span types require this catalog update. Example:
tool execution span for `tradeos.estimate.prepareDraft`. Error: telemetry
failure must not complete a business action falsely. Security: no secrets or
raw payment data.

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
