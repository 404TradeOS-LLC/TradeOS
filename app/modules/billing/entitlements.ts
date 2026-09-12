import type { BillingEntitlements, BillingPlan } from "./types";

const ENTITLEMENTS: Record<BillingPlan, BillingEntitlements> = {
  starter: {
    maxUsers: 1,
    customerPortal: true,
    costbook: "basic",
    athena: "basic",
    financialIntelligence: false,
    automations: false,
    apiAccess: false,
  },
  pro: {
    maxUsers: 3,
    customerPortal: true,
    costbook: "regional",
    athena: "pro",
    financialIntelligence: false,
    automations: true,
    apiAccess: false,
  },
  business: {
    maxUsers: 8,
    customerPortal: true,
    costbook: "advanced",
    athena: "advanced",
    financialIntelligence: true,
    automations: true,
    apiAccess: false,
  },
  scale: {
    maxUsers: 20,
    customerPortal: true,
    costbook: "advanced",
    athena: "advanced",
    financialIntelligence: true,
    automations: true,
    apiAccess: true,
  },
};

export function getBillingEntitlements(plan: BillingPlan | null): BillingEntitlements | null {
  return plan ? { ...ENTITLEMENTS[plan] } : null;
}
