import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { cn } from "@/lib/utils";
import type { OwnerQuickAction } from "./owner-dashboard-data";

interface OwnerQuickActionsProps {
  actions: OwnerQuickAction[];
}

export function OwnerQuickActions({ actions }: OwnerQuickActionsProps) {
  return (
    <DashboardPanel
      title="Quick Actions"
      description="Morning shortcuts for the work owners start most often."
      contentClassName="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const content = (
          <>
            <Icon aria-hidden="true" />
            <span>{action.label}</span>
          </>
        );

        return (
          <div key={action.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/85 p-3 shadow-(--elev-1)">
            {action.href ? (
              <Link href={action.href} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between")}>
                <span className="flex items-center gap-2">{content}</span>
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="outline" className="w-full justify-start opacity-70" disabled>
                  {content}
                </Button>
                <Badge variant="secondary" className="shrink-0 uppercase tracking-[0.1em]">
                  Soon
                </Badge>
              </div>
            )}
            <p className="text-xs leading-5 text-muted-foreground">{action.helper}</p>
          </div>
        );
      })}
    </DashboardPanel>
  );
}
