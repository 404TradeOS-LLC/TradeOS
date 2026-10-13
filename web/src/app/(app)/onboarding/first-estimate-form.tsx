"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/app/actions/projects";
import type { Customer } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";

export function FirstEstimateForm({ customers }: { customers: Customer[] }) {
  const [state, formAction, isPending] = useActionState(createProjectAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="intent" value="estimate" />

      <div className="flex flex-col gap-2">
        <Label htmlFor="quickstart-name">Job name</Label>
        <Input
          id="quickstart-name"
          name="name"
          required
          maxLength={160}
          placeholder="Garage floor refinishing"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">A recognizable name for this project.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="quickstart-scope">What does the customer want done?</Label>
        <Textarea
          id="quickstart-scope"
          name="simpleScope"
          required
          minLength={12}
          rows={7}
          placeholder="Paint a two-and-a-half-car garage floor. The old coating is worn in traffic areas. The customer wants a beige finish before next weekend."
          aria-describedby="quickstart-scope-help"
        />
        <p id="quickstart-scope-help" className="text-xs text-muted-foreground">
          Include the work and conditions you know. Measurements and products can be clarified in the estimate.
        </p>
      </div>

      {customers.length > 0 ? (
        <SelectField label="Customer (optional)" name="customerId" defaultValue="">
          <option value="">Add or link a customer later</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </SelectField>
      ) : null}

      {state?.error ? (
        <p role="alert" className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="min-h-12 w-full sm:w-auto">
        {isPending ? "Creating your estimate…" : "Create project & start estimate"}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        This creates a real draft estimate, not a finished quote. Prices and line items still need your approval.
      </p>
    </form>
  );
}
