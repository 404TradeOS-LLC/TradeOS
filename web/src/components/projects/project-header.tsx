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
    <div className={cn("rounded-xl border border-border/70 bg-card p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Link href="/projects" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to projects
          </Link>
          <StatusBadge status={project.status} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <Meta label="Customer" value={project.customerId ? "Customer linked" : "Not linked yet"} />
            <Meta label="Work type" value={project.jobType ?? "Not set"} />
            <Meta label="Site address" value={project.siteAddress ?? "Not added yet"} />
          </div>
        </div>
        <div className="grid min-w-64 gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={buttonVariants({ variant: action.variant })}>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  );
}
