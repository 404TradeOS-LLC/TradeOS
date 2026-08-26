"use client";

import { useActionState } from "react";
import { addChangeOrderLineItemAction, createChangeOrderAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangeOrderCreateForm({
  projectId,
  estimateOptions,
}: {
  projectId: string;
  estimateOptions: Array<{ id: string; label: string }>;
}) {
  const [state, formAction, isPending] = useActionState(createChangeOrderAction, undefined);

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-border/70 bg-card/90 p-5">
      <input type="hidden" name="projectId" value={projectId} />
      <div>
        <h3 className="text-base font-semibold text-foreground">Create change order</h3>
        <p className="mt-1 text-sm text-muted-foreground">Capture scope shifts without turning TradeOS into full PM software.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="Add sheathing replacement at rear slope" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="scheduleImpactDays">Schedule impact</Label>
          <Input id="scheduleImpactDays" name="scheduleImpactDays" type="number" min="0" placeholder="2" />
        </div>
        <div className="grid gap-2 md:col-span-3">
          <Label htmlFor="estimateId">Original estimate</Label>
          <select
            id="estimateId"
            name="estimateId"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">No linked estimate</option>
            {estimateOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Create change order"}
        </Button>
      </div>
    </form>
  );
}

export function ChangeOrderLineItemForm({ projectId, changeOrderId }: { projectId: string; changeOrderId: string }) {
  const [state, formAction, isPending] = useActionState(addChangeOrderLineItemAction, undefined);

  return (
    <form action={formAction} className="grid gap-3 rounded-xl border border-border/60 bg-background/70 p-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="changeOrderId" value={changeOrderId} />
      <div className="grid gap-3 md:grid-cols-[1.6fr_0.7fr_0.7fr_auto]">
        <Input name="description" placeholder="Line item description" />
        <Input name="quantity" type="number" min="0" step="0.01" placeholder="Qty" />
        <Input name="unitCost" type="number" min="0" step="0.01" placeholder="Unit cost" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add line"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
