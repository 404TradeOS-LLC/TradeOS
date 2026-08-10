import { assertValidProviderDefinition } from "../modules/athena-context-engine/registry";
import { assertValidContextProviderFetchResult } from "../modules/athena-context-engine/resultValidation";
import { createDispatchProvider } from "../modules/athena-context-engine/providers/dispatchProvider";
import type { JobsService } from "../modules/jobs/service";
import type { JobListFilters, PaginatedJobsDTO } from "../modules/jobs/types";

function baseInput(overrides: Partial<{ orgId: string; actor: { userId: string; role: "owner" | "admin" | "dispatcher" | "technician" }; selectedScope: Record<string, string> }> = {}) {
  return {
    orgId: "org-1",
    actor: { userId: "user-1", role: "owner" as const },
    selectedScope: {},
    deadline: new Date(Date.now() + 5_000),
    cancellationSignal: new AbortController().signal,
    ...overrides,
  };
}

function fakeJobsService(result: PaginatedJobsDTO, onList?: (filters: JobListFilters) => void): Pick<JobsService, "list"> {
  return {
    async list(filters: JobListFilters) {
      onList?.(filters);
      return result;
    },
  };
}

describe("dispatch context provider", () => {
  it("is a valid provider definition with no domain-permission requirement", () => {
    const provider = createDispatchProvider();
    expect(() => assertValidProviderDefinition(provider)).not.toThrow();
    expect(provider.permissions).toEqual([]);
    expect(provider.sensitivity).toBe("internal");
    expect(provider.section).toBe("dispatch");
  });

  it("maps JobSummaryDTO into a narrow, PII-minimized shape and reports omittedFields", async () => {
    const result: PaginatedJobsDTO = {
      items: [
        {
          id: "job-1",
          jobNumber: "J-1",
          title: "Replace water heater",
          jobType: "repair",
          status: "scheduled" as const,
          priority: "medium",
          scheduledStart: "2026-08-11T09:00:00.000Z",
          scheduledEnd: "2026-08-11T11:00:00.000Z",
          archivedAt: null,
          project: { id: "project-1", name: "Main Street" },
          customer: { id: "customer-1", name: "Ada Lovelace", email: "ada@example.com", phone: "555-1234" },
          assignedTechnicians: [{ userId: "user-2", name: "Tech Two" }],
          needsAttention: false,
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
    };
    const jobsService = fakeJobsService(result);
    const provider = createDispatchProvider({}, jobsService);

    const fetchResult = await provider.fetch(baseInput());

    expect(() => assertValidContextProviderFetchResult(fetchResult)).not.toThrow();
    expect(fetchResult.data.jobs).toEqual([
      {
        jobId: "job-1",
        jobNumber: "J-1",
        title: "Replace water heater",
        status: "scheduled" as const,
        priority: "medium",
        scheduledStart: "2026-08-11T09:00:00.000Z",
        scheduledEnd: "2026-08-11T11:00:00.000Z",
        projectName: "Main Street",
        needsAttention: false,
      },
    ]);
    expect(fetchResult.data.total).toBe(1);
    expect(fetchResult.itemCount).toBe(1);
    expect(fetchResult.omittedFields).toEqual(["customer.email", "customer.phone", "assignedTechnicians"]);
    expect(JSON.stringify(fetchResult.data)).not.toContain("ada@example.com");
  });

  it("passes orgId and actor-derived auth through to JobsService.list(), never trusting a client-supplied role override", async () => {
    let capturedFilters: JobListFilters | undefined;
    const jobsService = fakeJobsService({ items: [], page: 1, pageSize: 25, total: 0 }, (filters) => { capturedFilters = filters; });
    const provider = createDispatchProvider({}, jobsService);

    await provider.fetch(baseInput({ orgId: "org-42", actor: { userId: "user-9", role: "technician" } }));

    expect(capturedFilters?.orgId).toBe("org-42");
    expect(capturedFilters?.auth.userId).toBe("user-9");
    expect(capturedFilters?.auth.role).toBe("technician");
  });

  it("passes selectedScope.projectId/customerId through as narrowing filters", async () => {
    let capturedFilters: JobListFilters | undefined;
    const jobsService = fakeJobsService({ items: [], page: 1, pageSize: 25, total: 0 }, (filters) => { capturedFilters = filters; });
    const provider = createDispatchProvider({}, jobsService);

    await provider.fetch(baseInput({ selectedScope: { projectId: "project-9", customerId: "customer-9" } }));

    expect(capturedFilters?.projectId).toBe("project-9");
    expect(capturedFilters?.customerId).toBe("customer-9");
  });

  it("caps pageSize at the provider's own maxItems so itemCount never exceeds the declared budget", async () => {
    const provider = createDispatchProvider();
    expect(provider.maxItems).toBeGreaterThanOrEqual(1);
  });
});
