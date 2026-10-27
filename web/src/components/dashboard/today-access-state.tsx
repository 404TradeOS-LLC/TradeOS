import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function TodayAccessState() {
  return <section className="rounded-2xl border border-border bg-card p-8"><ShieldAlert className="text-warning" /><h1 className="mt-4 font-heading text-2xl font-semibold">Workspace access unavailable</h1><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">We could not verify your current organization role. Refresh to retry; your saved work is unchanged.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>Retry Today</Link><Link href="/settings" className={buttonVariants({ variant: "outline" })}>Workspace settings</Link></div></section>;
}
