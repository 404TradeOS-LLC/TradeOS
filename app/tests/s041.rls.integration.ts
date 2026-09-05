import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { ChangeOrdersService } from "../modules/change-orders/service";
import { SupplierDatabaseService } from "../modules/supplier-database/service";
import type { SupportedRole } from "../domain";

const appClient = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_URL") } } });
const adminClient = new PrismaClient({ datasources: { db: { url: requiredEnvironment("TEST_DATABASE_ADMIN_URL") } } });
const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const membershipA = randomUUID();
const membershipB = randomUUID();
const projectA = randomUUID();

describe("S041 changed-surface tenant boundaries", () => {
  beforeAll(async () => {
    await adminClient.organization.createMany({ data: [{ id: orgA, name: "S041 Org A" }, { id: orgB, name: "S041 Org B" }] });
    await adminClient.appUser.createMany({
      data: [
        { id: userA, authSubject: `s041-a-${userA}`, email: `s041-a-${userA}@example.com` },
        { id: userB, authSubject: `s041-b-${userB}`, email: `s041-b-${userB}@example.com` },
      ],
    });
    await adminClient.organizationMembership.createMany({
      data: [
        { id: membershipA, orgId: orgA, userId: userA, role: "owner", status: "active" },
        { id: membershipB, orgId: orgB, userId: userB, role: "owner", status: "active" },
      ],
    });
    await adminClient.project.create({ data: { id: projectA, orgId: orgA, name: "S041 project" } });
  });

  afterAll(async () => {
    await adminClient.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await appClient.$disconnect();
    await adminClient.$disconnect();
  });

  it("allows same-organization reads and denies cross-organization reads for suppliers and change orders", async () => {
    const supplier = await inSession(userA, orgA, "owner", () => new SupplierDatabaseService().create({ orgId: orgA, name: "S041 Supplier" }));
    const changeOrder = await inSession(userA, orgA, "owner", () => new ChangeOrdersService().create({ projectId: projectA, description: "S041 change" , orgId: orgA }));

    await expect(inSession(userA, orgA, "owner", () => new SupplierDatabaseService().getById(supplier.id, orgA))).resolves.toMatchObject({ id: supplier.id });
    await expect(inSession(userA, orgA, "owner", () => new ChangeOrdersService().getById(changeOrder.id, orgA))).resolves.toMatchObject({ id: changeOrder.id });
    await expect(inSession(userB, orgB, "owner", () => new SupplierDatabaseService().getById(supplier.id, orgB))).rejects.toMatchObject({ statusCode: 404 });
    await expect(inSession(userB, orgB, "owner", () => new ChangeOrdersService().getById(changeOrder.id, orgB))).rejects.toMatchObject({ statusCode: 404 });
  });
});

function inSession<T>(userId: string, orgId: string, role: SupportedRole, operation: () => Promise<T>): Promise<T> {
  return runWithDatabaseSession(appClient, { userId, orgId, role }, operation, "s041-integration");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for S041 integration tests`);
  return value;
}
