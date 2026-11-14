import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { basePrisma, prisma } from "../db/client";
import { runWithDatabaseSession } from "../db/requestSession";
import { AdminDashboardService } from "../modules/admin-dashboard/service";

const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_ADMIN_URL } } });
const orgId = randomUUID();
const otherOrgId = randomUUID();
const ownerId = randomUUID();
const foreignId = randomUUID();
const actor = { orgId, userId: ownerId, role: "owner" as const };
const subjects: string[] = [];
const service = new AdminDashboardService();
const session = <T>(operation: () => Promise<T>) => runWithDatabaseSession(basePrisma, actor, operation);
function input() {
  const id = randomUUID();
  const authSubject = `synthetic-member:${id}`;
  subjects.push(authSubject);
  return { authSubject, email: `${id}@example.invalid`, fullName: "Synthetic member", role: "technician" as const };
}

beforeAll(async () => {
  const [role] = await basePrisma.$queryRawUnsafe<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user"
  );
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  const tables = await admin.$queryRawUnsafe<Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
    "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname IN ('users','organization_memberships','organization_membership_audits')"
  );
  expect(tables).toHaveLength(3);
  for (const table of tables) expect(table).toEqual({ relrowsecurity: true, relforcerowsecurity: true });
  await admin.organization.createMany({ data: [{ id: orgId, name: "Synthetic membership test" }, { id: otherOrgId, name: "Synthetic foreign org" }] });
  await admin.appUser.createMany({ data: [
    { id: ownerId, authSubject: `owner:${ownerId}`, email: `${ownerId}@example.invalid` },
    { id: foreignId, authSubject: `foreign:${foreignId}`, email: `${foreignId}@example.invalid`, fullName: "Foreign original", isActive: false },
  ] });
  await admin.organizationMembership.createMany({ data: [
    { orgId, userId: ownerId, role: "owner", status: "active" },
    { orgId: otherOrgId, userId: foreignId, role: "technician", status: "active" },
  ] });
}, 30_000);

afterAll(async () => {
  await admin.$executeRawUnsafe('DROP TRIGGER IF EXISTS synthetic_membership_audit_failure ON organization_membership_audits');
  await admin.$executeRawUnsafe('DROP FUNCTION IF EXISTS synthetic_membership_audit_failure()');
  await admin.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
  await admin.appUser.deleteMany({ where: { OR: [{ id: { in: [ownerId, foreignId] } }, { authSubject: { in: subjects } }] } });
  await Promise.all([basePrisma.$disconnect(), admin.$disconnect()]);
});

test("a verified owner creates a new member and audit under forced RLS, then restores provisioning", async () => {
  const data = input();
  await session(async () => {
    const result = await service.upsertOrganizationMember(orgId, data, actor);
    expect(result).toMatchObject({ authSubject: data.authSubject, role: "technician", status: "active" });
    const [context] = await prisma.$queryRawUnsafe<Array<{ provisioning: string | null }>>("SELECT current_setting('app.provisioning',true) AS provisioning");
    expect(context.provisioning).not.toBe("true");
    expect(await prisma.appUser.findUnique({ where: { id: foreignId } })).toBeNull();
  });
  expect(await admin.organizationMembershipAudit.count({ where: { orgId, action: "created" } })).toBe(1);
});

test("attaching a known foreign user preserves their global profile and other membership", async () => {
  const original = await admin.appUser.findUniqueOrThrow({ where: { id: foreignId } });
  const data = { ...input(), authSubject: original.authSubject, email: "must-not-change@example.invalid", fullName: "Must not change" };
  const result = await session(() => service.upsertOrganizationMember(orgId, data, actor));
  expect(result.userId).toBe(foreignId);
  expect(await admin.appUser.findUniqueOrThrow({ where: { id: foreignId } })).toMatchObject({ email: original.email, fullName: original.fullName, isActive: false });
  expect(await admin.organizationMembership.count({ where: { userId: foreignId } })).toBe(2);
});

test("existing own-organization member profile updates retain their current contract", async () => {
  const data = input();
  await session(() => service.upsertOrganizationMember(orgId, data, actor));
  const result = await session(() => service.upsertOrganizationMember(orgId, { ...data, fullName: "Updated own member" }, actor));
  expect(result.fullName).toBe("Updated own member");
});

test("a forged actor role or foreign organization cannot enter provisioning", async () => {
  const data = input();
  const unprivileged = await admin.appUser.create({ data: { authSubject: data.authSubject, email: data.email } });
  await admin.organizationMembership.create({ data: { orgId, userId: unprivileged.id, role: "technician", status: "active" } });
  await session(async () => {
    await expect(service.upsertOrganizationMember(orgId, input(), { ...actor, userId: unprivileged.id })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.upsertOrganizationMember(otherOrgId, input(), actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.upsertOrganizationMember(orgId, { ...input(), authSubject: `owner:${ownerId}` }, actor)).rejects.toMatchObject({ statusCode: 403 });
    const [context] = await prisma.$queryRawUnsafe<Array<{ provisioning: string | null }>>("SELECT current_setting('app.provisioning',true) AS provisioning");
    expect(context.provisioning).not.toBe("true");
  });
});

test("a late audit failure rolls back both new user and membership", async () => {
  const data = input();
  const membershipCount = await admin.organizationMembership.count({ where: { orgId } });
  const auditCount = await admin.organizationMembershipAudit.count({ where: { orgId } });
  await admin.$executeRawUnsafe(`CREATE FUNCTION synthetic_membership_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.org_id='${orgId}' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
  await admin.$executeRawUnsafe('CREATE TRIGGER synthetic_membership_audit_failure BEFORE INSERT ON organization_membership_audits FOR EACH ROW EXECUTE FUNCTION synthetic_membership_audit_failure()');
  try {
    await expect(session(() => service.upsertOrganizationMember(orgId, data, actor))).rejects.toThrow("synthetic audit failure");
    expect(await admin.organizationMembership.count({ where: { orgId } })).toBe(membershipCount);
    expect(await admin.organizationMembershipAudit.count({ where: { orgId } })).toBe(auditCount);
    expect(await admin.appUser.findUnique({ where: { authSubject: data.authSubject } })).toBeNull();
  } finally {
    await admin.$executeRawUnsafe('DROP TRIGGER synthetic_membership_audit_failure ON organization_membership_audits');
    await admin.$executeRawUnsafe('DROP FUNCTION synthetic_membership_audit_failure()');
  }
});
