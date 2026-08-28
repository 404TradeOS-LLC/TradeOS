import "dotenv/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../backend/auth/jwt";
import { basePrisma } from "../client";
import { assertSeedTargetIsNotProduction } from "./productionGuard";

const IDS = {
  orgPrimary: "00000000-0000-0000-0000-000000000001",
  orgSecondary: "00000000-0000-0000-0000-000000000002",
  userOwner: "10000000-0000-0000-0000-000000000001",
  userSecondOwner: "10000000-0000-0000-0000-000000000002",
  userAdmin: "10000000-0000-0000-0000-000000000003",
  userDispatcher: "10000000-0000-0000-0000-000000000004",
  userTechnician: "10000000-0000-0000-0000-000000000005",
  userHelper: "10000000-0000-0000-0000-000000000006",
  userSecondDispatcher: "10000000-0000-0000-0000-000000000007",
  userSecondTechnician: "10000000-0000-0000-0000-000000000008",
  division: "20000000-0000-0000-0000-000000000001",
  category: "20000000-0000-0000-0000-000000000002",
  subcategory: "20000000-0000-0000-0000-000000000003",
  laborRate: "20000000-0000-0000-0000-000000000004",
  material: "20000000-0000-0000-0000-000000000005",
  equipment: "20000000-0000-0000-0000-000000000006",
  costItemExcavation: "20000000-0000-0000-0000-000000000007",
  costItemGravel: "20000000-0000-0000-0000-000000000008",
  assemblyTemplate: "20000000-0000-0000-0000-000000000009",
  customerJane: "30000000-0000-0000-0000-000000000001",
  addressJanePrimary: "30000000-0000-0000-0000-000000000002",
  projectDrainage: "30000000-0000-0000-0000-000000000003",
  customerCorey: "30000000-0000-0000-0000-000000000004",
  addressCoreyRemodel: "30000000-0000-0000-0000-000000000005",
  projectRemodel: "30000000-0000-0000-0000-000000000006",
  equipmentCondenser: "30000000-0000-0000-0000-000000000007",
  equipmentFurnace: "30000000-0000-0000-0000-000000000008",
  jobUnscheduled: "40000000-0000-0000-0000-000000000001",
  jobScheduled: "40000000-0000-0000-0000-000000000002",
  jobDispatched: "40000000-0000-0000-0000-000000000003",
  jobOnSite: "40000000-0000-0000-0000-000000000004",
  jobCompleted: "40000000-0000-0000-0000-000000000005",
  jobConflict: "40000000-0000-0000-0000-000000000006",
  customerBob: "50000000-0000-0000-0000-000000000001",
  addressBobPrimary: "50000000-0000-0000-0000-000000000002",
  projectPanelUpgrade: "50000000-0000-0000-0000-000000000003",
  jobPanelUpgrade: "50000000-0000-0000-0000-000000000004",
} as const;

type SeedTransaction = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

interface SeedSessionInput {
  orgId: string;
  userId: string;
  role?: string;
  authSubject?: string;
  provisioning?: boolean;
  sessionSource: string;
}

async function withSeedSession<T>(
  input: SeedSessionInput,
  operation: (tx: SeedTransaction) => Promise<T>
): Promise<T> {
  return basePrisma.$transaction(
    async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${input.userId}, true),
          set_config('app.org_id', ${input.orgId}, true),
          set_config('app.role', ${input.role ?? ""}, true),
          set_config('app.auth_subject', ${input.authSubject ?? ""}, true),
          set_config('app.provisioning', ${input.provisioning ? "true" : "false"}, true),
          set_config('app.session_source', ${input.sessionSource}, true)
      `);
      return operation(tx);
    },
    { timeout: 120_000 }
  );
}

async function provisionPrimaryOrganization() {
  await provisionOrganization({
    orgId: IDS.orgPrimary,
    ownerUserId: IDS.userOwner,
    ownerAuthSubject: "seed-user-1",
    name: "Sample Contracting Co.",
    regionCode: "US-TX-AUSTIN",
    sessionSource: "seed:provision:primary",
  });

  const [owner, admin, dispatcher, technician, helper] = await Promise.all([
    provisionUser({
      orgId: IDS.orgPrimary,
      userId: IDS.userOwner,
      authSubject: "seed-user-1",
      email: "seed@example.com",
      fullName: "Seed User",
      sessionSource: "seed:user:owner",
    }),
    provisionUser({
      orgId: IDS.orgPrimary,
      userId: IDS.userAdmin,
      authSubject: "seed-admin-1",
      email: "admin@example.com",
      fullName: "Operations Admin",
      sessionSource: "seed:user:admin",
    }),
    provisionUser({
      orgId: IDS.orgPrimary,
      userId: IDS.userDispatcher,
      authSubject: "seed-dispatcher-1",
      email: "dispatch@example.com",
      fullName: "Dispatch Lead",
      sessionSource: "seed:user:dispatcher",
    }),
    provisionUser({
      orgId: IDS.orgPrimary,
      userId: IDS.userTechnician,
      authSubject: "seed-technician-1",
      email: "tech1@example.com",
      fullName: "Maya HVAC",
      sessionSource: "seed:user:technician",
    }),
    provisionUser({
      orgId: IDS.orgPrimary,
      userId: IDS.userHelper,
      authSubject: "seed-technician-2",
      email: "tech2@example.com",
      fullName: "Luis Helper",
      sessionSource: "seed:user:helper",
    }),
  ]);

  await Promise.all([
    provisionMembership({ orgId: IDS.orgPrimary, userId: owner.id, role: "owner", sessionSource: "seed:membership:owner" }),
    provisionMembership({ orgId: IDS.orgPrimary, userId: admin.id, role: "admin", sessionSource: "seed:membership:admin" }),
    provisionMembership({ orgId: IDS.orgPrimary, userId: dispatcher.id, role: "dispatcher", sessionSource: "seed:membership:dispatcher" }),
    provisionMembership({ orgId: IDS.orgPrimary, userId: technician.id, role: "technician", sessionSource: "seed:membership:technician" }),
    provisionMembership({ orgId: IDS.orgPrimary, userId: helper.id, role: "technician", sessionSource: "seed:membership:helper" }),
  ]);

  return {
    organization: { id: IDS.orgPrimary, name: "Sample Contracting Co.", regionCode: "US-TX-AUSTIN" },
    owner,
    admin,
    dispatcher,
    technician,
    helper,
  };
}

async function provisionSecondaryOrganization() {
  await provisionOrganization({
    orgId: IDS.orgSecondary,
    ownerUserId: IDS.userSecondOwner,
    ownerAuthSubject: "seed-user-2",
    name: "Second Sample Services",
    regionCode: "US-IN-INDIANAPOLIS",
    sessionSource: "seed:provision:secondary",
  });

  const [owner, dispatcher, technician] = await Promise.all([
    provisionUser({
      orgId: IDS.orgSecondary,
      userId: IDS.userSecondOwner,
      authSubject: "seed-user-2",
      email: "seed2@example.com",
      fullName: "Second Seed User",
      sessionSource: "seed:user:second-owner",
    }),
    provisionUser({
      orgId: IDS.orgSecondary,
      userId: IDS.userSecondDispatcher,
      authSubject: "seed-dispatcher-2",
      email: "dispatch2@example.com",
      fullName: "Second Dispatch",
      sessionSource: "seed:user:second-dispatcher",
    }),
    provisionUser({
      orgId: IDS.orgSecondary,
      userId: IDS.userSecondTechnician,
      authSubject: "seed-technician-3",
      email: "tech3@example.com",
      fullName: "Nina Spark",
      sessionSource: "seed:user:second-technician",
    }),
  ]);

  await Promise.all([
    provisionMembership({ orgId: IDS.orgSecondary, userId: owner.id, role: "owner", sessionSource: "seed:membership:second-owner" }),
    provisionMembership({ orgId: IDS.orgSecondary, userId: dispatcher.id, role: "dispatcher", sessionSource: "seed:membership:second-dispatcher" }),
    provisionMembership({ orgId: IDS.orgSecondary, userId: technician.id, role: "technician", sessionSource: "seed:membership:second-technician" }),
  ]);

  return {
    organization: { id: IDS.orgSecondary, name: "Second Sample Services", regionCode: "US-IN-INDIANAPOLIS" },
    owner,
    dispatcher,
    technician,
  };
}

interface ProvisionUserInput {
  orgId: string;
  userId: string;
  authSubject: string;
  email: string;
  fullName: string;
  sessionSource: string;
}

async function provisionOrganization(input: {
  orgId: string;
  ownerUserId: string;
  ownerAuthSubject: string;
  name: string;
  regionCode: string;
  sessionSource: string;
}) {
  return withSeedSession(
    {
      orgId: input.orgId,
      userId: input.ownerUserId,
      authSubject: input.ownerAuthSubject,
      provisioning: true,
      sessionSource: input.sessionSource,
    },
    async (tx) => {
      const existing = await tx.organization.findUnique({ where: { id: input.orgId } });
      if (existing) return existing;
      return tx.organization.create({
        data: {
          id: input.orgId,
          name: input.name,
          regionCode: input.regionCode,
        },
      });
    }
  );
}

async function provisionUser(input: ProvisionUserInput) {
  return withSeedSession(
    {
      orgId: input.orgId,
      userId: input.userId,
      authSubject: input.authSubject,
      provisioning: true,
      sessionSource: input.sessionSource,
    },
    async (tx) => {
      const existing = await tx.appUser.findFirst({ where: { authSubject: input.authSubject } });
      if (existing) {
        await tx.$queryRaw(Prisma.sql`
          select set_config('app.user_id', ${existing.id}, true)
        `);
        return tx.appUser.update({
          where: { id: existing.id },
          data: {
            email: input.email,
            fullName: input.fullName,
            isActive: true,
          },
        });
      }

      return tx.appUser.create({
        data: {
          id: input.userId,
          authSubject: input.authSubject,
          email: input.email,
          fullName: input.fullName,
          isActive: true,
        },
      });
    }
  );
}

async function provisionMembership(input: {
  orgId: string;
  userId: string;
  role: string;
  sessionSource: string;
}) {
  return withSeedSession(
    {
      orgId: input.orgId,
      userId: input.userId,
      provisioning: true,
      sessionSource: input.sessionSource,
    },
    async (tx) =>
      tx.organizationMembership.upsert({
        where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
        update: { role: input.role, status: "active" },
        create: { orgId: input.orgId, userId: input.userId, role: input.role, status: "active" },
      })
  );
}

async function resetPrimaryOrganizationData(tx: SeedTransaction) {
  await tx.siteVisit.deleteMany({ where: { project: { orgId: IDS.orgPrimary } } });
  await tx.projectTask.deleteMany({ where: { project: { orgId: IDS.orgPrimary } } });
  await tx.jobEquipment.deleteMany({
    where: { job: { orgId: IDS.orgPrimary } },
  });
  await tx.jobAssignment.deleteMany({
    where: { orgId: IDS.orgPrimary },
  });
  await tx.job.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.customerEquipment.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.project.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.serviceAddress.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.customer.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.assemblyItem.deleteMany({ where: { assembly: { orgId: IDS.orgPrimary } } });
  await tx.assembly.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.costItem.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.equipment.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.material.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.laborRate.deleteMany({ where: { orgId: IDS.orgPrimary } });
  await tx.subcategory.deleteMany({ where: { category: { division: { orgId: IDS.orgPrimary } } } });
  await tx.category.deleteMany({ where: { division: { orgId: IDS.orgPrimary } } });
  await tx.division.deleteMany({ where: { orgId: IDS.orgPrimary } });
}

async function seedPrimaryOrganizationData(
  tx: SeedTransaction,
  users: {
    owner: { id: string; authSubject: string; email: string };
    dispatcher: { id: string };
    technician: { id: string };
    helper: { id: string };
  }
) {
  await tx.organization.update({
    where: { id: IDS.orgPrimary },
    data: { name: "Sample Contracting Co.", regionCode: "US-TX-AUSTIN" },
  });
  await resetPrimaryOrganizationData(tx);

  const division = await tx.division.create({
    data: { id: IDS.division, orgId: IDS.orgPrimary, code: "02", name: "Sitework", sortOrder: 1 },
  });
  const category = await tx.category.create({
    data: { id: IDS.category, divisionId: division.id, code: "02-200", name: "Excavation", sortOrder: 1 },
  });
  const subcategory = await tx.subcategory.create({
    data: { id: IDS.subcategory, categoryId: category.id, code: "02-200-10", name: "Residential Excavation", sortOrder: 1 },
  });

  const laborRate = await tx.laborRate.create({
    data: {
      id: IDS.laborRate,
      orgId: IDS.orgPrimary,
      role: "Equipment Operator",
      description: "Seeded labor rate",
      hourlyCost: 32,
      billRate: 32,
      active: true,
      trade: "Equipment Operator",
      baseHourlyRate: 32,
      burdenPct: 28,
    },
  });

  const material = await tx.material.create({
    data: {
      id: IDS.material,
      orgId: IDS.orgPrimary,
      name: "Gravel Base, 3/4in",
      unitOfMeasure: "CY",
      unitCost: 38,
      wasteFactorPct: 5,
      lastPriceUpdate: new Date(),
    },
  });

  const equipment = await tx.equipment.create({
    data: {
      id: IDS.equipment,
      orgId: IDS.orgPrimary,
      name: "Mini Excavator, 5T",
      ownershipCostPerHour: 18,
      operatingCostPerHour: 12,
    },
  });

  const excavationCostItem = await tx.costItem.create({
    data: {
      id: IDS.costItemExcavation,
      orgId: IDS.orgPrimary,
      subcategoryId: subcategory.id,
      code: "02-200-10-001",
      name: "Excavation Per Cubic Yard",
      unitOfMeasure: "CY",
      productionRate: 20,
      laborRateId: laborRate.id,
      equipmentId: equipment.id,
    },
  });

  const gravelBaseCostItem = await tx.costItem.create({
    data: {
      id: IDS.costItemGravel,
      orgId: IDS.orgPrimary,
      subcategoryId: subcategory.id,
      code: "02-200-10-002",
      name: "Gravel Base, Install",
      unitOfMeasure: "CY",
      productionRate: 10,
      laborRateId: laborRate.id,
      materialId: material.id,
    },
  });

  const drivewayBaseTemplate = await tx.assembly.create({
    data: {
      id: IDS.assemblyTemplate,
      orgId: IDS.orgPrimary,
      code: "TPL-DRIVEWAY-BASE",
      name: "Residential Driveway Base Package",
      unitOfMeasure: "CY",
      description: "Excavation plus gravel base install, priced per cubic yard.",
      isTemplate: true,
    },
  });
  await tx.assemblyItem.createMany({
    data: [
      { assemblyId: drivewayBaseTemplate.id, costItemId: excavationCostItem.id, quantityPerUnit: 1, sortOrder: 1 },
      { assemblyId: drivewayBaseTemplate.id, costItemId: gravelBaseCostItem.id, quantityPerUnit: 1, sortOrder: 2 },
    ],
  });

  const customer = await tx.customer.create({
    data: { id: IDS.customerJane, orgId: IDS.orgPrimary, name: "Jane Homeowner", email: "jane@example.com" },
  });

  const primaryAddress = await tx.serviceAddress.create({
    data: {
      id: IDS.addressJanePrimary,
      orgId: IDS.orgPrimary,
      customerId: customer.id,
      label: "Primary",
      addressLine1: "101 Main Street",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      isPrimary: true,
    },
  });

  const project = await tx.project.create({
    data: {
      id: IDS.projectDrainage,
      orgId: IDS.orgPrimary,
      customerId: customer.id,
      name: "Backyard Drainage Fix",
      jobType: "Drainage Repair",
      status: "active",
    },
  });

  const remodelCustomer = await tx.customer.create({
    data: {
      id: IDS.customerCorey,
      orgId: IDS.orgPrimary,
      name: "Corey Remodel",
      email: "corey@example.com",
      phone: "512-555-0149",
    },
  });
  const remodelAddress = await tx.serviceAddress.create({
    data: {
      id: IDS.addressCoreyRemodel,
      orgId: IDS.orgPrimary,
      customerId: remodelCustomer.id,
      label: "Remodel Site",
      addressLine1: "505 Cedar Avenue",
      city: "Austin",
      state: "TX",
      postalCode: "78702",
      isPrimary: true,
    },
  });
  const remodelProject = await tx.project.create({
    data: {
      id: IDS.projectRemodel,
      orgId: IDS.orgPrimary,
      customerId: remodelCustomer.id,
      name: "Kitchen Remodel",
      jobType: "Remodel",
      status: "active",
    },
  });

  const condenser = await tx.customerEquipment.create({
    data: {
      id: IDS.equipmentCondenser,
      orgId: IDS.orgPrimary,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      name: "Condensing Unit",
      manufacturer: "Carrier",
      model: "24ABC6",
      serialNumber: "CARRIER-001",
      status: "active",
    },
  });
  const furnace = await tx.customerEquipment.create({
    data: {
      id: IDS.equipmentFurnace,
      orgId: IDS.orgPrimary,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      name: "Gas Furnace",
      manufacturer: "Carrier",
      model: "59TP6",
      serialNumber: "FURNACE-001",
      status: "active",
    },
  });

  const unscheduledJob = await tx.job.create({
    data: {
      id: IDS.jobUnscheduled,
      orgId: IDS.orgPrimary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      jobNumber: "JOB-2026-000001",
      title: "Drain inspection follow-up",
      description: "Return after proposal acceptance to finalize trench access plan.",
      jobType: "Drainage Repair",
      status: "unscheduled",
      priority: "medium",
      createdById: users.dispatcher.id,
    },
  });
  const scheduledJob = await tx.job.create({
    data: {
      id: IDS.jobScheduled,
      orgId: IDS.orgPrimary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      jobNumber: "JOB-2026-000002",
      title: "Cooling tune-up",
      description: "Standard maintenance visit with capacitor inspection.",
      jobType: "HVAC Service",
      status: "scheduled",
      priority: "high",
      scheduledStart: new Date("2026-07-16T13:00:00.000Z"),
      scheduledEnd: new Date("2026-07-16T15:00:00.000Z"),
      estimatedDurationMinutes: 120,
      createdById: users.dispatcher.id,
    },
  });
  const dispatchedJob = await tx.job.create({
    data: {
      id: IDS.jobDispatched,
      orgId: IDS.orgPrimary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      jobNumber: "JOB-2026-000003",
      title: "No-cool service call",
      description: "Unit not cooling, likely low refrigerant or failed contactor.",
      jobType: "HVAC Service",
      status: "dispatched",
      priority: "urgent",
      scheduledStart: new Date("2026-07-16T15:30:00.000Z"),
      scheduledEnd: new Date("2026-07-16T17:00:00.000Z"),
      estimatedDurationMinutes: 90,
      createdById: users.dispatcher.id,
    },
  });
  const onSiteJob = await tx.job.create({
    data: {
      id: IDS.jobOnSite,
      orgId: IDS.orgPrimary,
      projectId: remodelProject.id,
      customerId: remodelCustomer.id,
      serviceAddressId: remodelAddress.id,
      jobNumber: "JOB-2026-000004",
      title: "Demo and rough-in",
      description: "Active remodel phase with punch-list cleanup in progress.",
      jobType: "Remodel",
      status: "on_site",
      priority: "high",
      scheduledStart: new Date("2026-07-16T14:00:00.000Z"),
      scheduledEnd: new Date("2026-07-16T18:00:00.000Z"),
      actualStart: new Date("2026-07-16T14:05:00.000Z"),
      estimatedDurationMinutes: 240,
      createdById: users.dispatcher.id,
    },
  });
  const completedJob = await tx.job.create({
    data: {
      id: IDS.jobCompleted,
      orgId: IDS.orgPrimary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      jobNumber: "JOB-2026-000005",
      title: "Thermostat replacement",
      description: "Completed smart thermostat swap, ready for invoice review.",
      jobType: "HVAC Service",
      status: "completed",
      priority: "medium",
      scheduledStart: new Date("2026-07-15T14:00:00.000Z"),
      scheduledEnd: new Date("2026-07-15T15:00:00.000Z"),
      actualStart: new Date("2026-07-15T14:05:00.000Z"),
      actualEnd: new Date("2026-07-15T14:50:00.000Z"),
      completedAt: new Date("2026-07-15T14:50:00.000Z"),
      completedById: users.technician.id,
      readyForInvoiceAt: new Date("2026-07-15T15:00:00.000Z"),
      estimatedDurationMinutes: 60,
      createdById: users.dispatcher.id,
    },
  });
  const conflictJob = await tx.job.create({
    data: {
      id: IDS.jobConflict,
      orgId: IDS.orgPrimary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: primaryAddress.id,
      jobNumber: "JOB-2026-000006",
      title: "Intentional overlap test",
      description: "Seeded schedule conflict for validation and demos.",
      jobType: "HVAC Service",
      status: "scheduled",
      priority: "high",
      scheduledStart: new Date("2026-07-16T14:30:00.000Z"),
      scheduledEnd: new Date("2026-07-16T16:00:00.000Z"),
      estimatedDurationMinutes: 90,
      createdById: users.dispatcher.id,
    },
  });

  await tx.jobAssignment.createMany({
    data: [
      { orgId: IDS.orgPrimary, jobId: scheduledJob.id, userId: users.technician.id, assignmentRole: "lead", isLead: true, assignedById: users.dispatcher.id },
      { orgId: IDS.orgPrimary, jobId: scheduledJob.id, userId: users.helper.id, assignmentRole: "helper", isLead: false, assignedById: users.dispatcher.id },
      { orgId: IDS.orgPrimary, jobId: dispatchedJob.id, userId: users.technician.id, assignmentRole: "lead", isLead: true, assignedById: users.dispatcher.id },
      { orgId: IDS.orgPrimary, jobId: onSiteJob.id, userId: users.helper.id, assignmentRole: "lead", isLead: true, assignedById: users.dispatcher.id, acceptedAt: new Date("2026-07-16T13:55:00.000Z") },
      { orgId: IDS.orgPrimary, jobId: completedJob.id, userId: users.technician.id, assignmentRole: "lead", isLead: true, assignedById: users.dispatcher.id, acceptedAt: new Date("2026-07-15T13:45:00.000Z") },
      { orgId: IDS.orgPrimary, jobId: conflictJob.id, userId: users.technician.id, assignmentRole: "lead", isLead: true, assignedById: users.dispatcher.id },
    ],
  });
  await tx.jobEquipment.createMany({
    data: [
      { jobId: scheduledJob.id, equipmentId: condenser.id },
      { jobId: scheduledJob.id, equipmentId: furnace.id },
      { jobId: completedJob.id, equipmentId: furnace.id },
    ],
  });
  await tx.projectTask.createMany({
    data: [
      { projectId: project.id, jobId: scheduledJob.id, title: "Change return filter", status: "todo", priority: "medium" },
      { projectId: project.id, jobId: scheduledJob.id, title: "Document refrigerant pressures", status: "in_progress", priority: "high" },
    ],
  });
  await tx.siteVisit.create({
    data: {
      projectId: project.id,
      jobId: scheduledJob.id,
      notes: "Customer asked us to check the upstairs airflow while onsite.",
    },
  });

  return {
    organizationId: IDS.orgPrimary,
    ownerId: users.owner.id,
    ownerAuthSubject: users.owner.authSubject,
    ownerEmail: users.owner.email,
    templateAssemblyId: drivewayBaseTemplate.id,
    jobs: [unscheduledJob.id, scheduledJob.id, dispatchedJob.id, onSiteJob.id, completedJob.id, conflictJob.id],
  };
}

async function resetSecondaryOrganizationData(tx: SeedTransaction) {
  await tx.jobAssignment.deleteMany({ where: { orgId: IDS.orgSecondary } });
  await tx.job.deleteMany({ where: { orgId: IDS.orgSecondary } });
  await tx.project.deleteMany({ where: { orgId: IDS.orgSecondary } });
  await tx.serviceAddress.deleteMany({ where: { orgId: IDS.orgSecondary } });
  await tx.customer.deleteMany({ where: { orgId: IDS.orgSecondary } });
}

async function seedSecondaryOrganizationData(
  tx: SeedTransaction,
  users: {
    dispatcher: { id: string };
    technician: { id: string };
  }
) {
  await tx.organization.update({
    where: { id: IDS.orgSecondary },
    data: { name: "Second Sample Services", regionCode: "US-IN-INDIANAPOLIS" },
  });
  await resetSecondaryOrganizationData(tx);

  const customer = await tx.customer.create({
    data: {
      id: IDS.customerBob,
      orgId: IDS.orgSecondary,
      name: "Bob Facility Manager",
      email: "bob@example.com",
      phone: "317-555-0100",
    },
  });
  const address = await tx.serviceAddress.create({
    data: {
      id: IDS.addressBobPrimary,
      orgId: IDS.orgSecondary,
      customerId: customer.id,
      label: "Main Facility",
      addressLine1: "880 Meridian Park",
      city: "Indianapolis",
      state: "IN",
      postalCode: "46240",
      isPrimary: true,
    },
  });
  const project = await tx.project.create({
    data: {
      id: IDS.projectPanelUpgrade,
      orgId: IDS.orgSecondary,
      customerId: customer.id,
      name: "Panel Upgrade",
      jobType: "Electrical Service",
      status: "active",
    },
  });
  const job = await tx.job.create({
    data: {
      id: IDS.jobPanelUpgrade,
      orgId: IDS.orgSecondary,
      projectId: project.id,
      customerId: customer.id,
      serviceAddressId: address.id,
      jobNumber: "JOB-2026-000001",
      title: "Service panel upgrade",
      description: "Separate organization seed proving tenant isolation.",
      jobType: "Electrical Service",
      status: "scheduled",
      priority: "high",
      scheduledStart: new Date("2026-07-17T13:00:00.000Z"),
      scheduledEnd: new Date("2026-07-17T17:00:00.000Z"),
      estimatedDurationMinutes: 240,
      createdById: users.dispatcher.id,
    },
  });
  await tx.jobAssignment.create({
    data: {
      orgId: IDS.orgSecondary,
      jobId: job.id,
      userId: users.technician.id,
      assignmentRole: "lead",
      isLead: true,
      assignedById: users.dispatcher.id,
    },
  });

  return {
    organizationId: IDS.orgSecondary,
    ownerId: IDS.userSecondOwner,
    jobs: [job.id],
  };
}

async function main() {
  const [primaryProvisioned, secondaryProvisioned] = await Promise.all([
    provisionPrimaryOrganization(),
    provisionSecondaryOrganization(),
  ]);
  const primaryOrg = primaryProvisioned.organization;
  const secondaryOrg = secondaryProvisioned.organization;

  const primarySeed = await withSeedSession(
    {
      orgId: IDS.orgPrimary,
      userId: primaryProvisioned.owner.id,
      role: "owner",
      authSubject: primaryProvisioned.owner.authSubject,
      sessionSource: "seed:owner:primary",
    },
    (tx) =>
      seedPrimaryOrganizationData(tx, {
        owner: primaryProvisioned.owner,
        dispatcher: primaryProvisioned.dispatcher,
        technician: primaryProvisioned.technician,
        helper: primaryProvisioned.helper,
      })
  );

  const secondarySeed = await withSeedSession(
    {
      orgId: IDS.orgSecondary,
      userId: secondaryProvisioned.owner.id,
      role: "owner",
      authSubject: secondaryProvisioned.owner.authSubject,
      sessionSource: "seed:owner:secondary",
    },
    (tx) =>
      seedSecondaryOrganizationData(tx, {
        dispatcher: secondaryProvisioned.dispatcher,
        technician: secondaryProvisioned.technician,
      })
  );

  // eslint-disable-next-line no-console
  console.log("Seed complete:", {
    organizations: [primaryOrg.id, secondaryOrg.id],
    seedUserIds: [
      primaryProvisioned.owner.id,
      secondaryProvisioned.owner.id,
      primaryProvisioned.admin.id,
      primaryProvisioned.dispatcher.id,
      primaryProvisioned.technician.id,
      primaryProvisioned.helper.id,
      secondaryProvisioned.dispatcher.id,
      secondaryProvisioned.technician.id,
    ],
    templateAssemblyId: primarySeed.templateAssemblyId,
    jobs: [...primarySeed.jobs, ...secondarySeed.jobs],
  });

  if (process.env.PRINT_SEED_TOKEN === "true" && process.env.AUTH_JWT_SECRET) {
    const token = signAuthToken(
      {
        sub: primarySeed.ownerAuthSubject,
        email: primarySeed.ownerEmail,
        orgId: primarySeed.organizationId,
        role: "owner",
        iss: process.env.AUTH_ISSUER ?? "tradeos-costbook",
        aud: process.env.AUTH_AUDIENCE ?? "tradeos-costbook-api",
      },
      process.env.AUTH_JWT_SECRET
    );
    // eslint-disable-next-line no-console
    console.log("Dev bearer token:", token);
  }
}

assertSeedTargetIsNotProduction();

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await basePrisma.$disconnect();
  });
