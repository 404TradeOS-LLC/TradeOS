import type { AthenaApprovalVerifier } from "../athena-approvals/types";

export type {
  AthenaApprovalCreateInput,
  AthenaApprovalRecord,
  AthenaApprovalStatus,
  AthenaApprovalStore,
  AthenaApprovalVerifier,
  AthenaApprovalVerificationInput,
  AthenaApprovalVerificationResult,
} from "../athena-approvals/types";
export { createInMemoryAthenaApprovalStore, createPrismaAthenaApprovalStore } from "../athena-approvals/store";

export function createFailClosedAthenaApprovalVerifier(): AthenaApprovalVerifier {
  return {
    async verify() {
      return { valid: false, reasonCode: "approval_not_found" };
    },
  };
}
