import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { basePrisma, prisma } from "../../db/client";
import { getBillingEntitlements } from "./entitlements";
import { getStripePriceId, getTradeOsAppUrl, resolvePlanFromPriceId } from "./config";
import { BILLING_CATALOG, getBillingPriceDefinition } from "./catalog";
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
  pendingCheckoutAttemptId: string | null;
  pendingCheckoutSessionId: string | null;
  pendingCheckoutUrl: string | null;
  pendingCheckoutPlan: BillingPlan | null;
  pendingCheckoutInterval: BillingInterval | null;
  pendingCheckoutExpiresAt: Date | null;
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

interface StripePrice {
  id: string;
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string } | null;
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);
const ENTITLED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const INTEGRATION_IDENTIFIER = "tradeos_checkout_qmrvknzt";
const CHECKOUT_ATTEMPT_TTL_MS = 23 * 60 * 60 * 1000;

function dateFromUnix(value: number | null | undefined): Date | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;
}

export function isEntitledBillingStatus(status: string): boolean {
  return ENTITLED_SUBSCRIPTION_STATUSES.has(status);
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
    entitlements: isEntitledBillingStatus(row.status) ? getBillingEntitlements(row.plan) : null,
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
      last_invoice_status as "lastInvoiceStatus",
      pending_checkout_attempt_id as "pendingCheckoutAttemptId",
      pending_checkout_session_id as "pendingCheckoutSessionId",
      pending_checkout_url as "pendingCheckoutUrl",
      pending_checkout_plan as "pendingCheckoutPlan",
      pending_checkout_interval as "pendingCheckoutInterval",
      pending_checkout_expires_at as "pendingCheckoutExpiresAt"
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
  getCatalog() {
    return BILLING_CATALOG;
  }

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

    const priceId = await this.getValidatedStripePriceId(plan, interval);
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
    }

    const claim = await this.claimCheckoutAttempt(auth, customerId, plan, interval);
    if (claim.url) return { url: claim.url };

    const appUrl = getTradeOsAppUrl();
    const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
      method: "POST",
      idempotencyKey: `tradeos-checkout-${claim.attemptId}`,
      body: {
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        payment_method_collection: "if_required",
        success_url: `${appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
        allow_promotion_codes: true,
        expires_at: Math.floor(claim.expiresAt.getTime() / 1000),
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
    await this.runAsBillingAdmin(auth, async (tx) => {
      const updated = await tx.$executeRaw(Prisma.sql`
        update organization_billing
        set pending_checkout_session_id = ${session.id},
            pending_checkout_url = ${session.url},
            updated_at = now()
        where org_id = ${auth.orgId}::uuid
          and pending_checkout_attempt_id = ${claim.attemptId}
      `);
      if (updated !== 1) throw new ApiError(409, "The pending checkout attempt changed; start checkout again");
    });
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
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const supplied = subscriptionFromObject(event.data.object);
      if (!supplied.id) throw new ApiError(422, "Stripe subscription event is missing its subscription id");
      // Stripe does not guarantee webhook ordering. Hydrate the authoritative
      // current subscription so a stale update cannot restore older state.
      hydratedSubscription = await retrieveSubscription(supplied.id);
    }

    const orgId = hydratedSubscription?.metadata?.tradeos_org_id ?? await resolveEventOrgId(event);

    return basePrisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        select
          set_config('app.org_id', ${orgId}, true),
          set_config('app.role', 'owner', true),
          set_config('app.session_source', 'stripe_webhook', true)
      `);

      const inserted = await tx.$queryRaw<Array<{ stripeEventId: string }>>(Prisma.sql`
        insert into stripe_webhook_events (stripe_event_id, org_id, event_type, stripe_created_at)
        values (
          ${event.id},
          ${orgId}::uuid,
          ${event.type},
          ${event.created ? new Date(event.created * 1000) : null}
        )
        on conflict (stripe_event_id) do nothing
        returning stripe_event_id as "stripeEventId"
      `);
      if (inserted.length === 0) return { duplicate: true };

      if (event.type === "checkout.session.completed" && hydratedSubscription) {
        await this.syncSubscription(tx, orgId, hydratedSubscription);
      } else if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        if (!hydratedSubscription) throw new ApiError(422, "Stripe subscription could not be hydrated");
        await this.syncSubscription(tx, orgId, hydratedSubscription);
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
        pending_checkout_attempt_id = null,
        pending_checkout_session_id = null,
        pending_checkout_url = null,
        pending_checkout_plan = null,
        pending_checkout_interval = null,
        pending_checkout_expires_at = null,
        updated_at = now()
    `);
  }

  private async getValidatedStripePriceId(plan: BillingPlan, interval: BillingInterval): Promise<string> {
    const priceId = getStripePriceId(plan, interval);
    const expected = getBillingPriceDefinition(plan, interval);
    const price = await stripeRequest<StripePrice>(`/prices/${encodeURIComponent(priceId)}`);
    if (
      price.id !== priceId ||
      price.active !== true ||
      price.currency?.toLowerCase() !== expected.currency ||
      price.unit_amount !== expected.amountCents ||
      price.recurring?.interval !== expected.stripeInterval
    ) {
      throw new ApiError(503, `Stripe price configuration does not match the TradeOS ${plan} ${interval} catalog`);
    }
    return priceId;
  }

  private async claimCheckoutAttempt(
    auth: AuthContext,
    customerId: string,
    plan: BillingPlan,
    interval: BillingInterval,
  ): Promise<{ attemptId: string; expiresAt: Date; url: string | null }> {
    return this.runAsBillingAdmin(auth, async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`select pg_advisory_xact_lock(hashtextextended(${`billing-checkout:${auth.orgId}`}, 0))`,
      );
      const rows = await tx.$queryRaw<BillingRow[]>(Prisma.sql`
        select
          org_id as "orgId", stripe_customer_id as "stripeCustomerId",
          stripe_subscription_id as "stripeSubscriptionId", plan,
          billing_interval as "billingInterval", status, price_id as "priceId",
          trial_ends_at as "trialEndsAt", current_period_ends_at as "currentPeriodEndsAt",
          cancel_at_period_end as "cancelAtPeriodEnd", last_invoice_status as "lastInvoiceStatus",
          pending_checkout_attempt_id as "pendingCheckoutAttemptId",
          pending_checkout_session_id as "pendingCheckoutSessionId",
          pending_checkout_url as "pendingCheckoutUrl",
          pending_checkout_plan as "pendingCheckoutPlan",
          pending_checkout_interval as "pendingCheckoutInterval",
          pending_checkout_expires_at as "pendingCheckoutExpiresAt"
        from organization_billing where org_id = ${auth.orgId}::uuid for update
      `);
      const row = rows[0];
      if (row?.stripeSubscriptionId && ACTIVE_SUBSCRIPTION_STATUSES.has(row.status)) {
        throw new ApiError(409, "This organization already has a subscription. Manage the existing plan instead.");
      }

      const now = new Date();
      if (row?.pendingCheckoutAttemptId && row.pendingCheckoutExpiresAt && row.pendingCheckoutExpiresAt > now) {
        if (row.pendingCheckoutPlan !== plan || row.pendingCheckoutInterval !== interval) {
          throw new ApiError(409, "This organization already has a pending checkout for another plan");
        }
        return {
          attemptId: row.pendingCheckoutAttemptId,
          expiresAt: row.pendingCheckoutExpiresAt,
          url: row.pendingCheckoutUrl,
        };
      }

      const attemptId = crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + CHECKOUT_ATTEMPT_TTL_MS);
      await tx.$executeRaw(Prisma.sql`
        insert into organization_billing (
          org_id, stripe_customer_id, status, pending_checkout_attempt_id,
          pending_checkout_plan, pending_checkout_interval, pending_checkout_expires_at
        ) values (
          ${auth.orgId}::uuid, ${customerId}, 'none', ${attemptId}, ${plan}, ${interval}, ${expiresAt}
        )
        on conflict (org_id) do update set
          stripe_customer_id = excluded.stripe_customer_id,
          pending_checkout_attempt_id = excluded.pending_checkout_attempt_id,
          pending_checkout_session_id = null,
          pending_checkout_url = null,
          pending_checkout_plan = excluded.pending_checkout_plan,
          pending_checkout_interval = excluded.pending_checkout_interval,
          pending_checkout_expires_at = excluded.pending_checkout_expires_at,
          updated_at = now()
      `);
      return { attemptId, expiresAt, url: null };
    });
  }

  private async runAsBillingAdmin<T>(
    auth: AuthContext,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return basePrisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        select
          set_config('app.user_id', ${auth.userId}, true),
          set_config('app.org_id', ${auth.orgId}, true),
          set_config('app.role', ${auth.role}, true),
          set_config('app.session_source', 'stripe_checkout', true)
      `);
      return operation(tx);
    });
  }
}
