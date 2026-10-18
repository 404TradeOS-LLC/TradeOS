import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getSessionToken } from "@/lib/session";
import { getAbcItemAvailability, type AbcItemAvailability } from "@/lib/costbook-api";

export const metadata: Metadata = {
  title: "ABC Branch Order Eligibility | TradeOS",
  description: "Provider-listed branch ordering eligibility and length options, not on-hand inventory.",
};

export default async function AbcItemAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemNumber: string }>;
  searchParams: Promise<{ branchNumber?: string }>;
}) {
  const { itemNumber } = await params;
  const query = await searchParams;
  const branchNumber = query.branchNumber?.trim() || undefined;
  const token = await getSessionToken();
  let availability: AbcItemAvailability | null = null;
  let error: string | null = null;

  if (!token) {
    error = "Sign in to TradeOS to check the ABC sandbox order-eligibility list.";
  } else if (!/^[A-Za-z0-9_-]{1,80}$/.test(itemNumber) || (branchNumber && !/^[0-9]{1,6}$/.test(branchNumber))) {
    error = "Invalid ABC item or branch number.";
  } else {
    try {
      availability = await getAbcItemAvailability(token, itemNumber, branchNumber);
    } catch {
      error = "ABC sandbox availability could not be verified. Check Product API access or the item number.";
    }
  }

  const detailHref = "/costbook/abc-catalog/" + encodeURIComponent(itemNumber);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ABC branch ordering eligibility"
        description={"ABC item " + itemNumber + " • Product API sandbox • Read-only"}
        backHref={detailHref}
        backLabel="Product details"
      />
      <section className="flex gap-3 rounded-xl border border-border/70 bg-card p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-6 text-muted-foreground">
          ABC lists branches where an item may be available for ordering and the lengths carried.
          This does not represent on-hand inventory quantities, a purchase commitment, your
          authorized Ship-To branch, or a customer-specific price. Confirm before estimating.
        </p>
      </section>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card p-4">
        <label className="flex-1 space-y-1">
          <span className="block text-xs font-semibold text-muted-foreground">ABC branch number (optional)</span>
          <input name="branchNumber" defaultValue={branchNumber} inputMode="numeric" pattern="[0-9]{1,6}"
            maxLength={6} placeholder="Filter exact branch number" className="h-11 w-full min-w-40 rounded-lg border border-input bg-background px-3 text-sm" />
        </label>
        <button type="submit" className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Check branch
        </button>
      </form>
      {error ? <EmptyState title="ABC availability unavailable" description={error} /> : availability ? (
        <>
          <p className="text-sm text-muted-foreground">
            ABC provider lists <strong className="text-foreground">{availability.providerBranchCount}</strong> branch records
            {availability.selectedBranch ? " · Checked branch " + availability.selectedBranch : ""}
          </p>
          {availability.selectedBranch && availability.selectedBranchListed === false ? (
            <EmptyState title="Branch not listed by provider" description="ABC did not list this item for ordering at the selected branch in this sandbox response. This is not a live stock count." />
          ) : availability.branches.length === 0 ? (
            <EmptyState title="No ordering branches listed" description="No ABC branch-ordering records were returned for this item. Confirm with ABC before quoting." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2" aria-label="Provider-listed ordering branches">
              {availability.branches.map((branch) => (
                <article key={branch.branchNumber} className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                  <h2 className="font-semibold">ABC branch {branch.branchNumber}</h2>
                  <p className="text-xs text-muted-foreground">
                    Listed by ABC for ordering • {branch.isDimensional ? "Dimensional item" : "No dimensional flag"}
                  </p>
                  {branch.variations.length ? (
                    <ul className="space-y-1 text-sm">
                      {branch.variations.map((variation, i) => (
                        <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
                          <span>{variation.size || "Provider length option"}</span>
                          <span className="text-muted-foreground">{variation.length || "Length not supplied"}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-muted-foreground">No lengths specified by ABC for this branch.</p>}
                </article>
              ))}
            </div>
          )}
          {availability.truncated ? <p className="text-sm text-muted-foreground">
            Only the first 50 provider-listed branches are displayed. Use an exact branch number to check additional branches.
          </p> : null}
        </>
      ) : null}
      <Link href={detailHref} className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to product details
      </Link>
    </div>
  );
}
