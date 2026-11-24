import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInvoiceCurrency, formatProposalDueDate } from "@/lib/document-workflow";
import type { ProposalAllowance, ProposalSelection } from "@/lib/api";

// DES-10-F8: read-only Copperline proposal sections 03 (selections) and 04
// (allowances) for the customer portal. Renders nothing when the proposal
// has neither — no invented rows. The allowances total is display-only and
// is not added to the proposal investment shown elsewhere on the page.
export function ProposalSelectionsAllowancesReadonly({
  selections,
  allowances,
  allowancesTotal,
}: {
  selections: ProposalSelection[];
  allowances: ProposalAllowance[];
  allowancesTotal: number;
}) {
  if (selections.length === 0 && allowances.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selections &amp; allowances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {selections.length > 0 && (
          <section aria-label="Selections">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">03 · Selections</div>
            <ul className="mt-3 space-y-3">
              {selections.map((selection) => {
                const dueDate = formatProposalDueDate(selection.dueDate);
                return (
                  <li key={selection.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          {selection.label}
                        </div>
                        <div className="mt-1 font-medium">
                          {selection.detail ?? (dueDate ? `Choose by ${dueDate}` : "No option chosen yet")}
                        </div>
                        {selection.detail && dueDate && (
                          <div className="mt-1 text-xs text-muted-foreground">Decide by {dueDate}</div>
                        )}
                      </div>
                      <StatusBadge status={selection.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {allowances.length > 0 && (
          <section aria-label="Allowances">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">04 · Allowances</div>
            <ul className="mt-3 space-y-3">
              {allowances.map((allowance) => (
                <li key={allowance.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="font-medium">{allowance.description}</div>
                  <div className="font-medium">{formatInvoiceCurrency(allowance.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-start justify-between border-t-2 border-foreground/80 pt-3 font-bold">
              <span className="text-xs uppercase tracking-[0.15em]">Total allowance</span>
              <span>{formatInvoiceCurrency(allowancesTotal)}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Allowances are shown for reference. They are not added to the proposal investment.
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
