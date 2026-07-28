import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OwnerQuickAction } from "./owner-dashboard-data";

interface OwnerQuickActionsProps {
  actions: OwnerQuickAction[];
}

export function OwnerQuickActions({ actions }: OwnerQuickActionsProps) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Morning shortcuts for the work owners start most often.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const content = (
            <>
              <Icon aria-hidden="true" />
              <span>{action.label}</span>
            </>
          );

          return (
            <div key={action.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
              {action.href ? (
                <Link href={action.href} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}>
                  {content}
                </Link>
              ) : (
                <Button type="button" variant="outline" className="w-full justify-start" disabled>
                  {content}
                </Button>
              )}
              <p className="text-xs leading-5 text-muted-foreground">{action.helper}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
