import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Customer portal</p>
        <h1 className="text-3xl font-semibold tracking-tight">Continue to your secure portal</h1>
        <p className="text-muted-foreground">
          Confirm below to use this one-time invitation and open the project information your contractor shared.
        </p>
      </div>
      <form action="/customer-portal/access/redeem" method="post">
        <button type="submit" className={buttonVariants()}>
          Continue to customer portal
        </button>
      </form>
      <p className="text-sm text-muted-foreground">This confirmation protects one-time invitations from automated email link previews.</p>
    </main>
  );
}
