"use client";

import { useActionState } from "react";
import { updateJobExpenseAction, voidJobExpenseAction, type JobExpenseActionState } from "@/app/actions/job-expenses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobExpense } from "@/lib/api";
import { JOB_EXPENSE_CATEGORY_LABELS } from "@/lib/job-expenses";

export function JobExpenseRowActions({ expense }: { expense: JobExpense }) {
  const [editState, editAction, editPending] = useActionState(updateJobExpenseAction, undefined satisfies JobExpenseActionState);
  const [voidState, voidAction, voidPending] = useActionState(voidJobExpenseAction, undefined satisfies JobExpenseActionState);

  if (expense.voidedAt) return null;
  return (
    <details className="mt-3 border-t border-border/60 pt-3">
      <summary className="cursor-pointer text-sm font-medium text-copper">Edit or void this expense</summary>
      <form action={editAction} className="mt-3 grid gap-3">
        <input type="hidden" name="jobId" value={expense.jobId} />
        <input type="hidden" name="expenseId" value={expense.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={`amount-${expense.id}`}>Amount (USD)</Label>
            <Input id={`amount-${expense.id}`} name="amount" type="text" inputMode="decimal"
              required defaultValue={(expense.amountCents / 100).toFixed(2)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`category-${expense.id}`}>Category</Label>
            <select id={`category-${expense.id}`} name="category" defaultValue={expense.category} required
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base md:text-sm">
              {Object.entries(JOB_EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <Label htmlFor={`payer-${expense.id}`}>Paid by</Label>
            <select id={`payer-${expense.id}`} name="paymentResponsibility"
              defaultValue={expense.paymentResponsibility} required
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base md:text-sm">
              <option value="contractor">Contractor</option>
              <option value="customer">Customer</option>
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`date-${expense.id}`}>Incurred on</Label>
            <Input id={`date-${expense.id}`} name="incurredOn" type="date"
              required defaultValue={expense.incurredOn} />
          </div>
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`vendor-${expense.id}`}>Vendor</Label>
          <Input id={`vendor-${expense.id}`} name="vendor" type="text"
            maxLength={200} defaultValue={expense.vendor} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`description-${expense.id}`}>Description</Label>
          <Textarea id={`description-${expense.id}`} name="description" rows={2}
            maxLength={2000} defaultValue={expense.description} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`note-${expense.id}`}>Receipt note</Label>
          <Textarea id={`note-${expense.id}`} name="receiptNote" rows={2}
            maxLength={2000} defaultValue={expense.receiptNote} />
        </div>
        {editState?.error ? <p role="alert" className="text-sm text-destructive">{editState.error}</p> : null}
        <Button type="submit" disabled={editPending} className="min-h-11 w-full sm:w-auto sm:justify-self-end">
          {editPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
      <form action={voidAction} className="mt-4 grid gap-2 border-t border-border/60 pt-4">
        <input type="hidden" name="jobId" value={expense.jobId} />
        <input type="hidden" name="expenseId" value={expense.id} />
        <Label htmlFor={`void-reason-${expense.id}`}>Reason for voiding (optional)</Label>
        <Input id={`void-reason-${expense.id}`} name="reason" type="text" maxLength={500}
          placeholder="Duplicate or entered in error" />
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" required className="mt-1" />
          I understand this expense will be voided, not erased, and removed from cost totals.
        </label>
        {voidState?.error ? <p role="alert" className="text-sm text-destructive">{voidState.error}</p> : null}
        <Button type="submit" variant="outline" disabled={voidPending}
          className="min-h-11 w-full sm:w-auto sm:justify-self-start">
          {voidPending ? "Voiding…" : "Void expense"}
        </Button>
      </form>
    </details>
  );
}
