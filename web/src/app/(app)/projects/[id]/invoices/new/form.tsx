"use client";

import { useActionState, useState } from "react";
import { createInvoiceAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import type { Estimate, Proposal } from "@/lib/api";

export function NewInvoiceForm({ projectId, estimates, proposals }: { projectId: string; estimates: Estimate[]; proposals: Proposal[] }) {
  const [state, formAction, isPending] = useActionState(createInvoiceAction, undefined);
  const [type, setType] = useState<"full" | "progress">("full");
  const [estimateId, setEstimateId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const eligibleEstimates = estimates.filter((estimate) => estimate.status !== "draft");
  const acceptedProposals = proposals.filter(
    (proposal) => proposal.status === "accepted" && proposal.finalPrice !== null && proposal.estimateId === estimateId
  );

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
            required
            value={estimateId}
            onChange={(event) => {
              setEstimateId(event.target.value);
              setProposalId("");
            }}
          >
            <option value="">Select an estimate…</option>
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
            <Input id="dueDate" name="dueDate" type="date" />
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
