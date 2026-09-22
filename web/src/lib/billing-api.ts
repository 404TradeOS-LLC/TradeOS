import "server-only";
import { apiFetch } from "@/lib/api";

export type BillingPlan = "starter" | "pro" | "business" | "scale";
export type BillingInterval = "monthly" | "annual";

export interface BillingEntitlements {
  maxUsers: number;
  customerPortal: boolean;
  costbook: "basic" | "regional" | "advanced";
  athena: "basic" | "pro" | "advanced";
  financialIntelligence: boolean;
  automations: boolean;
  apiAccess: boolean;
}

export interface BillingSummary {
  orgId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: BillingPlan | null;
  billingInterval: BillingInterval | null;
  status: string;
  priceId: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  lastInvoiceStatus: string | null;
  entitlements: BillingEntitlements | null;
}

export interface BillingCatalogPrice {
  amountCents: number;
  currency: "usd";
  stripeInterval: "month" | "year";
}

export interface BillingCatalogPlan {
  id: BillingPlan;
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
  prices: Record<BillingInterval, BillingCatalogPrice>;
}

export function getBillingCatalog(token: string) {
  return apiFetch<BillingCatalogPlan[]>("/api/v1/billing/catalog", { token, cache: "no-store" });
}

export function getBillingSummary(token: string) {
  return apiFetch<BillingSummary>("/api/v1/billing", { token, cache: "no-store" });
}

export function createBillingCheckout(token: string, input: { plan: BillingPlan; billingInterval: BillingInterval }) {
  return apiFetch<{ url: string }>("/api/v1/billing/checkout", {
    token,
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createBillingPortal(token: string) {
  return apiFetch<{ url: string }>("/api/v1/billing/portal", {
    token,
    method: "POST",
    body: JSON.stringify({}),
  });
}
