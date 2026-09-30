"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

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
        This page ran into a problem and couldn&apos;t finish loading. Your work elsewhere in TradeOS is unaffected - try again, or head back to the dashboard.
      </p>
      {error.digest ? (
        <details className="w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground">Error reference</summary>
          <p className="mt-2 font-mono text-xs">{error.digest}</p>
        </details>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
