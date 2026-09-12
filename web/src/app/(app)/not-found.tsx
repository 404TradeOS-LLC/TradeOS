import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">TradeOS</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This page doesn&apos;t exist, or the link may be out of date. It may also point to something that was moved or removed.
      </p>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
