import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/api";

interface ProjectHeaderProps {
  project: Project;
  subtitle: string;
  actions: Array<{ href: string; label: string; variant?: "default" | "secondary" | "outline" }>;
  className?: string;
}

export function ProjectHeader({ project, subtitle, actions, className }: ProjectHeaderProps) {
  return (
    <header className={cn("rounded-xl border border-border/70 bg-card p-4 sm:p-6", className)}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 space-y-3">
          <Link href="/projects" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to projects
          </Link>
          <div className="space-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div
            role="group"
            aria-label="Project details"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
          >
            <span>{project.customerId ? "Customer linked" : "No customer linked"}</span>
            <span aria-hidden="true">·</span>
            <span>{project.jobType ?? "Work type not set"}</span>
            <span aria-hidden="true">·</span>
            <span>{project.siteAddress ?? "Site address not added"}</span>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap gap-2 md:w-auto md:max-w-[45%] md:justify-end">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={buttonVariants({ variant: action.variant })}>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
