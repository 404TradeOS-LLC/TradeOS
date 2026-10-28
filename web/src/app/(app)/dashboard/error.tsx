"use client";
import { Button } from "@/components/ui/button";
export default function TodayError({ reset }: { reset: () => void }) {
  return <section role="alert" className="rounded-2xl border border-border bg-card p-8"><h2 className="font-heading text-xl font-semibold">Today could not finish loading</h2><p className="my-4 text-sm text-muted-foreground">Your saved records are safe. Retry to reconnect to your workspace.</p><Button onClick={reset}>Retry Today</Button></section>;
}
