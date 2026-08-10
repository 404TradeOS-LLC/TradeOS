"use client";

import { useActionState } from "react";
import { createCustomerAction } from "@/app/actions/customers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewCustomerPage() {
  const [state, formAction, isPending] = useActionState(createCustomerAction, undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Add customer</h1>
        <p className="text-sm text-muted-foreground">Enter the contact details you want on bids, proposals, invoices, and payment reminders.</p>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Smith Family" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="owner@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" placeholder="(317) 555-0123" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="billingAddress">Billing address</Label>
              <Input id="billingAddress" name="billingAddress" placeholder="123 Main St, Indianapolis, IN" />
            </div>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Create customer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
