// A6's injectable approval-verification seam (docs/athena/roadmap/
// A6-action-engine-implementation-plan.md "Approval enforcement"). No
// persistent approval record table exists yet anywhere in Athena - C005
// only carries an optional `approvalId` string on the action itself; C006/
// the 09-security "High-Risk Action Policy" section describe what a real
// approval record must eventually bind (approval actor, timestamp,
// expiration, risk class, tool/version, target entity, idempotency key, and
// an input hash) but no such table or contract is implemented anywhere in
// this repository yet. This is the smallest injectable seam that lets A6
// enforce "approval_required decisions never execute without a verified
// approval" today, with the exact binding fields 09-security already
// documents, while leaving real persistence to a later milestone.
//
// Production default is `createFailClosedAthenaApprovalVerifier()`: it
// verifies nothing and always reports every approval invalid. This is
// deliberate, not a placeholder bug - until a real approval store exists,
// "approval_required" must behave exactly like "no approval was ever
// granted," never like "allow." Tests inject
// createInMemoryAthenaApprovalStore() instead to exercise the valid-approval
// path deterministically.
export interface AthenaApprovalVerificationInput {
  approvalId: string;
  orgId: string;
  toolId: string;
  toolVersion: string;
  // Binds the approval to the exact action, not merely the exact tool - the
  // same idempotencyKey identifies "this one action" the way it does
  // elsewhere in C005, so an approval granted for one action can never be
  // replayed against an unrelated action for the same tool (09-security:
  // "A changed plan or changed target invalidates the approval").
  idempotencyKey: string;
}

export type AthenaApprovalVerificationResult = { valid: true } | { valid: false; reasonCode: "approval_not_found" | "approval_org_mismatch" | "approval_tool_mismatch" | "approval_action_mismatch" | "approval_expired" | "approval_not_granted" };

export interface AthenaApprovalVerifier {
  verify(input: AthenaApprovalVerificationInput): Promise<AthenaApprovalVerificationResult>;
}

export function createFailClosedAthenaApprovalVerifier(): AthenaApprovalVerifier {
  return {
    async verify() {
      return { valid: false, reasonCode: "approval_not_found" };
    },
  };
}

// Deterministic test/dev-only approval record, carrying exactly the binding
// fields 09-security documents that this seam can practically enforce
// without a real approval workflow (actor/timestamp capture, revocation,
// and a full input-hash comparison are left to the future persistent
// implementation - see the module comment above).
export interface AthenaApprovalRecord {
  approvalId: string;
  orgId: string;
  toolId: string;
  toolVersion: string;
  idempotencyKey: string;
  status: "granted" | "denied" | "expired" | "revoked";
}

export interface AthenaApprovalStore extends AthenaApprovalVerifier {
  grant(record: AthenaApprovalRecord): void;
}

export function createInMemoryAthenaApprovalStore(): AthenaApprovalStore {
  const records = new Map<string, AthenaApprovalRecord>();

  return {
    grant(record) {
      records.set(record.approvalId, record);
    },
    async verify(input) {
      const record = records.get(input.approvalId);
      if (!record) return { valid: false, reasonCode: "approval_not_found" };
      if (record.orgId !== input.orgId) return { valid: false, reasonCode: "approval_org_mismatch" };
      if (record.toolId !== input.toolId || record.toolVersion !== input.toolVersion) return { valid: false, reasonCode: "approval_tool_mismatch" };
      if (record.idempotencyKey !== input.idempotencyKey) return { valid: false, reasonCode: "approval_action_mismatch" };
      if (record.status === "expired") return { valid: false, reasonCode: "approval_expired" };
      if (record.status !== "granted") return { valid: false, reasonCode: "approval_not_granted" };
      return { valid: true };
    },
  };
}
