import { ApiError } from "../../backend/middleware/errorHandler";
import { billingIntervals, billingPlans, type BillingInterval, type BillingPlan } from "./types";

const SANDBOX_PRICE_IDS: Record<BillingPlan, Record<BillingInterval, string>> = {
  starter: {
    monthly: "price_1UEicF2asgU6GM2Gr8ebG00s",
    annual: "price_1UEicJ2asgU6GM2GUHlQaTYk",
  },
  pro: {
    monthly: "price_1UEicP2asgU6GM2Gpf5F27Te",
    annual: "price_1UEicU2asgU6GM2GL9kYpWG0",
  },
  business: {
    monthly: "price_1UEicX2asgU6GM2GsE8KUBKk",
    annual: "price_1UEicd2asgU6GM2Gq25ilCtr",
  },
  scale: {
    monthly: "price_1UEich2asgU6GM2GuoKHDhsv",
    annual: "price_1UEick2asgU6GM2GZ6R1gReq",
  },
};

const PRICE_ENV: Record<BillingPlan, Record<BillingInterval, string>> = {
  starter: { monthly: "STRIPE_PRICE_STARTER_MONTHLY", annual: "STRIPE_PRICE_STARTER_ANNUAL" },
  pro: { monthly: "STRIPE_PRICE_PRO_MONTHLY", annual: "STRIPE_PRICE_PRO_ANNUAL" },
  business: { monthly: "STRIPE_PRICE_BUSINESS_MONTHLY", annual: "STRIPE_PRICE_BUSINESS_ANNUAL" },
  scale: { monthly: "STRIPE_PRICE_SCALE_MONTHLY", annual: "STRIPE_PRICE_SCALE_ANNUAL" },
};

export function isBillingPlan(value: string): value is BillingPlan {
  return (billingPlans as readonly string[]).includes(value);
}

export function isBillingInterval(value: string): value is BillingInterval {
  return (billingIntervals as readonly string[]).includes(value);
}

export function getStripePriceId(plan: BillingPlan, interval: BillingInterval): string {
  const explicit = process.env[PRICE_ENV[plan][interval]]?.trim();
  if (explicit) return explicit;

  if (process.env.NODE_ENV !== "production") return SANDBOX_PRICE_IDS[plan][interval];
  throw new ApiError(503, `Stripe price configuration is missing for ${plan} ${interval}`);
}

export function resolvePlanFromPriceId(priceId: string): { plan: BillingPlan; interval: BillingInterval } | null {
  for (const plan of billingPlans) {
    for (const interval of billingIntervals) {
      const configured = process.env[PRICE_ENV[plan][interval]]?.trim();
      if (priceId === configured || (process.env.NODE_ENV !== "production" && priceId === SANDBOX_PRICE_IDS[plan][interval])) {
        return { plan, interval };
      }
    }
  }
  return null;
}

export function requireStripeSecretKey(): string {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new ApiError(503, "Stripe billing is not configured");
  return value;
}

export function requireStripeWebhookSecret(): string {
  const value = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!value) throw new ApiError(503, "Stripe webhook verification is not configured");
  return value;
}

export function getTradeOsAppUrl(): string {
  const value = process.env.TRADEOS_APP_URL?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (value) return value.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new ApiError(503, "TradeOS application URL is not configured");
}
