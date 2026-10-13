import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrganizationSettings, listCustomers, type Customer } from "@/lib/api";
import { canStartFirstEstimate } from "@/lib/first-estimate-access";
import { getSessionToken } from "@/lib/session";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackState } from "@/components/ui/feedback-state";
import { FirstEstimateForm } from "./first-estimate-form";

export const metadata = {
  title: "Build your first estimate | TradeOS",
  description: "Start with a real job and create an estimate before configuring the rest of TradeOS.",
};

export default async function FirstEstimateOnboardingPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const settings = await getOrganizationSettings(token).catch(() => null);
  if (!canStartFirstEstimate(settings?.currentRole)) {
    return (
      <FeedbackState
        kind={settings ? "restricted" : "error"}
        title={settings ? "Estimate creation is unavailable for your role" : "Couldn’t verify your access"}
        description={settings ? "Ask an owner or administrator to start the project and estimate. You can return to your assigned work on Today." : "Your permissions could not be loaded. Return to Today and retry when the connection is available."}
        action={<Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Go to Today</Link>}
      />
    );
  }

  let customers: Customer[] = [];
  let customerLookupUnavailable = false;
  try {
    customers = await listCustomers(token);
  } catch {
    customerLookupUnavailable = true;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="border-b border-border/70 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.19em] text-copper">
            Quick start · first useful estimate
          </p>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            Go to Today
          </Link>
        </div>
        <h1 className="mt-4 max-w-3xl font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Start with a job you actually know.
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          You can create your first project and draft estimate without setting up suppliers, payments,
          branding, or your team. Describe the work now; review quantities and prices in the real
          Estimate Workspace before sending anything.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section aria-labelledby="first-estimate-heading" className="overflow-hidden rounded-2xl border border-border/80 bg-card">
          <div className="border-b border-border/70 bg-muted/20 px-5 py-4 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">A real first job</p>
            <h2 id="first-estimate-heading" className="mt-2 font-heading text-xl font-semibold tracking-tight">
              Give TradeOS the scope.
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Two or three rough sentences are enough to begin. Your job is saved as a Project
              and a draft Estimate is created using the existing workflow.
            </p>
          </div>
          {customerLookupUnavailable ? (
            <p role="status" className="mx-5 mt-5 border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground sm:mx-7">
              Customer lookup is temporarily unavailable. You can still start without linking
              a customer; add one later from the Project workspace.
            </p>
          ) : null}
          <div className="px-5 py-5 sm:px-7 sm:py-7">
            <FirstEstimateForm customers={customers} />
          </div>
        </section>

        <aside aria-label="What happens next" className="rounded-2xl border border-border/80 bg-muted/10 p-5 sm:p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">What happens next</h2>
          <ol className="mt-4 space-y-4">
            <li>
              <p className="font-medium text-foreground">1. Save your scope</p>
              <p className="mt-1 text-sm text-muted-foreground">The actual Project holds your description, not a temporary demo fixture.</p>
            </li>
            <li>
              <p className="font-medium text-foreground">2. Open a draft estimate</p>
              <p className="mt-1 text-sm text-muted-foreground">TradeOS takes you directly into the existing Estimate Workspace.</p>
            </li>
            <li>
              <p className="font-medium text-foreground">3. Review items and prices</p>
              <p className="mt-1 text-sm text-muted-foreground">Use Estimate Assist where available, verify Costbook sources, and deliberately apply reviewed items.</p>
            </li>
          </ol>
          <p className="mt-5 border-t border-border/70 pt-4 text-xs leading-5 text-muted-foreground">
            Supplier connections, payment setup, company branding, and team invitations can wait.
            No AI draft or price is automatically approved here.
          </p>
        </aside>
      </div>
    </div>
  );
}
