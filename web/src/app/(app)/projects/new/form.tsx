"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProjectAction } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, ServiceAddress } from "@/lib/api";
import type { NewProjectCreateIntent } from "@/lib/universal-create";

type CustomerProjectContext = Customer & { serviceAddresses: ServiceAddress[] };

function formatServiceAddress(address: ServiceAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function serviceAddressLabel(address: ServiceAddress) {
  const label = address.label?.trim() || "Service address";
  return address.isPrimary ? `${label} · Primary` : label;
}

export function NewProjectForm({
  customers,
  defaultCustomerId,
  selectedCustomer,
  focusScope = false,
  createIntent,
}: {
  customers: Customer[];
  defaultCustomerId?: string;
  selectedCustomer?: CustomerProjectContext;
  focusScope?: boolean;
  createIntent?: NewProjectCreateIntent;
}) {
  const [state, formAction, isPending] = useActionState(createProjectAction, undefined);
  const validDefaultCustomerId = customers.some((customer) => customer.id === defaultCustomerId)
    ? defaultCustomerId
    : selectedCustomer?.id ?? "";
  const savedAddresses = selectedCustomer?.serviceAddresses ?? [];
  const preferredAddress = savedAddresses.find((address) => address.isPrimary) ?? savedAddresses[0] ?? null;
  const customerContext = Boolean(selectedCustomer);

  return (
    <div className={customerContext ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" : "max-w-3xl"}>
      <Card className="border-border/70 bg-muted/10">
        <CardHeader className="border-b border-border/60">
          {customerContext ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-success">1 Customer</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-success">2 Address</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-accent-foreground">3 Project</span>
            </div>
          ) : null}
          <CardTitle>Project details</CardTitle>
          {customerContext ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Project name and scope persist on the Project. A selected saved address is copied into the existing Project site-address text field.
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="pt-5">
          <form action={formAction} className="flex flex-col gap-5">
            {createIntent ? <input type="hidden" name="intent" value={createIntent} /> : null}

            {selectedCustomer ? (
              <input type="hidden" name="customerId" value={selectedCustomer.id} />
            ) : (
              <SelectField label="Linked customer" name="customerId" defaultValue={validDefaultCustomerId}>
                <option value="">No customer linked yet</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </SelectField>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" name="name" required placeholder="Deck Replacement" />
                <p className="text-xs text-muted-foreground">Required</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="jobType">Job type</Label>
                <Input id="jobType" name="jobType" placeholder="Deck / Exterior carpentry" />
                <p className="text-xs text-muted-foreground">Optional</p>
              </div>
            </div>

            {selectedCustomer && savedAddresses.length > 0 ? (
              <SelectField
                label="Jobsite"
                name="siteAddress"
                defaultValue={preferredAddress ? formatServiceAddress(preferredAddress) : ""}
                hint="Saved Customer address selected · copied into Project.siteAddress."
              >
                {savedAddresses.map((address) => {
                  const formatted = formatServiceAddress(address);
                  return (
                    <option key={address.id} value={formatted}>
                      {serviceAddressLabel(address)} — {formatted}
                    </option>
                  );
                })}
                <option value="">Use no saved address</option>
              </SelectField>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="siteAddress">Project address</Label>
                <Input
                  id="siteAddress"
                  name="siteAddress"
                  defaultValue={selectedCustomer?.address ?? ""}
                  placeholder="123 Main St, Terre Haute, IN"
                />
                {selectedCustomer ? (
                  <p className="text-xs text-muted-foreground">No saved ServiceAddress is available; enter the current jobsite as Project text.</p>
                ) : null}
              </div>
            )}

            {selectedCustomer && savedAddresses.length > 0 ? (
              <p className="rounded-xl border border-info/25 bg-info/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                ServiceAddress remains a Customer record. TradeOS copies only the formatted address text into this Project; no hidden Project→ServiceAddress relationship is created.
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="simpleScope">Scope</Label>
              <Textarea
                id="simpleScope"
                name="simpleScope"
                rows={5}
                autoFocus={focusScope}
                placeholder="Replace the existing deck with pressure-treated framing and decking. Remove and dispose of old materials."
              />
              <p className="text-xs text-muted-foreground">Saved as Project.simpleScope and available to the estimating workflow.</p>
            </div>

            {state?.error ? (
              <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}

            {customerContext && !createIntent ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={isPending} className="sm:min-w-40">
                  {isPending ? "Saving…" : "Create project"}
                </Button>
                <Button
                  type="submit"
                  name="intent"
                  value="estimate"
                  variant="outline"
                  disabled={isPending}
                  className="sm:min-w-48"
                >
                  {isPending ? "Saving…" : "Create & start estimate"}
                </Button>
              </div>
            ) : (
              <Button type="submit" disabled={isPending} className="w-full md:w-auto">
                {isPending ? "Saving…" : createIntent === "estimate" ? "Create & start estimate" : "Create project"}
              </Button>
            )}

            {customerContext ? (
              <p className="text-xs text-muted-foreground">
                Create project opens the new Project workspace immediately. Create & start estimate continues into the existing Estimate workflow.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {selectedCustomer ? (
        <aside className="grid content-start gap-4">
          <Card className="border-border/70">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Customer</p>
              <CardTitle>{selectedCustomer.name}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>{selectedCustomer.phone ?? "Phone not recorded"}</p>
              <p className="break-all">{selectedCustomer.email ?? "Email not recorded"}</p>
              <p className="mt-1 text-xs font-medium text-success">Existing CRM record</p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Saved service address</p>
              <CardTitle className="text-base">
                {preferredAddress ? serviceAddressLabel(preferredAddress) : "No saved address"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">
                {preferredAddress ? formatServiceAddress(preferredAddress) : "Add a ServiceAddress on the Customer before reusing it here."}
              </p>
              <Link
                href={`/customers/${selectedCustomer.id}#details`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Change or add address
              </Link>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-info/25 bg-info/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-info">Continuity</p>
            <p className="mt-2 text-sm font-medium text-foreground">Open the new Project workspace</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              After creation, TradeOS opens the Project so the persisted Customer, site-address text, and scope can be verified immediately.
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
