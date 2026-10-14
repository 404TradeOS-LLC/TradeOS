import type { Metadata } from "next";
import { PortalAccessShell } from "@/components/customer-portal/portal-access-shell";

export const metadata: Metadata = {
  title: "Portal access unavailable | TradeOS",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function CustomerPortalAccessErrorPage() {
  return (
    <PortalAccessShell>
      <section
        aria-labelledby="portal-access-error-title"
        className="w-full max-w-md space-y-3 rounded-2xl bg-zinc-950 px-7 py-8 text-zinc-50 shadow-sm sm:px-9 sm:py-10"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">Access unavailable</p>
        <h1 id="portal-access-error-title" className="font-heading text-2xl font-semibold tracking-tight">
          This link is no longer available
        </h1>
        <p className="text-sm leading-6 text-zinc-300">
          The link may have expired, already been used, or been revoked. Ask your contractor for a new invitation.
        </p>
      </section>
    </PortalAccessShell>
  );
}
