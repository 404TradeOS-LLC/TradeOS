"use server";

import { redirect } from "next/navigation";
import { createBillingCheckout, createBillingPortal, type BillingInterval, type BillingPlan } from "@/lib/billing-api";
import { getSessionToken } from "@/lib/session";

const PLANS = new Set<BillingPlan>(["starter", "pro", "business", "scale"]);
const INTERVALS = new Set<BillingInterval>(["monthly", "annual"]);

export async function startSubscriptionAction(formData: FormData): Promise<never> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const plan = String(formData.get("plan") ?? "") as BillingPlan;
  const billingInterval = String(formData.get("billingInterval") ?? "") as BillingInterval;
  if (!PLANS.has(plan) || !INTERVALS.has(billingInterval)) redirect("/settings/billing?error=invalid-plan");

  try {
    const session = await createBillingCheckout(token, { plan, billingInterval });
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/settings/billing?error=checkout");
  }
}

export async function manageSubscriptionAction(): Promise<never> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  try {
    const session = await createBillingPortal(token);
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect("/settings/billing?error=portal");
  }
}
