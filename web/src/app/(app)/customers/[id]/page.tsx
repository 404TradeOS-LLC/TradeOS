import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Mail,
  Phone,
} from "lucide-react";
import { deleteCustomerAction } from "@/app/actions/customers";
import { getStaleProposalCutoffIso } from "@/components/dashboard/needs-attention-model";
import { ListRowLink } from "@/components/shared/list-row-link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackState } from "@/components/ui/feedback-state";
import {
  getCustomer,
  getDispatchSummary,
  getOrganizationSettings,
  getProject,
  listJobsForDispatch,
  toInclusiveEndBoundary,
  type DispatchJob,
} from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  formatScheduleInZone,
} from "@/lib/document-workflow";
import { getSessionToken } from "@/lib/session";
import { CustomerPortalLink } from "./customer-portal-link";
import { EditCustomerForm } from "./edit-form";
import { ServiceAddresses } from "./service-addresses";

const CUSTOMER_PROJECT_DETAIL_LIMIT = 8;
const CUSTOMER_SCHEDULE_LIMIT = 8;

type CustomerProjectDetail = Awaited<ReturnType<typeof getProject>>;

interface CustomerActivityItem {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
  href: string;
}

function formatCustomerSince(createdAt: string) {
  const year = new Date(createdAt).getUTCFullYear();
  return Number.isFinite(year) ? `Customer since ${year}` : "Customer record";
}

function isCurrentProject(project: CustomerProjectDetail) {
  return !["completed", "archived"].includes(project.status);
}

function moneySummary(projects: CustomerProjectDetail[]) {
  const invoices = projects.flatMap((project) =>
    project.invoices.map((invoice) => ({ ...invoice, projectName: project.name }))
  );
  const activeInvoices = invoices.filter((invoice) => invoice.status !== "voided");

  return {
    invoiced: activeInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    paid: activeInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0),
    outstanding: activeInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    overdueCount: activeInvoices.filter((invoice) => invoice.status === "overdue" && invoice.balanceDue > 0).length,
  };
}

function buildCustomerActivity(projects: CustomerProjectDetail[]): CustomerActivityItem[] {
  const items: CustomerActivityItem[] = [];

  for (const project of projects) {
    for (const proposal of project.proposals) {
      if (proposal.respondedAt && (proposal.status === "accepted" || proposal.status === "declined")) {
        items.push({
          id: `proposal-response-${proposal.id}`,
          occurredAt: proposal.respondedAt,
          title: proposal.status === "accepted" ? "Proposal accepted" : "Proposal declined",
          description: project.name,
          href: `/projects/${project.id}/proposals/${proposal.id}`,
        });
      } else if (proposal.viewedAt) {
        items.push({
          id: `proposal-viewed-${proposal.id}`,
          occurredAt: proposal.viewedAt,
          title: "Proposal viewed",
          description: project.name,
          href: `/projects/${project.id}/proposals/${proposal.id}`,
        });
      } else if (proposal.sentAt) {
        items.push({
          id: `proposal-sent-${proposal.id}`,
          occurredAt: proposal.sentAt,
          title: "Proposal sent",
          description: project.name,
          href: `/projects/${project.id}/proposals/${proposal.id}`,
        });
      }
    }

    for (const invoice of project.invoices) {
      for (const payment of invoice.payments) {
        items.push({
          id: `payment-${payment.id}`,
          occurredAt: payment.createdAt || payment.paymentDate,
          title: "Payment recorded",
          description: `${project.name} · ${formatCurrency(payment.amount)}`,
          href: `/projects/${project.id}/invoices/${invoice.id}`,
        });
      }
    }

    for (const siteVisit of project.siteVisits) {
      items.push({
        id: `site-visit-${siteVisit.id}`,
        occurredAt: siteVisit.createdAt,
        title: "Site Visit captured",
        description: project.name,
        href: `/projects/${project.id}/intake`,
      });
    }

    for (const file of project.projectFiles) {
      items.push({
        id: `file-${file.id}`,
        occurredAt: file.createdAt,
        title: "File added",
        description: `${project.name} · ${file.fileName}`,
        href: `/projects/${project.id}?tab=documents`,
      });
    }
  }

  return items
    .filter((item) => !Number.isNaN(Date.parse(item.occurredAt)))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 5);
}

function workSummary(project: CustomerProjectDetail) {
  const activeJob = project.jobs.find((job) => !["completed", "cancelled"].includes(job.status));
  if (activeJob) {
    return {
      meta: `Job #${activeJob.jobNumber} · ${activeJob.status.replaceAll("_", " ")}`,
      status: activeJob.status,
      amount: null as number | null,
    };
  }

  const proposal = [...project.proposals]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .find((item) => !["declined", "expired"].includes(item.status));
  if (proposal) {
    return {
      meta: `Proposal · ${proposal.status.replaceAll("_", " ")}`,
      status: proposal.status,
      amount: proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow,
    };
  }

  const estimate = [...project.estimates]
    .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""))
    .find((item) => item.status !== "superseded");
  if (estimate) {
    return {
      meta: `Estimate v${estimate.version} · ${estimate.status.replaceAll("_", " ")}`,
      status: estimate.status,
      amount: estimate.totalPrice,
    };
  }

  return {
    meta: `Project · ${project.status.replaceAll("_", " ")}`,
    status: project.status,
    amount: null as number | null,
  };
}

async function loadCustomerProjects(token: string, customer: Awaited<ReturnType<typeof getCustomer>>) {
  const selected = [...customer.projects]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, CUSTOMER_PROJECT_DETAIL_LIMIT);
  const results = await Promise.allSettled(selected.map((project) => getProject(token, project.id)));
  const items = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

  return {
    items,
    failedCount: results.length - items.length,
    totalProjects: customer.projects.length,
    bounded: customer.projects.length > selected.length,
  };
}

async function loadCustomerSchedule(token: string, customerId: string) {
  try {
    const summary = await getDispatchSummary(token);
    const response = await listJobsForDispatch(token, {
      customerId,
      scheduledFrom: new Date().toISOString(),
      scheduledTo: toInclusiveEndBoundary(summary.weekRangeUtc.end),
      page: 1,
      pageSize: CUSTOMER_SCHEDULE_LIMIT,
    });

    return {
      items: response.items
        .filter((job) => job.scheduledStart)
        .sort((a, b) => Date.parse(a.scheduledStart ?? "") - Date.parse(b.scheduledStart ?? "")),
      total: response.total,
      timezone: summary.timezone.value,
      error: null as string | null,
    };
  } catch {
    return {
      items: [] as DispatchJob[],
      total: 0,
      timezone: "UTC",
      error: "Upcoming schedule could not be loaded. Customer and project records are still available.",
    };
  }
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getSessionToken();
  const [customer, settings] = await Promise.all([
    getCustomer(token ?? "", id),
    getOrganizationSettings(token ?? ""),
  ]);

  const [projectLoad, schedule] = await Promise.all([
    loadCustomerProjects(token ?? "", customer),
    loadCustomerSchedule(token ?? "", customer.id),
  ]);

  const projects = projectLoad.items;
  const currentProjects = projects.filter(isCurrentProject);
  const money = moneySummary(projects);
  const activity = buildCustomerActivity(projects);
  const canIssuePortalLink = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const canWrite = ["owner", "admin", "dispatcher", "estimator"].includes(settings.currentRole);
  const staleCutoff = Date.parse(getStaleProposalCutoffIso(new Date()));

  const overdueInvoices = projects.flatMap((project) =>
    project.invoices
      .filter((invoice) => invoice.status === "overdue" && invoice.balanceDue > 0)
      .map((invoice) => ({ project, invoice }))
  );
  const staleProposals = projects.flatMap((project) =>
    project.proposals
      .filter(
        (proposal) =>
          ["sent", "viewed"].includes(proposal.status) &&
          !proposal.respondedAt &&
          proposal.sentAt &&
          Date.parse(proposal.sentAt) <= staleCutoff
      )
      .map((proposal) => ({ project, proposal }))
  );
  const blockedTasks = projects.flatMap((project) =>
    project.tasks.filter((task) => task.status === "blocked").map((task) => ({ project, task }))
  );

  const attentionCount = overdueInvoices.length + staleProposals.length + blockedTasks.length;
  const fileRows = projects
    .flatMap((project) =>
      project.projectFiles.map((file) => ({
        id: file.id,
        projectId: project.id,
        projectName: project.name,
        fileName: file.fileName,
        fileType: file.fileType,
        createdAt: file.createdAt,
      }))
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 5);
  const customerLocation = customer.address ?? customer.billingAddress;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={customer.name}
        backHref="/customers"
        backLabel="All customers"
        description={[
          "Customer",
          customerLocation,
          formatCustomerSince(customer.createdAt),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            {customer.phone ? (
              <a href={`tel:${customer.phone}`} className={buttonVariants({ variant: "outline" })}>
                <Phone className="size-4" aria-hidden="true" />
                Call
              </a>
            ) : null}
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className={buttonVariants({ variant: "outline" })}>
                <Mail className="size-4" aria-hidden="true" />
                Email
              </a>
            ) : null}
            {canWrite ? (
              <Link href={`/projects/new?customerId=${customer.id}`} className={buttonVariants()}>
                New project
              </Link>
            ) : null}
          </div>
        }
      />

      {projectLoad.failedCount > 0 || projectLoad.bounded ? (
        <FeedbackState
          kind="partial"
          title="Some customer work is outside this loaded view"
          description={[
            projectLoad.failedCount > 0
              ? `${projectLoad.failedCount} project detail${projectLoad.failedCount === 1 ? "" : "s"} could not load.`
              : null,
            projectLoad.bounded
              ? `Showing the most recent ${CUSTOMER_PROJECT_DETAIL_LIMIT} of ${projectLoad.totalProjects} customer projects.`
              : null,
            "Loaded work remains safe and actionable.",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ) : null}

      {attentionCount > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-warning/30 bg-card" aria-labelledby="customer-needs-you">
          <div className="flex items-end justify-between gap-3 border-b border-warning/20 bg-warning/5 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warning">Needs You</p>
              <h2 id="customer-needs-you" className="mt-1 font-heading text-lg font-semibold">Customer work waiting on a human decision</h2>
            </div>
            <Badge variant="outline">{attentionCount}</Badge>
          </div>
          <div className="divide-y divide-border/60">
            {overdueInvoices.slice(0, 2).map(({ project, invoice }) => (
              <ListRowLink
                key={`invoice-${invoice.id}`}
                href={`/projects/${project.id}/invoices/${invoice.id}`}
                title={`Invoice #${invoice.invoiceNumber} overdue`}
                subtitle={`${project.name} · ${formatCurrency(invoice.balanceDue)} still due`}
                trailing={<StatusBadge status="overdue" />}
                className="rounded-none border-0"
              />
            ))}
            {staleProposals.slice(0, 2).map(({ project, proposal }) => (
              <ListRowLink
                key={`proposal-${proposal.id}`}
                href={`/projects/${project.id}/proposals/${proposal.id}`}
                title={`${project.name} proposal needs follow-up`}
                subtitle={proposal.sentAt ? `Sent ${formatDate(proposal.sentAt)} · no response recorded` : "No response recorded"}
                trailing={<StatusBadge status="needs_attention" />}
                className="rounded-none border-0"
              />
            ))}
            {blockedTasks.slice(0, 2).map(({ project, task }) => (
              <ListRowLink
                key={`task-${task.id}`}
                href={`/projects/${project.id}?tab=tasks`}
                title={task.title}
                subtitle={`${project.name} · blocked task`}
                trailing={<StatusBadge status="blocked" />}
                className="rounded-none border-0"
              />
            ))}
          </div>
        </section>
      ) : null}

      <nav aria-label="Customer workspace sections" className="flex gap-2 overflow-x-auto pb-1">
        {[
          ["#work", "Work"],
          ["#money", "Money"],
          ["#upcoming", "Upcoming"],
          ["#activity", "Activity"],
          ["#files", "Files"],
          ["#details", "Customer details"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="min-h-10 shrink-0 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="grid content-start gap-5">
          <Card id="work" className="border-border/70">
            <CardHeader className="flex-row items-end justify-between gap-3 border-b border-border/60">
              <div>
                <CardTitle>Current work</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Active Project work, using the latest real Job, Proposal, or Estimate context.</p>
              </div>
              <Badge variant="outline">{currentProjects.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {currentProjects.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <EmptyState
                    title="No active customer work"
                    description="Create the next project when this customer is ready for more work."
                    action={
                      canWrite ? (
                        <Link href={`/projects/new?customerId=${customer.id}`} className={buttonVariants()}>
                          New project
                        </Link>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {currentProjects.slice(0, 6).map((project) => {
                    const summary = workSummary(project);
                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="group grid gap-3 px-4 py-4 outline-none hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{project.name}</p>
                            <StatusBadge status={summary.status} />
                          </div>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{summary.meta}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {summary.amount != null ? (
                            <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(summary.amount)}</span>
                          ) : null}
                          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <section id="money" className="grid gap-3 sm:grid-cols-3" aria-label="Customer money summary">
            <Card className="border-border/70">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Outstanding</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(money.outstanding)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{money.overdueCount} overdue invoice{money.overdueCount === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Paid</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(money.paid)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Recorded payments on loaded projects</p>
              </CardContent>
            </Card>
            <Card className="border-border/70">
              <CardContent className="pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Invoiced</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{formatCurrency(money.invoiced)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Non-voided invoices on loaded projects</p>
              </CardContent>
            </Card>
          </section>

          <Card id="upcoming" className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {schedule.error ? (
                <div className="p-4 sm:p-5">
                  <FeedbackState kind="partial" title="Upcoming schedule is unavailable" description={schedule.error} />
                </div>
              ) : schedule.items.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <EmptyState title="No scheduled customer work this week" description="Scheduled Jobs will appear here when they are assigned a time." />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {schedule.items.slice(0, 5).map((job) => (
                    <Link
                      key={job.id}
                      href={job.project ? `/projects/${job.project.id}` : "/dispatch"}
                      className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30 text-muted-foreground">
                        <CalendarClock className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{job.title}</span>
                        <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                          {job.scheduledStart ? formatScheduleInZone(job.scheduledStart, schedule.timezone) : "Unscheduled"} · {job.assignedTechnicians.length > 0 ? job.assignedTechnicians.map((tech) => tech.name).join(", ") : "Unassigned"}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="activity" className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:p-5">No recent customer work activity is available in the loaded project records.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {activity.map((item) => (
                    <Link key={item.id} href={item.href} className="block px-4 py-3 hover:bg-muted/30 sm:px-5">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description} · {formatDate(item.occurredAt)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="files" className="border-border/70">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {fileRows.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:p-5">No project files are available in the loaded customer work.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {fileRows.map((file) => (
                    <ListRowLink
                      key={file.id}
                      href={`/projects/${file.projectId}?tab=documents`}
                      title={file.fileName}
                      subtitle={`${file.projectName} · ${file.fileType}`}
                      trailing={<FileText className="size-4 text-muted-foreground" aria-hidden="true" />}
                      className="rounded-none border-0"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <aside className="grid content-start gap-4">
          <Card id="details" className="border-border/70">
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                <p className="mt-1 break-all text-foreground">{customer.email ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Phone</p>
                <p className="mt-1 text-foreground">{customer.phone ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Address</p>
                <p className="mt-1 text-foreground">{customerLocation ?? "Not recorded"}</p>
              </div>
              {customer.notes ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{customer.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Service addresses</CardTitle>
            </CardHeader>
            <CardContent>
              <ServiceAddresses customerId={customer.id} addresses={customer.serviceAddresses ?? []} canWrite={canWrite} />
            </CardContent>
          </Card>

          {canIssuePortalLink ? (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Customer portal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Create a single-use link for this customer. The raw link is shown only once.</p>
                <CustomerPortalLink customerId={customer.id} />
              </CardContent>
            </Card>
          ) : null}

          {canWrite ? (
            <details className="rounded-xl border border-border/70 bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Edit customer</summary>
              <div className="mt-4">
                <EditCustomerForm customer={customer} />
              </div>
            </details>
          ) : null}

          {canWrite ? (
            <details className="rounded-xl border border-border/70 bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">Customer administration</summary>
              <form action={deleteCustomerAction} className="mt-4">
                <input type="hidden" name="customerId" value={customer.id} />
                <Button type="submit" variant="destructive">
                  Remove customer
                </Button>
              </form>
            </details>
          ) : null}

          <div className="rounded-xl border border-info/25 bg-info/5 p-4">
            <div className="flex gap-3">
              <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted-foreground">
                Money totals and activity summarize the loaded customer Project records. When project detail is partial, the page discloses that instead of treating missing data as zero.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
