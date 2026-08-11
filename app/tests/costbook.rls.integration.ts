import { PrismaClient } from "@prisma/client";
import { prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import type { SupportedRole } from "../domain";

// Live RLS coverage for the C001 Costbook workspace foundation. Unit tests
// cover CostbookService's organization-scoped queries; this suite proves the
// database policies enforce the same tenant and role boundaries independently.
const appDatabaseUrl = requiredEnvironment("TEST_DATABASE_URL");
const adminDatabaseUrl = requiredEnvironment("TEST_DATABASE_ADMIN_URL");
const appClient = new PrismaClient({ datasources: { db: { url: appDatabaseUrl } } });
const adminClient = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });

const orgA = "71000000-0000-0000-0000-000000000001";
const orgB = "81000000-0000-0000-0000-000000000002";
const ownerA = "71000000-0000-0000-0000-000000000011";
const technicianA = "71000000-0000-0000-0000-000000000012";
const ownerB = "81000000-0000-0000-0000-000000000021";
const membershipOwnerA = "71000000-0000-0000-0000-000000000031";
const membershipTechA = "71000000-0000-0000-0000-000000000032";
const membershipOwnerB = "81000000-0000-0000-0000-000000000041";
const workspaceA = "71000000-0000-0000-0000-000000000051";
const workspaceB = "81000000-0000-0000-0000-000000000052";
const materialA = "71000000-0000-0000-0000-000000000061";
const materialB = "81000000-0000-0000-0000-000000000062";
const laborRateA = "71000000-0000-0000-0000-000000000071";
const laborRateB = "81000000-0000-0000-0000-000000000072";

describe("live row-level security for the C001 costbook workspace foundation", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "Costbook RLS Org A" }, { id: orgB, name: "Costbook RLS Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: ownerA, authSubject: "costbook-owner-a", email: "costbook-owner-a@example.com" },
        { id: technicianA, authSubject: "costbook-technician-a", email: "costbook-technician-a@example.com" },
        { id: ownerB, authSubject: "costbook-owner-b", email: "costbook-owner-b@example.com" },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipOwnerA, orgId: orgA, userId: ownerA, role: "owner", status: "active" },
        { id: membershipTechA, orgId: orgA, userId: technicianA, role: "technician", status: "active" },
        { id: membershipOwnerB, orgId: orgB, userId: ownerB, role: "owner", status: "active" },
      ],
    });

    await inSession(ownerA, orgA, "owner", () =>
      prisma.costbookWorkspace.create({
        data: { id: workspaceA, organizationId: orgA, setupState: { source: "integration-test" } },
      })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.costbookWorkspace.create({
        data: { id: workspaceB, organizationId: orgB, setupState: { source: "integration-test" } },
      })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.material.create({
        data: { id: materialA, orgId: orgA, sku: "ORG-A-CONC", name: "Org A Concrete", unitOfMeasure: "CY", unitCost: 150 },
      })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.material.create({
        data: { id: materialB, orgId: orgB, sku: "ORG-B-CONC", name: "Org B Concrete", unitOfMeasure: "CY", unitCost: 175 },
      })
    );
    await inSession(ownerA, orgA, "owner", () =>
      prisma.laborRate.create({
        data: {
          id: laborRateA,
          orgId: orgA,
          role: "Lead Carpenter",
          description: "Org A labor rate",
          hourlyCost: 42.5,
          billRate: 85,
          active: true,
          trade: "Lead Carpenter",
          baseHourlyRate: 42.5,
          burdenPct: 0,
        },
      })
    );
    await inSession(ownerB, orgB, "owner", () =>
      prisma.laborRate.create({
        data: {
          id: laborRateB,
          orgId: orgB,
          role: "Field Electrician",
          description: "Org B labor rate",
          hourlyCost: 48,
          billRate: 96,
          active: true,
          trade: "Field Electrician",
          baseHourlyRate: 48,
          burdenPct: 0,
        },
      })
    );
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("lets a technician read their organization's Costbook workspace", async () => {
    const rows = await inSession(technicianA, orgA, "technician", () => prisma.costbookWorkspace.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(workspaceA);
  });

  it("hides another organization's Costbook workspace from an owner", async () => {
    const crossOrg = await inSession(ownerA, orgA, "owner", () => prisma.costbookWorkspace.findMany({ where: { id: workspaceB } }));
    expect(crossOrg).toHaveLength(0);
  });

  it("scopes materials by organization at the database layer", async () => {
    const techRows = await inSession(technicianA, orgA, "technician", () => prisma.material.findMany({ orderBy: { name: "asc" } }));
    const crossOrgRows = await inSession(ownerA, orgA, "owner", () => prisma.material.findMany({ where: { id: materialB } }));

    expect(techRows.map((row) => row.id)).toEqual([materialA]);
    expect(crossOrgRows).toEqual([]);
  });

  it("scopes labor rates by organization at the database layer", async () => {
    const techRows = await inSession(technicianA, orgA, "technician", () => prisma.laborRate.findMany({ orderBy: { role: "asc" } }));
    const crossOrgRows = await inSession(ownerA, orgA, "owner", () => prisma.laborRate.findMany({ where: { id: laborRateB } }));

    expect(techRows.map((row) => row.id)).toEqual([laborRateA]);
    expect(crossOrgRows).toEqual([]);
  });

  it("rejects technician writes to materials", async () => {
    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.material.create({
          data: { orgId: orgA, name: "Technician Attempt", unitOfMeasure: "EA", unitCost: 12 },
        })
      )
    ).rejects.toBeTruthy();

    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.material.update({ where: { id: materialA }, data: { name: "Technician Edit Attempt" } })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects technician writes to labor rates", async () => {
    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.laborRate.create({
          data: {
            orgId: orgA,
            role: "Technician Attempt",
            hourlyCost: 25,
            billRate: 40,
            active: true,
            trade: "Technician Attempt",
            baseHourlyRate: 25,
            burdenPct: 0,
          },
        })
      )
    ).rejects.toBeTruthy();

    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.laborRate.update({ where: { id: laborRateA }, data: { billRate: 90 } })
      )
    ).rejects.toBeTruthy();
  });

  it("rejects technician writes to Costbook workspace foundation tables", async () => {
    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.costbookWorkspace.create({
          data: { organizationId: orgA, setupState: { source: "technician-write-attempt" } },
        })
      )
    ).rejects.toBeTruthy();

    await expect(
      inSession(technicianA, orgA, "technician", () =>
        prisma.costbookWorkspaceEvent.create({
          data: {
            organizationId: orgA,
            costbookWorkspaceId: workspaceA,
            eventType: "technician_write_attempt",
            actorUserId: technicianA,
            actorRole: "technician",
          },
        })
      )
    ).rejects.toBeTruthy();
  });

  it("lets owner/admin-capable actors create same-organization Costbook workspace events", async () => {
    const event = await inSession(ownerA, orgA, "owner", () =>
      prisma.costbookWorkspaceEvent.create({
        data: {
          organizationId: orgA,
          costbookWorkspaceId: workspaceA,
          eventType: "workspace_foundation_verified",
          actorUserId: ownerA,
          actorRole: "owner",
        },
      })
    );

    expect(event.organizationId).toBe(orgA);
    expect(event.costbookWorkspaceId).toBe(workspaceA);
  });

  it("rejects Costbook workspace events whose organization does not match the workspace", async () => {
    await expect(
      inSession(ownerA, orgA, "owner", () =>
        prisma.costbookWorkspaceEvent.create({
          data: {
            organizationId: orgA,
            costbookWorkspaceId: workspaceB,
            eventType: "cross_org_event_attempt",
            actorUserId: ownerA,
            actorRole: "owner",
          },
        })
      )
    ).rejects.toBeTruthy();
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "integration-test");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live Costbook RLS integration tests`);
  return value;
}
