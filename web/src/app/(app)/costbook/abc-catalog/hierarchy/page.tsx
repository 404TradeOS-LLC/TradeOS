import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getSessionToken } from "@/lib/session";
import { listAbcSupplyHierarchy, type AbcHierarchyResult } from "@/lib/costbook-api";

export const metadata: Metadata = {
  title: "ABC Product Hierarchy | TradeOS",
  description: "Explore ABC Supply's official six-level product classification without storing a copy.",
};

export default async function AbcHierarchyPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const rawPage = Number(pageParam);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100_000) : 1;
  const token = await getSessionToken();
  let result: AbcHierarchyResult | null = null;
  let error: string | null = null;
  if (!token) {
    error = "Sign in to TradeOS to browse ABC's product hierarchy.";
  } else {
    try {
      result = await listAbcSupplyHierarchy(token, page, 25);
    } catch {
      error = "ABC hierarchy is unavailable until Product API browsing is enabled and authorized in the sandbox.";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ABC product hierarchy"
        description="Six supplier-defined classification levels • Read directly from ABC sandbox • Not cached"
        backHref="/costbook/abc-catalog"
        backLabel="ABC catalog"
      />
      <section className="flex gap-3 rounded-xl border border-border/70 bg-card p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm leading-6 text-muted-foreground">
          These categories come from ABC&apos;s hierarchy, not inferred TradeOS classifications.
          Browsing these labels does not add Materials or grant price or stock availability.
        </p>
      </section>
      {error ? <EmptyState title="ABC hierarchy unavailable" description={error} /> : result ? (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{result.pagination.totalItems.toLocaleString("en-US")}</span> provider hierarchy paths
            {" · "}page {result.pagination.pageNumber} of {result.pagination.totalPages || 1}
          </p>
          {result.paths.length === 0 ? (
            <EmptyState title="No paths on this page" description="The sandbox provider returned no hierarchy entries at this page." />
          ) : (
            <div className="grid gap-3" aria-label="ABC product hierarchy paths">
              {result.paths.map((path, index) => (
                <article key={page + "-" + index} className="rounded-xl border border-border/70 bg-card p-4">
                  <ol className="grid gap-2 text-sm">
                    {path.map((level, levelIndex) => (
                      <li key={level.level + "-" + level.code + "-" + levelIndex} className="flex flex-wrap gap-2">
                        <span className="w-5 shrink-0 text-muted-foreground">{levelIndex + 1}.</span>
                        <span className="font-medium">{level.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">{level.code}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          )}
          <nav aria-label="ABC hierarchy pagination" className="flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link href={"/costbook/abc-catalog/hierarchy?page=" + (page - 1)} className={buttonVariants({ variant: "outline" })}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Previous
              </Link>
            ) : <span />}
            {page < result.pagination.totalPages ? (
              <Link href={"/costbook/abc-catalog/hierarchy?page=" + (page + 1)} className={buttonVariants({ variant: "outline" })}>
                Next page <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : <span />}
          </nav>
        </>
      ) : null}
    </div>
  );
}
