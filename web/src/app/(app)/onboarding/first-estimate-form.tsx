"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createFirstEstimateAction } from "@/app/actions/first-estimate";
import type { Customer } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackState } from "@/components/ui/feedback-state";

export function FirstEstimateForm({ customers }: { customers: Customer[] }) {
  const [state, formAction, isPending] = useActionState(createFirstEstimateAction, undefined);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [customerId, setCustomerId] = useState("");
  const isSaved = Boolean(state?.projectId);

  return (
    <form action={formAction} aria-busy={isPending} className="flex flex-col gap-5">

      <div className="flex flex-col gap-2">
        <Label htmlFor="quickstart-name">Job name</Label>
        <Input
          id="quickstart-name"
          name="name"
          required
          maxLength={160}
          placeholder="Garage floor refinishing"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          readOnly={isSaved || isPending}
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
          maxLength={10000}
          rows={7}
          placeholder="Paint a two-and-a-half-car garage floor. The old coating is worn in traffic areas. The customer wants a beige finish before next weekend."
          aria-describedby="quickstart-scope-help"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          readOnly={isSaved || isPending}
        />
        <p id="quickstart-scope-help" className="text-xs text-muted-foreground">
          Include the work and conditions you know. Measurements and products can be clarified in the estimate.
        </p>
      </div>

      {customers.length > 0 ? (
        <SelectField label="Customer (optional)" name="customerId" value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={isSaved || isPending}>
          <option value="">Add or link a customer later</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </SelectField>
      ) : null}

      {state?.error ? (
        <FeedbackState
          kind="error"
          title={isSaved ? "Your project is saved" : "Couldn’t start your estimate"}
          description={state.error}
          action={state.projectId ? (
            <Link href={`/projects/${state.projectId}`} className={buttonVariants({ variant: "outline" })}>
              Open saved project
            </Link>
          ) : (
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>Check Projects</Link>
          )}
        />
      ) : null}

      <Button type="submit" disabled={isPending} className="min-h-12 w-full sm:w-auto">
        {isPending ? (isSaved ? "Reopening your project…" : "Creating your estimate…") : (isSaved ? "Continue with saved project" : "Build My First Estimate")}
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        This creates a real draft estimate, not a finished quote. Prices and line items still need your approval.
      </p>
    </form>
  );
}
