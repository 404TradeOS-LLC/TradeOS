import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/document-workflow";
import type { OwnerActivityEntry, OwnerActivityTone } from "./owner-dashboard-data";
import type { ReactNode } from "react";

interface OwnerActivityFeedProps {
  entries: OwnerActivityEntry[];
  title?: string;
  description?: string;
  emptyState?: ReactNode;
}

const toneStyles: Record<OwnerActivityTone, string> = {
  success: "bg-primary",
  info: "bg-foreground/60",
  warning: "bg-accent-foreground",
};

export function OwnerActivityFeed({
  entries,
  title = "Owner activity",
  description = "A concise timeline of customer, job, estimate, and payment milestones.",
  emptyState = <EmptyState title="No owner activity yet." description="Approved estimates, paid invoices, completed jobs, and customer reviews will appear here." />,
}: OwnerActivityFeedProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          emptyState
        ) : (
          <ol className="space-y-3" aria-label={title}>
            {entries.map((entry) => (
              <li key={entry.id} className="relative grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-[auto_1fr]">
                <div className="flex items-start justify-center pt-1" aria-hidden="true">
                  <span className={`size-2.5 rounded-full ${toneStyles[entry.tone]}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-medium text-foreground">{entry.title}</h3>
                      <p className="mt-1 break-words text-sm text-muted-foreground">{entry.description}</p>
                    </div>
                    <Badge variant="outline">{entry.category}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDateTime(entry.occurredAt)}</span>
                    <span aria-hidden="true">/</span>
                    <span>{entry.actor}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
