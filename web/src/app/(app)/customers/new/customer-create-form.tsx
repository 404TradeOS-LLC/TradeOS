"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCustomerAction } from "@/app/actions/customers";

const MATCH_LABELS = { name: "Name matches", email: "Email matches" } as const;

export function CustomerCreateForm() {
  const [state, formAction, isPending] = useActionState(createCustomerAction, undefined);
  const [values, setValues] = useState({ name: "", email: "", phone: "", billingAddress: "" });

  const resultIsCurrent = state?.customerInput?.name === values.name.trim()
    && state.customerInput.email === values.email.trim()
    && state.customerInput.phone === values.phone.trim();
  const matches = resultIsCurrent ? state?.customerMatches ?? [] : [];

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Customer details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required placeholder="Smith Family" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} placeholder="owner@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} placeholder="(317) 555-0123" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="billingAddress">Billing address</Label>
            <Input id="billingAddress" name="billingAddress" value={values.billingAddress} onChange={(event) => setValues({ ...values, billingAddress: event.target.value })} placeholder="123 Main St, Indianapolis, IN" />
          </div>

          {matches.length > 0 ? (
            <section aria-labelledby="possible-matches-heading" className="rounded-xl border border-border bg-muted/30 p-4">
              <h2 id="possible-matches-heading" className="font-semibold">Possible existing customers</h2>
              <p className="mt-1 text-sm text-muted-foreground">These records match the name or email you entered. Choose one to open it, or create a separate customer record.</p>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {matches.map((customer) => (
                  <li key={customer.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{customer.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact saved"}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {customer.matchedOn.map((field) => <Badge key={field} variant="outline">{MATCH_LABELS[field]}</Badge>)}
                      </div>
                    </div>
                    <Link href={`/customers/${encodeURIComponent(customer.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Use existing customer
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {resultIsCurrent && state?.customerMatchLookupFailed ? (
            <p role="status" className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Some possible-match searches could not finish. Retry the search before creating this customer.</p>
          ) : resultIsCurrent && state?.customerMatches ? (
            <p role="status" className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">No likely matches found in this organization. You can create this customer.</p>
          ) : null}

          {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="submit" name="intent" value="check" variant="outline" disabled={isPending}>
              {isPending ? "Checking…" : "Check for existing customers"}
            </Button>
            {matches.length > 0 ? (
              <Button type="submit" name="intent" value="create-separate" disabled={isPending}>
                {isPending ? "Saving…" : "Create separate customer"}
              </Button>
            ) : (
              <Button type="submit" name="intent" value="create" disabled={isPending}>
                {isPending ? "Saving…" : "Create customer"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Possible matches are advisory. Phone formatting is not used for matching yet. TradeOS will not merge or block records automatically.</p>
        </form>
      </CardContent>
    </Card>
  );
}
