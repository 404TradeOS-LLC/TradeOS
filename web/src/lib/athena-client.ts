import { ClientApiError, clientFetch } from "@/lib/clientApi";

export type AthenaKernelState =
  | "created"
  | "context_building"
  | "routing"
  | "planning"
  | "policy_check"
  | "awaiting_approval"
  | "executing"
  | "degraded"
  | "needs_clarification"
  | "partially_succeeded"
  | "succeeded"
  | "failed"
  | "denied"
  | "expired"
  | "cancelled";

export interface AthenaSelectedScope {
  customerId?: string;
  projectId?: string;
  jobId?: string;
  estimateId?: string;
  invoiceId?: string;
  page?: string;
}

export interface AthenaWarning {
  code: string;
  message: string;
}

export interface AthenaFollowUp {
  kind: "question" | "action";
  label: string;
}

export interface AthenaKernelResult {
  success: boolean;
  executionId: string;
  traceId: string;
  state: AthenaKernelState;
  summary: string;
  message: string | null;
  warnings: AthenaWarning[];
  followUps: AthenaFollowUp[];
  telemetry: {
    traceId: string;
    executionId: string;
  };
  error?: {
    code: string;
    category: "validation" | "authorization" | "conflict" | "timeout" | "provider" | "service" | "unknown";
    retryable: boolean;
    safeSummary: string;
    correlationId: string;
  };
}

export interface AthenaChatInput {
  message: string;
  conversationId?: string;
  selectedScope?: AthenaSelectedScope;
  channel?: "text" | "mobile";
  viewportClass?: "compact" | "regular";
  idempotencyKey?: string;
}

export async function sendAthenaMessage(input: AthenaChatInput): Promise<AthenaKernelResult> {
  return clientFetch<AthenaKernelResult>("/api/v1/athena/chat", {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      conversationId: input.conversationId,
      selectedScope: input.selectedScope,
      interaction: {
        channel: input.channel ?? "text",
        platform: "web",
        viewportClass: input.viewportClass ?? "regular",
        connectivity: "online",
      },
      idempotencyKey: input.idempotencyKey,
    }),
  });
}

export function describeAthenaClientError(error: unknown): string {
  if (error instanceof ClientApiError) {
    if (error.status === 404) return "Athena is not enabled in this environment yet.";
    if (error.status === 403) return "Athena could not perform that request with your current access.";
    if (error.status === 409) return "Athena found a conflict and did not apply the requested change.";
    if (error.status === 504) return "Athena timed out before the request could complete.";
    return error.message || "Athena could not complete that request.";
  }
  return error instanceof Error ? error.message : "Athena could not complete that request.";
}
