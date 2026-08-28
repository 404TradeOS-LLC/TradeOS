"use client";

import { useActionState } from "react";
import { recordInvoicePaymentAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatInvoiceCurrency } from "@/lib/document-workflow";

export function RecordPaymentForm({ projectId, invoiceId, balanceDue }: { projectId: string; invoiceId: string; balanceDue: number }) {
  const [state, formAction, pending] = useActionState(recordInvoicePaymentAction, undefined);

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="font-medium">Record a payment</h3>
        <p className="mt-1 text-sm text-muted-foreground">Apply a deposit, progress payment, or other received payment to this invoice.</p>
        <p className="mt-1 text-sm text-muted-foreground">Current balance: {formatInvoiceCurrency(balanceDue)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="paymentAmount">Amount</Label>
          <Input id="paymentAmount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paymentDate">Payment date</Label>
          <Input id="paymentDate" name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paymentMethod">Method</Label>
          <select
            id="paymentMethod"
            name="method"
            defaultValue="check"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          >
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="paymentReference">Reference <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="paymentReference" name="reference" maxLength={160} placeholder="Check number or transaction ID" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="paymentNotes">Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="paymentNotes" name="notes" rows={2} maxLength={2000} placeholder="Deposit received at jobsite…" />
      </div>
      {state?.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto sm:justify-self-end">
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
