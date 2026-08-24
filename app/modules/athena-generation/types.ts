export type AthenaGenerationStatus = "succeeded" | "failed" | "cancelled" | "expired" | "denied";
export type AthenaGenerationReviewOutcome = "accepted" | "rejected" | "amended";

export interface AthenaGenerationRecord {
  id: string;
  orgId: string;
  actorUserId: string;
  executionId?: string;
  requestId: string;
  traceId: string;
  provider: string;
  model: string;
  providerVersion?: string;
  status: AthenaGenerationStatus;
  failureCode?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedUsd?: number;
  latencyMs: number;
  toolNames: string[];
  provenance: Record<string, unknown>;
  retentionExpiresAt: string;
  createdAt: string;
  completedAt?: string;
}

export interface AthenaGenerationReviewRecord {
  id: string;
  orgId: string;
  generationId: string;
  reviewerUserId: string;
  outcome: AthenaGenerationReviewOutcome;
  provenance: Record<string, unknown>;
  reviewedAt: string;
  createdAt: string;
}
