import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AIConversationHeaderProps {
  title: string;
  subtitle: string;
  status?: string;
  className?: string;
}

export function AIConversationHeader({ title, subtitle, status, className }: AIConversationHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {status ? <Badge variant="outline" className="capitalize">{status.replaceAll("_", " ")}</Badge> : null}
    </div>
  );
}

