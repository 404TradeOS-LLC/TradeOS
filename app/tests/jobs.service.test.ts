const runInDatabaseTransaction = jest.fn((_client, operation: (tx: unknown) => unknown) => operation(mockDb));

jest.mock("../db/requestSession", () => ({
  getRequestDatabaseClient: jest.fn(),
  runInDatabaseTransaction,
}));

jest.mock("../modules/intelligence/service", () => ({
  ActivityTimelineService: jest.fn().mockImplementation(() => ({
    list: jest.fn().mockResolvedValue([]),
  })),
}));

const mockDb = {
  job: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
  },
  serviceAddress: {
    findFirst: jest.fn(),
  },
  organizationMembership: {
    findMany: jest.fn(),
  },
  jobAssignment: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  jobEquipment: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  activityEvent: {
    create: jest.fn(),
  },
  comment: {
    findMany: jest.fn(),
  },
  organizationSettings: {
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

import { JobsService } from "../modules/jobs/service";

const scheduledJob = {
  id: "job-1",
  orgId: "org-1",
  projectId: "project-1",
  customerId: "customer-1",
  serviceAddressId: "address-1",
  jobNumber: "JOB-2026-000001",
  title: "AC tune-up",
  description: "Seasonal maintenance",
  jobType: "HVAC Service",
  status: "scheduled",
  priority: "high",
  scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
  scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
  arrivalWindowStart: null,
  arrivalWindowEnd: null,
  estimatedDurationMinutes: 120,
  actualStart: null,
  actualEnd: null,
  completedAt: null,
  completedById: null,
  readyForInvoiceAt: null,
  createdById: "dispatcher-1",
  createdAt: new Date("2026-07-14T12:00:00.000Z"),
  updatedAt: new Date("2026-07-14T12:00:00.000Z"),
  archivedAt: null,
  project: { id: "project-1", name: "Project One", status: "active" },
  customer: { id: "customer-1", name: "Customer One", email: "customer@example.com", phone: "555-0100" },
  serviceAddress: {
    id: "address-1",
    label: "Primary",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Indianapolis",
    state: "IN",
    postalCode: "46201",
    country: "US",
  },
  assignments: [],
  equipmentLinks: [],
  tasks: [],
  siteVisits: [],
};

describe("JobsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockDb.project.findFirst.mockResolvedValue({
      id: "project-1",
      orgId: "org-1",
      customerId: "customer-1",
      name: "Project One",
      status: "active",
    });
    mockDb.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      orgId: "org-1",
      name: "Customer One",
      email: "customer@example.com",
      phone: "555-0100",
      deletedAt: null,
    });
    mockDb.serviceAddress.findFirst.mockResolvedValue({
      id: "address-1",
      orgId: "org-1",
      customerId: "customer-1",
      label: "Primary",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Indianapolis",
      state: "IN",
      postalCode: "46201",
      country: "US",
      deletedAt: null,
    });
    mockDb.organizationMembership.findMany.mockResolvedValue([
      {
        orgId: "org-1",
        userId: "tech-1",
        role: "technician",
        status: "active",
        user: { id: "tech-1", email: "tech@example.com", fullName: "Tech One", isActive: true },
      },
    ]);
    mockDb.jobAssignment.findMany.mockResolvedValue([]);
    mockDb.job.count.mockResolvedValue(0);
    mockDb.job.create.mockResolvedValue(scheduledJob);
    mockDb.job.findFirst.mockResolvedValue(scheduledJob);
    mockDb.job.findMany.mockResolvedValue([]);
    mockDb.comment.findMany.mockResolvedValue([]);
    mockDb.organizationSettings.findUnique.mockResolvedValue(null);
  });

  it("rejects non-technician organization members in technicianIds during job creation", async () => {
    mockDb.organizationMembership.findMany.mockResolvedValue([
      {
        orgId: "org-1",
        userId: "dispatcher-1",
        role: "dispatcher",
        status: "active",
        user: { id: "dispatcher-1", email: "dispatcher@example.com", fullName: "Dispatcher", isActive: true },
      },
    ]);
    const service = new JobsService(mockDb as never);

    await expect(
      service.create({
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        projectId: "project-1",
        customerId: "customer-1",
        serviceAddressId: "address-1",
        title: "Invalid assignment",
        jobType: "HVAC Service",
        technicianIds: ["dispatcher-1"],
      })
    ).rejects.toThrow("Assigned technicians must be active users in the same organization");
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("creates a scheduled job and seeds technician assignments", async () => {
    const service = new JobsService(mockDb as never);

    const job = await service.create({
      orgId: "org-1",
      actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      projectId: "project-1",
      customerId: "customer-1",
      serviceAddressId: "address-1",
      title: "AC tune-up",
      description: "Seasonal maintenance",
      jobType: "HVAC Service",
      priority: "high",
      scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
      scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
      estimatedDurationMinutes: 120,
      technicianIds: ["tech-1"],
    });

    expect(job.status).toBe("scheduled");
    expect(mockDb.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobNumber: "JOB-2026-000001",
          status: "scheduled",
          priority: "high",
        }),
      })
    );
    expect(mockDb.jobAssignment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: "tech-1",
            assignmentRole: "lead",
            isLead: true,
          }),
        ],
      })
    );
  });

  it("uses half-open interval bounds for technician conflicts", async () => {
    const service = new JobsService(mockDb as never);

    await service.create({
      orgId: "org-1",
      actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      projectId: "project-1",
      customerId: "customer-1",
      serviceAddressId: "address-1",
      title: "Boundary job",
      jobType: "HVAC Service",
      scheduledStart: new Date("2026-07-16T15:00:00.000Z"),
      scheduledEnd: new Date("2026-07-16T16:00:00.000Z"),
      technicianIds: ["tech-1"],
    });

    const conflictQuery = mockDb.jobAssignment.findMany.mock.calls
      .map(([query]) => query)
      .find((query) => query?.where?.job?.scheduledStart);
    expect(conflictQuery).toBeDefined();
    expect(conflictQuery.where.job.scheduledStart).toEqual({ lt: new Date("2026-07-16T16:00:00.000Z") });
    expect(conflictQuery.where.job.scheduledEnd).toEqual({ gt: new Date("2026-07-16T15:00:00.000Z") });
  });

  it("rejects invalid direct-service schedule dates before persistence", async () => {
    const service = new JobsService(mockDb as never);

    await expect(
      service.create({
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        projectId: "project-1",
        customerId: "customer-1",
        serviceAddressId: "address-1",
        title: "Invalid date",
        jobType: "HVAC Service",
        scheduledStart: new Date("invalid"),
        scheduledEnd: new Date("2026-07-16T16:00:00.000Z"),
        technicianIds: ["tech-1"],
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "scheduledStart must be a valid date" });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("rejects fractional direct-service durations before persistence", async () => {
    const service = new JobsService(mockDb as never);

    await expect(
      service.create({
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        projectId: "project-1",
        customerId: "customer-1",
        serviceAddressId: "address-1",
        title: "Fractional duration",
        jobType: "HVAC Service",
        estimatedDurationMinutes: 30.5,
        technicianIds: ["tech-1"],
      })
    ).rejects.toMatchObject({ statusCode: 400, message: "estimatedDurationMinutes must be a positive integer" });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("blocks dispatcher conflict overrides without owner/admin permission", async () => {
    mockDb.jobAssignment.findMany.mockResolvedValue([
      {
        userId: "tech-1",
        user: { fullName: "Tech One" },
        jobId: "job-99",
        job: {
          jobNumber: "JOB-2026-000099",
          title: "Conflicting Job",
          scheduledStart: new Date("2026-07-16T13:30:00.000Z"),
          scheduledEnd: new Date("2026-07-16T14:30:00.000Z"),
        },
      },
    ]);
    const service = new JobsService(mockDb as never);

    await expect(
      service.create({
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        projectId: "project-1",
        customerId: "customer-1",
        serviceAddressId: "address-1",
        title: "Conflicting dispatch",
        jobType: "HVAC Service",
        scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
        scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
        technicianIds: ["tech-1"],
        overrideConflict: true,
        overrideReason: "Force it through",
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Only owners and admins can override schedule conflicts",
    });
  });

  it("rejects assignment of non-technician memberships", async () => {
    mockDb.job.findFirst.mockResolvedValue({ ...scheduledJob, description: "", priority: "medium" });
    mockDb.organizationMembership.findMany.mockResolvedValue([
      {
        orgId: "org-1",
        userId: "dispatcher-2",
        role: "dispatcher",
        status: "active",
        user: { id: "dispatcher-2", email: "dispatcher2@example.com", fullName: "Dispatch Two", isActive: true },
      },
    ]);

    const service = new JobsService(mockDb as never);

    await expect(
      service.addAssignment("job-1", {
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        userId: "dispatcher-2",
        assignmentRole: "technician",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "User dispatcher-2 is not an active technician",
    });
  });

  it("reactivates a declined assignment instead of violating the active-assignment index", async () => {
    const declinedAssignment = {
      id: "assignment-1",
      orgId: "org-1",
      jobId: "job-1",
      userId: "tech-1",
      assignmentRole: "technician",
      isLead: false,
      assignedAt: new Date("2026-07-15T12:00:00.000Z"),
      assignedById: "dispatcher-old",
      acceptedAt: null,
      declinedAt: new Date("2026-07-15T13:00:00.000Z"),
      removedAt: null,
      createdAt: new Date("2026-07-15T12:00:00.000Z"),
      updatedAt: new Date("2026-07-15T13:00:00.000Z"),
      user: { id: "tech-1", fullName: "Tech One", email: "tech@example.com" },
    };
    const reactivatedAssignment = { ...declinedAssignment, declinedAt: null, assignedById: "dispatcher-1" };
    mockDb.jobAssignment.findFirst.mockResolvedValue(declinedAssignment);
    mockDb.jobAssignment.update.mockResolvedValue(reactivatedAssignment);

    const service = new JobsService(mockDb as never);
    const result = await service.addAssignment("job-1", {
      orgId: "org-1",
      actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      userId: "tech-1",
      assignmentRole: "technician",
    });

    expect(result).toMatchObject({ id: "assignment-1", userId: "tech-1", declinedAt: null });
    expect(mockDb.jobAssignment.create).not.toHaveBeenCalled();
    expect(mockDb.jobAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "assignment-1" },
        data: expect.objectContaining({
          assignmentRole: "technician",
          assignedById: "dispatcher-1",
          acceptedAt: null,
          declinedAt: null,
          assignedAt: expect.any(Date),
        }),
      })
    );
  });

  it("lets an assigned technician complete an on-site job", async () => {
    mockDb.job.findFirst.mockResolvedValue({
      ...scheduledJob,
      description: "",
      priority: "medium",
      status: "on_site",
      actualStart: new Date("2026-07-16T13:10:00.000Z"),
    });
    mockDb.jobAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    mockDb.job.update.mockResolvedValue({
      ...scheduledJob,
      status: "completed",
      actualEnd: new Date("2026-07-16T15:05:00.000Z"),
      completedAt: new Date("2026-07-16T15:05:00.000Z"),
      completedById: "tech-1",
    });

    const service = new JobsService(mockDb as never);

    const job = await service.complete("job-1", {
      orgId: "org-1",
      actor: { userId: "tech-1", orgId: "org-1", role: "technician" },
    });

    expect(job.status).toBe("completed");
    expect(mockDb.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          completedById: "tech-1",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it.each(["traveling", "paused"] as const)("does not allow %s jobs to be completed before returning on site", async (status) => {
    mockDb.job.findFirst.mockResolvedValue({
      ...scheduledJob,
      description: "",
      priority: "medium",
      status,
    });
    const service = new JobsService(mockDb as never);

    await expect(
      service.complete("job-1", {
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: `Job job-1 cannot transition from ${status} to completed`,
    });
    expect(mockDb.job.update).not.toHaveBeenCalled();
  });

  it("requires an existing schedule when reopening a completed job to scheduled", async () => {
    mockDb.job.findFirst.mockResolvedValue({
      ...scheduledJob,
      description: "",
      priority: "medium",
      status: "completed",
      scheduledStart: null,
      scheduledEnd: null,
    });
    const service = new JobsService(mockDb as never);

    await expect(
      service.reopen("job-1", {
        orgId: "org-1",
        actor: { userId: "admin-1", orgId: "org-1", role: "admin" },
        status: "scheduled",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Job job-1 cannot reopen to scheduled without an existing schedule",
    });
    expect(mockDb.job.update).not.toHaveBeenCalled();
  });

  it("only allows completed jobs to be marked ready for invoice", async () => {
    mockDb.job.findFirst.mockResolvedValue({
      ...scheduledJob,
      description: "",
      priority: "medium",
      status: "on_site",
    });
    const service = new JobsService(mockDb as never);

    await expect(
      service.readyForInvoice("job-1", {
        orgId: "org-1",
        actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Job job-1 must be completed before it is ready for invoice",
    });
    expect(mockDb.job.update).not.toHaveBeenCalled();
  });

  it("treats repeated invoice-readiness acknowledgement as an idempotent read", async () => {
    const readyJob = {
      ...scheduledJob,
      status: "completed",
      completedAt: new Date("2026-07-16T15:00:00.000Z"),
      readyForInvoiceAt: new Date("2026-07-16T15:05:00.000Z"),
    };
    mockDb.job.findFirst.mockResolvedValue(readyJob);
    const service = new JobsService(mockDb as never);

    const result = await service.readyForInvoice("job-1", {
      orgId: "org-1",
      actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
    });

    expect(result.readyForInvoiceAt).toBe(readyJob.readyForInvoiceAt.toISOString());
    expect(mockDb.job.update).not.toHaveBeenCalled();
    expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
  });

  describe("list", () => {
    // buildJobWhere composes optional predicates as separate entries in a
    // shared `AND` array (rather than spreading each one directly onto the
    // where-object), since more than one of them can need the same
    // top-level key (`assignments` for technicianId/unassigned, `OR` for
    // search/needsAttention) and a single JS object can only hold one value
    // per key. These assertions check the AND array's contents accordingly.
    function andConditions(where: unknown): unknown[] {
      const and = (where as { AND?: unknown[] })?.AND;
      return Array.isArray(and) ? and : [];
    }

    it("builds an assignments.none where clause for the unassigned filter", async () => {
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        unassigned: true,
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      expect(findManyWhere.orgId).toBe("org-1");
      expect(andConditions(findManyWhere)).toContainEqual({ assignments: { none: { removedAt: null, declinedAt: null } } });

      const countWhere = mockDb.job.count.mock.calls[0][0].where;
      expect(andConditions(countWhere)).toContainEqual({ assignments: { none: { removedAt: null, declinedAt: null } } });
    });

    it("builds an assignments.some where clause for unassigned: false (assigned-only), not the same as omitted", async () => {
      // Regression guard: `filters.unassigned ? X : {}` would treat
      // `unassigned: false` identically to omitted (no filter at all,
      // returning every job) instead of actively filtering to only jobs
      // that currently have an active assignment.
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        unassigned: false,
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      expect(findManyWhere.orgId).toBe("org-1");
      expect(andConditions(findManyWhere)).toContainEqual({ assignments: { some: { removedAt: null, declinedAt: null } } });

      const countWhere = mockDb.job.count.mock.calls[0][0].where;
      expect(andConditions(countWhere)).toContainEqual({ assignments: { some: { removedAt: null, declinedAt: null } } });
    });

    it("does not add an assignments filter when unassigned is omitted", async () => {
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      expect(findManyWhere.assignments).toBeUndefined();
      for (const condition of andConditions(findManyWhere)) {
        expect((condition as { assignments?: unknown }).assignments).toBeUndefined();
      }
    });

    it("filters to only jobs needing attention when needsAttention: true, reusing the same OR clause getDispatchSummary uses", async () => {
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        needsAttention: true,
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      const orCondition = andConditions(findManyWhere).find((condition) => Array.isArray((condition as { OR?: unknown }).OR)) as
        | { OR: unknown[] }
        | undefined;
      expect(orCondition).toBeDefined();
      expect(orCondition!.OR).toHaveLength(3);
      expect(orCondition!.OR).toEqual(
        expect.arrayContaining([
          { status: { in: ["scheduled", "dispatched", "traveling", "on_site", "paused"] }, scheduledStart: { lt: expect.any(Date) } },
          { status: { notIn: ["completed", "cancelled"] }, assignments: { none: { removedAt: null, declinedAt: null } } },
          { status: "unscheduled" },
        ])
      );
    });

    it("filters the invoice handoff to completed jobs that have not been acknowledged", async () => {
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        status: "completed",
        readyForInvoice: false,
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      expect(findManyWhere.status).toBe("completed");
      expect(andConditions(findManyWhere)).toContainEqual({ readyForInvoiceAt: null });
    });

    it("does not add a needsAttention filter when omitted or explicitly false", async () => {
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        needsAttention: false,
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      expect(andConditions(findManyWhere).some((condition) => Array.isArray((condition as { OR?: unknown }).OR))).toBe(false);
    });

    it("combines needsAttention and search as two independent AND-array entries without one silently overwriting the other's OR clause", async () => {
      // Regression guard: before buildJobWhere composed its optional
      // predicates via a shared AND array, two blocks that each wrote a
      // top-level `OR` key (search's text-match OR, and needsAttention's
      // attention-predicate OR) would collide on the same object property -
      // only the last one spread onto the where-object would survive.
      const service = new JobsService(mockDb as never);

      await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
        needsAttention: true,
        search: "furnace",
      });

      const findManyWhere = mockDb.job.findMany.mock.calls[0][0].where;
      const orClauses = andConditions(findManyWhere)
        .map((condition) => (condition as { OR?: unknown[] }).OR)
        .filter((or): or is unknown[] => Array.isArray(or));

      expect(orClauses).toHaveLength(2);
      const needsAttentionOr = orClauses.find((or) => or.length === 3);
      const searchOr = orClauses.find((or) => or.length === 7);
      expect(needsAttentionOr).toBeDefined();
      expect(searchOr).toBeDefined();
      expect(searchOr).toContainEqual({ title: { contains: "furnace", mode: "insensitive" } });
    });

    it("enriches list rows with project/customer/assignedTechnicians and dispatch-attention booleans", async () => {
      mockDb.job.findMany.mockResolvedValue([
        {
          id: "job-overdue",
          jobNumber: "JOB-2026-000010",
          title: "Overdue dispatched job",
          jobType: "HVAC Service",
          status: "dispatched",
          priority: "high",
          scheduledStart: new Date("2020-01-01T00:00:00.000Z"),
          scheduledEnd: new Date("2020-01-01T02:00:00.000Z"),
          archivedAt: null,
          project: { id: "project-9", name: "Riverside Remodel", siteAddress: "9 River Rd" },
          customer: { id: "customer-9", name: "Riverside Co" },
          assignments: [],
        },
        {
          id: "job-assigned",
          jobNumber: "JOB-2026-000011",
          title: "Assigned upcoming job",
          jobType: "Plumbing",
          status: "scheduled",
          priority: "medium",
          scheduledStart: new Date("2099-01-01T00:00:00.000Z"),
          scheduledEnd: new Date("2099-01-01T02:00:00.000Z"),
          archivedAt: null,
          project: null,
          customer: null,
          assignments: [
            { userId: "tech-1", user: { id: "tech-1", fullName: "Tech One", email: "tech1@example.com" } },
            { userId: "tech-2", user: { id: "tech-2", fullName: null, email: "tech2@example.com" } },
          ],
        },
      ]);

      const service = new JobsService(mockDb as never);
      const result = await service.list({
        orgId: "org-1",
        auth: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" },
      });

      expect(result.items).toHaveLength(2);

      const overdueItem = result.items.find((item) => item.id === "job-overdue")!;
      expect(overdueItem.project).toEqual({ id: "project-9", name: "Riverside Remodel", siteAddress: "9 River Rd" });
      expect(overdueItem.customer).toEqual({ id: "customer-9", name: "Riverside Co" });
      expect(overdueItem.assignedTechnicians).toEqual([]);
      expect(overdueItem.isOverdue).toBe(true);
      expect(overdueItem.isUnassigned).toBe(true);
      expect(overdueItem.needsAttention).toBe(true);

      const assignedItem = result.items.find((item) => item.id === "job-assigned")!;
      expect(assignedItem.project).toBeNull();
      expect(assignedItem.customer).toBeNull();
      expect(assignedItem.assignedTechnicians).toEqual([
        { userId: "tech-1", name: "Tech One" },
        { userId: "tech-2", name: "tech2@example.com" },
      ]);
      expect(assignedItem.isOverdue).toBe(false);
      expect(assignedItem.isUnassigned).toBe(false);
      expect(assignedItem.needsAttention).toBe(false);
    });
  });

  describe("getDispatchSummary", () => {
    it("runs count-only queries and derives an org timezone from settingsJson", async () => {
      mockDb.organizationSettings.findUnique.mockResolvedValue({
        settingsJson: { timezone: "America/New_York" },
      });
      mockDb.job.count.mockResolvedValue(0);

      const service = new JobsService(mockDb as never);
      const summary = await service.getDispatchSummary("org-1", { role: "owner" });

      expect(mockDb.organizationSettings.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { orgId: "org-1" } })
      );
      expect(summary.timezone).toEqual({ source: "organization", value: "America/New_York" });
      expect(mockDb.job.count).toHaveBeenCalledTimes(5);
      expect(typeof summary.generatedAt).toBe("string");
      expect(typeof summary.todayRangeUtc.start).toBe("string");
      expect(typeof summary.weekRangeUtc.start).toBe("string");
    });

    it("falls back to UTC when no organization timezone setting is present", async () => {
      mockDb.organizationSettings.findUnique.mockResolvedValue(null);
      mockDb.job.count.mockResolvedValue(0);

      const service = new JobsService(mockDb as never);
      const summary = await service.getDispatchSummary("org-1", { role: "owner" });

      expect(summary.timezone).toEqual({ source: "utc_fallback", value: "UTC" });
    });

    it("labels the scope as organization-wide for owner/admin/dispatcher and assigned-only for every other role", async () => {
      mockDb.organizationSettings.findUnique.mockResolvedValue(null);
      mockDb.job.count.mockResolvedValue(0);
      const service = new JobsService(mockDb as never);

      for (const role of ["owner", "admin", "dispatcher"]) {
        const summary = await service.getDispatchSummary("org-1", { role });
        expect(summary.scope).toEqual({ source: "organization", role });
      }

      for (const role of ["technician", "viewer", "estimator"]) {
        const summary = await service.getDispatchSummary("org-1", { role });
        expect(summary.scope).toEqual({ source: "assigned_only", role });
      }
    });

    it("scopes every count query to the organization and uses the correct status sets", async () => {
      mockDb.organizationSettings.findUnique.mockResolvedValue(null);
      mockDb.job.count.mockResolvedValue(0);

      const service = new JobsService(mockDb as never);
      await service.getDispatchSummary("org-1", { role: "owner" });

      const calls = mockDb.job.count.mock.calls.map((call) => call[0]);
      for (const call of calls) {
        expect(call.where.orgId).toBe("org-1");
      }

      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            where: expect.objectContaining({
              orgId: "org-1",
              status: { notIn: ["completed", "cancelled"] },
            }),
          }),
          expect.objectContaining({
            where: expect.objectContaining({ orgId: "org-1", status: "unscheduled" }),
          }),
        ])
      );

      const overdueCall = calls.find(
        (call) =>
          call.where.status &&
          typeof call.where.status === "object" &&
          "in" in call.where.status &&
          call.where.scheduledStart
      );
      expect(overdueCall).toBeDefined();
      expect(overdueCall.where.status.in).toEqual(["scheduled", "dispatched", "traveling", "on_site", "paused"]);
    });

    it("excludes archived jobs from every count query, even when status is non-terminal", async () => {
      // JobsService.archive() sets archivedAt independently of status (a
      // "scheduled" job can be archived without ever becoming "completed" or
      // "cancelled"). Without archivedAt: null on every count() where-clause,
      // an archived-but-non-terminal job would inflate these KPI counts while
      // being correctly absent from the work-queue list, whose buildJobWhere
      // already defaults to archivedAt: null.
      mockDb.organizationSettings.findUnique.mockResolvedValue(null);
      mockDb.job.count.mockResolvedValue(0);

      const service = new JobsService(mockDb as never);
      await service.getDispatchSummary("org-1", { role: "owner" });

      const calls = mockDb.job.count.mock.calls.map((call) => call[0]);
      expect(calls).toHaveLength(5);
      for (const call of calls) {
        expect(call.where.archivedAt).toBeNull();
      }
    });

    it("computes needsAttention with a single OR'd count call, not a sum of separate counts", async () => {
      mockDb.organizationSettings.findUnique.mockResolvedValue(null);
      mockDb.job.count.mockResolvedValue(0);

      const service = new JobsService(mockDb as never);
      await service.getDispatchSummary("org-1", { role: "owner" });

      // Exactly 5 count() calls total for the whole summary: activeJobs,
      // unscheduledJobs, scheduledToday, overdueActionable, and ONE combined
      // needsAttention call — never 3 extra calls that get summed in JS.
      expect(mockDb.job.count).toHaveBeenCalledTimes(5);

      const orCall = mockDb.job.count.mock.calls
        .map((call) => call[0])
        .find((call) => Array.isArray(call.where.OR));
      expect(orCall).toBeDefined();
      expect(orCall.where.OR).toHaveLength(3);
      expect(orCall.where.OR).toEqual(
        expect.arrayContaining([
          { status: { in: ["scheduled", "dispatched", "traveling", "on_site", "paused"] }, scheduledStart: { lt: expect.any(Date) } },
          {
            status: { notIn: ["completed", "cancelled"] },
            assignments: { none: { removedAt: null, declinedAt: null } },
          },
          { status: "unscheduled" },
        ])
      );
    });
  });
});
