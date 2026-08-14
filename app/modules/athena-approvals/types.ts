export const athenaApprovalStatuses = ["pending", "granted", "denied", "revoked", "expired"] as const;
export type AthenaApprovalStatus = (typeof athenaApprovalStatuses)[number];

export interface AthenaApprovalVerificationInput {
  approvalId: string;
  orgId: string;
  userId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "low" | "medium" | "high";
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
}

export type AthenaApprovalVerificationResult =
  | { valid: true }
  | {
      valid: false;
      reasonCode:
        | "approval_not_found"
        | "approval_org_mismatch"
        | "approval_user_mismatch"
        | "approval_tool_mismatch"
        | "approval_risk_mismatch"
        | "approval_action_mismatch"
        | "approval_input_mismatch"
        | "approval_plan_mismatch"
        | "approval_step_mismatch"
        | "approval_not_yet_valid"
        | "approval_expired"
        | "approval_not_granted";
    };

export interface AthenaApprovalRecord {
  approvalId: string;
  userId: string;
  organizationId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "low" | "medium" | "high";
  approvedAt: Date;
  approvedBy: string;
  expiration: Date;
  status: AthenaApprovalStatus;
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadata: Record<string, unknown>;
}

export interface AthenaApprovalCreateInput {
  approvalId: string;
  userId: string;
  organizationId: string;
  actionId: string;
  toolId: string;
  toolVersion: string;
  riskLevel: "low" | "medium" | "high";
  approvedBy?: string;
  approvedAt?: Date;
  expiration: Date;
  status?: AthenaApprovalStatus;
  idempotencyKey: string;
  inputHash: string;
  planId: string;
  stepId: string;
  metadata?: Record<string, unknown>;
}

export interface AthenaApprovalListQuery {
  organizationId: string;
  status?: AthenaApprovalStatus;
  userId?: string;
  limit: number;
}

export interface AthenaApprovalVerifier {
  verify(input: AthenaApprovalVerificationInput): Promise<AthenaApprovalVerificationResult>;
}

export interface AthenaApprovalStore extends AthenaApprovalVerifier {
  create(input: AthenaApprovalCreateInput): Promise<AthenaApprovalRecord>;
  upsertPending(input: AthenaApprovalCreateInput): Promise<AthenaApprovalRecord>;
  list(query: AthenaApprovalListQuery): Promise<AthenaApprovalRecord[]>;
  getById(approvalId: string): Promise<AthenaApprovalRecord | null>;
  grant(approvalId: string, approvedBy?: string, approvedAt?: Date): Promise<AthenaApprovalRecord>;
  deny(approvalId: string, approvedBy: string, approvedAt?: Date): Promise<AthenaApprovalRecord>;
  reviewPending(
    organizationId: string,
    approvalId: string,
    decision: "grant" | "deny",
    approvedBy: string,
    reviewedAt?: Date
  ): Promise<AthenaApprovalRecord | null>;
  revoke(approvalId: string): Promise<AthenaApprovalRecord>;
  expire(approvalId: string, expiredAt?: Date): Promise<AthenaApprovalRecord>;
}
