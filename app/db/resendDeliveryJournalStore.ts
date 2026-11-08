import { Prisma } from "@prisma/client";
import { basePrisma } from "./client";
import { getDatabaseTransactionMaxWait } from "./requestSession";
import { KNOWN_RESEND_DELIVERY_EVENTS, type DeliveryJournalStore } from "../modules/email/deliveryJournal";

/**
 * Durable Prisma adapter for the Resend delivery journal (issue #927).
 *
 * The module in `app/modules/email/deliveryJournal.ts` owns the processing
 * contract; database access stays here, mirroring
 * `app/db/athenaActionIdempotencyStore.ts`, so the email module keeps its
 * import boundary.
 *
 * Privileged boundary: both tables have FORCE ROW LEVEL SECURITY and no
 * tenant session can write them. Every method below runs in its own
 * transaction that first sets the transaction-local `app.resend_webhook`
 * flag, exactly like the `app.login_lookup` flag used for pre-auth lookups.
 * The RLS policies only widen writes for the duration of that transaction.
 * The store is server-only: its only callers are the Svix-verified webhook
 * route (after #923 merges) and the outbound send call sites, which record
 * a sent message after Resend returns a provider id.
 *
 * Atomicity: the inbox insert and the journal status update share one
 * transaction, so the route acknowledges an event only after the durable
 * write commits. A duplicate `svix-id` is serialized by the unique
 * constraint (`ON CONFLICT DO NOTHING`) and changes nothing. Any failure
 * aborts the transaction and propagates, so the caller must answer 5xx
 * rather than acknowledge.
 */
export function createPrismaResendDeliveryJournalStore(
  client: typeof basePrisma = basePrisma,
): DeliveryJournalStore {
  return {
    async recordOutbound(input) {
      return client.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`select set_config('app.resend_webhook', 'true', true)`,
          );
          const inserted = await transaction.$queryRaw<Array<{ provider_message_id: string }>>(
            Prisma.sql`
              insert into email_delivery_messages (
                provider_message_id,
                org_id,
                kind,
                recipient_digest,
                status
              ) values (
                ${input.providerMessageId},
                ${input.orgId ? Prisma.sql`${input.orgId}::uuid` : Prisma.sql`NULL`},
                ${input.kind},
                ${input.recipientDigest ?? null},
                'sent'
              )
              on conflict (provider_message_id) do nothing
              returning provider_message_id
            `,
          );
          return { created: inserted.length === 1 };
        },
        { maxWait: getDatabaseTransactionMaxWait() },
      );
    },

    async processVerifiedEvent(input) {
      return client.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`select set_config('app.resend_webhook', 'true', true)`,
          );

          // Serialize known-message callbacks before inserting their inbox
          // rows. A later transaction then sees the earlier committed event
          // when choosing the current status, regardless of arrival order.
          if (input.providerMessageId) {
            await transaction.$queryRaw(Prisma.sql`
              select provider_message_id from email_delivery_messages
              where provider_message_id = ${input.providerMessageId}
              for update
            `);
          }

          // Org attribution is resolved here, inside the database, from the
          // outbound journal row — never from caller-supplied or
          // payload-supplied org claims.
          const inserted = await transaction.$queryRaw<Array<{ org_id: string | null }>>(
            Prisma.sql`
              insert into email_delivery_events (
                svix_id,
                event_type,
                provider_message_id,
                org_id,
                payload_digest,
                metadata
              ) values (
                ${input.svixId},
                ${input.eventType},
                ${input.providerMessageId},
                (
                  select org_id
                  from email_delivery_messages
                  where provider_message_id = ${input.providerMessageId}
                ),
                ${input.payloadDigest},
                ${JSON.stringify(input.metadata)}::jsonb
              )
              on conflict (svix_id) do nothing
              returning org_id::text as org_id
            `,
          );

          if (inserted.length === 0) {
            const existing = await transaction.$queryRaw<
              Array<{ provider_message_id: string | null; org_id: string | null }>
            >(
              Prisma.sql`
                select provider_message_id, org_id::text as org_id
                from email_delivery_events
                where svix_id = ${input.svixId}
              `,
            );
            const row = existing[0];
            return {
              duplicate: true,
              matched: row?.provider_message_id !== null && row?.provider_message_id !== undefined,
              orgId: row?.org_id ?? null,
            };
          }

          const orgId = inserted[0]?.org_id ?? null;
          let matched = false;
          if (input.providerMessageId) {
            if (input.nextStatus) {
              const updated = await transaction.$executeRaw(
                Prisma.sql`
                  update email_delivery_messages
                  set status = case when not exists (
                      select 1 from email_delivery_events
                      where provider_message_id = ${input.providerMessageId}
                        and event_type in (${Prisma.join([...KNOWN_RESEND_DELIVERY_EVENTS])})
                        and (metadata ->> 'createdAt')::timestamptz > ${input.metadata.createdAt as string}::timestamptz
                    ) then ${input.nextStatus} else status end,
                    suppression_candidate = suppression_candidate or ${input.markSuppressionCandidate},
                    updated_at = now()
                  where provider_message_id = ${input.providerMessageId}
                `,
              );
              matched = updated === 1;
            } else {
              // Unknown event type: the inbox row is the audit trail; no
              // delivery state changes, but still report whether the
              // message is known.
              const found = await transaction.$queryRaw<Array<{ provider_message_id: string }>>(
                Prisma.sql`
                  select provider_message_id
                  from email_delivery_messages
                  where provider_message_id = ${input.providerMessageId}
                `,
              );
              matched = found.length === 1;
            }
          }
          return { duplicate: false, matched, orgId };
        },
        { maxWait: getDatabaseTransactionMaxWait() },
      );
    },
  };
}

/** Stateless singleton for the outbound send call sites. */
export const resendDeliveryJournalStore: DeliveryJournalStore = createPrismaResendDeliveryJournalStore();
