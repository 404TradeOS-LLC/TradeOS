import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import type { ContinueWorkingRow } from "@/components/dashboard/continue-working-model";

interface ContinueWorkingPanelProps {
  rows: ContinueWorkingRow[];
  scopeLabel: string;
}

/**
 * Renders the "Continue working" panel: in-progress work that isn't stuck or
 * overdue (that's Needs Attention above) — just the next step to keep a job
 * moving toward getting paid.
 */
export function ContinueWorkingPanel({ rows, scopeLabel }: ContinueWorkingPanelProps) {
  return (
    <DashboardPanel
      title="Continue working"
      description={`In-progress work from the ${scopeLabel} that's ready for its next step — nothing overdue, just next.`}
    >
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing mid-flight right now."
          description="Every loaded project is either waiting on a customer, fully invoiced, or hasn't started yet."
        />
      ) : (
        rows.map((row) => (
          <article key={row.projectId} className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-(--elev-1)">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold text-foreground">{row.projectName}</h3>
                <p className="mt-1 break-words text-sm text-muted-foreground">{row.customerName}</p>
                <p className="mt-2 break-words text-sm text-foreground">{row.helper}</p>
              </div>
              <Link href={row.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {row.label}
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </article>
        ))
      )}
    </DashboardPanel>
  );
}
