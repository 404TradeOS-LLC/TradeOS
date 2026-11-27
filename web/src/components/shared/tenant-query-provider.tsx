"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

// Tenant-scoped query cache. This provider must live inside the (app)
// shell's workspace-keyed boundary (not the root Providers): the root
// QueryClient survives workspace switches, so a catalog search repeated in
// workspace B would serve A's cached items — the item-search key carries
// the catalog kind and search text but no workspace ID. A client created
// per mount is discarded with the shell subtree on every switch, so no
// tenant's cached queries can leak into the next workspace. The default
// options intentionally match the root provider's.
//
// Org-less query keys are safe ONLY because of that discard — audit before
// raising any staleTime: ["item-search", ...], ["estimate", ...],
// ["estimate-codes-hints", ...], ["assembly-items", ...],
// ["assembly-unit-cost", ...], ["starter-catalog"],
// ["assembly-catalog-cost-preview", ...], ["starter-reuse-sources", ...]
// and ["cost-item-preview", ...] / ["assembly-preview", ...] carry no
// orgId. If this provider ever moves out of the keyed boundary, or a query
// is hoisted to the root client, every one of those keys must gain the
// orgId first (AppNav's ["dispatch-summary-attention", orgId] is the
// pattern: the root client survives switches, so its keys are org-scoped
// instead).
export function TenantQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
