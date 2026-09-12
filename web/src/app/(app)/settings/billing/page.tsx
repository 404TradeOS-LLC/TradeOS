import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganizationSettings } from "@/lib/api";
import { getBillingSummary, type BillingPlan } from "@/lib/billing-api";
import { getSessionToken } from "@/lib/session";
import { manageSubscriptionAction, startSubscriptionAction } from "./actions";

export const metadata: Metadata = {
  title: "Billing & Plan | TradeOS",
  description: "Manage the TradeOS subscription, billing cycle, and plan entitlements.",
};

const PLANS: Array<{
  id: BillingPlan;
  name: string;
  monthly: number;
  annual: number;
  description: string;
  features: string[];
  popular?: boolean;
}> = [
  {
    id: "starter",
    name: "Starter",
    monthly: 39,
    annual: 390,
    description: "Get a solo contracting business organized.",
    features: ["1 user", "Estimates & invoices", "Customer portal", "Basic Costbook", "Athena Basic"],
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 99,
    annual: 990,
    description: "Run a small contracting company from one command center.",
    features: ["3 users", "Regional Costbook", "Athena Pro", "Automations", "Advanced job workflows"],
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    monthly: 199,
    annual: 1990,
    description: "Coordinate growing crews, profitability, and operations.",
    features: ["8 users", "Advanced Costbook", "Advanced Athena", "Financial intelligence", "Automations"],
  },
  {
    id: "scale",
    name: "Scale",
    monthly: 399,
    annual: 3990,
    description: "Operate TradeOS as the system of record for an established company.",
    features: ["20 users", "Advanced Athena", "Financial intelligence", "API access", "Scale operations"],
  },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: string): string {
  if (status === "none") return "No subscription";
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const [token, query] = await Promise.all([getSessionToken(), searchParams]);
  const [billing, settings] = token
    ? await Promise.all([getBillingSummary(token), getOrganizationSettings(token)])
    : [null, null];

  const canManage = settings?.canManageWorkspace ?? false;
  const currentPlan = billing?.plan ?? null;
  const currentInterval = billing?.billingInterval ?? null;
  const hasCustomer = Boolean(billing?.stripeCustomerId);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-2">
          <Link href="/settings" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Settings
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Billing & Plan</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              TradeOS subscription billing is handled by Stripe. Subscription access changes only after Stripe confirms them by webhook.
            </p>
          </div>
        </div>
        {hasCustomer && canManage ? (
          <form action={manageSubscriptionAction}>
            <Button type="submit" variant="outline">
              Manage in Stripe
              <ExternalLink className="size-4" aria-hidden="true" />
            </Button>
          </form>
        ) : null}
      </div>

      {query.checkout === "success" ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Checkout completed. TradeOS will update your plan as soon as the signed Stripe webhook is processed.
        </div>
      ) : null}
      {query.checkout === "cancelled" ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. Your existing TradeOS access has not changed.
        </div>
      ) : null}
      {query.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Stripe billing could not be opened. Verify billing configuration and try again.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Current subscription</CardTitle>
              <CardDescription>Webhook-synchronized billing state for this TradeOS organization.</CardDescription>
            </div>
            <Badge variant={billing?.status === "active" || billing?.status === "trialing" ? "default" : "outline"}>
              {statusLabel(billing?.status ?? "none")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Plan</div>
            <div className="mt-1 text-base font-medium capitalize">{currentPlan ?? "Not selected"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Billing</div>
            <div className="mt-1 text-base font-medium capitalize">{currentInterval ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Trial ends</div>
            <div className="mt-1 text-base font-medium">{formatDate(billing?.trialEndsAt ?? null)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Period ends</div>
            <div className="mt-1 text-base font-medium">{formatDate(billing?.currentPeriodEndsAt ?? null)}</div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 text-xs text-muted-foreground">
          <span>{billing?.cancelAtPeriodEnd ? "Cancellation scheduled at period end" : "No cancellation scheduled"}</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" aria-hidden="true" /> Stripe-secured billing</span>
        </CardFooter>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <Card key={plan.id} className={plan.popular ? "border-primary/35 shadow-(--elev-2)" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.popular ? <Badge>Most popular</Badge> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <span className="font-heading text-3xl font-semibold">${plan.monthly}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                  <div className="mt-1 text-xs text-muted-foreground">${plan.annual}/year — about two months free</div>
                </div>
                <div className="grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="grid gap-2">
                {canManage ? (
                  <>
                    <form action={startSubscriptionAction}>
                      <input type="hidden" name="plan" value={plan.id} />
                      <input type="hidden" name="billingInterval" value="monthly" />
                      <Button type="submit" className="w-full" variant={plan.popular ? "default" : "outline"}>
                        <CreditCard className="size-4" aria-hidden="true" />
                        {isCurrent && currentInterval === "monthly" ? "Current monthly plan" : `Choose monthly — $${plan.monthly}`}
                      </Button>
                    </form>
                    <form action={startSubscriptionAction}>
                      <input type="hidden" name="plan" value={plan.id} />
                      <input type="hidden" name="billingInterval" value="annual" />
                      <Button type="submit" className="w-full" variant="ghost">
                        {isCurrent && currentInterval === "annual" ? "Current annual plan" : `Choose annual — $${plan.annual}`}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">An owner or admin manages subscription changes.</div>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        New subscriptions begin with a 14-day trial. If no payment method is added before the trial ends, Stripe is configured to cancel the subscription rather than create an unpaid balance.
      </div>
    </div>
  );
}
