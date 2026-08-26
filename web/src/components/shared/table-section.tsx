import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TableSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

export function TableSection({ title, description, action, children, className, innerClassName }: TableSectionProps) {
  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", innerClassName)}>
        <div className="overflow-x-auto">{children}</div>
      </CardContent>
    </Card>
  );
}
