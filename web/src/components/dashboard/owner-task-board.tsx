import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CircleSlash, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import type { OrganizationProjectTask } from "@/lib/api";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { buildDashboardTaskSnapshot, formatTaskDueLabel } from "./dashboard-task-model";

interface OwnerTaskBoardProps {
  tasks: OrganizationProjectTask[];
  now: Date;
  timeZone: string;
  errorMessage?: string | null;
}

export function OwnerTaskBoard({ tasks, now, timeZone, errorMessage = null }: OwnerTaskBoardProps) {
  const snapshot = buildDashboardTaskSnapshot(tasks, now, timeZone);

  return (
    <DashboardPanel
      title="Tasks To Move"
      description="Live project tasks across the organization, ordered by due pressure so the dashboard surfaces work that needs a decision now."
      action={
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1.5">
            <AlertTriangle className="size-3" />
            {snapshot.overdueCount} overdue
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <ListTodo className="size-3" />
            {snapshot.dueTodayCount} due today
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <CircleSlash className="size-3" />
            {snapshot.blockedCount} blocked
          </Badge>
        </div>
      }
    >
      {errorMessage ? (
        <EmptyState
          title="Task data is temporarily unavailable."
          description={`${errorMessage} You can still open the project workspace directly while the dashboard task feed recovers.`}
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Open projects
            </Link>
          }
        />
      ) : snapshot.openTasks.length === 0 ? (
        <EmptyState
          title="No open tasks right now."
          description="Every project task in the current organization slice is complete, so there is nothing queued for follow-up on the dashboard."
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Review projects
            </Link>
          }
        />
      ) : (
        snapshot.openTasks.slice(0, 6).map((task) => (
          <article key={task.id} className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-(--elev-1)">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.status} />
                  <Badge variant="outline" className="capitalize">
                    {task.priority}
                  </Badge>
                  <p className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {formatTaskDueLabel(task, now, timeZone)}
                  </p>
                </div>
                <h3 className="mt-2 break-words text-base font-semibold text-foreground">{task.title}</h3>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {task.projectName}
                  {task.customerName ? ` / ${task.customerName}` : ""}
                  {task.jobTitle ? ` / ${task.jobTitle}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{task.assignedTo ? `Assigned to ${task.assignedTo}` : "Unassigned"}</span>
                  <span aria-hidden="true">/</span>
                  <span className="capitalize">{task.projectStatus.replaceAll("_", " ")}</span>
                </div>
              </div>
              <Link href={`/projects/${task.projectId}?tab=tasks`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </article>
        ))
      )}
    </DashboardPanel>
  );
}
