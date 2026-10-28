import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { runWithDatabaseSession, getRequestDatabaseClient } from "../db/requestSession";
import { ProjectTasksService } from "../modules/project-tasks/service";
import { projectTasksController } from "../backend/controllers/projectTasks.controller";
import type { SupportedRole } from "../domain";
const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_ADMIN_URL! } } });
const app = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
const org = randomUUID(), foreignOrg = randomUUID(), owner = randomUUID(), tech = randomUUID(), peer = randomUUID(), outsider = randomUUID(), dispatcher = randomUUID(), estimator = randomUUID();
const project = randomUUID(), foreignProject = randomUUID(), customer = randomUUID(), address = randomUUID(), job = randomUUID(), assignment = randomUUID();
const session = <T>(userId: string, orgId: string, role: SupportedRole, op: () => Promise<T>) => runWithDatabaseSession(app, { userId, orgId, role }, op, "integration-test");
const tx = () => getRequestDatabaseClient()!;
async function task(assignedUserId: string | null = tech) { return admin.projectTask.create({ data: { projectId: project, jobId: job, title: "Inspect trim", assignedUserId, assignedTo: "Same display name" } }); }
async function save(id: string, revision: Date, status = "completed") {
  return session(tech, org, "technician", async () => {
    let result: unknown;
    await projectTasksController.updateAssignedStatus({ orgId: org, auth: { orgId: org, userId: tech, role: "technician" }, params: { jobId: job, taskId: id }, body: { status, expectedUpdatedAt: revision.toISOString() } } as never, { json: (value: unknown) => { result = value; } } as never);
    return result;
  });
}
describe("personal field task forced RLS and audited saves", () => {
  beforeAll(async () => {
    await admin.organization.createMany({ data: [{ id: org, name: "Field tasks A" }, { id: foreignOrg, name: "Field tasks B" }] });
    await admin.appUser.createMany({ data: [owner, tech, peer, outsider, dispatcher, estimator].map(id => ({ id, authSubject: `field-${id}`, email: `${id}@example.test` })) });
    await admin.organizationMembership.createMany({ data: [{ orgId: org, userId: owner, role: "owner" }, { orgId: org, userId: tech, role: "technician" }, { orgId: org, userId: peer, role: "technician" }, { orgId: foreignOrg, userId: outsider, role: "owner" }, { orgId: org, userId: dispatcher, role: "dispatcher" }, { orgId: org, userId: estimator, role: "estimator" }] });
    await admin.project.createMany({ data: [{ id: project, orgId: org, name: "Field tasks" }, { id: foreignProject, orgId: foreignOrg, name: "Foreign project" }] });
    await admin.customer.create({ data: { id: customer, orgId: org, name: "Field customer" } });
    await admin.serviceAddress.create({ data: { id: address, orgId: org, customerId: customer, addressLine1: "1 Test St", city: "Terre Haute", state: "IN", postalCode: "47802" } });
    await admin.job.create({ data: { id: job, orgId: org, projectId: project, customerId: customer, serviceAddressId: address, jobNumber: "FIELD-TASK-1", title: "Assigned work", description: "Test only", jobType: "Service", status: "scheduled", createdById: owner } });
    await admin.jobAssignment.createMany({ data: [{ id: assignment, orgId: org, jobId: job, userId: tech, assignmentRole: "technician", assignedById: owner }, { orgId: org, jobId: job, userId: peer, assignmentRole: "technician", assignedById: owner }] });
  });
  afterAll(async () => { await admin.organization.deleteMany({ where: { id: { in: [org, foreignOrg] } } }); await admin.appUser.deleteMany({ where: { id: { in: [owner, tech, peer, outsider, dispatcher, estimator] } } }); await app.$disconnect(); await admin.$disconnect(); });
  it("saves an explicit personal task with exactly one audited completion", async () => {
    const row = await task(); await save(row.id, row.updatedAt);
    const stored = await admin.projectTask.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe("completed"); expect(stored.completedAt).not.toBeNull(); expect(stored.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    expect(await admin.activityEvent.count({ where: { entityId: row.id, actorUserId: tech, eventType: "task.completed" } })).toBe(1);
  });
  it("denies another person's task and a matching legacy display name", async () => {
    for (const identity of [peer, null]) { const row = await task(identity); await expect(save(row.id, row.updatedAt)).rejects.toMatchObject({ statusCode: 404 }); }
    expect(await session(tech, org, "technician", () => tx().projectTask.updateMany({ where: { projectId: foreignProject }, data: { status: "completed" } }))).toMatchObject({ count: 0 });
  });
  it("enforces immutable columns and denies technician creation/deletion", async () => {
    const row = await task();
    for (const data of [{ title: "Tampered" }, { assignedUserId: peer }, { jobId: null }, { dueDate: new Date() }]) await expect(session(tech, org, "technician", () => tx().projectTask.update({ where: { id: row.id }, data }))).rejects.toThrow();
    await expect(session(tech, org, "technician", () => tx().projectTask.create({ data: { projectId: project, jobId: job, title: "Forbidden" } }))).rejects.toThrow();
    expect(await session(tech, org, "technician", () => tx().projectTask.deleteMany({ where: { id: row.id } }))).toMatchObject({ count: 0 });
  });
  it("rejects removed, declined and inactive assignments and terminal jobs", async () => {
    const row = await task();
    try {
      for (const data of [{ removedAt: new Date(), declinedAt: null }, { removedAt: null, declinedAt: new Date() }]) {
        await admin.jobAssignment.update({ where: { id: assignment }, data }); await expect(save(row.id, row.updatedAt)).rejects.toMatchObject({ statusCode: 404 });
      }
      await admin.jobAssignment.update({ where: { id: assignment }, data: { removedAt: null, declinedAt: null } });
      for (const status of ["completed", "cancelled"]) { await admin.job.update({ where: { id: job }, data: { status } }); await expect(save(row.id, row.updatedAt)).rejects.toMatchObject({ statusCode: 404 }); }
      await admin.job.update({ where: { id: job }, data: { status: "scheduled" } });
      await admin.organizationMembership.update({ where: { orgId_userId: { orgId: org, userId: tech } }, data: { status: "disabled" } });
      expect(await session(tech, org, "technician", () => tx().projectTask.updateMany({ where: { id: row.id }, data: { status: "completed" } }))).toMatchObject({ count: 0 });
    } finally { await admin.jobAssignment.update({ where: { id: assignment }, data: { removedAt: null, declinedAt: null } }); await admin.job.update({ where: { id: job }, data: { status: "scheduled" } }); await admin.organizationMembership.update({ where: { orgId_userId: { orgId: org, userId: tech } }, data: { status: "active" } }); }
  });
  it("permits one concurrent revision winner and no duplicate audit", async () => {
    const row = await task(); const outcomes = await Promise.allSettled([save(row.id, row.updatedAt), save(row.id, row.updatedAt, "blocked")]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(r => r.status === "rejected").map(r => (r as PromiseRejectedResult).reason.statusCode)).toEqual([409]);
    expect(await admin.activityEvent.count({ where: { entityId: row.id } })).toBe(1);
  });
  it("serializes assignment revocation after an in-flight task save", async () => {
    const row = await task();
    let release!: () => void, signal!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { signal = resolve; });
    const pendingSave = session(tech, org, "technician", async () => {
      const result = await new ProjectTasksService().updateAssignedStatus({ orgId: org, userId: tech, jobId: job, taskId: row.id, status: "in_progress", expectedUpdatedAt: row.updatedAt });
      signal(); await held; return result;
    });
    let revoke: Promise<unknown> | undefined;
    try {
      await Promise.race([ready, pendingSave.then(() => { throw new Error("Save did not expose held locks"); })]);
      let pid!: number, revokeSignal!: () => void;
      const revokeReady = new Promise<void>(resolve => { revokeSignal = resolve; });
      revoke = session(owner, org, "owner", async () => {
        const rows = await tx().$queryRaw<Array<{ pid: number }>>(Prisma.sql`select pg_backend_pid() as pid`); pid = rows[0].pid; revokeSignal();
        await tx().jobAssignment.update({ where: { id: assignment }, data: { removedAt: new Date() } });
      });
      await revokeReady;
      let blocked = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const rows = await admin.$queryRaw<Array<{ wait_event_type: string | null }>>(Prisma.sql`select wait_event_type from pg_stat_activity where pid = ${pid}`);
        if (rows[0]?.wait_event_type === "Lock") { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(blocked).toBe(true);
      release(); const saved = await pendingSave; await revoke;
      await expect(save(row.id, new Date(saved.updatedAt))).rejects.toMatchObject({ statusCode: 404 });
    } finally { release(); await pendingSave.catch(() => {}); if (revoke) await revoke.catch(() => {}); await admin.jobAssignment.update({ where: { id: assignment }, data: { removedAt: null } }); }
  });

  it("retains office assignment validation and cross-tenant invisibility", async () => {
    await expect(session(owner, org, "owner", () => new ProjectTasksService().create({ orgId: org, projectId: project, jobId: job, assignedUserId: outsider, title: "Foreign user" }))).rejects.toMatchObject({ statusCode: 400 });
    const row = await task();
    await expect(session(outsider, foreignOrg, "owner", () => new ProjectTasksService().updateAssignedStatus({ orgId: org, userId: tech, jobId: job, taskId: row.id, status: "completed", expectedUpdatedAt: row.updatedAt }))).rejects.toMatchObject({ statusCode: 404 });
    const created = await session(owner, org, "owner", () => new ProjectTasksService().create({ orgId: org, projectId: project, jobId: job, assignedUserId: tech, title: "Valid assignment" })); expect(created.assignedUserId).toBe(tech);
  });
  it("lets dispatcher sessions list assignees and create assigned tasks, and preserves estimator ordinary writes", async () => {
    const members = await session(dispatcher, org, "dispatcher", () => new ProjectTasksService().listAssignableMembers(org, project));
    expect(members.map(m => m.userId)).toEqual(expect.arrayContaining([owner, tech, peer]));
    expect(members.every(m => m.status === "active")).toBe(true);
    const assigned = await session(dispatcher, org, "dispatcher", () => new ProjectTasksService().create({ orgId: org, projectId: project, jobId: job, assignedUserId: tech, title: "Dispatcher-assigned work" }));
    expect(assigned.assignedUserId).toBe(tech);
    const storedAssigned = await admin.projectTask.findUniqueOrThrow({ where: { id: assigned.id } });
    expect(storedAssigned.assignedUserId).toBe(tech); expect(storedAssigned.title).toBe("Dispatcher-assigned work");
    const written = await session(estimator, org, "estimator", () => new ProjectTasksService().create({ orgId: org, projectId: project, title: "Estimator ordinary write" }));
    const persisted = await admin.projectTask.findUniqueOrThrow({ where: { id: written.id } });
    expect(persisted.title).toBe("Estimator ordinary write");
  });
});
