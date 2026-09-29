import type { BillingInterval, BillingPlan } from "./types";

export interface BillingPriceDefinition {
  amountCents: number;
  currency: "usd";
  stripeInterval: "month" | "year";
}

export interface BillingPlanDefinition {
  id: BillingPlan;
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
  prices: Record<BillingInterval, BillingPriceDefinition>;
}

export const BILLING_CATALOG: readonly BillingPlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Get a solo contracting business organized.",
    features: ["1 user", "Estimates & invoices", "Customer portal", "Basic Costbook", "Athena Basic"],
    prices: {
      monthly: { amountCents: 3_900, currency: "usd", stripeInterval: "month" },
      annual: { amountCents: 39_000, currency: "usd", stripeInterval: "year" },
    },
  },
  {
    id: "pro",
    name: "Pro",
    description: "Run a small contracting company from one command center.",
    features: ["3 users", "Regional Costbook", "Athena Pro", "Automations", "Advanced job workflows"],
    popular: true,
    prices: {
      monthly: { amountCents: 9_900, currency: "usd", stripeInterval: "month" },
      annual: { amountCents: 99_000, currency: "usd", stripeInterval: "year" },
    },
  },
  {
    id: "business",
    name: "Business",
    description: "Coordinate growing crews, profitability, and operations.",
    features: ["8 users", "Advanced Costbook", "Advanced Athena", "Financial intelligence", "Automations"],
    prices: {
      monthly: { amountCents: 19_900, currency: "usd", stripeInterval: "month" },
      annual: { amountCents: 199_000, currency: "usd", stripeInterval: "year" },
    },
  },
  {
    id: "scale",
    name: "Scale",
    description: "Operate TradeOS as the system of record for an established company.",
    features: ["20 users", "Advanced Athena", "Financial intelligence", "API access", "Scale operations"],
    prices: {
      monthly: { amountCents: 39_900, currency: "usd", stripeInterval: "month" },
      annual: { amountCents: 399_000, currency: "usd", stripeInterval: "year" },
    },
  },
] as const;

export function getBillingPriceDefinition(plan: BillingPlan, interval: BillingInterval): BillingPriceDefinition {
  const definition = BILLING_CATALOG.find((candidate) => candidate.id === plan);
  if (!definition) throw new Error(`Unknown billing plan: ${plan}`);
  return definition.prices[interval];
}
