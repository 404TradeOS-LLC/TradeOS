import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalAccessShell } from "@/components/customer-portal/portal-access-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE,
  isValidCustomerPortalAccessToken,
} from "@/lib/customer-portal-access";

export const metadata: Metadata = {
  title: "Confirm customer portal access | TradeOS",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ConfirmCustomerPortalAccessPage() {
  const pendingToken = (await cookies()).get(CUSTOMER_PORTAL_PENDING_ACCESS_COOKIE)?.value;
  if (!isValidCustomerPortalAccessToken(pendingToken)) redirect("/customer-portal/access-error");

  return (
    <PortalAccessShell>
      <div className="w-full max-w-xl space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Customer portal</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Open your project documents
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Confirm to open the private project information your contractor shared.
          </p>
        </div>
        <section aria-label="Invitation confirmation" className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground">
            One-time invitation
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Continue to securely view your shared documents.
          </p>
          <form action="/customer-portal/access/redeem" method="post">
            <button type="submit" className={cn(buttonVariants({ size: "lg" }), "min-h-11 w-full")}>
              Continue to customer portal
            </button>
          </form>
          <p className="text-xs leading-5 text-muted-foreground">Only continue if you were expecting this invitation.</p>
        </section>
        <aside className="space-y-1 rounded-xl border border-border/60 bg-muted px-5 py-4">
          <p className="text-sm font-semibold text-foreground">This is a private, one-time invitation.</p>
          <p className="text-xs leading-5 text-muted-foreground">
            For your security, an expired or already-used link cannot be opened again.
          </p>
        </aside>
      </div>
    </PortalAccessShell>
  );
}
