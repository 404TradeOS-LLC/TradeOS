"use client";

import { useActionState } from "react";
import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/api";

export function NewProjectForm({ customers, defaultCustomerId }: { customers: Customer[]; defaultCustomerId?: string }) {
  const [state, formAction, isPending] = useActionState(createProjectAction, undefined);
  const validDefaultCustomerId = customers.some((customer) => customer.id === defaultCustomerId) ? defaultCustomerId : "";

  return (
    <Card className="max-w-3xl border-border/70 bg-muted/10">
      <CardHeader>
        <CardTitle>Project details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Job name</Label>
              <Input id="name" name="name" required placeholder="Smith Residence Roof Replacement" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="jobType">Type of work</Label>
              <Input id="jobType" name="jobType" placeholder="Roofing, siding, deck, bath remodel…" />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField label="Linked customer" name="customerId" defaultValue={validDefaultCustomerId}>
              <option value="">No customer linked yet</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </SelectField>
            <div className="flex flex-col gap-2">
              <Label htmlFor="siteAddress">Project address</Label>
              <Input id="siteAddress" name="siteAddress" placeholder="123 Main St, Indianapolis, IN" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="simpleScope">Short scope of work</Label>
            <Textarea
              id="simpleScope"
              name="simpleScope"
              rows={5}
              placeholder="Replace existing shingle roof, repair chimney flashing, and remove debris."
            />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending} className="w-full md:w-auto">
            {isPending ? "Saving…" : "Create project"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
