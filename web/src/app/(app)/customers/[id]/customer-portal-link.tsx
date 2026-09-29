"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { issueCustomerPortalLinkAction } from "@/app/actions/customer-portal";

export function CustomerPortalLink({ customerId }: { customerId: string }) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; link?: string; expiresAt?: string }>({});
  const [copied, setCopied] = useState(false);

  function createLink() {
    setCopied(false);
    startTransition(async () => {
      setState(await issueCustomerPortalLinkAction(customerId));
    });
  }

  async function copyLink() {
    if (!state.link) return;
    await navigator.clipboard.writeText(new URL(state.link, window.location.origin).toString());
    setCopied(true);
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={createLink} disabled={isPending}>
        {isPending ? "Creating link…" : "Create portal link"}
      </Button>
      {state.error ? <p className="text-sm text-destructive" role="alert">{state.error}</p> : null}
      {state.link ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="customer-portal-link">Single-use link</label>
          <div className="flex gap-2">
            <input id="customer-portal-link" className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm" value={state.link} readOnly />
            <Button type="button" variant="outline" onClick={copyLink}>{copied ? "Copied" : "Copy"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Expires {new Date(state.expiresAt ?? "").toLocaleString()} · Create another link only if this one is lost or revoked.</p>
        </div>
      ) : null}
    </div>
  );
}
