import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { basePrisma, prisma } from "../../db/client";
import { getBillingEntitlements } from "./entitlements";
import { getStripePriceId, getTradeOsAppUrl, resolvePlanFromPriceId } from "./config";
import { stripeRequest } from "./stripeRest";
import type { BillingInterval, BillingPlan, BillingSummary, StripeEventEnvelope } from "./types";

interface BillingRow {
  orgId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: BillingPlan | null;
  billingInterval: BillingInterval | null;
  status: string;
  priceId: string | null;
  trialEndsAt: Date | null;
  currentPeriodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  lastInvoiceStatus: string | null;
}

interface StripeCustomer {
  id: string;
  metadata?: Record<string, string>;
}

interface StripeCheckoutSession {
  id: string;
  url: string | null;
  customer?: string | StripeCustomer | null;
  subscription?: string | StripeSubscription | null;
  metadata?: Record<string, string>;
}

interface StripeSubscription {
  id: string;
  customer: string | StripeCustomer;
  status: string;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
  trial_end?: number | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean;
}

interface StripeInvoice {
  customer?: string | StripeCustomer | null;
  status?: string | null;
  metadata?: Record<string, string>;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);
const INTEGRATION_IDENTIFIER = "tradeos_checkout_qmrvknzt";

function dateFromUnix(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

function toSummary(row: BillingRow): BillingSummary {
  return {
    orgId: row.orgId,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    plan: row.plan,
    billingInterval: row.billingInterval,
    status: row.status,
    priceId: row.priceId,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodEndsAt: row.currentPeriodEndsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    lastInvoiceStatus: row.lastInvoiceStatus,
    entitlements: getBillingEntitlements(row.plan),
  };
}

async function readBilling(orgId: string): Promise<BillingRow | null> {
  const rows = await prisma.$queryRaw<BillingRow[]>(Prisma.sql`
    select
      org_id as "orgId",
      stripe_customer_id as "stripeCustomerId",
      stripe_subscription_id as "stripeSubscriptionId",
      plan,
      billing_interval as "billingInterval",
      status,
      price_id as "priceId",
      trial_ends_at as "trialEndsAt",
      current_period_ends_at as "currentPeriodEndsAt",
      cancel_at_period_end as "cancelAtPeriodEnd",
      last_invoice_status as "lastInvoiceStatus"
    from organization_billing
    where org_id = ${orgId}::uuid
    limit 1
  `);
  return rows[0] ?? null;
}

async function retrieveCustomer(customerId: string): Promise<StripeCustomer> {
  return stripeRequest<StripeCustomer>(`/customers/${encodeURIComponent(customerId)}`);
}

async function retrieveSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

async function resolveEventOrgId(event: StripeEventEnvelope): Promise<string> {
  const object = event.data.object;
  const directMetadata = object.metadata;
  if (directMetadata && typeof directMetadata === "object") {
    const orgId = (directMetadata as Record<string, unknown>).tradeos_org_id;
    if (typeof orgId === "string" && orgId) return orgId;
  }

  const customer = object.customer;
  if (customer && typeof customer === "object") {
    const metadata = (customer as { metadata?: Record<string, string> }).metadata;
    if (metadata?.tradeos_org_id) return metadata.tradeos_org_id;
  }
  if (typeof customer === "string") {
    const resolved = await retrieveCustomer(customer);
    if (resolved.metadata?.tradeos_org_id) return resolved.metadata.tradeos_org_id;
  }

  throw new ApiError(422, `Stripe event ${event.type} is missing TradeOS organization metadata`);
}

function subscriptionFromObject(object: Record<string, unknown>): StripeSubscription {
  return object as unknown as StripeSubscription;
}

export class BillingService {
  async getSummary(orgId: string): Promise<BillingSummary> {
    const row = await readBilling(orgId);
    if (row) return toSummary(row);
    return {
      orgId,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      plan: null,
      billingInterval: null,
      status: "none",
      priceId: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      lastInvoiceStatus: null,
      entitlements: null,
    };
  }

  async createCheckout(auth: AuthContext, plan: BillingPlan, interval: BillingInterval): Promise<{ url: string }> {
    const existing = await readBilling(auth.orgId);
    if (existing?.stripeSubscriptionId && ACTIVE_SUBSCRIPTION_STATUSES.has(existing.status)) {
      throw new ApiError(409, "This organization already has a subscription. Manage the existing plan instead.");
    }

    let customerId = existing?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await stripeRequest<StripeCustomer>("/customers", {
        method: "POST",
        idempotencyKey: `tradeos-customer-${auth.orgId}`,
        body: {
          email: auth.email,
          metadata: { tradeos_org_id: auth.orgId },
        },
      });
      customerId = customer.id;
      await prisma.$executeRaw(Prisma.sql`
        insert into organization_billing (org_id, stripe_customer_id, status)
        values (${auth.orgId}::uuid, ${customerId}, 'none')
        on conflict (org_id) do update set
          stripe_customer_id = excluded.stripe_customer_id,
          updated_at = now()
      `);
    }

    const appUrl = getTradeOsAppUrl();
    const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
      method: "POST",
      idempotencyKey: `tradeos-checkout-${crypto.randomUUID()}`,
      body: {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: getStripePriceId(plan, interval), quantity: 1 }],
        payment_method_collection: "if_required",
        success_url: `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
        allow_promotion_codes: true,
        integration_identifier: INTEGRATION_IDENTIFIER,
        metadata: { tradeos_org_id: auth.orgId, tradeos_plan: plan, tradeos_interval: interval },
        subscription_data: {
          trial_period_days: 14,
          metadata: { tradeos_org_id: auth.orgId, tradeos_plan: plan, tradeos_interval: interval },
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        },
      },
    });

    if (!session.url) throw new ApiError(502, "Stripe did not return a Checkout URL");
    return { url: session.url };
  }

  async createPortal(orgId: string): Promise<{ url: string }> {
    const billing = await readBilling(orgId);
    if (!billing?.stripeCustomerId) throw new ApiError(400, "Start a TradeOS subscription before opening billing management");

    const session = await stripeRequest<{ url?: string }>("/billing_portal/sessions", {
      method: "POST",
      body: {
        customer: billing.stripeCustomerId,
        return_url: `${getTradeOsAppUrl()}/settings/billing`,
        ...(process.env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID
          ? { configuration: process.env.STRIPE_CUSTOMER_PORTAL_CONFIGURATION_ID }
          : {}),
      },
    });
    if (!session.url) throw new ApiError(502, "Stripe did not return a billing portal URL");
    return { url: session.url };
  }

  async processWebhook(event: StripeEventEnvelope): Promise<{ duplicate: boolean }> {
    let hydratedSubscription: StripeSubscription | null = null;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as unknown as StripeCheckoutSession;
      if (typeof session.subscription === "string") hydratedSubscription = await retrieveSubscription(session.subscription);
      else if (session.subscription && typeof session.subscription === "object") hydratedSubscription = session.subscription;
    }

    const orgId = hydratedSubscription?.metadata?.tradeos_org_id ?? await resolveEventOrgId(event);

    return basePrisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        select
          set_config('app.org_id', ${orgId}, true),
          set_config('app.role', 'owner', true),
          set_config('app.session_source', 'stripe_webhook', true)
      `);

      const existing = await tx.$queryRaw<Array<{ stripeEventId: string }>>(Prisma.sql`
        select stripe_event_id as "stripeEventId"
        from stripe_webhook_events
        where stripe_event_id = ${event.id}
        limit 1
      `);
      if (existing.length > 0) return { duplicate: true };

      await tx.$executeRaw(Prisma.sql`
        insert into stripe_webhook_events (stripe_event_id, org_id, event_type, stripe_created_at)
        values (
          ${event.id},
          ${orgId}::uuid,
          ${event.type},
          ${event.created ? new Date(event.created * 1000) : null}
        )
      `);

      if (event.type === "checkout.session.completed" && hydratedSubscription) {
        await this.syncSubscription(tx, orgId, hydratedSubscription);
      } else if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await this.syncSubscription(tx, orgId, subscriptionFromObject(event.data.object));
      } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        const invoice = event.data.object as unknown as StripeInvoice;
        const invoiceStatus = event.type === "invoice.paid" ? "paid" : "payment_failed";
        await tx.$executeRaw(Prisma.sql`
          insert into organization_billing (org_id, status, last_invoice_status)
          values (${orgId}::uuid, 'none', ${invoiceStatus})
          on conflict (org_id) do update set
            last_invoice_status = ${invoice.status ?? invoiceStatus},
            updated_at = now()
        `);
      }

      return { duplicate: false };
    });
  }

  private async syncSubscription(tx: Prisma.TransactionClient, orgId: string, subscription: StripeSubscription): Promise<void> {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (!priceId) throw new ApiError(422, "Stripe subscription is missing its recurring price");
    const resolved = resolvePlanFromPriceId(priceId);
    if (!resolved) throw new ApiError(422, `Stripe subscription uses an unknown TradeOS price: ${priceId}`);

    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    await tx.$executeRaw(Prisma.sql`
      insert into organization_billing (
        org_id, stripe_customer_id, stripe_subscription_id, plan, billing_interval,
        status, price_id, trial_ends_at, current_period_ends_at,
        cancel_at_period_end, updated_at
      ) values (
        ${orgId}::uuid,
        ${customerId},
        ${subscription.id},
        ${resolved.plan},
        ${resolved.interval},
        ${subscription.status},
        ${priceId},
        ${dateFromUnix(subscription.trial_end)},
        ${dateFromUnix(subscription.current_period_end)},
        ${Boolean(subscription.cancel_at_period_end)},
        now()
      )
      on conflict (org_id) do update set
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        plan = excluded.plan,
        billing_interval = excluded.billing_interval,
        status = excluded.status,
        price_id = excluded.price_id,
        trial_ends_at = excluded.trial_ends_at,
        current_period_ends_at = excluded.current_period_ends_at,
        cancel_at_period_end = excluded.cancel_at_period_end,
        updated_at = now()
    `);
  }
}
