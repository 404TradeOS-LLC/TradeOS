import { AthenaActorContext, AthenaAIContext, AthenaKernelRequest, AthenaSelectedScope } from "./types";

// A1 context budget. No provider sections exist yet (A3+ work), so this is
// deliberately tiny relative to what C001's budget fields are meant to
// bound once weather/calendar/dispatch/customers/costbook/knowledgeEngine/
// inventory/notifications sections are added.
const ATHENA_A1_CONTEXT_BUDGET = {
  maxBytes: 8_192,
  maxEstimatedTokens: 2_048,
  maxProviderCount: 0,
} as const;

export interface BuildMinimalContextInput {
  requestId: string;
  traceId: string;
  executionId: string;
  actor: AthenaActorContext;
  request: AthenaKernelRequest;
  receivedAt?: Date;
}

// Builds C001's minimal A1 slice: request, organization, user, permissions,
// selectedScope, budget, telemetry, and an optional conversation reference.
// No customer/dispatch/calendar/costbook/knowledge/inventory/notification
// data is ever assembled here - HIGH-003 in the A0.5 review flagged broad
// context hydration as the primary PII/latency risk, and A1 is scoped to
// avoid it entirely rather than redact it after the fact.
export function buildMinimalAthenaContext(input: BuildMinimalContextInput): AthenaAIContext {
  const receivedAt = input.receivedAt ?? new Date();
  const selectedScope: AthenaSelectedScope = input.request.selectedScope ?? {};

  const context: AthenaAIContext = {
    version: "1.0.0",
    request: {
      requestId: input.requestId,
      traceId: input.traceId,
      executionId: input.executionId,
      requestSource: input.request.requestSource,
      receivedAt: receivedAt.toISOString(),
    },
    organization: {
      orgId: input.actor.orgId,
    },
    user: {
      userId: input.actor.userId,
      role: input.actor.role,
    },
    permissions: {
      role: input.actor.role,
      permissions: [...input.actor.permissions],
    },
    selectedScope,
    budget: { ...ATHENA_A1_CONTEXT_BUDGET },
    telemetry: {
      traceId: input.traceId,
      executionId: input.executionId,
    },
  };

  if (input.request.conversationId) {
    context.conversation = { conversationId: input.request.conversationId };
  }

  return context;
}
