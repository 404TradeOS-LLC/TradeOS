export const billingPlans = ["starter", "pro", "business", "scale"] as const;
export type BillingPlan = (typeof billingPlans)[number];

export const billingIntervals = ["monthly", "annual"] as const;
export type BillingInterval = (typeof billingIntervals)[number];

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

export interface StripeEventEnvelope {
  id: string;
  type: string;
  created?: number;
  data: { object: Record<string, unknown> };
}
