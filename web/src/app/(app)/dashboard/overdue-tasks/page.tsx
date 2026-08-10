import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTaskDueLabel, getTaskDueBucket } from "@/components/dashboard/dashboard-task-dates";
import { getOrganizationSettings, listOrganizationProjectTasks } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { mergeTradeOsSettingsDraft } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Overdue Tasks | TradeOS",
  description: "Open project tasks currently past due in the same organization task feed used by the owner dashboard.",
};

const DASHBOARD_TASK_FEED_LIMIT = 24;

function getSafeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

export default async function OverdueTasksPage() {
  const token = await getSessionToken();
  const now = new Date();
  let loadError: string | null = null;

  const [tasks, settingsResponse] = token
    ? await Promise.all([
        listOrganizationProjectTasks(token, { limit: DASHBOARD_TASK_FEED_LIMIT, includeCompleted: true }).catch((error: unknown) => {
          loadError = error instanceof Error ? error.message : "Task feed request failed";
          return [];
        }),
        getOrganizationSettings(token).catch(() => null),
      ])
    : [[], null];

  const settings = mergeTradeOsSettingsDraft(settingsResponse?.settings);
  const timeZone = getSafeTimeZone(settings.timezone);
  const overdueTasks = tasks.filter((task) => getTaskDueBucket(task, now, timeZone) === "overdue");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overdue Tasks"
        description="The exact overdue records behind the owner-dashboard KPI, using the same live organization task feed and calendar-date rules."
        backHref="/dashboard"
        backLabel="Owner dashboard"
      />

      {loadError ? (
        <EmptyState
          title="Overdue task data is temporarily unavailable."
          description={`${loadError} Open project workspaces directly while the task feed recovers.`}
          action={
            <Link href="/projects" className={buttonVariants({ variant: "outline" })}>
              Open projects
            </Link>
          }
        />
      ) : overdueTasks.length === 0 ? (
        <EmptyState
          title="No overdue tasks."
          description="There are no open tasks past due in the current dashboard task-feed slice."
          action={
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              Back to dashboard
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {overdueTasks.map((task) => (
            <Card key={task.id} className="border-border/70">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    <Badge variant="outline" className="capitalize">
                      {task.priority}
                    </Badge>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {formatTaskDueLabel(task, now, timeZone)}
                    </span>
                  </div>
                  <h2 className="mt-2 break-words text-base font-semibold text-foreground">{task.title}</h2>
                  <p className="mt-1 break-words text-sm text-muted-foreground">
                    {task.projectName}
                    {task.customerName ? ` / ${task.customerName}` : ""}
                    {task.jobTitle ? ` / ${task.jobTitle}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {task.assignedTo ? `Assigned to ${task.assignedTo}` : "Unassigned"}
                  </p>
                </div>
                <Link href={`/projects/${task.projectId}?tab=tasks`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open task workspace
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
