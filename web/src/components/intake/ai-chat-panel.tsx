import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIConversationHeader } from "./ai-conversation-header";
import type { AIConversationItem } from "./types";

interface AIChatPanelProps {
  title: string;
  subtitle: string;
  status?: string;
  messages: AIConversationItem[];
}

export function AIChatPanel({ title, subtitle, status, messages }: AIChatPanelProps) {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader>
        <CardTitle>
          <AIConversationHeader title={title} subtitle={subtitle} status={status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id ?? `${message.role}-${message.title}-${message.text}`}
            className={`rounded-xl border p-4 ${message.role === "assistant" ? "border-border/60 bg-muted/20" : "border-border/50 bg-background/70"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-foreground">{message.title}</div>
              {message.meta ? <div className="text-xs text-muted-foreground">{message.meta}</div> : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
