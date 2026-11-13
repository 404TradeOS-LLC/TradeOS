"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createInvoiceAction, type CreateInvoiceResult } from "@/app/actions/invoices";
import { submitInvoiceDraft, type InvoiceAttempt } from "./submit-invoice-draft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import type { Estimate, Proposal } from "@/lib/api";

interface ManualLine {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_LINE: ManualLine = { description: "", quantity: "1", unitPrice: "" };

export function NewInvoiceForm({ projectId, projectName, customerName, estimates, proposals, createRequestKey }: { projectId: string; projectName: string; customerName: string; estimates: Estimate[]; proposals: Proposal[]; createRequestKey: string }) {
  const router = useRouter();
  const attempt = useRef<InvoiceAttempt | null>(null);
  const errorContext = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState<CreateInvoiceResult | undefined, FormData>(async (previous, data) => {
    if (previous && "invoiceId" in previous) return previous;
    const result = await submitInvoiceDraft(attempt, data, createInvoiceAction);
    if ("invoiceId" in result) router.replace(`/projects/${projectId}/invoices/${encodeURIComponent(result.invoiceId)}`);
    return result;
  }, undefined);
  const unconfirmed = state && "error" in state && state.unconfirmed;
  const confirmed = state && "invoiceId" in state;
  const [percentComplete, setPercentComplete] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<"full" | "progress">("full");
  const [estimateId, setEstimateId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [lines, setLines] = useState<ManualLine[]>([{ ...EMPTY_LINE }]);
  const eligibleEstimates = estimates.filter((estimate) => estimate.status !== "draft");
  const acceptedProposals = proposals.filter(
    (proposal) => proposal.status === "accepted" && proposal.finalPrice !== null && proposal.estimateId === estimateId
  );
  // The estimate is optional: with no estimate selected, the invoice is built
  // from the manual line items below instead of an estimate's priced scope.
  const manualMode = estimateId === "";

  useEffect(() => {
    if (!isPending && state && "error" in state) errorContext.current?.focus();
  }, [state, isPending]);

  function updateLine(index: number, patch: Partial<ManualLine>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  return (
    <Card className="w-full max-w-[680px] [--card-spacing:--spacing(5)]">
      <CardHeader>
        <p className="text-xs font-medium uppercase text-accent-foreground">{isPending ? "Saving draft" : unconfirmed ? "Save not confirmed" : confirmed ? "Draft · not sent" : "Not saved"}</p>
        <CardTitle>{projectName}</CardTitle>
        <p className="text-xs text-muted-foreground">{unconfirmed ? "Retry with these details. If you leave or reload, check the project’s invoices before creating another." : "Choose how to price this invoice."}</p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <section className="space-y-2 rounded-lg border p-3.5" aria-label="Project and customer">
            <h2 className="font-semibold">Project and customer</h2>
            <p className="text-xs text-muted-foreground">{projectName} · {customerName}</p>
          </section>
          {unconfirmed && !isPending && <section className="space-y-2 rounded-lg border p-3.5" aria-label="Last submitted details">
            <h2 className="font-semibold">Last submitted details</h2>
            <p className="text-xs text-muted-foreground">{type === "progress" ? `Progress invoice · ${percentComplete}%` : "Full invoice"}{estimateId ? ` · Estimate v${estimates.find(estimate => estimate.id === estimateId)?.version ?? ""}` : " · Manual line items"}</p>
            {proposalId && <p className="text-xs text-muted-foreground">Accepted proposal pricing</p>}
            {manualMode && <ul className="space-y-1 text-xs text-muted-foreground">{lines.map((line, index) => <li key={index}>Line {index + 1} · {line.description} · {line.quantity} × ${line.unitPrice}</li>)}</ul>}
            {dueDate && <p className="text-xs text-muted-foreground">Due date · {dueDate}</p>}
          </section>}
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="createRequestKey" value={createRequestKey} />
          {/* Disabled fields are omitted from FormData; unconfirmed retries must
              resend the retained attempt.data, not incoming form values. */}
          <fieldset disabled={isPending || Boolean(unconfirmed || confirmed)} className={`${unconfirmed && !isPending ? "hidden" : "flex"} min-w-0 flex-col gap-4 rounded-lg border p-3.5 [&_input:not([type=radio])]:h-11 [&_select]:h-11`}>
            <legend className="sr-only">Invoice details</legend>
            <h2 className="font-semibold">Invoice details</h2>
            <SelectField
              label="Estimate"
              name="estimateId"
              value={estimateId}
              onChange={(event) => {
                setEstimateId(event.target.value);
                setProposalId("");
              }}
            >
              <option value="">No estimate — manual invoice</option>
              {eligibleEstimates.map((estimate) => (
                <option key={estimate.id} value={estimate.id}>
                  v{estimate.version} · {estimate.status} · ${Number(estimate.totalPrice).toFixed(2)}
                </option>
              ))}
            </SelectField>
            {acceptedProposals.length > 0 ? (
              <SelectField label="Accepted proposal price" name="proposalId" value={proposalId} onChange={(event) => setProposalId(event.target.value)}>
                <option value="">Use estimate price</option>
                {acceptedProposals.map((proposal) => (
                  <option key={proposal.id} value={proposal.id}>
                    Accepted proposal · ${Number(proposal.finalPrice).toFixed(2)}
                  </option>
                ))}
              </SelectField>
            ) : null}
            {manualMode && (
              <div className="flex flex-col gap-3">
                <input type="hidden" name="lineCount" value={lines.length} />
                <p className="text-sm text-muted-foreground">Enter the work to bill. Each line is quantity × unit price.</p>
                {lines.map((line, index) => (
                  <div key={index} className="flex flex-col gap-2 rounded-lg border border-input p-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`lineDescription${index}`}>{index > 0 ? `Line ${index + 1} · Description` : "Description"}</Label>
                      <Input
                        id={`lineDescription${index}`}
                        name={`lineDescription${index}`}
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                        placeholder="e.g. Deep clean bathtub"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="flex flex-1 flex-col gap-2">
                        <Label htmlFor={`lineQuantity${index}`}>{index > 0 ? `Line ${index + 1} · Quantity` : "Quantity"}</Label>
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
                        <Label htmlFor={`lineUnitPrice${index}`}>{index > 0 ? `Line ${index + 1} · Unit price ($)` : "Unit price ($)"}</Label>
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
                        className="h-11 w-full sm:w-auto"
                        disabled={lines.length === 1}
                        onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove line {index + 1}
                      </Button>
                    </div>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}>
                    Add line item
                  </Button>
                </div>
              </div>
            )}
            <div role="group" aria-label="Invoice type" className="flex min-h-11 items-center gap-4 rounded-lg border px-2.5 text-sm">
              <label className="flex min-h-11 items-center gap-2">
                <input type="radio" name="type" value="full" checked={type === "full"} onChange={() => setType("full")} /> Full
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="type"
                  value="progress"
                  checked={type === "progress"}
                  onChange={() => setType("progress")}
                />{" "}
                Progress
              </label>
            </div>
            {type === "progress" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="percentComplete">Percent complete</Label>
                <Input id="percentComplete" name="percentComplete" type="number" min="0" max="100" step="any" value={percentComplete} onChange={(event) => setPercentComplete(event.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" name="dueDate" type="text" inputMode="text" value={dueDate} onChange={(event) => setDueDate(event.target.value)} autoComplete="off" placeholder="MM/DD/YYYY or YYYY-MM-DD" aria-describedby="dueDate-hint" />
              <p id="dueDate-hint" className="text-xs text-muted-foreground">Optional. Type MM/DD/YYYY or YYYY-MM-DD.</p>
            </div>
          </fieldset>
          {state && "error" in state && (
            <div ref={errorContext} tabIndex={-1} role="alert" className="space-y-2 rounded-lg text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {unconfirmed && <h2 className="font-semibold">Invoice save not confirmed</h2>}
              <p>{state.error}</p>
              {unconfirmed && <p>Retry the same draft here, or check this project’s invoices before starting another draft.</p>}
            </div>
          )}
          <p role="status" className="sr-only">{isPending ? "Saving invoice draft" : confirmed ? "Invoice draft saved" : ""}</p>
          <Button type="submit" className="h-11 w-full sm:max-w-[300px]" disabled={isPending || Boolean(confirmed)}>
            {isPending ? "Saving…" : confirmed ? "Draft saved" : unconfirmed ? "Retry same draft" : "Create invoice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
