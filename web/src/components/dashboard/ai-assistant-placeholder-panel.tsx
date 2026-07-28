import type { ComponentType } from "react";
import { CalendarClock, ClipboardCheck, Sparkles, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AIAssistantPlaceholderPanelProps {
  className?: string;
}

interface OwnerBriefingItem {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}

const OWNER_BRIEFING_ITEMS: OwnerBriefingItem[] = [
  { label: "Schedule briefing", value: "Connect live schedule source", icon: CalendarClock },
  { label: "Estimate follow-up", value: "Use Needs attention today", icon: ClipboardCheck },
  { label: "Dispatch actions", value: "Open project workspaces", icon: Wrench },
  { label: "AI recommendations", value: "Not connected in this foundation", icon: Sparkles },
];

const ASSISTANT_BRIEFING_COPY =
  "AI owner briefings are not connected yet. This panel is a disabled dashboard foundation slot; use the live KPI and Needs attention cards for current project signals.";

const SUGGESTED_ACTIONS = ["Review", "Schedule", "Open Dispatch"];

export function AIAssistantPlaceholderPanel({ className }: AIAssistantPlaceholderPanelProps) {
  return (
    <Card className={cn("border-border/70 bg-muted/10", className)}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>Non-live owner briefing placeholder for the dashboard foundation.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-foreground">{ASSISTANT_BRIEFING_COPY}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {OWNER_BRIEFING_ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-xl border border-border/60 bg-background/80 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
                    <div className="mt-1 break-words font-medium text-foreground">{item.value}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_ACTIONS.map((action) => (
            <Button key={action} type="button" variant={action === "Review" ? "default" : "outline"} disabled>
              {action}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
