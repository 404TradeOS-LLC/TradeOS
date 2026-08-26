"use client";

import { useActionState } from "react";
import { updateProposalAction } from "@/app/actions/proposals";
import { PaymentScheduleFields } from "@/components/proposals/payment-schedule-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Proposal } from "@/lib/api";

export function ProposalReviewForm({ projectId, proposal }: { projectId: string; proposal: Proposal }) {
  const [state, formAction, isPending] = useActionState(updateProposalAction, undefined);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="proposalId" value={proposal.id} />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input id="companyName" name="companyName" defaultValue={proposal.companyName ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="timeline">Estimated timeline</Label>
          <Input id="timeline" name="timeline" defaultValue={proposal.timeline ?? ""} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="priceLow">Low range</Label>
          <Input id="priceLow" name="priceLow" defaultValue={proposal.priceLow ?? ""} inputMode="decimal" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priceHigh">High range</Label>
          <Input id="priceHigh" name="priceHigh" defaultValue={proposal.priceHigh ?? ""} inputMode="decimal" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="finalPrice">Final price</Label>
          <Input id="finalPrice" name="finalPrice" defaultValue={proposal.finalPrice ?? ""} inputMode="decimal" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="scopeOfWork">Scope of work</Label>
        <Textarea id="scopeOfWork" name="scopeOfWork" rows={8} defaultValue={proposal.scopeOfWork ?? ""} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="assumptions">Assumptions</Label>
          <Textarea id="assumptions" name="assumptions" rows={8} defaultValue={proposal.assumptions ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exclusions">Exclusions</Label>
          <Textarea id="exclusions" name="exclusions" rows={8} defaultValue={proposal.exclusions ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="termsAndConditions">Terms and conditions</Label>
        <Textarea id="termsAndConditions" name="termsAndConditions" rows={6} defaultValue={proposal.termsAndConditions ?? ""} />
      </div>

      <PaymentScheduleFields
        schedule={Array.isArray(proposal.paymentScheduleJson) ? (proposal.paymentScheduleJson as Array<{ label: string; amountPercent: number; notes?: string }>) : []}
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={isPending} className="w-full md:w-auto">
        {isPending ? "Saving proposal…" : "Save proposal draft"}
      </Button>
    </form>
  );
}
