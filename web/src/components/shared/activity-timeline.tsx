import { WorkflowEvent, formatDateTime } from "@/lib/document-workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityTimelineProps {
  title?: string;
  items: WorkflowEvent[];
}

export function ActivityTimeline({ title = "Activity timeline", items }: ActivityTimelineProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mt-1 size-2 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.category}</div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.at)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
