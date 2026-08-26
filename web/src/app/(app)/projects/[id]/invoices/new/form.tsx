"use client";

import { useActionState, useState } from "react";
import { createInvoiceAction } from "@/app/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import type { Estimate } from "@/lib/api";

export function NewInvoiceForm({ projectId, estimates }: { projectId: string; estimates: Estimate[] }) {
  const [state, formAction, isPending] = useActionState(createInvoiceAction, undefined);
  const [type, setType] = useState<"full" | "progress">("full");

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Invoice details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="projectId" value={projectId} />
          <SelectField label="Estimate" name="estimateId" required defaultValue="">
            <option value="">Select an estimate…</option>
            {estimates.map((estimate) => (
              <option key={estimate.id} value={estimate.id}>
                v{estimate.version} · {estimate.status} · ${estimate.totalPrice.toFixed(2)}
              </option>
            ))}
          </SelectField>
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
