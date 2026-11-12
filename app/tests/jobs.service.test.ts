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
  proposal: {
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
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

import { JobsService } from "../modules/jobs/service";

const scheduledJob = {
  id: "job-1",
  orgId: "org-1",
  projectId: "project-1",
  customerId: "customer-1",
  serviceAddressId: "address-1",
  jobNumber: "JOB-2026-000001",
  sourceProposalId: null,
  acceptedBaselineJson: null,
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


  const acceptedProposal = {
    id: "proposal-1",
    projectId: "project-1",
    estimateId: "estimate-1",
    status: "accepted",
    respondedAt: new Date("2026-10-26T12:00:00.000Z"),
    scopeOfWork: "Refinish fifteen cabinets",
    assumptions: "Existing oak is sound",
    exclusions: "Countertop replacement",
    timeline: "Five days",
    finalPrice: { toString: () => "7125.37" },
    priceLow: null,
    priceHigh: null,
    paymentScheduleJson: [{ label: "Completion", amountPercent: 100 }],
    termsAndConditions: "Net 15",
    project: { id: "project-1", orgId: "org-1", customerId: "customer-1", name: "Kitchen cabinets", simpleScope: "Paint cabinets", jobType: "Cabinet refinishing" },
  };

  const conversionInput = {
    orgId: "org-1",
    actor: { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" as const },
    proposalId: "proposal-1",
    serviceAddressId: "address-1",
  };

  it("converts an accepted proposal into one unscheduled job with an immutable monetary snapshot", async () => {
    mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
    const converted = { ...scheduledJob, sourceProposalId: "proposal-1", acceptedBaselineJson: { finalPrice: "7125.37" } };
    mockDb.job.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(converted);
    mockDb.job.create.mockResolvedValue(converted);
    const service = new JobsService(mockDb as never);

    const job = await service.createFromAcceptedProposal(conversionInput);

    expect(job.sourceProposalId).toBe("proposal-1");
    expect(job.acceptedBaselineJson).toEqual({ finalPrice: "7125.37" });
    expect(mockDb.proposal.findFirst).toHaveBeenCalledWith({
      where: { id: "proposal-1", project: { orgId: "org-1" } },
      include: { project: true },
    });
    expect(mockDb.$executeRaw).toHaveBeenCalled();
    expect(mockDb.job.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        sourceProposalId: "proposal-1",
        projectId: "project-1",
        customerId: "customer-1",
        serviceAddressId: "address-1",
        description: "Refinish fifteen cabinets",
        title: "Kitchen cabinets",
        jobType: "Cabinet refinishing",
        status: "unscheduled",
        acceptedBaselineJson: expect.objectContaining({
          estimateId: "estimate-1",
          finalPrice: "7125.37",
          scopeOfWork: "Refinish fifteen cabinets",
          exclusions: "Countertop replacement",
          termsAndConditions: "Net 15",
        }),
      }),
    }));
  });

  it.each([null, "", "   "])("rejects missing accepted scope %p without copying mutable project scope", async (scopeOfWork) => {
    mockDb.proposal.findFirst.mockResolvedValue({ ...acceptedProposal, scopeOfWork });
    mockDb.job.findFirst.mockResolvedValueOnce(null);
    const service = new JobsService(mockDb as never);

    await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({
      statusCode: 409,
      message: "The accepted proposal must include a scope of work before creating a field job",
    });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it.each([acceptedProposal.scopeOfWork, null])("returns the original job on retry even with accepted scope %p", async (scopeOfWork) => {
    mockDb.proposal.findFirst.mockResolvedValue({ ...acceptedProposal, scopeOfWork });
    const previous = { ...scheduledJob, sourceProposalId: "proposal-1" };
    mockDb.job.findFirst.mockResolvedValueOnce(previous);
    const service = new JobsService(mockDb as never);

    const result = await service.createFromAcceptedProposal(conversionInput);

    expect(result.id).toBe("job-1");
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("rejects a retry with a service address owned by another customer", async () => {
    mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
    const previous = { ...scheduledJob, sourceProposalId: "proposal-1" };
    mockDb.job.findFirst.mockResolvedValueOnce(previous);
    mockDb.serviceAddress.findFirst.mockResolvedValue({ id: "address-1", orgId: "org-1", customerId: "other-customer" });
    const service = new JobsService(mockDb as never);

    await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("refuses a draft or cross-organization proposal without job creation", async () => {
    const service = new JobsService(mockDb as never);
    mockDb.proposal.findFirst.mockResolvedValueOnce({ ...acceptedProposal, status: "draft" }).mockResolvedValueOnce(null);

    await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({ statusCode: 404 });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("rejects a service address owned by another customer", async () => {
    mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
    mockDb.job.findFirst.mockResolvedValueOnce(null);
    mockDb.serviceAddress.findFirst.mockResolvedValue({ id: "address-1", orgId: "org-1", customerId: "other-customer" });
    const service = new JobsService(mockDb as never);

    await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockDb.job.create).not.toHaveBeenCalled();
  });

  it("forbids a technician from converting proposals", async () => {
    const service = new JobsService(mockDb as never);
    await expect(service.createFromAcceptedProposal({
      ...conversionInput, actor: { ...conversionInput.actor, role: "technician" },
    })).rejects.toMatchObject({ statusCode: 403 });
    expect(mockDb.proposal.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["projectId", "project-2"],
    ["customerId", "customer-2"],
    ["serviceAddressId", "address-2"],
  ] as const)("rejects proposal-derived job reparenting through %s", async (field, value) => {
    mockDb.job.findFirst.mockResolvedValue({ ...scheduledJob, sourceProposalId: "proposal-1" });
    const service = new JobsService(mockDb as never);
    await expect(service.update("job-1", {
      orgId: "org-1", actor: conversionInput.actor, [field]: value,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(mockDb.job.update).not.toHaveBeenCalled();
  });

  it("does not expose accepted commercial pricing to assigned technician job reads", async () => {
    const jobRow = {
      ...scheduledJob,
      sourceProposalId: "proposal-1",
      acceptedBaselineJson: { version: 1, proposalId: "proposal-1", finalPrice: "7125.37", termsAndConditions: "Net 15" },
    };
    mockDb.job.findFirst.mockResolvedValue(jobRow);
    const service = new JobsService(mockDb as never);

    const owner = await service.getById("org-1", "job-1", { userId: "owner-1", role: "owner" });
    const technician = await service.getById("org-1", "job-1", { userId: "tech-1", role: "technician" });
    expect(owner.acceptedBaselineJson).toMatchObject({ finalPrice: "7125.37" });
    expect(technician.acceptedBaselineJson).toBeNull();
    expect(technician.description).toBe("Seasonal maintenance");
  });

  it("preserves technician ownership flags while redacting accepted proposal commercial terms", async () => {
    const makeTask = (id: string, assignedUserId: string) => ({
      id,
      assignedUserId,
      updatedAt: new Date("2026-07-16T13:00:00.000Z"),
      title: id,
      status: "todo",
      priority: "medium",
      dueDate: null,
      assignedTo: null,
      completedAt: null,
      notes: null,
    });
    const job = {
      ...scheduledJob,
      sourceProposalId: "proposal-1",
      acceptedBaselineJson: { version: 1, proposalId: "proposal-1", finalPrice: "7125.37", termsAndConditions: "Net 15" },
      tasks: [makeTask("assigned-task", "tech-1"), makeTask("other-task", "tech-2")],
    };
    mockDb.job.findFirst.mockResolvedValue(job);
    const service = new JobsService(mockDb as never);

    const manager = await service.getById("org-1", "job-1", { userId: "owner-1", role: "owner" });
    expect(manager.acceptedBaselineJson).toMatchObject({ finalPrice: "7125.37" });
    expect(manager.tasks.every(task => task.canUpdateStatus === false)).toBe(true);

    const assignedTechnician = await service.getById("org-1", "job-1", { userId: "tech-1", role: "technician" });
    expect(assignedTechnician.acceptedBaselineJson).toBeNull();
    expect(assignedTechnician.tasks.find(task => task.id === "assigned-task")?.canUpdateStatus).toBe(true);
    expect(assignedTechnician.tasks.find(task => task.id === "other-task")?.canUpdateStatus).toBe(false);

    mockDb.job.findFirst.mockResolvedValue({ ...job, archivedAt: new Date("2026-07-18T13:00:00.000Z") });
    const archived = await service.getById("org-1", "job-1", { userId: "tech-1", role: "technician" });
    expect(archived.tasks.every(task => task.canUpdateStatus === false)).toBe(true);
    expect(archived.acceptedBaselineJson).toBeNull();
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

  it("scopes technician detail reads to active assignments and hides an unassigned job", async () => {
    mockDb.job.findFirst.mockResolvedValue(null);
    const service = new JobsService(mockDb as never);
    await expect(service.getById("org-1", "job-1", { userId: "tech-1", role: "technician" }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(mockDb.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: "job-1", orgId: "org-1",
        assignments: { some: { userId: "tech-1", removedAt: null, declinedAt: null } },
      }),
    }));
    expect(mockDb.job.update).not.toHaveBeenCalled();
    expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
  });

  it("does not complete or emit activity for a technician without an active assignment", async () => {
    mockDb.job.findFirst.mockResolvedValue({ ...scheduledJob, status: "on_site" });
    mockDb.jobAssignment.findFirst.mockResolvedValue(null);
    await expect(new JobsService(mockDb as never).complete("job-1", {
      orgId: "org-1", actor: { userId: "tech-1", orgId: "org-1", role: "technician" },
    })).rejects.toMatchObject({ statusCode: 403 });
    expect(mockDb.jobAssignment.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: "org-1", jobId: "job-1", userId: "tech-1", removedAt: null, declinedAt: null },
    }));
    expect(mockDb.job.update).not.toHaveBeenCalled();
    expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
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
      acceptedBaselineJson: { finalPrice: "7125.37", termsAndConditions: "Net 15" },
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
    expect(job.acceptedBaselineJson).toBeNull();
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

  describe("field lifecycle transitions", () => {
    const dispatcher = { userId: "dispatcher-1", orgId: "org-1", role: "dispatcher" } as const;
    const techActor = { userId: "tech-1", orgId: "org-1", role: "technician" } as const;
    const jobUpdatedAt = new Date("2026-07-14T12:00:00.000Z");

    function rowWith(status: string, overrides: Record<string, unknown> = {}) {
      return { ...scheduledJob, status, updatedAt: jobUpdatedAt, ...overrides };
    }

    function assignedTechnician() {
      mockDb.jobAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    }

    it("pauses an on-site job and resumes it back on site", async () => {
      mockDb.job.findFirst.mockResolvedValueOnce(rowWith("on_site")).mockResolvedValueOnce(rowWith("paused"));
      mockDb.job.update
        .mockResolvedValueOnce(rowWith("paused"))
        .mockResolvedValueOnce(rowWith("on_site", { actualStart: new Date("2026-07-16T13:10:00.000Z") }));
      assignedTechnician();
      const service = new JobsService(mockDb as never);

      const paused = await service.pause("job-1", { orgId: "org-1", actor: techActor, reason: "Waiting on parts" });
      expect(paused.status).toBe("paused");
      expect(mockDb.job.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "paused" }) })
      );
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.paused",
            metadataJson: { previousStatus: "on_site", newStatus: "paused" },
          }),
        })
      );

      const resumed = await service.resume("job-1", { orgId: "org-1", actor: techActor });
      expect(resumed.status).toBe("on_site");
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.resumed",
            metadataJson: { previousStatus: "paused", newStatus: "on_site" },
          }),
        })
      );
    });

    it("rejects pausing a job that is not on site", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
      const service = new JobsService(mockDb as never);

      await expect(
        service.pause("job-1", { orgId: "org-1", actor: dispatcher, reason: "Waiting on parts" })
      ).rejects.toMatchObject({ statusCode: 409, message: "Job job-1 cannot transition from scheduled to paused" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
      expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
    });

    it("requires a reason to pause", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("on_site"));
      const service = new JobsService(mockDb as never);

      await expect(
        service.pause("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 400, message: "A reason is required for this action" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
      expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
    });

    it("dispatches a scheduled job with at least one active assignment", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
      mockDb.jobAssignment.count.mockResolvedValue(1);
      mockDb.job.update.mockResolvedValue(rowWith("dispatched"));
      const service = new JobsService(mockDb as never);

      const job = await service.dispatch("job-1", { orgId: "org-1", actor: dispatcher });

      expect(job.status).toBe("dispatched");
      expect(mockDb.job.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "dispatched" }) })
      );
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.dispatched",
            metadataJson: { previousStatus: "scheduled", newStatus: "dispatched" },
          }),
        })
      );
    });

    it("rejects dispatch when the job has no schedule", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled", { scheduledStart: null, scheduledEnd: null }));
      const service = new JobsService(mockDb as never);

      await expect(
        service.dispatch("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 409, message: "Job job-1 must be scheduled before dispatch" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
    });

    it("rejects dispatch when the job has zero active assignments", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
      mockDb.jobAssignment.count.mockResolvedValue(0);
      const service = new JobsService(mockDb as never);

      await expect(
        service.dispatch("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 409, message: "Job job-1 must have at least one active assignment before dispatch" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
    });

    it("rejects dispatch of an archived job", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled", { archivedAt: new Date("2026-07-15T12:00:00.000Z") }));
      const service = new JobsService(mockDb as never);

      await expect(
        service.dispatch("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(mockDb.job.update).not.toHaveBeenCalled();
    });

    it("starts travel from dispatched and records arrival with an actual start", async () => {
      mockDb.job.findFirst.mockResolvedValueOnce(rowWith("dispatched")).mockResolvedValueOnce(rowWith("traveling"));
      mockDb.job.update
        .mockResolvedValueOnce(rowWith("traveling"))
        .mockResolvedValueOnce(rowWith("on_site", { actualStart: new Date("2026-07-16T13:10:00.000Z") }));
      assignedTechnician();
      const service = new JobsService(mockDb as never);

      const traveling = await service.startTravel("job-1", { orgId: "org-1", actor: techActor });
      expect(traveling.status).toBe("traveling");

      const arrived = await service.arrive("job-1", { orgId: "org-1", actor: techActor });
      expect(arrived.status).toBe("on_site");
      expect(arrived.actualStart).toBe("2026-07-16T13:10:00.000Z");
      const arriveCall = mockDb.job.update.mock.calls[1][0];
      expect(arriveCall.data).toEqual(expect.objectContaining({ status: "on_site", actualStart: expect.any(Date) }));
    });

    it.each([
      ["scheduled", undefined],
      ["dispatched", "Dispatch no longer needed"],
      ["paused", "Customer asked to stop"],
    ] as const)("cancels a %s job", async (status, reason) => {
      mockDb.job.findFirst.mockResolvedValue(rowWith(status));
      mockDb.job.update.mockResolvedValue(rowWith("cancelled"));
      const service = new JobsService(mockDb as never);

      const job = await service.cancel("job-1", { orgId: "org-1", actor: dispatcher, reason });

      expect(job.status).toBe("cancelled");
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.cancelled",
            metadataJson: { previousStatus: status, newStatus: "cancelled" },
          }),
        })
      );
    });

    it.each(["dispatched", "paused"] as const)("requires a reason to cancel a %s job", async (status) => {
      mockDb.job.findFirst.mockResolvedValue(rowWith(status));
      const service = new JobsService(mockDb as never);

      await expect(
        service.cancel("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 400, message: "A reason is required for this action" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
    });

    it("reopens a completed job to unscheduled, clearing completion fields and writing job.reopened", async () => {
      const completed = rowWith("completed", {
        actualStart: new Date("2026-07-16T13:10:00.000Z"),
        actualEnd: new Date("2026-07-16T15:05:00.000Z"),
        completedAt: new Date("2026-07-16T15:05:00.000Z"),
        completedById: "tech-1",
        readyForInvoiceAt: new Date("2026-07-16T15:10:00.000Z"),
      });
      mockDb.job.findFirst.mockResolvedValue(completed);
      mockDb.job.update.mockResolvedValue(rowWith("unscheduled", {
        actualStart: null, actualEnd: null, completedAt: null, completedById: null, readyForInvoiceAt: null,
      }));
      const service = new JobsService(mockDb as never);

      const job = await service.reopen("job-1", {
        orgId: "org-1",
        actor: { userId: "admin-1", orgId: "org-1", role: "admin" },
        reason: "Customer reported a callback",
      });

      expect(job.status).toBe("unscheduled");
      expect(job.completedAt).toBeNull();
      expect(mockDb.job.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "unscheduled",
            actualStart: null,
            actualEnd: null,
            completedAt: null,
            completedById: null,
            readyForInvoiceAt: null,
          }),
        })
      );
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.reopened",
            metadataJson: { previousStatus: "completed", newStatus: "unscheduled" },
          }),
        })
      );
    });

    it("reopens a completed job to scheduled when it still has a schedule", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("completed", {
        completedAt: new Date("2026-07-16T15:05:00.000Z"),
        completedById: "tech-1",
      }));
      mockDb.job.update.mockResolvedValue(rowWith("scheduled"));
      const service = new JobsService(mockDb as never);

      const job = await service.reopen("job-1", {
        orgId: "org-1",
        actor: { userId: "owner-1", orgId: "org-1", role: "owner" },
        status: "scheduled",
      });

      expect(job.status).toBe("scheduled");
      expect(mockDb.job.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "scheduled" }) })
      );
    });

    it("forbids a dispatcher from reopening a completed job", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("completed"));
      const service = new JobsService(mockDb as never);

      await expect(
        service.reopen("job-1", { orgId: "org-1", actor: dispatcher })
      ).rejects.toMatchObject({ statusCode: 403, message: "Only owners and admins can reopen completed jobs" });
      expect(mockDb.job.update).not.toHaveBeenCalled();
    });

    it.each([
      ["dispatch", "unscheduled", "dispatched"],
      ["startTravel", "scheduled", "traveling"],
      ["arrive", "dispatched", "on_site"],
      ["pause", "traveling", "paused"],
      ["resume", "on_site", "on_site"],
      ["complete", "paused", "completed"],
      ["cancel", "on_site", "cancelled"],
      ["cancel", "traveling", "cancelled"],
    ] as const)("rejects %s from %s with 409 and no update or activity", async (method, from, to) => {
      mockDb.job.findFirst.mockResolvedValue(rowWith(from));
      const service = new JobsService(mockDb as never);

      await expect(
        service[method]("job-1", { orgId: "org-1", actor: dispatcher, reason: "No longer needed" })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: `Job job-1 cannot transition from ${from} to ${to}`,
      });
      expect(mockDb.job.update).not.toHaveBeenCalled();
      expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
    });

    it.each([
      ["startTravel", "dispatched"],
      ["arrive", "traveling"],
      ["pause", "on_site"],
      ["resume", "paused"],
    ] as const)("denies an unassigned technician %s from %s with 403 and no update or activity", async (method, from) => {
      mockDb.job.findFirst.mockResolvedValue(rowWith(from));
      mockDb.jobAssignment.findFirst.mockResolvedValue(null);
      const service = new JobsService(mockDb as never);

      await expect(
        service[method]("job-1", { orgId: "org-1", actor: techActor, reason: "Waiting on parts" })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockDb.job.update).not.toHaveBeenCalled();
      expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
    });

    it("lets a manager without an assignment run a field transition (current behavior)", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("dispatched"));
      mockDb.job.update.mockResolvedValue(rowWith("traveling"));
      const service = new JobsService(mockDb as never);

      const job = await service.startTravel("job-1", { orgId: "org-1", actor: dispatcher });

      expect(job.status).toBe("traveling");
      expect(mockDb.jobAssignment.findFirst).not.toHaveBeenCalled();
    });

    it("writes job.scheduled with previous/new status metadata when scheduling", async () => {
      mockDb.job.findFirst.mockResolvedValue(rowWith("unscheduled", { scheduledStart: null, scheduledEnd: null }));
      mockDb.job.update.mockResolvedValue(rowWith("scheduled"));
      const service = new JobsService(mockDb as never);

      const job = await service.schedule("job-1", {
        orgId: "org-1",
        actor: dispatcher,
        scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
        scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
      });

      expect(job.status).toBe("scheduled");
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.scheduled",
            metadataJson: expect.objectContaining({ previousStatus: "unscheduled", newStatus: "scheduled" }),
          }),
        })
      );
    });

    it("records self-acceptance activity and rejects another user's assignment with 404", async () => {
      const assignment = {
        id: "assignment-1",
        jobId: "job-1",
        userId: "tech-1",
        assignmentRole: "technician",
        isLead: false,
        assignedAt: new Date("2026-07-15T12:00:00.000Z"),
        assignedById: "dispatcher-1",
        acceptedAt: null,
        declinedAt: null,
        removedAt: null,
        createdAt: new Date("2026-07-15T12:00:00.000Z"),
        updatedAt: new Date("2026-07-15T12:00:00.000Z"),
        user: { id: "tech-1", fullName: "Tech One", email: "tech@example.com" },
      };
      mockDb.jobAssignment.findFirst.mockResolvedValue(assignment);
      mockDb.jobAssignment.update.mockResolvedValue({ ...assignment, acceptedAt: new Date("2026-07-16T12:00:00.000Z") });
      const service = new JobsService(mockDb as never);

      const accepted = await service.acceptAssignment("job-1", "assignment-1", { orgId: "org-1", actor: techActor });
      expect(accepted.acceptedAt).not.toBeNull();
      expect(mockDb.jobAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: "tech-1" }) })
      );
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "job.assignment_accepted",
            metadataJson: { assignmentId: "assignment-1", userId: "tech-1" },
          }),
        })
      );

      mockDb.jobAssignment.findFirst.mockResolvedValue(null);
      await expect(
        service.acceptAssignment("job-1", "assignment-1", { orgId: "org-1", actor: techActor })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("records a decline with job.assignment_declined activity", async () => {
      const assignment = {
        id: "assignment-1",
        jobId: "job-1",
        userId: "tech-1",
        assignmentRole: "technician",
        isLead: false,
        assignedAt: new Date("2026-07-15T12:00:00.000Z"),
        assignedById: "dispatcher-1",
        acceptedAt: null,
        declinedAt: null,
        removedAt: null,
        createdAt: new Date("2026-07-15T12:00:00.000Z"),
        updatedAt: new Date("2026-07-15T12:00:00.000Z"),
        user: { id: "tech-1", fullName: "Tech One", email: "tech@example.com" },
      };
      mockDb.jobAssignment.findFirst.mockResolvedValue(assignment);
      mockDb.jobAssignment.update.mockResolvedValue({ ...assignment, declinedAt: new Date("2026-07-16T12:00:00.000Z") });
      const service = new JobsService(mockDb as never);

      const declined = await service.declineAssignment("job-1", "assignment-1", {
        orgId: "org-1", actor: techActor, reason: "Out that day",
      });

      expect(declined.declinedAt).not.toBeNull();
      expect(mockDb.activityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: "job.assignment_declined" }),
        })
      );
    });

    it("forbids a non-field role from responding to an assignment", async () => {
      const service = new JobsService(mockDb as never);

      await expect(
        service.acceptAssignment("job-1", "assignment-1", {
          orgId: "org-1",
          actor: { userId: "viewer-1", orgId: "org-1", role: "viewer" },
        })
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(mockDb.job.findFirst).not.toHaveBeenCalled();
      expect(mockDb.jobAssignment.findFirst).not.toHaveBeenCalled();
    });

    it.each(["declined", "expired"] as const)("rejects %s proposal conversion with 409", async (status) => {
      mockDb.proposal.findFirst.mockResolvedValue({ ...acceptedProposal, status });
      const service = new JobsService(mockDb as never);

      await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({
        statusCode: 409,
        message: "Only an accepted proposal can become a field job",
      });
      expect(mockDb.job.create).not.toHaveBeenCalled();
    });

    it("allows two accepted proposals on one project to become two jobs", async () => {
      const proposal2 = { ...acceptedProposal, id: "proposal-2", scopeOfWork: "Paint the exterior trim" };
      const job1 = { ...scheduledJob, id: "job-1", sourceProposalId: "proposal-1" };
      const job2 = { ...scheduledJob, id: "job-2", jobNumber: "JOB-2026-000002", sourceProposalId: "proposal-2" };
      mockDb.proposal.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === "proposal-2" ? proposal2 : acceptedProposal
      );
      mockDb.job.findFirst.mockImplementation(async ({ where }: { where: { sourceProposalId?: string; id?: string } }) => {
        if (where.sourceProposalId) return null;
        if (where.id === "job-2") return job2;
        return job1;
      });
      mockDb.job.create.mockImplementation(async ({ data }: { data: { sourceProposalId: string } }) =>
        data.sourceProposalId === "proposal-2" ? job2 : job1
      );
      const service = new JobsService(mockDb as never);

      const first = await service.createFromAcceptedProposal(conversionInput);
      const second = await service.createFromAcceptedProposal({ ...conversionInput, proposalId: "proposal-2" });

      expect(first.id).toBe("job-1");
      expect(second.id).toBe("job-2");
      expect(mockDb.job.create).toHaveBeenCalledTimes(2);
    });

    it("returns the previous job when creation races into the unique source-proposal index (P2002)", async () => {
      const previous = { ...scheduledJob, sourceProposalId: "proposal-1" };
      mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
      mockDb.job.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(previous);
      mockDb.job.create.mockRejectedValueOnce({ code: "P2002" });
      const service = new JobsService(mockDb as never);

      const result = await service.createFromAcceptedProposal(conversionInput);

      expect(result.id).toBe("job-1");
      expect(result.sourceProposalId).toBe("proposal-1");
      expect(mockDb.job.create).toHaveBeenCalledTimes(1);
    });

    it("rethrows a P2002 race when no previous job can be re-read", async () => {
      mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
      mockDb.job.findFirst.mockResolvedValue(null);
      mockDb.job.create.mockRejectedValueOnce({ code: "P2002" });
      const service = new JobsService(mockDb as never);

      await expect(service.createFromAcceptedProposal(conversionInput)).rejects.toMatchObject({ code: "P2002" });
    });

    it("isolates the racing insert in a savepoint so the fallback re-read runs in a live transaction", async () => {
      const previous = { ...scheduledJob, sourceProposalId: "proposal-1" };
      const { getRequestDatabaseClient } = jest.requireMock("../db/requestSession") as {
        getRequestDatabaseClient: jest.Mock;
      };
      getRequestDatabaseClient.mockReturnValueOnce(mockDb);
      mockDb.$executeRawUnsafe.mockResolvedValue(undefined);
      mockDb.proposal.findFirst.mockResolvedValue(acceptedProposal);
      mockDb.job.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(previous);
      mockDb.job.create.mockRejectedValueOnce({ code: "P2002" });
      const service = new JobsService(mockDb as never);

      const result = await service.createFromAcceptedProposal(conversionInput);

      expect(result.id).toBe("job-1");
      const sql = mockDb.$executeRawUnsafe;
      expect(sql.mock.calls.map(([statement]) => statement)).toEqual([
        expect.stringMatching(/^SAVEPOINT "job_create_/),
        expect.stringMatching(/^ROLLBACK TO SAVEPOINT "job_create_/),
        expect.stringMatching(/^RELEASE SAVEPOINT "job_create_/),
      ]);
      const [save, rollback, release] = sql.mock.invocationCallOrder;
      const [insert] = mockDb.job.create.mock.invocationCallOrder;
      const [, fallbackRead] = mockDb.job.findFirst.mock.invocationCallOrder;
      expect(save).toBeLessThan(insert);
      expect(insert).toBeLessThan(rollback);
      expect(rollback).toBeLessThan(release);
      expect(release).toBeLessThan(fallbackRead);
    });

    describe("optimistic-concurrency guard (expectedUpdatedAt)", () => {
      const staleToken = new Date("2026-07-13T12:00:00.000Z");

      it("rejects a stale token with 409 and no update or activity", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
        const service = new JobsService(mockDb as never);

        await expect(
          service.dispatch("job-1", { orgId: "org-1", actor: dispatcher, expectedUpdatedAt: staleToken })
        ).rejects.toMatchObject({
          statusCode: 409,
          message: "This job changed since you opened it. Refresh the source workspace before saving again.",
        });
        expect(mockDb.job.update).not.toHaveBeenCalled();
        expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
      });

      it("accepts a matching token and predicates the write on it", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
        mockDb.jobAssignment.count.mockResolvedValue(1);
        mockDb.job.update.mockResolvedValue(rowWith("dispatched"));
        const service = new JobsService(mockDb as never);

        const job = await service.dispatch("job-1", { orgId: "org-1", actor: dispatcher, expectedUpdatedAt: jobUpdatedAt });

        expect(job.status).toBe("dispatched");
        const updateCall = mockDb.job.update.mock.calls[0][0];
        expect(updateCall.where).toEqual({ id: "job-1", updatedAt: jobUpdatedAt });
        expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
        expect(updateCall.data.updatedAt.getTime()).toBeGreaterThan(jobUpdatedAt.getTime());
      });

      it("succeeds without a token and still predicates the write on the just-read revision", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
        mockDb.jobAssignment.count.mockResolvedValue(1);
        mockDb.job.update.mockResolvedValue(rowWith("dispatched"));
        const service = new JobsService(mockDb as never);

        const job = await service.dispatch("job-1", { orgId: "org-1", actor: dispatcher });

        expect(job.status).toBe("dispatched");
        const updateCall = mockDb.job.update.mock.calls[0][0];
        expect(updateCall.where).toEqual({ id: "job-1", updatedAt: jobUpdatedAt });
        expect(updateCall.data.updatedAt).toBeInstanceOf(Date);
        expect(updateCall.data.updatedAt.getTime()).toBeGreaterThan(jobUpdatedAt.getTime());
      });

      it("maps a lost-update (P2025) on the guarded write to the same 409", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("scheduled"));
        mockDb.jobAssignment.count.mockResolvedValue(1);
        mockDb.job.update.mockRejectedValueOnce({ code: "P2025" });
        const service = new JobsService(mockDb as never);

        await expect(
          service.dispatch("job-1", { orgId: "org-1", actor: dispatcher, expectedUpdatedAt: jobUpdatedAt })
        ).rejects.toMatchObject({
          statusCode: 409,
          message: "This job changed since you opened it. Refresh the source workspace before saving again.",
        });
        expect(mockDb.activityEvent.create).not.toHaveBeenCalled();
      });

      it("rejects a stale token on reopen with 409 and no update", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("completed"));
        const service = new JobsService(mockDb as never);

        await expect(
          service.reopen("job-1", {
            orgId: "org-1",
            actor: { userId: "admin-1", orgId: "org-1", role: "admin" },
            expectedUpdatedAt: staleToken,
          })
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(mockDb.job.update).not.toHaveBeenCalled();
      });

      it("rejects a stale token on schedule with 409 and no update", async () => {
        mockDb.job.findFirst.mockResolvedValue(rowWith("unscheduled", { scheduledStart: null, scheduledEnd: null }));
        const service = new JobsService(mockDb as never);

        await expect(
          service.schedule("job-1", {
            orgId: "org-1",
            actor: dispatcher,
            scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
            scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
            expectedUpdatedAt: staleToken,
          })
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(mockDb.job.update).not.toHaveBeenCalled();
      });
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
