"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">TradeOS</p>
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        The page could not finish loading. Try again, and if the issue keeps happening, use the latest request details from the API logs to trace it.
      </p>
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {error.message || "Unexpected application error"}
      </div>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
