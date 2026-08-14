import type { AthenaAuditReader } from "../modules/athena-audit/types";
import { AthenaApprovalService } from "../modules/athena-approvals/service";
import { createInMemoryAthenaApprovalStore } from "../modules/athena-approvals/store";
import type { AthenaApprovalCreateInput } from "../modules/athena-approvals/types";

const NOW = new Date("2026-08-14T15:00:00.000Z");
const ORG_ID = "org-1";

function buildApproval(overrides: Partial<AthenaApprovalCreateInput> = {}): AthenaApprovalCreateInput {
  return {
    approvalId: "approval-1",
    userId: "requester-1",
    organizationId: ORG_ID,
    actionId: "action-1",
    toolId: "estimator.create",
    toolVersion: "1.0.0",
    riskLevel: "medium",
    expiration: new Date("2026-08-14T14:59:00.000Z"),
    status: "pending",
    idempotencyKey: "action-1:approval:v1",
    inputHash: "hash-1",
    planId: "plan-1",
    stepId: "step-1",
    ...overrides,
  };
}

const auditReader: AthenaAuditReader = {
  async listForApproval() {
    return [];
  },
};

describe("Athena approval expiry lifecycle", () => {
  it("persists overdue pending approvals as expired before list filtering without crossing organization or terminal-state boundaries", async () => {
    const store = createInMemoryAthenaApprovalStore({ now: () => NOW });
    const service = new AthenaApprovalService(store, auditReader);

    await store.create(buildApproval());
    await store.create(
      buildApproval({
        approvalId: "approval-future",
        actionId: "action-future",
        idempotencyKey: "action-future:approval:v1",
        expiration: new Date("2026-08-14T15:05:00.000Z"),
      })
    );
    await store.create(
      buildApproval({
        approvalId: "approval-other-org",
        organizationId: "org-2",
        actionId: "action-other-org",
        idempotencyKey: "action-other-org:approval:v1",
      })
    );
    await store.create(
      buildApproval({
        approvalId: "approval-denied",
        actionId: "action-denied",
        idempotencyKey: "action-denied:approval:v1",
        status: "denied",
      })
    );

    const pending = await service.list({ organizationId: ORG_ID, status: "pending" });
    const expired = await service.list({ organizationId: ORG_ID, status: "expired" });

    expect(pending.map((record) => record.approvalId)).toEqual(["approval-future"]);
    expect(expired.map((record) => record.approvalId)).toEqual(["approval-1"]);
    expect((await store.getById("approval-1"))?.status).toBe("expired");
    expect((await store.getById("approval-other-org"))?.status).toBe("pending");
    expect((await store.getById("approval-denied"))?.status).toBe("denied");
  });

  it("returns expired lifecycle state from detail reads even when no list request ran first", async () => {
    const store = createInMemoryAthenaApprovalStore({ now: () => NOW });
    const service = new AthenaApprovalService(store, auditReader);
    await store.create(buildApproval());

    const detail = await service.getDetail(ORG_ID, "approval-1");

    expect(detail?.approval.status).toBe("expired");
    expect((await store.getById("approval-1"))?.status).toBe("expired");
  });

  it("expires a pending approval at the exact expiry cutoff", async () => {
    const store = createInMemoryAthenaApprovalStore({ now: () => NOW });
    const service = new AthenaApprovalService(store, auditReader);
    await store.create(buildApproval({ expiration: new Date(NOW) }));

    const detail = await service.getDetail(ORG_ID, "approval-1");

    expect(detail?.approval.status).toBe("expired");
    expect((await store.getById("approval-1"))?.status).toBe("expired");
  });
});
