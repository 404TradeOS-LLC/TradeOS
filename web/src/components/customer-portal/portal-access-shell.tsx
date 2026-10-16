import type { ReactNode } from "react";

export function PortalAccessShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border/70 bg-card">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground"
          >
            ›
          </span>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">TradeOS Customer Portal</p>
            <p className="text-xs text-muted-foreground">Private project documents</p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
