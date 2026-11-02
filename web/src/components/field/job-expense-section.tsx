import { JobExpenseForm } from "@/components/field/job-expense-form";
import type { JobCostSummary, JobExpense } from "@/lib/api";
import { expenseCategoryLabel, formatCentsUsd } from "@/lib/job-expenses";

function formatIncurredOn(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

export function JobExpenseSection({
  jobId,
  expenses,
  summary,
  loadError,
  defaultIncurredOn,
}: {
  jobId: string;
  expenses: JobExpense[];
  summary: JobCostSummary | null;
  loadError: string | null;
  defaultIncurredOn: string;
}) {
  const actualCents = summary?.actualCents ?? expenses
    .filter((expense) => (expense.paymentResponsibility ?? "contractor") !== "customer")
    .reduce((total, expense) => total + expense.amountCents, 0);
  const customerPaidCents = summary?.customerPaidCents ?? expenses
    .filter((expense) => expense.paymentResponsibility === "customer")
    .reduce((total, expense) => total + expense.amountCents, 0);
  const estimatedCents = summary?.estimatedCents ?? null;
  const varianceCents = summary?.varianceCents ?? (estimatedCents === null ? null : estimatedCents - actualCents);

  return (
    <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-labelledby="job-costs-heading">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Job costs</p>
        <h3 id="job-costs-heading" className="mt-1 font-heading text-lg font-medium">
          Actual costs
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Record actual business costs separately from materials paid for by your customer.</p>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning-foreground" role="status">
          {loadError} Costs you add below will still save.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contractor-paid</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">{formatCentsUsd(actualCents)}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Customer-paid</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">{formatCentsUsd(customerPaidCents)}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estimated</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">{estimatedCents === null ? "No estimate" : formatCentsUsd(estimatedCents)}</dd>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quote less costs</dt>
          <dd className="mt-1 text-base font-semibold sm:text-lg">
            {varianceCents === null ? "—" : varianceCents < 0 ? `${formatCentsUsd(-varianceCents)} over` : formatCentsUsd(varianceCents)}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Estimated is the project's latest quoted price, not a cost budget. Quote less costs is not profit or collected revenue.
      </p>

      {expenses.length > 0 ? (
        <ul className="grid gap-2">
          {expenses.map((expense) => (
            <li key={expense.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">
                  {expenseCategoryLabel(expense.category)}
                  {expense.vendor ? <span className="font-normal text-muted-foreground"> · {expense.vendor}</span> : null}
                </p>
                <p className="text-sm font-semibold">{formatCentsUsd(expense.amountCents)}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatIncurredOn(expense.incurredOn)}
                {" · "}
                {expense.paymentResponsibility === "customer" ? "Customer paid" : "Contractor paid"}
              </p>
              {expense.receiptNote ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{expense.receiptNote}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-muted/30 px-3 py-3 text-sm text-muted-foreground">No expenses recorded for this job yet.</p>
      )}

      <div className="border-t border-border/70 pt-4">
        <JobExpenseForm jobId={jobId} defaultIncurredOn={defaultIncurredOn} />
      </div>
    </section>
  );
}
