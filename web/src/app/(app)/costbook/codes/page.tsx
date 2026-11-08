import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, ExternalLink, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getCostbookCodeReferences,
  type CodeReferenceResult,
  type CodeTopic,
} from "@/lib/costbook-codes";
import { getSessionToken } from "@/lib/session";
import { normalizeCodesSearchParams, type CodesSearchParams } from "@/lib/costbook-codes-query";

export const metadata: Metadata = {
  title: "Codes & Permits | Costbook | TradeOS",
  description: "Review cited zoning, building, electrical, and highway permit sources before estimating.",
};

const topics: { value: CodeTopic; label: string }[] = [
  { value: "signage", label: "Signs" },
  { value: "permits", label: "Permits" },
  { value: "electrical", label: "Electrical" },
  { value: "structural", label: "Structural" },
  { value: "right-of-way", label: "Highway right-of-way" },
];

export default async function CodesAndPermitsPage({
  searchParams,
}: {
  searchParams: Promise<CodesSearchParams>;
}) {
  const token = await getSessionToken();
  const search = await searchParams;
  const { county, q, topic } = normalizeCodesSearchParams(search);
  let result: CodeReferenceResult | null = null;
  let error: string | null = null;

  if (token) {
    try {
      result = await getCostbookCodeReferences(token, {
        state: "IN",
        county: county || undefined,
        topic,
        q: q || undefined,
      });
    } catch {
      error = "TradeOS couldn't retrieve code references from the authenticated Costbook API.";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Codes & Permits"
        description="Official references for early permit planning. Verify what applies to the actual property before committing to a scope or price."
        backHref="/costbook"
        backLabel="Costbook"
      />

      {!token ? (
        <EmptyState title="Sign in required" description="An authenticated Costbook session is required to view references." />
      ) : (
        <>
          <form
            action="/costbook/codes"
            method="get"
            className="grid gap-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_180px] lg:grid-cols-[180px_190px_minmax(0,1fr)_auto] lg:items-end"
          >
            <label className="grid gap-1 text-sm font-medium">
              County (Indiana)
              <input name="county" defaultValue={county} maxLength={80}
                className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-describedby="code-coverage-note"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Work type
              <select name="topic" defaultValue={topic ?? ""}
                className="h-11 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value="">All topics</option>
                {topics.map(({ value, label }) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Search references
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
                <input name="q" defaultValue={q} maxLength={120} placeholder="e.g. sign, electrical, right-of-way"
                  className="h-11 w-full min-w-0 rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
              </span>
            </label>
            <button type="submit" className={buttonVariants({ variant: "default" }) + " h-11"}>Find sources</button>
          </form>

          <p id="code-coverage-note" className="text-sm text-muted-foreground">
            Pilot coverage is Vigo County and statewide Indiana references only. A different county may show state sources but does not imply local clearance.
          </p>

          {error ? (
            <EmptyState title="Couldn't load Codes & Permits" description={error} />
          ) : result ? (
            <>
              <div className="rounded-xl border border-border/70 bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Verification required before bidding or building</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{result.disclaimer}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.total} reference{result.total === 1 ? "" : "s"} found · No permit status, fee or approved design inferred.
                </p>
              </div>

              {result.items.length === 0 ? (
                <EmptyState title="No reviewed sources for this selection"
                  description="TradeOS has not indexed local requirements for this area or topic. Check the authority having jurisdiction; absence here does not mean no permit is required." />
              ) : (
                <section aria-label="Codes and permits references" className="overflow-hidden rounded-xl border border-border/70 bg-card">
                  <div className="divide-y divide-border/70">
                    {result.items.map((item) => (
                      <article key={item.id} className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <BookOpenText className="size-4 shrink-0" aria-hidden="true" />
                              <span>{item.citation} · {item.county ? item.county + " County" : "Indiana statewide"}</span>
                            </div>
                            <h2 className="mt-1 text-base font-semibold text-foreground">{item.title}</h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {item.issuer} · Source reviewed {item.reviewedAt}
                              {item.sourceDate ? ` · Source dated ${item.sourceDate}` : ""}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                            <p className="mt-2 text-sm leading-6 text-foreground"><span className="font-semibold">Next:</span> {item.nextAction}</p>
                          </div>
                          <a className={buttonVariants({ variant: "outline" }) + " shrink-0 self-start"}
                            href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                            Official source <ExternalLink className="ml-2 size-4" aria-hidden="true" />
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : null}

          <p className="text-xs leading-5 text-muted-foreground">
            Codes & Permits is a read-only source index. It never changes Estimate line items, Costbook pricing, inspection status, or a customer proposal.
          </p>
          <Link href="/costbook" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">Back to Costbook</Link>
        </>
      )}
    </div>
  );
}
