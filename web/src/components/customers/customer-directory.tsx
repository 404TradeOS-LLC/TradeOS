"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { TableSection } from "@/components/shared/table-section";
import type { Customer } from "@/lib/api";
import { cn } from "@/lib/utils";

type CustomerFilter = "all" | "contacted" | "missing-contact" | "billing";

const FILTERS: Array<{ value: CustomerFilter; label: string; description: string }> = [
  { value: "all", label: "All", description: "Every customer record" },
  { value: "contacted", label: "Contacted", description: "Has email or phone" },
  { value: "missing-contact", label: "Missing contact", description: "Needs an email or phone" },
  { value: "billing", label: "Billing set", description: "Has a billing address" },
];

export function CustomerDirectory({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return customers
      .filter((customer) => {
        if (filter === "contacted" && !customer.email && !customer.phone) return false;
        if (filter === "missing-contact" && (customer.email || customer.phone)) return false;
        if (filter === "billing" && !customer.billingAddress) return false;

        if (!normalizedQuery) return true;

        return [customer.name, customer.email, customer.phone, customer.address, customer.billingAddress]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [customers, filter, query]);

  const stats = useMemo(
    () => ({
      total: customers.length,
      contacted: customers.filter((customer) => customer.email || customer.phone).length,
      billing: customers.filter((customer) => customer.billingAddress).length,
      missingContact: customers.filter((customer) => !customer.email && !customer.phone).length,
    }),
    [customers]
  );

  const activeFilter = FILTERS.find((item) => item.value === filter);
  const hasFilters = Boolean(query.trim()) || filter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard label="Customers" value={String(stats.total)} />
        <SummaryMetricCard label="Contacted" value={String(stats.contacted)} />
        <SummaryMetricCard label="Billing ready" value={String(stats.billing)} />
        <SummaryMetricCard label="Needs contact" value={String(stats.missingContact)} />
      </div>

      <div className="rounded-3xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label htmlFor="customer-search" className="sr-only">
              Search customers
            </label>
            <div className="relative max-w-2xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="customer-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, phone, billing address, or city"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={cn("rounded-full", !active && "bg-background")}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </Button>
              );
            })}
            {hasFilters ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => { setQuery(""); setFilter("all"); }}>
                <X className="mr-1 size-4" />
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Showing <span className="font-medium text-foreground">{filteredCustomers.length}</span> of{" "}
            <span className="font-medium text-foreground">{stats.total}</span>
          </span>
          {activeFilter ? <Badge variant="outline">{activeFilter.description}</Badge> : null}
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={customers.length === 0 ? "No customers yet." : "No customers match your filters."}
          description={
            customers.length === 0
              ? "Create the first customer to start tracking contact details and billing information."
              : "Try a different search term or clear the contact filters."
          }
          action={
            <Link href="/customers/new" className={buttonVariants()}>
              New customer
            </Link>
          }
        />
      ) : (
        <>
          <TableSection
            className="hidden md:block"
            title="Customer list"
            description="Searchable customer records with contact and billing details."
          >
            {/* Table is desktop-only (md:block above); the card list below is the mobile equivalent, not a duplicate render. */}
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th scope="col" className="py-3 pr-4 font-medium">Customer</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Contact</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Billing</th>
                  <th scope="col" className="py-3 pr-4 font-medium">Added</th>
                  <th scope="col" className="py-3 pl-4 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-muted/40">
                    <td className="py-4 pr-4 align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">{customer.name}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {customer.address ? <Badge variant="outline">{customer.address}</Badge> : null}
                          {!customer.email && !customer.phone ? <Badge variant="secondary">Needs contact</Badge> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div>{customer.email ?? "No email saved"}</div>
                        <div>{customer.phone ?? "No phone saved"}</div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 align-top text-sm text-muted-foreground">{customer.billingAddress ?? "No billing address"}</td>
                    <td className="py-4 pr-4 align-top text-sm text-muted-foreground">{formatDate(customer.createdAt)}</td>
                    <td className="py-4 pl-4 text-right align-top">
                      <Link href={`/customers/${customer.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableSection>

          <div className="grid gap-3 md:hidden">
            {filteredCustomers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{customer.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{customer.email ?? customer.phone ?? "No contact saved"}</div>
                  </div>
                  <Badge variant="outline">{formatDate(customer.createdAt)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customer.billingAddress ? <Badge variant="outline">{customer.billingAddress}</Badge> : null}
                  {!customer.email && !customer.phone ? <Badge variant="secondary">Needs contact</Badge> : null}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
