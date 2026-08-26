import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowNotification, formatDateTime } from "@/lib/document-workflow";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  title?: string;
  items: WorkflowNotification[];
}

const NOTIFICATION_TONES: Record<WorkflowNotification["status"], string> = {
  ready: "border-sky-500/20 bg-sky-500/10",
  attention: "border-orange-500/20 bg-orange-500/10",
  completed: "border-emerald-500/20 bg-emerald-500/10",
};

export function NotificationCenter({ title = "Notifications", items }: NotificationCenterProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
            No document notifications yet. Proposal, contract, and invoice alerts will appear here.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={cn("rounded-xl border p-4", NOTIFICATION_TONES[item.status])}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.status}</div>
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
