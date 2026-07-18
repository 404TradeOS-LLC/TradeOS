import type { ComponentType } from "react";
import { CalendarClock, CloudRain, Sparkles, UserRoundX } from "lucide-react";
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
  tone: "neutral" | "warning";
}

const OWNER_BRIEFING_ITEMS: OwnerBriefingItem[] = [
  { label: "Scheduled jobs", value: "8", icon: CalendarClock, tone: "neutral" },
  { label: "Estimates awaiting approval", value: "2", icon: Sparkles, tone: "neutral" },
  { label: "Weather watch", value: "Rain after 3 PM", icon: CloudRain, tone: "warning" },
  { label: "Capacity risk", value: "One technician overloaded", icon: UserRoundX, tone: "warning" },
];

const ASSISTANT_BRIEFING_COPY =
  "Good morning. Today you have: 8 scheduled jobs, 2 estimates awaiting approval, rain expected after 3 PM, one technician overloaded. Suggested actions: Review, Schedule, Open Dispatch.";

const SUGGESTED_ACTIONS = ["Review", "Schedule", "Open Dispatch"];

export function AIAssistantPlaceholderPanel({ className }: AIAssistantPlaceholderPanelProps) {
  return (
    <Card className={cn("border-border/70 bg-muted/10", className)}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>Owner briefing placeholder for the dashboard foundation.</CardDescription>
          </div>
          <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            UI preview
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
                className={cn(
                  "rounded-xl border border-border/60 bg-background/80 p-4",
                  item.tone === "warning" ? "ring-1 ring-primary/20" : ""
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "rounded-lg border border-border/60 p-2 text-muted-foreground",
                      item.tone === "warning" ? "bg-primary/10 text-primary" : "bg-muted/30"
                    )}
                  >
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
