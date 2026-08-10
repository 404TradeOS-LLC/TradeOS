// A6's injectable approval-verification seam (docs/athena/roadmap/
// A6-action-engine-implementation-plan.md "Approval enforcement"). No
// persistent approval record table exists yet anywhere in Athena - C005
// only carries an optional `approvalId` string on the action itself; the
// 09-security "High-Risk Action Policy" section describes what a real
// approval record must eventually bind (approval actor, timestamp,
// expiration, risk class, tool/version, target entity, idempotency key, and
// a hash of the approved input) but no such table or contract is
// implemented anywhere in this repository yet. This is the smallest
// injectable seam that lets A6 enforce "approval_required decisions never
// execute without a verified approval bound to the exact action payload"
// today, with exactly the binding fields 09-security already documents,
// while leaving real persistence to a later milestone.
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
  // The actor executing THIS action, not necessarily the same person as the
  // approval's own actor/approver (see AthenaApprovalRecord's comment on
  // that distinction). Binding on this prevents an approval granted for one
  // requesting actor from authorizing a different actor's action.
  actorUserId: string;
  toolId: string;
  toolVersion: string;
  // The registered tool's own authoritative risk (never a caller-supplied
  // value) - an approval granted at one risk classification must not
  // silently cover an action now resolving to a different one.
  risk: "low" | "medium" | "high";
  // Binds the approval to the exact action, not merely the exact tool - the
  // same idempotencyKey identifies "this one action" the way it does
  // elsewhere in C005, so an approval granted for one action can never be
  // replayed against an unrelated action for the same tool (09-security:
  // "A changed plan or changed target invalidates the approval").
  idempotencyKey: string;
  // Deterministic hash of the already-validated tool input (inputHash.ts) -
  // the exact-payload binding 09-security requires. A caller cannot reuse a
  // valid approval/idempotency key pair against a different input.
  inputHash: string;
  // Mandatory, not "where cleanly available" - 09-security's own invariant
  // ("A changed plan invalidates the approval") means an approval that
  // never named a plan/step can never legitimately stand in for one that
  // does, and A6 always has both of these by the time it reaches approval
  // verification (see engine.ts's precondition check). There is no
  // "unscoped, valid for any plan/step" approval.
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
        | "approval_actor_mismatch"
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
// without a real approval workflow (revocation beyond a static `status`
// value, and a real approving-actor identity distinct from the requesting
// actor, are left to the future persistent implementation - see the module
// comment above). `actorUserId` here is the action's own requesting/
// executing actor (bound by verify()), not necessarily the person who
// clicked "approve" in some future approval UI - the docs/athena/09-security/
// README.md "High-Risk Action Policy" section's "approval actor" field is a
// distinct future concept this seam does not yet model; conflating the two
// would incorrectly let an approval scoped to one requester silently cover
// a different one, which is exactly the bug this repair closes.
export interface AthenaApprovalRecord {
  approvalId: string;
  orgId: string;
  actorUserId: string;
  toolId: string;
  toolVersion: string;
  risk: "low" | "medium" | "high";
  idempotencyKey: string;
  inputHash: string;
  // Mandatory (docs/athena/09-security/README.md: "A changed plan invalidates
  // the approval") - no "unscoped, valid for any plan/step" approval exists.
  planId: string;
  stepId: string;
  approvedAt: Date;
  expiresAt: Date;
  status: "granted" | "denied" | "revoked";
}

export interface AthenaApprovalStore extends AthenaApprovalVerifier {
  grant(record: AthenaApprovalRecord): void;
}

export interface AthenaApprovalStoreOptions {
  // Injectable clock so expiry can be tested deterministically without
  // fragile sleeps - defaults to the real system clock.
  now?: () => Date;
}

export function createInMemoryAthenaApprovalStore(options: AthenaApprovalStoreOptions = {}): AthenaApprovalStore {
  const now = options.now ?? (() => new Date());
  const records = new Map<string, AthenaApprovalRecord>();

  return {
    grant(record) {
      records.set(record.approvalId, record);
    },
    async verify(input) {
      const record = records.get(input.approvalId);
      if (!record) return { valid: false, reasonCode: "approval_not_found" };
      if (record.orgId !== input.orgId) return { valid: false, reasonCode: "approval_org_mismatch" };
      if (record.actorUserId !== input.actorUserId) return { valid: false, reasonCode: "approval_actor_mismatch" };
      if (record.toolId !== input.toolId || record.toolVersion !== input.toolVersion) return { valid: false, reasonCode: "approval_tool_mismatch" };
      if (record.risk !== input.risk) return { valid: false, reasonCode: "approval_risk_mismatch" };
      if (record.idempotencyKey !== input.idempotencyKey) return { valid: false, reasonCode: "approval_action_mismatch" };
      if (record.inputHash !== input.inputHash) return { valid: false, reasonCode: "approval_input_mismatch" };
      // Unconditional - both fields are mandatory on both sides (see the
      // AthenaApprovalRecord/AthenaApprovalVerificationInput comments).
      // There is no "the record didn't specify one, so anything matches"
      // fallback: an approval never scoped to a plan/step cannot exist to
      // begin with, so any mismatch here is a real cross-plan/cross-step
      // replay attempt.
      if (record.planId !== input.planId) return { valid: false, reasonCode: "approval_plan_mismatch" };
      if (record.stepId !== input.stepId) return { valid: false, reasonCode: "approval_step_mismatch" };
      if (record.status !== "granted") return { valid: false, reasonCode: "approval_not_granted" };
      // Full timestamp window enforcement, independent of `status` - a
      // record whose status still says "granted" must still fail once
      // outside [approvedAt, expiresAt), never accepted merely because
      // nothing ever flipped its status field. A future-dated approvedAt
      // (e.g. a pre-staged approval that hasn't taken effect yet) is
      // rejected the same as an expired one, not silently treated as
      // already active.
      const nowMs = now().getTime();
      if (nowMs < record.approvedAt.getTime()) return { valid: false, reasonCode: "approval_not_yet_valid" };
      if (nowMs >= record.expiresAt.getTime()) return { valid: false, reasonCode: "approval_expired" };
      return { valid: true };
    },
  };
}
