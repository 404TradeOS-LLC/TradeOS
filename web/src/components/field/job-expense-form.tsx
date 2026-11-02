"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addJobExpenseAction, type JobExpenseActionState } from "@/app/actions/job-expenses";
import { JOB_EXPENSE_CATEGORY_LABELS } from "@/lib/job-expenses";

export function JobExpenseForm({
  jobId, defaultIncurredOn, idempotencyKey,
}: { jobId: string; defaultIncurredOn: string; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(addJobExpenseAction, undefined satisfies JobExpenseActionState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="expense-amount">Amount (USD)</Label>
          <Input id="expense-amount" name="amount" type="text" inputMode="decimal" placeholder="0.00"
            aria-label="Expense amount in dollars" required className="min-h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="expense-category">Category</Label>
          <select id="expense-category" name="category" defaultValue="material" required
            className="min-h-11 rounded-md border border-input bg-background px-3 text-base md:text-sm">
            {Object.entries(JOB_EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="expense-vendor">Vendor</Label>
          <Input id="expense-vendor" name="vendor" type="text" maxLength={200}
            placeholder="Supplier or store (optional)" className="min-h-11" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="expense-incurred">Date incurred</Label>
          <Input id="expense-incurred" name="incurredOn" type="date"
            defaultValue={defaultIncurredOn} required className="min-h-11" />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expense-payer">Who paid?</Label>
        <select id="expense-payer" name="paymentResponsibility" defaultValue="contractor" required
          className="min-h-11 rounded-md border border-input bg-background px-3 text-base md:text-sm">
          <option value="contractor">I paid / business paid</option>
          <option value="customer">Customer paid / supplied</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Customer-paid purchases remain visible but do not count toward business costs.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expense-description">What was purchased or done?</Label>
        <Textarea id="expense-description" name="description" rows={2} maxLength={2000}
          placeholder="e.g. Patio paint and brushes" aria-label="Expense description" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expense-note">Receipt note</Label>
        <Textarea id="expense-note" name="receiptNote" rows={2} maxLength={2000}
          placeholder="Receipt number, explanation (optional)" aria-label="Receipt note" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="expense-receipt">Receipt photo or PDF (optional)</Label>
        <Input id="expense-receipt" name="receipt" type="file"
          accept="image/png,image/jpeg,application/pdf" className="min-h-11" />
        <p className="text-xs text-muted-foreground">
          JPEG, PNG or PDF, up to 6 MB. Stored privately with the job.
        </p>
      </div>
      {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto sm:justify-self-end">
        {pending ? "Saving…" : "Add expense"}
      </Button>
    </form>
  );
}
