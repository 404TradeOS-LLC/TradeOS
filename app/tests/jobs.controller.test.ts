const create = jest.fn();
const list = jest.fn();
const schedule = jest.fn();
const archive = jest.fn();
const getDispatchSummary = jest.fn();

jest.mock("../modules/jobs/service", () => ({
  JobsService: jest.fn().mockImplementation(() => ({
    create,
    list,
    schedule,
    archive,
    getDispatchSummary,
    getById: jest.fn(),
    update: jest.fn(),
    reschedule: jest.fn(),
    dispatch: jest.fn(),
    startTravel: jest.fn(),
    arrive: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    reopen: jest.fn(),
    readyForInvoice: jest.fn(),
    listAssignments: jest.fn(),
    addAssignment: jest.fn(),
    updateAssignment: jest.fn(),
    removeAssignment: jest.fn(),
    acceptAssignment: jest.fn(),
    declineAssignment: jest.fn(),
  })),
}));

jest.mock("../db/client", () => ({
  prisma: {
    comment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { jobsController } from "../backend/controllers/jobs.controller";

describe("jobsController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps create request bodies into service input", async () => {
    create.mockResolvedValue({ id: "job-1" });
    const req = {
      body: {
        projectId: "10000000-0000-0000-0000-000000000001",
        customerId: "10000000-0000-0000-0000-000000000002",
        serviceAddressId: "10000000-0000-0000-0000-000000000003",
        title: "Job Title",
        description: "Description",
        jobType: "HVAC Service",
        priority: "high",
        scheduledStart: "2026-07-16T13:00:00.000Z",
        scheduledEnd: "2026-07-16T15:00:00.000Z",
      },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.create(req, res);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        actor: (req as any).auth,
        title: "Job Title",
        scheduledStart: expect.any(Date),
        scheduledEnd: expect.any(Date),
      })
    );
    expect((res as any).status).toHaveBeenCalledWith(201);
  });

  it("parses list filters for the jobs index", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: {
        status: "scheduled",
        technicianId: "10000000-0000-0000-0000-000000000003",
        scheduledFrom: "2026-07-16T00:00:00.000Z",
        scheduledTo: "2026-07-17T00:00:00.000Z",
        page: "2",
        pageSize: "10",
      },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.list(req, res);

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "scheduled",
        technicianId: "10000000-0000-0000-0000-000000000003",
        scheduledFrom: expect.any(Date),
        scheduledTo: expect.any(Date),
        page: 2,
        pageSize: 10,
      })
    );
  });

  it("parses unassigned=true strictly as the boolean true (only unassigned jobs)", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: { unassigned: "true" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.list(req, res);

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ unassigned: true }));
  });

  it("parses unassigned=false strictly as the boolean false (only assigned jobs), not truthy-coerced to true", async () => {
    // Regression guard: z.coerce.boolean() is `Boolean(value)`, so the
    // nonempty string "false" would otherwise coerce to `true` here,
    // silently flipping an "Assigned" filter request into "Unassigned".
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: { unassigned: "false" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.list(req, res);

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ unassigned: false }));
  });

  it("passes unassigned as undefined when the query param is omitted entirely", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: {},
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.list(req, res);

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ unassigned: undefined }));
  });

  it("rejects a malformed unassigned value instead of silently coercing it to a truthy filter", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: { unassigned: "yes" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await expect(jobsController.list(req, res)).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
  });

  it("parses needsAttention=true for the dispatcher workspace's default attention-only queue view", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: { needsAttention: "true" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.list(req, res);

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ needsAttention: true }));
  });

  it("rejects a malformed needsAttention value the same way it rejects a malformed unassigned value", async () => {
    list.mockResolvedValue({ items: [], page: 1, pageSize: 25, total: 0 });
    const req = {
      query: { needsAttention: "1" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await expect(jobsController.list(req, res)).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
  });

  it("returns the dispatch summary for the authenticated org, requiring no elevated role", async () => {
    const summary = {
      activeJobs: 3,
      unscheduledJobs: 1,
      scheduledToday: 2,
      overdueActionable: 1,
      needsAttention: 2,
      timezone: { source: "organization", value: "America/New_York" },
      todayRangeUtc: { start: "2026-07-28T04:00:00.000Z", end: "2026-07-29T04:00:00.000Z" },
      weekRangeUtc: { start: "2026-07-28T04:00:00.000Z", end: "2026-08-04T04:00:00.000Z" },
      generatedAt: "2026-07-28T12:00:00.000Z",
      scope: { source: "assigned_only", role: "technician" },
    };
    getDispatchSummary.mockResolvedValue(summary);
    const auth = {
      // technician is the lowest-privilege canonical role in this app — this
      // proves the endpoint doesn't gate on an elevated role, just auth.
      userId: "tech-1",
      orgId: "org-1",
      role: "technician",
    };
    const req = {
      orgId: "org-1",
      auth,
    } as any;
    const res = responseDouble();

    await jobsController.dispatchSummary(req, res);

    // The controller passes the full auth context through so the service
    // can label whether these counts are org-wide or narrowed to the
    // caller's own assigned jobs (see DispatchSummaryDTO.scope) — it does
    // not use it to gate access, per the comment above.
    expect(getDispatchSummary).toHaveBeenCalledWith("org-1", auth);
    expect(res.json).toHaveBeenCalledWith(summary);
  });

  it("converts scheduling payloads into Dates", async () => {
    schedule.mockResolvedValue({ id: "job-1", status: "scheduled" });
    const req = {
      params: { jobId: "job-1" },
      body: {
        scheduledStart: "2026-07-16T13:00:00.000Z",
        scheduledEnd: "2026-07-16T15:00:00.000Z",
        overrideConflict: true,
        overrideReason: "Owner approved",
      },
      orgId: "org-1",
      auth: { userId: "owner-1", orgId: "org-1", role: "owner" },
    } as any;
    const res = responseDouble();

    await jobsController.schedule(req, res);

    expect(schedule).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        scheduledStart: expect.any(Date),
        scheduledEnd: expect.any(Date),
        overrideConflict: true,
        overrideReason: "Owner approved",
      })
    );
  });

  it("returns 204 after soft-archiving a job", async () => {
    archive.mockResolvedValue(undefined);
    const req = {
      params: { jobId: "job-1" },
      orgId: "org-1",
      auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    } as any;
    const res = responseDouble();

    await jobsController.remove(req, res);

    expect(archive).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({
        orgId: "org-1",
        actor: (req as any).auth,
      })
    );
    expect((res as any).status).toHaveBeenCalledWith(204);
    expect((res as any).send).toHaveBeenCalled();
  });
});

function responseDouble() {
  const res = {
    json: jest.fn(),
    send: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as any;
}
