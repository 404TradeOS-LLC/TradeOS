import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSection } from "@/components/shared/table-section";
import type { AthenaTraceSearchResultRow } from "@/lib/api";
import { formatAthenaUsd } from "@/lib/athena-overview-model";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function truncateId(id: string) {
  return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

interface AthenaTraceResultsProps {
  rows: AthenaTraceSearchResultRow[];
  isFiltered: boolean;
}

export function AthenaTraceResults({ rows, isFiltered }: AthenaTraceResultsProps) {
  if (rows.length === 0) {
    return (
      <TableSection title="Traces" description="Every Athena request execution recorded in your organization, most recent first.">
        {isFiltered ? (
          <EmptyState
            title="No traces match these filters"
            description="Try widening the time range or clearing one of the id/status/tool/model filters."
            action={
              <Link href="/athena/traces" className={buttonVariants({ variant: "outline" })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No traces yet"
            description="Athena hasn't recorded any request executions for this organization yet. Traces appear here as soon as Athena processes a request."
          />
        )}
      </TableSection>
    );
  }

  return (
    <>
      <TableSection className="hidden md:block" title="Traces" description={`${rows.length} trace${rows.length === 1 ? "" : "s"} on this page.`}>
        <table className="min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th scope="col" className="px-3 py-2">Trace / Request</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Actor</th>
              <th scope="col" className="px-3 py-2">Spans</th>
              <th scope="col" className="px-3 py-2">Cost</th>
              <th scope="col" className="px-3 py-2">Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.execution.executionId} className="border-b border-border/50 align-top">
                <td className="max-w-64 px-3 py-3">
                  <Link
                    href={`/athena/traces/${row.execution.traceId}`}
                    className="block truncate font-mono text-sm text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    {truncateId(row.execution.traceId)}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">req {truncateId(row.execution.requestId)}</div>
                  {row.execution.safeSummary ? <div className="mt-1 truncate text-xs text-muted-foreground">{row.execution.safeSummary}</div> : null}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.execution.state} />
                  {row.execution.safeErrorCode ? <div className="mt-1 text-xs text-muted-foreground">{row.execution.safeErrorCode}</div> : null}
                </td>
                <td className="px-3 py-3 text-sm text-foreground">
                  <div className="truncate">{row.execution.canonicalRole}</div>
                  <div className="text-xs text-muted-foreground">{row.execution.requestSource}</div>
                </td>
                <td className="px-3 py-3 text-sm text-foreground">
                  {row.spanCount}
                  {row.errorSpanCount > 0 ? <span className="ml-1 text-xs text-rose-600 dark:text-rose-300">({row.errorSpanCount} error)</span> : null}
                </td>
                <td className="px-3 py-3 text-sm text-foreground">{formatAthenaUsd(row.totalCostUsd)}</td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-foreground">{formatDateTime(row.execution.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableSection>

      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <Link
            key={row.execution.executionId}
            href={`/athena/traces/${row.execution.traceId}`}
            className="rounded-2xl border border-border/60 bg-background/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm text-foreground">{truncateId(row.execution.traceId)}</div>
                <div className="truncate text-xs text-muted-foreground">req {truncateId(row.execution.requestId)}</div>
              </div>
              <StatusBadge status={row.execution.state} />
            </div>

            {row.execution.safeSummary ? <p className="mt-2 text-sm text-muted-foreground">{row.execution.safeSummary}</p> : null}

            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Actor</p>
                <p className="mt-1 text-foreground">
                  {row.execution.canonicalRole} · {row.execution.requestSource}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Spans / Cost</p>
                <p className="mt-1 text-foreground">
                  {row.spanCount} spans{row.errorSpanCount > 0 ? ` (${row.errorSpanCount} error)` : ""} · {formatAthenaUsd(row.totalCostUsd)}
                </p>
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">Started {formatDateTime(row.execution.createdAt)}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
