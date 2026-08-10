import { evaluateAthenaPermission } from "../modules/athena-permissions/policy";
import type { AthenaCapabilityRequest } from "../modules/athena-permissions/types";
import type { JobsService } from "../modules/jobs/service";

type FakeJobsService = Pick<JobsService, "getById">;

function fakeJobsService(assignedJobIds: string[], onGetById?: () => void): FakeJobsService {
  return {
    async getById(_orgId, jobId) {
      onGetById?.();
      if (!assignedJobIds.includes(jobId)) {
        throw new Error("not found");
      }
      return { id: jobId } as never;
    },
  };
}

const readCapability: AthenaCapabilityRequest = { kind: "context_provider", id: "test.read", requiredPermissions: ["crm.read"] };
const dispatchManageCapability: AthenaCapabilityRequest = { kind: "context_provider", id: "test.dispatch-read", requiredPermissions: ["dispatch.manage"] };

describe("evaluateAthenaPermission - role/permission matrix", () => {
  it.each(["owner", "admin", "dispatcher", "technician"] as const)("allows %s a capability every canonical role holds (crm.read)", async (rawRole) => {
    const decision = await evaluateAthenaPermission({ rawRole, orgId: "org-1", userId: "user-1", request: readCapability });

    expect(decision.decision).toBe("allow");
    expect(decision.reasonCode).toBe("athena_permission_allowed");
    expect(decision.role).toBe(rawRole);
    expect(decision.permissions).toContain("crm.read");
    expect(decision.deniedFields).toEqual([]);
  });

  it.each(["owner", "admin", "dispatcher"] as const)("allows %s a capability technicians lack (dispatch.manage)", async (rawRole) => {
    const decision = await evaluateAthenaPermission({ rawRole, orgId: "org-1", userId: "user-1", request: dispatchManageCapability });

    expect(decision.decision).toBe("allow");
  });

  it("denies technician a capability requiring dispatch.manage, listing the missing permission", async () => {
    const decision = await evaluateAthenaPermission({ rawRole: "technician", orgId: "org-1", userId: "user-1", request: dispatchManageCapability });

    expect(decision.decision).toBe("deny");
    expect(decision.reasonCode).toBe("athena_permission_denied_missing_permission");
    expect(decision.deniedFields).toEqual(["dispatch.manage"]);
  });

  it("normalizes a legacy role (estimator) to its canonical mapping before evaluating", async () => {
    const decision = await evaluateAthenaPermission({ rawRole: "estimator", orgId: "org-1", userId: "user-1", request: dispatchManageCapability });

    // estimator normalizes to dispatcher (app/domain/contracts.ts), which holds dispatch.manage.
    expect(decision.role).toBe("dispatcher");
    expect(decision.decision).toBe("allow");
  });
});

describe("evaluateAthenaPermission - risk-based approval classification", () => {
  it.each(["owner", "admin", "dispatcher", "technician"] as const)("allows %s a low-risk tool it has permission for", async (rawRole) => {
    const request: AthenaCapabilityRequest = { kind: "tool", id: "tradeos.test.read-tool", requiredPermissions: ["crm.read"], risk: "low" };
    const decision = await evaluateAthenaPermission({ rawRole, orgId: "org-1", userId: "user-1", request });

    expect(decision.decision).toBe("allow");
  });

  it.each(["medium", "high"] as const)("requires approval for a %s-risk tool even when permissions are granted", async (risk) => {
    const request: AthenaCapabilityRequest = { kind: "tool", id: "tradeos.test.risky-tool", requiredPermissions: ["crm.read"], risk };
    const decision = await evaluateAthenaPermission({ rawRole: "owner", orgId: "org-1", userId: "user-1", request });

    expect(decision.decision).toBe("approval_required");
    expect(decision.reasonCode).toBe(`athena_permission_approval_required_risk_${risk}`);
  });

  it("denies before ever reaching risk classification when permissions are missing", async () => {
    const request: AthenaCapabilityRequest = { kind: "tool", id: "tradeos.test.risky-tool", requiredPermissions: ["dispatch.manage"], risk: "high" };
    const decision = await evaluateAthenaPermission({ rawRole: "technician", orgId: "org-1", userId: "user-1", request });

    expect(decision.decision).toBe("deny");
    expect(decision.reasonCode).toBe("athena_permission_denied_missing_permission");
  });

  it("ignores a declared risk tier for non-tool capability kinds (treated as low)", async () => {
    const request: AthenaCapabilityRequest = { kind: "context_provider", id: "test.read", requiredPermissions: ["crm.read"], risk: "high" };
    const decision = await evaluateAthenaPermission({ rawRole: "owner", orgId: "org-1", userId: "user-1", request });

    expect(decision.decision).toBe("allow");
  });
});

describe("evaluateAthenaPermission - job object-scope resolution", () => {
  it.each(["owner", "admin", "dispatcher"] as const)("grants %s org-wide 'member' access without calling JobsService.getById", async (rawRole) => {
    let called = false;
    const jobsService = fakeJobsService([], () => { called = true; });
    const request: AthenaCapabilityRequest = { kind: "context_provider", id: "test.dispatch-read", requiredPermissions: [], resourceRequest: { entityType: "job", entityId: "job-1" } };

    const decision = await evaluateAthenaPermission({ rawRole, orgId: "org-1", userId: "user-1", request, jobsService });

    expect(called).toBe(false);
    expect(decision.resourceScope).toEqual({ entityType: "job", entityId: "job-1", relationship: "member" });
    expect(decision.decision).toBe("allow");
  });

  it("grants a technician 'assignee' scope for a job JobsService confirms they can access", async () => {
    const jobsService = fakeJobsService(["job-1"]);
    const request: AthenaCapabilityRequest = { kind: "context_provider", id: "test.dispatch-read", requiredPermissions: [], resourceRequest: { entityType: "job", entityId: "job-1" } };

    const decision = await evaluateAthenaPermission({ rawRole: "technician", orgId: "org-1", userId: "user-1", request, jobsService });

    expect(decision.resourceScope).toEqual({ entityType: "job", entityId: "job-1", relationship: "assignee" });
    expect(decision.decision).toBe("allow");
  });

  it("denies a technician access to a job JobsService.getById rejects (out of scope/RLS-filtered)", async () => {
    const jobsService = fakeJobsService(["job-1"]);
    const request: AthenaCapabilityRequest = { kind: "context_provider", id: "test.dispatch-read", requiredPermissions: [], resourceRequest: { entityType: "job", entityId: "job-9" } };

    const decision = await evaluateAthenaPermission({ rawRole: "technician", orgId: "org-1", userId: "user-1", request, jobsService });

    expect(decision.resourceScope).toEqual({ entityType: "job", entityId: "job-9", relationship: "none" });
    expect(decision.decision).toBe("deny");
    expect(decision.reasonCode).toBe("athena_permission_object_scope_denied");
  });

  it("does not resolve object scope at all when the permission check already denied", async () => {
    let called = false;
    const jobsService = fakeJobsService(["job-1"], () => { called = true; });
    const request: AthenaCapabilityRequest = { kind: "context_provider", id: "test.dispatch-read", requiredPermissions: ["dispatch.manage"], resourceRequest: { entityType: "job", entityId: "job-1" } };

    const decision = await evaluateAthenaPermission({ rawRole: "technician", orgId: "org-1", userId: "user-1", request, jobsService });

    expect(called).toBe(false);
    expect(decision.decision).toBe("deny");
    expect(decision.resourceScope).toBeUndefined();
  });
});
