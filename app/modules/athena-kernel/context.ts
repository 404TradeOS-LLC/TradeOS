import { ATHENA_CONTEXT_BUDGET } from "../athena-context-engine/budget";
import { AthenaActorContext, AthenaAIContext, AthenaKernelRequest, AthenaSelectedScope } from "./types";

export interface BuildMinimalContextInput {
  requestId: string;
  traceId: string;
  executionId: string;
  actor: AthenaActorContext;
  request: AthenaKernelRequest;
  receivedAt?: Date;
}

export function buildMinimalAthenaContext(input: BuildMinimalContextInput): AthenaAIContext {
  const receivedAt = input.receivedAt ?? new Date();
  const selectedScope: AthenaSelectedScope = input.request.selectedScope ?? {};
  const interaction = input.request.interaction
    ? {
        channel: input.request.interaction.channel,
        ...(input.request.interaction.platform ? { platform: input.request.interaction.platform } : {}),
        ...(input.request.interaction.viewportClass ? { viewportClass: input.request.interaction.viewportClass } : {}),
        ...(input.request.interaction.connectivity ? { connectivity: input.request.interaction.connectivity } : {}),
      }
    : undefined;

  const context: AthenaAIContext = {
    version: "1.0.0",
    request: {
      requestId: input.requestId,
      traceId: input.traceId,
      executionId: input.executionId,
      requestSource: input.request.requestSource,
      receivedAt: receivedAt.toISOString(),
      ...(interaction ? { interaction } : {}),
    },
    organization: { orgId: input.actor.orgId },
    user: { userId: input.actor.userId, role: input.actor.role },
    permissions: { role: input.actor.role, permissions: [...input.actor.permissions] },
    selectedScope,
    budget: { ...ATHENA_CONTEXT_BUDGET },
    telemetry: { traceId: input.traceId, executionId: input.executionId },
  };

  if (input.request.conversationId) context.conversation = { conversationId: input.request.conversationId };
  return context;
}
