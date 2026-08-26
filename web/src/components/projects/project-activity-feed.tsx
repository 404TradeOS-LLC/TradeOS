import { WorkflowEvent, formatDateTime } from "@/lib/document-workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

interface ProjectActivityFeedProps {
  items: WorkflowEvent[];
}

export function ProjectActivityFeed({ items }: ProjectActivityFeedProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Recent updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <EmptyState title="No updates yet." description="Notes, proposals, and files will appear here as you work the job." />
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">{item.title}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.category}</div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.at)}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
