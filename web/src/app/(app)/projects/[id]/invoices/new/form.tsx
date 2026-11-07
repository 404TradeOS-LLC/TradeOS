"use client";

import { useActionState, useState } from "react";
import { createInvoiceAction } from "@/app/actions/invoices";
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

export function NewInvoiceForm({ projectId, estimates, proposals }: { projectId: string; estimates: Estimate[]; proposals: Proposal[] }) {
  const [state, formAction, isPending] = useActionState(createInvoiceAction, undefined);
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
          <input type="hidden" name="projectId" value={projectId} />
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
          )}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" name="type" value="full" checked={type === "full"} onChange={() => setType("full")} /> Full
            </label>
            <label className="flex items-center gap-1">
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
              <Input id="percentComplete" name="percentComplete" type="number" min="0" max="100" step="any" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" name="dueDate" type="text" inputMode="numeric" autoComplete="off" placeholder="MM/DD/YYYY or YYYY-MM-DD" aria-describedby="dueDate-hint" />
            <p id="dueDate-hint" className="text-xs text-muted-foreground">Optional. Type MM/DD/YYYY or YYYY-MM-DD.</p>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating…" : "Create invoice"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
