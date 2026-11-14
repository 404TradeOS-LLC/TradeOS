import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Only the post-read rendezvous is instrumented. All service writes, SQL,
// row locks, triggers and forced RLS use the real restricted-role database.
let mockAfterTokenRead: () => Promise<void> = async () => {};
jest.mock("../db/client", () => {
  const { PrismaClient } = jest.requireActual("@prisma/client");
  const client = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } });
  const extended = client.$extends({ query: {
    passwordResetToken: { async findUnique({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
      const result = await query(args); await mockAfterTokenRead(); return result;
    } },
    organizationInvite: { async findUnique({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
      const result = await query(args); await mockAfterTokenRead(); return result;
    } },
  } });
  return { basePrisma: extended, prisma: extended };
});

import { basePrisma } from "../db/client";
import { AuthService } from "../modules/auth/service";
import { verifyPassword } from "../backend/auth/password";

const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_ADMIN_URL } } });
const orgId = randomUUID();
const userId = randomUUID();
const email = `token-race-${userId}@example.invalid`;
const fixtureEmails = [email];
const originalSecret = process.env.AUTH_JWT_SECRET;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function rendezvous() {
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => { release = resolve; });
  return async () => { if (++arrivals === 2) release(); await ready; };
}

function assertSingleWinner(results: PromiseSettledResult<unknown>[], message: string) {
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const loser = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  expect(loser.reason).toMatchObject({ statusCode: 400, message });
}

beforeAll(async () => {
  process.env.AUTH_JWT_SECRET = "synthetic-integration-signing-secret";
  const [role] = await basePrisma.$queryRawUnsafe<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(
    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  );
  expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  const tables = await admin.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>(
    "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('password_reset_tokens', 'organization_invites')"
  );
  expect(tables).toHaveLength(2);
  for (const table of tables) expect(table).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
  await admin.organization.create({ data: { id: orgId, name: "Synthetic token race" } });
  await admin.appUser.create({ data: { id: userId, authSubject: `local:${userId}`, email, fullName: "Synthetic user" } });
}, 30_000);

afterAll(async () => {
  await admin.organization.deleteMany({ where: { id: orgId } });
  await admin.appUser.deleteMany({ where: { email: { in: fixtureEmails } } });
  if (originalSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = originalSecret;
  await Promise.all([basePrisma.$disconnect(), admin.$disconnect()]);
});

test("concurrent reset requests that both read a valid token allow exactly one credential change", async () => {
  const token = randomUUID();
  await admin.passwordResetToken.create({ data: { userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + 60_000) } });
  mockAfterTokenRead = rendezvous();
  const passwords = ["synthetic-reset-first", "synthetic-reset-second"];
  const results = await Promise.allSettled(passwords.map((password) => new AuthService().resetPassword({ token, password })));
  assertSingleWinner(results, "Password reset token is invalid or expired");
  const winner = results.findIndex((result) => result.status === "fulfilled");
  const user = await admin.appUser.findUniqueOrThrow({ where: { id: userId } });
  expect(await verifyPassword(passwords[winner], user.passwordHash!)).toBe(true);
  expect(await verifyPassword(passwords[1 - winner], user.passwordHash!)).toBe(false);
  const consumed = await admin.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: digest(token) } });
  expect(consumed.consumedAt).toBeInstanceOf(Date);
}, 30_000);

test("concurrent invite acceptance allows one membership/session and preserves the winner's password", async () => {
  const token = randomUUID();
  await admin.organizationInvite.create({ data: {
    orgId, email, role: "technician", invitedByUserId: userId,
    tokenHash: digest(token), expiresAt: new Date(Date.now() + 60_000),
  } });
  mockAfterTokenRead = rendezvous();
  const passwords = ["synthetic-invite-first", "synthetic-invite-second"];
  const results = await Promise.allSettled(passwords.map((password) => new AuthService().acceptInvite({ token, password })));
  if (!results.some((result) => result.status === "fulfilled")) {
    throw new AggregateError(results.map((result) => (result as PromiseRejectedResult).reason), "Both invite transactions failed");
  }
  assertSingleWinner(results, "Invite is invalid or expired");
  const winner = results.findIndex((result) => result.status === "fulfilled");
  const user = await admin.appUser.findUniqueOrThrow({ where: { id: userId } });
  expect(await verifyPassword(passwords[winner], user.passwordHash!)).toBe(true);
  expect(await verifyPassword(passwords[1 - winner], user.passwordHash!)).toBe(false);
  expect(await admin.organizationMembership.count({ where: { orgId, userId } })).toBe(1);
  expect(await admin.authRefreshToken.count({ where: { orgId, userId } })).toBe(1);
  const invite = await admin.organizationInvite.findUniqueOrThrow({ where: { tokenHash: digest(token) } });
  expect(invite).toMatchObject({ status: "accepted", acceptedAt: expect.any(Date) });
}, 30_000);


test("a valid invite provisions a new user under the restricted role", async () => {
  mockAfterTokenRead = async () => {};
  const token = randomUUID();
  const invitedEmail = `new-${randomUUID()}@example.invalid`;
  fixtureEmails.push(invitedEmail);
  await admin.organizationInvite.create({ data: {
    orgId, email: invitedEmail, role: "dispatcher", invitedByUserId: userId,
    tokenHash: digest(token), expiresAt: new Date(Date.now() + 60_000),
  } });
  const result = await new AuthService().acceptInvite({ token, password: "synthetic-new-user" });
  expect(result).toMatchObject({ role: "dispatcher", organization: { id: orgId }, user: { email: invitedEmail } });
  expect(await admin.organizationMembership.count({ where: { orgId, userId: result.user.id, status: "active" } })).toBe(1);
  expect(await admin.authRefreshToken.count({ where: { orgId, userId: result.user.id } })).toBe(1);
  await expect(new AuthService().acceptInvite({ token, password: "synthetic-replay" }))
    .rejects.toMatchObject({ statusCode: 400, message: "Invite is invalid or expired" });
  const user = await admin.appUser.findUniqueOrThrow({ where: { id: result.user.id } });
  expect(await verifyPassword("synthetic-new-user", user.passwordHash!)).toBe(true);
  expect(await admin.authRefreshToken.count({ where: { orgId, userId: result.user.id } })).toBe(1);
  const [context] = await basePrisma.$queryRawUnsafe<Array<{ provisioning: boolean }>>(
    "SELECT coalesce(current_setting('app.provisioning', true), '') = 'true' AS provisioning"
  );
  expect(context.provisioning).toBe(false);
}, 30_000);

test("a later session failure rolls back invite claim, user, membership and refresh writes", async () => {
  mockAfterTokenRead = async () => {};
  const token = randomUUID();
  const invitedEmail = `rollback-${randomUUID()}@example.invalid`;
  fixtureEmails.push(invitedEmail);
  await admin.organizationInvite.create({ data: {
    orgId, email: invitedEmail, role: "technician", invitedByUserId: userId,
    tokenHash: digest(token), expiresAt: new Date(Date.now() + 60_000),
  } });
  delete process.env.AUTH_JWT_SECRET;
  try {
    await expect(new AuthService().acceptInvite({ token, password: "synthetic-rollback" }))
      .rejects.toMatchObject({ statusCode: 500, message: "AUTH_JWT_SECRET is not configured" });
  } finally {
    process.env.AUTH_JWT_SECRET = "synthetic-integration-signing-secret";
  }
  const invite = await admin.organizationInvite.findUniqueOrThrow({ where: { tokenHash: digest(token) } });
  expect(invite).toMatchObject({ status: "pending", acceptedAt: null });
  expect(await admin.appUser.findUnique({ where: { email: invitedEmail } })).toBeNull();
  // Retry proves the rolled-back token is still usable, without a partial user.
  const result = await new AuthService().acceptInvite({ token, password: "synthetic-retry" });
  expect(await admin.organizationMembership.count({ where: { orgId, userId: result.user.id } })).toBe(1);
  expect(await admin.authRefreshToken.count({ where: { orgId, userId: result.user.id } })).toBe(1);
}, 30_000);
