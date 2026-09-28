import { ClientApiError } from "@/lib/clientApi";

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

const ATHENA_KERNEL_STATES = new Set<AthenaKernelState>([
  "created",
  "context_building",
  "routing",
  "planning",
  "policy_check",
  "awaiting_approval",
  "executing",
  "degraded",
  "needs_clarification",
  "partially_succeeded",
  "succeeded",
  "failed",
  "denied",
  "expired",
  "cancelled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAthenaKernelResult(value: unknown): value is AthenaKernelResult {
  if (!isRecord(value)) return false;
  if (typeof value.success !== "boolean") return false;
  if (typeof value.executionId !== "string" || typeof value.traceId !== "string") return false;
  if (typeof value.state !== "string" || !ATHENA_KERNEL_STATES.has(value.state as AthenaKernelState)) return false;
  if (typeof value.summary !== "string") return false;
  if (value.message !== null && typeof value.message !== "string") return false;
  if (!Array.isArray(value.warnings) || !Array.isArray(value.followUps)) return false;
  if (!isRecord(value.telemetry)) return false;
  if (typeof value.telemetry.traceId !== "string" || typeof value.telemetry.executionId !== "string") return false;
  return true;
}

function getProxyErrorMessage(body: unknown): string {
  if (isRecord(body) && typeof body.error === "string") return body.error;
  return "Request failed";
}

export async function sendAthenaMessage(input: AthenaChatInput): Promise<AthenaKernelResult> {
  const response = await fetch("/api/proxy/athena/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  const text = await response.text();
  let body: unknown = undefined;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ClientApiError(response.ok ? "Invalid Athena response" : "Request failed", response.status);
    }
  }

  // Athena intentionally returns its full result envelope for terminal
  // non-2xx states such as denied, failed, expired, provider failure, and
  // conflict. Preserve that typed result so the workspace can render the
  // safe summary, warnings, follow-ups, and trace references.
  if (isAthenaKernelResult(body)) return body;

  if (!response.ok) {
    throw new ClientApiError(getProxyErrorMessage(body), response.status);
  }

  throw new ClientApiError("Invalid Athena response", response.status);
}

export function isAthenaRetryableClientError(error: unknown): boolean {
  // A thrown non-ClientApiError is typically a transport/runtime failure where
  // the server outcome is ambiguous. Preserve the idempotency key for a retry.
  if (!(error instanceof ClientApiError)) return true;

  // Deterministic client/auth/configuration outcomes require a changed input,
  // session, or deployment state. Retry only timeouts/rate limits/server faults.
  return error.status === 408 || error.status === 429 || error.status >= 500;
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
