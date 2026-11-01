"use client";

import { useActionState, useState } from "react";
import { updateInvoiceAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInvoiceCurrency } from "@/lib/document-workflow";
import type { Invoice, InvoiceLineItem } from "@/lib/api";

interface ManualLine {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE: ManualLine = { description: "", quantity: "1", unitPrice: "" };

// Line editing is offered only for manual full drafts, using the same
// indexed line fields and the same parseManualLineItems validation as
// invoice creation (blank unit prices rejected, untouched rows skipped).
// The line editor markup deliberately mirrors the new-invoice form rather
// than extracting a shared component: the new form's shape tests pin those
// fields inside form.tsx, so an extraction would break them without
// changing any behavior. Progress and estimate-linked drafts submit
// due-date-only edits; the backend 409s any line replacement on those
// invoices, so the form never offers it.
export function EditInvoiceForm({
  projectId,
  invoice,
}: {
  projectId: string;
  invoice: Invoice & { lineItems: InvoiceLineItem[] };
}) {
  const [state, formAction, isPending] = useActionState(updateInvoiceAction, undefined);
  const linesEditable = invoice.type === "full" && invoice.estimateId === null;
  const [lines, setLines] = useState<ManualLine[]>(
    invoice.lineItems.length > 0
      ? invoice.lineItems.map((line) => ({
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
        }))
      : [{ ...EMPTY_LINE }]
  );

  function updateLine(index: number, patch: Partial<ManualLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Invoice details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="invoiceId" value={invoice.id} />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="editMode" value={linesEditable ? "lines" : "dueDate"} />
          {linesEditable ? (
            <div className="flex flex-col gap-3">
              <input type="hidden" name="lineCount" value={lines.length} />
              <p className="text-sm text-muted-foreground">Edit the work billed. Each line is quantity × unit price.</p>
              {lines.map((line, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-lg border border-input p-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`lineDescription${index}`}>Description</Label>
                    <Input
                      id={`lineDescription${index}`}
                      name={`lineDescription${index}`}
                      value={line.description}
                      onChange={(event) => updateLine(index, { description: event.target.value })}
                      placeholder="e.g. Deep clean bathtub"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor={`lineQuantity${index}`}>Quantity</Label>
                      <Input
                        id={`lineQuantity${index}`}
                        name={`lineQuantity${index}`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-2">
                      <Label htmlFor={`lineUnitPrice${index}`}>Unit price ($)</Label>
                      <Input
                        id={`lineUnitPrice${index}`}
                        name={`lineUnitPrice${index}`}
                        type="number"
                        min="0"
                        step="any"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove line
                    </Button>
                  </div>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}>
                  Add line item
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                {invoice.type === "progress"
                  ? "Progress invoice lines are scaled from the percent complete and can't be edited directly. You can change the due date below."
                  : "Line items on this invoice come from its estimate, so they can't be edited here. You can change the due date below."}
              </p>
              {invoice.lineItems.map((line) => (
                <div key={line.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-foreground">{line.description}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{formatInvoiceCurrency(line.lineTotal)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={invoice.dueDate ? invoice.dueDate.slice(0, 10) : ""} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
