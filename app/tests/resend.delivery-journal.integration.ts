import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createPrismaResendDeliveryJournalStore } from "../db/resendDeliveryJournalStore";
import { processVerifiedResendDeliveryEvent, recordOutboundDeliveryMessage } from "../modules/email/deliveryJournal";

function required(name: string): string {
  if (!process.env[name]) throw new Error(`${name} is required for disposable PostgreSQL evidence`);
  return process.env[name]!;
}
const admin = new PrismaClient({ datasources: { db: { url: required("TEST_DATABASE_ADMIN_URL") } } });
const client = new PrismaClient({ datasources: { db: { url: required("TEST_DATABASE_URL") } } });
const store = createPrismaResendDeliveryJournalStore(client);
const orgId = randomUUID();
async function outbound() {
  const id = randomUUID();
  await recordOutboundDeliveryMessage(store, { providerMessageId: id, kind: "team_invite", orgId });
  return id;
}
function event(id: string, type: string, createdAt: string) {
  return { svixId: randomUUID(), type, createdAt, data: { email_id: id }, rawPayload: Buffer.from(JSON.stringify({ type, created_at: createdAt, data: { email_id: id } })) };
}
async function read(id: string) {
  const rows = await admin.$queryRaw<Array<{ status: string; suppression_candidate: boolean }>>`select status, suppression_candidate from email_delivery_messages where provider_message_id = ${id}`;
  return rows[0];
}
describe("Resend delivery journal event ordering (real PostgreSQL)", () => {
  beforeAll(async () => { await admin.organization.create({ data: { id: orgId, name: "Disposable email ordering fixture" } }); });
  afterAll(async () => {
    await admin.$executeRaw`delete from email_delivery_events where org_id = ${orgId}::uuid`;
    await admin.organization.delete({ where: { id: orgId } });
    await Promise.all([client.$disconnect(), admin.$disconnect()]);
  });
  it("retains delivered status when an older sent callback arrives later", async () => {
    const id = await outbound();
    await processVerifiedResendDeliveryEvent(store, event(id, "email.delivered", "2026-11-06T12:02:00Z"));
    await processVerifiedResendDeliveryEvent(store, event(id, "email.sent", "2026-11-06T12:01:00Z"));
    expect((await read(id)).status).toBe("delivered");
  });
  it("retains every event and a bounce candidate even when the bounce is older", async () => {
    const id = await outbound();
    await processVerifiedResendDeliveryEvent(store, event(id, "email.delivered", "2026-11-06T12:02:00Z"));
    await processVerifiedResendDeliveryEvent(store, event(id, "email.bounced", "2026-11-06T12:01:00Z"));
    expect(await read(id)).toEqual({ status: "delivered", suppression_candidate: true });
    const rows = await admin.$queryRaw<Array<{ count: bigint }>>`select count(*) as count from email_delivery_events where provider_message_id = ${id}`;
    expect(Number(rows[0].count)).toBe(2);
  });
  it("still advances status for a genuinely newer event and ignores unrelated event types", async () => {
    const id = await outbound();
    await processVerifiedResendDeliveryEvent(store, event(id, "email.sent", "2026-11-06T12:01:00Z"));
    await processVerifiedResendDeliveryEvent(store, event(id, "email.opened", "2026-11-06T12:03:00Z"));
    const delivered = event(id, "email.delivered", "2026-11-06T12:02:00Z");
    await processVerifiedResendDeliveryEvent(store, delivered);
    expect((await processVerifiedResendDeliveryEvent(store, delivered)).outcome).toBe("duplicate");
    expect((await read(id)).status).toBe("delivered");
    const rows = await admin.$queryRaw<Array<{ count: bigint }>>`select count(*) as count from email_delivery_events where provider_message_id = ${id}`;
    expect(Number(rows[0].count)).toBe(3);
  });
  it("normalizes timezone offsets and preserves newest status under concurrent callbacks", async () => {
    const id = await outbound();
    await Promise.all([
      processVerifiedResendDeliveryEvent(store, event(id, "email.delivered", "2026-11-06T12:02:00Z")),
      processVerifiedResendDeliveryEvent(store, event(id, "email.sent", "2026-11-06T13:01:00+01:00")),
    ]);
    expect((await read(id)).status).toBe("delivered");
  });
});
