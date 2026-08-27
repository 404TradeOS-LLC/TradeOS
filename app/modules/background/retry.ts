import { randomUUID } from "node:crypto";

export const BACKGROUND_RETRY_MAX_ATTEMPTS = 5;
export const BACKGROUND_RETRY_BASE_DELAY_MS = 1_000;

export interface BackgroundAttemptContext {
  orgId: string;
  jobName: string;
  workerId: string;
  correlationId: string;
  attempt: number;
}

export interface BackgroundFailure {
  code: string;
  retryable: boolean;
  attempt: number;
  correlationId: string;
  nextAttemptAt: string | null;
}

export type BackgroundAttemptOutcome<T> =
  | { status: "succeeded"; value: T; context: BackgroundAttemptContext }
  | { status: "retryable_failure" | "terminal_failure"; failure: BackgroundFailure; context: BackgroundAttemptContext };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeCode(error: unknown): string {
  if (error instanceof Error && /active organization membership/i.test(error.message)) return "background_identity_invalid";
  if (isRecord(error) && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) return "background_job_rejected";
  const candidate = isRecord(error) && typeof error.code === "string" ? error.code : "background_job_failed";
  return /^[a-z0-9][a-z0-9:_-]{1,63}$/i.test(candidate) ? candidate : "background_job_failed";
}

function isRetryable(error: unknown): boolean {
  if (isRecord(error) && typeof error.retryable === "boolean") return error.retryable;
  if (error instanceof Error && /active organization membership/i.test(error.message)) return false;
  const statusCode = isRecord(error) && typeof error.statusCode === "number" ? error.statusCode : undefined;
  return statusCode === undefined || statusCode < 400 || statusCode >= 500;
}

export function classifyBackgroundFailure(error: unknown, context: BackgroundAttemptContext, now = new Date()): BackgroundFailure {
  const retryable = isRetryable(error) && context.attempt < BACKGROUND_RETRY_MAX_ATTEMPTS;
  const nextAttemptAt = retryable
    ? new Date(now.getTime() + BACKGROUND_RETRY_BASE_DELAY_MS * 2 ** context.attempt).toISOString()
    : null;
  return {
    code: safeCode(error),
    retryable,
    attempt: context.attempt,
    correlationId: context.correlationId,
    nextAttemptAt,
  };
}

export async function executeBackgroundAttempt<T>(input: Omit<BackgroundAttemptContext, "correlationId" | "attempt"> & Partial<Pick<BackgroundAttemptContext, "correlationId" | "attempt">>, operation: (context: BackgroundAttemptContext) => Promise<T>, now = new Date()): Promise<BackgroundAttemptOutcome<T>> {
  const context: BackgroundAttemptContext = {
    orgId: input.orgId,
    jobName: input.jobName,
    workerId: input.workerId,
    correlationId: input.correlationId ?? randomUUID(),
    attempt: input.attempt ?? 1,
  };

  try {
    return { status: "succeeded", value: await operation(context), context };
  } catch (error) {
    const failure = classifyBackgroundFailure(error, context, now);
    return { status: failure.retryable ? "retryable_failure" : "terminal_failure", failure, context };
  }
}
