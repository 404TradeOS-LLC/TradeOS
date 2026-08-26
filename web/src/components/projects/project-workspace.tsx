import Link from "next/link";
import type { ReactNode } from "react";
import { createEstimateAction, deleteProjectTaskAction, duplicateEstimateAction, rejectChangeOrderAction, updateProjectStatusAction, updateProjectTaskStatusAction, approveChangeOrderAction } from "@/app/actions/projects";
import { ChangeOrderLineItemForm, ChangeOrderCreateForm } from "@/components/projects/change-order-forms";
import { ProjectDocumentUpload } from "@/components/projects/project-document-upload";
import { ProjectPhotoPanel } from "@/components/projects/project-photo-panel";
import { ProjectStatusTimeline } from "@/components/projects/project-status-timeline";
import { ProjectTaskForm } from "@/components/projects/project-task-form";
import { ProjectWorkspaceTab } from "@/components/projects/project-workspace-tabs";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { NotificationCenter } from "@/components/shared/notification-center";
import { StatusBadge } from "@/components/shared/status-badge";
import { SummaryMetricCard } from "@/components/shared/summary-metric-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ChangeOrder, ChangeOrderLineItem, Contract, Customer, Estimate, Invoice, JobSummary, Project, ProjectFile, ProjectTask, Proposal, SiteVisit } from "@/lib/api";
import {
  buildProjectActivity,
  buildProjectNotifications,
  formatCurrency,
  formatDate,
  formatDateTime,
  getInvoiceDisplayStatus,
  getProposalDisplayStatus,
} from "@/lib/document-workflow";
import { projectStatuses, getStatusLabel } from "@/domain";

type DetailedChangeOrder = ChangeOrder & { lineItems: ChangeOrderLineItem[] };

interface ProjectWorkspaceProps {
  activeTab: ProjectWorkspaceTab;
  project: Project;
  customer: Customer | null;
  estimates: Estimate[];
  siteVisits: SiteVisit[];
  projectFiles: ProjectFile[];
  proposals: Proposal[];
  invoices: Array<Invoice & { lineItems: unknown[] }>;
  contracts: Contract[];
  changeOrders: DetailedChangeOrder[];
  tasks: ProjectTask[];
  jobs?: JobSummary[];
}

export async function ProjectWorkspace({
  activeTab,
  project,
  customer,
  estimates,
  siteVisits,
  projectFiles,
  proposals,
  invoices,
  contracts,
  changeOrders,
  tasks,
  jobs = [],
}: ProjectWorkspaceProps) {
  const activity = buildProjectActivity({ ...project, customer, estimates, siteVisits, projectFiles, proposals, invoices, contracts, changeOrders, tasks });
  const notifications = buildProjectNotifications({ ...project, proposals, contracts, invoices });
  const latestVisit = siteVisits[0] ?? null;
  const photoCount = projectFiles.filter((file) => file.fileType === "photo").length;
  const nonPhotoFiles = projectFiles.filter((file) => file.fileType !== "photo");
  const openTasks = tasks.filter((task) => task.status !== "completed");
  const revenuePipeline = proposals
    .filter((proposal) => ["sent", "viewed", "accepted"].includes(getProposalDisplayStatus(proposal)))
    .reduce((sum, proposal) => sum + (proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow ?? 0), 0);

  switch (activeTab) {
    case "overview":
      return (
        <div className="grid gap-6">
          <FieldDashboard projectId={project.id} />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryMetricCard label="Estimates" value={String(estimates.length)} />
            <SummaryMetricCard label="Site visits" value={String(siteVisits.length)} />
            <SummaryMetricCard label="Jobs" value={String(jobs.length)} />
            <SummaryMetricCard label="Open tasks" value={String(openTasks.length)} />
            <SummaryMetricCard label="Change orders" value={String(changeOrders.length)} />
            <SummaryMetricCard label="Pipeline" value={formatCurrency(revenuePipeline)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <ProjectStatusTimeline
              project={project}
              hasIntake={Boolean(latestVisit)}
              hasProposal={proposals.length > 0}
              hasContract={contracts.length > 0}
              hasInvoice={invoices.length > 0}
            />
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Lifecycle status</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateProjectStatusAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input type="hidden" name="projectId" value={project.id} />
                  <select
                    name="status"
                    defaultValue={project.status}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {projectStatuses.map((status) => (
                      <option key={status} value={status}>
                        {getStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className={buttonVariants({ variant: "outline" })}>
                    Update status
                  </button>
                </form>
                <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                  <div>Customer: <span className="font-medium text-foreground">{customer?.name ?? "No customer linked"}</span></div>
                  <div>Jobsite: <span className="font-medium text-foreground">{project.siteAddress ?? "No address yet"}</span></div>
                  <div>Photos: <span className="font-medium text-foreground">{photoCount}</span></div>
                </div>
              </CardContent>
            </Card>
          </div>
          {jobs.length > 0 ? (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Scheduled jobs</CardTitle>
                <p className="text-sm text-muted-foreground">Read-only summary of jobs scheduled against this project.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div>
                      <div className="font-medium text-foreground">
                        {job.title} <span className="font-mono text-xs tabular-nums text-muted-foreground">#{job.jobNumber}</span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {job.scheduledStart ? formatDateTime(job.scheduledStart) : "Not yet scheduled"}
                        {job.scheduledEnd ? ` – ${formatDateTime(job.scheduledEnd)}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          <ActivityTimeline title="Recent project timeline" items={activity.slice(0, 8)} />
        </div>
      );
    case "estimate-history":
      return (
        <Card className="border-border/70">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Estimate history</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Track every estimate version tied to this project.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {estimates.length >= 2 ? (
                <Link href={`/projects/${project.id}/estimates/compare`} className={buttonVariants({ variant: "outline" })}>
                  Compare versions
                </Link>
              ) : null}
              <form action={createEstimateAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <button type="submit" className={buttonVariants()}>
                  New estimate
                </button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {estimates.length === 0 ? (
              <EmptyState
                title="No estimates yet"
                description="Create the first estimate so this project can move into proposal review and the customer approval flow."
                action={
                  <form action={createEstimateAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <button type="submit" className={buttonVariants()}>
                      Create first estimate
                    </button>
                  </form>
                }
              />
            ) : (
              estimates.map((estimate) => (
                <div
                  key={estimate.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <div>
                    <Link href={`/projects/${project.id}/estimates/${estimate.id}`} className="font-medium text-foreground hover:underline">
                      Estimate v{estimate.version}
                    </Link>
                    <div className="text-sm text-muted-foreground">
                      {estimate.status} • {formatCurrency(estimate.totalPrice)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={estimate.status} />
                    <form action={duplicateEstimateAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <input type="hidden" name="estimateId" value={estimate.id} />
                      <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Duplicate
                      </button>
                    </form>
                    <Link href={`/projects/${project.id}/estimates/${estimate.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      );
    case "proposals":
      return (
        <ListSection
          title="Proposals"
          description="Customer-facing scope and pricing history."
          empty="No proposals yet. Build the first draft when the estimate is ready for customer review."
          action={
            <Link href={`/projects/${project.id}/proposals/new`} className={buttonVariants()}>
              Build proposal draft
            </Link>
          }
          items={proposals.map((proposal) => ({
            id: proposal.id,
            title: proposal.estimateId ? "Estimate-backed proposal" : "Project draft proposal",
            subtitle: `${formatCurrency(proposal.finalPrice ?? proposal.priceHigh ?? proposal.priceLow)} • ${formatDateTime(proposal.createdAt)}`,
            href: `/projects/${project.id}/proposals/${proposal.id}`,
            badge: getProposalDisplayStatus(proposal),
          }))}
        />
      );
    case "contracts":
      return (
        <ListSection
          title="Contracts"
          description="Signed and pending project agreements."
          empty="No contracts yet. Create one from an accepted proposal to move the job into execution."
          items={contracts.map((contract) => ({
            id: contract.id,
            title: "Project contract",
            subtitle: contract.signedAt ? `Signed ${formatDateTime(contract.signedAt)}` : `Created ${formatDateTime(contract.createdAt)}`,
            href: `/projects/${project.id}/contracts/${contract.id}`,
            badge: contract.status,
          }))}
        />
      );
    case "invoices":
      return (
        <ListSection
          title="Invoices"
          description="Billing history and outstanding balances."
          empty="No invoices yet. Create one after the contract or approved work scope is ready to bill."
          action={
            <Link href={`/projects/${project.id}/invoices/new`} className={buttonVariants()}>
              New invoice
            </Link>
          }
          items={invoices.map((invoice) => ({
            id: invoice.id,
            title: `Invoice #${invoice.invoiceNumber}`,
            subtitle: `${formatCurrency(invoice.amount)} • due ${formatDate(invoice.dueDate)}`,
            href: `/projects/${project.id}/invoices/${invoice.id}`,
            badge: getInvoiceDisplayStatus(invoice),
          }))}
        />
      );
    case "photos":
      return (
        <ProjectPhotoPanel
          projectFiles={projectFiles}
          projectId={project.id}
          editable
          title="Field photos"
          emptyMessage="No project photos saved yet. Use the intake flow or field dashboard to add proof from the jobsite."
        />
      );
    case "documents":
      return (
        <div className="grid gap-6">
          <ProjectDocumentUpload projectId={project.id} />
          <div className="grid gap-6 xl:grid-cols-2">
            <DocumentBucket
              title="Uploaded documents"
              items={nonPhotoFiles.map((file) => ({
                id: file.id,
                title: file.fileName,
                subtitle: `${file.fileType} • ${formatDateTime(file.createdAt)}`,
                href: file.fileUrl,
              }))}
              empty="No uploaded documents yet."
            />
            <DocumentBucket
              title="Generated lifecycle documents"
              items={[
                ...proposals.map((proposal) => ({
                  id: proposal.id,
                  title: "Proposal package",
                  subtitle: getProposalDisplayStatus(proposal),
                  href: `/projects/${project.id}/proposals/${proposal.id}`,
                })),
                ...contracts.map((contract) => ({
                  id: contract.id,
                  title: "Contract package",
                  subtitle: contract.status,
                  href: `/projects/${project.id}/contracts/${contract.id}`,
                })),
                ...invoices.map((invoice) => ({
                  id: invoice.id,
                  title: `Invoice #${invoice.invoiceNumber}`,
                  subtitle: getInvoiceDisplayStatus(invoice),
                  href: `/projects/${project.id}/invoices/${invoice.id}`,
                })),
              ]}
              empty="No generated project documents yet."
            />
          </div>
        </div>
      );
    case "site-visits":
      return (
        <div className="grid gap-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Site visit module</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">Capture arrival, departure, measurements, customer notes, punch items, and photos from the field.</div>
              <Link href={`/projects/${project.id}/intake`} className={buttonVariants()}>
                Open intake workspace
              </Link>
            </CardContent>
          </Card>
          {siteVisits.length === 0 ? (
            <EmptyState
              title="No site visits saved yet"
              description="Capture the first intake so measurements, photos, and field notes are available before the estimate is finalized."
              action={
                <Link href={`/projects/${project.id}/intake`} className={buttonVariants()}>
                  Open intake workspace
                </Link>
              }
            />
          ) : (
            siteVisits.map((visit) => (
              <Card key={visit.id} className="border-border/70">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    <span>Visit recorded {formatDateTime(visit.createdAt)}</span>
                    <StatusBadge status={project.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <InfoPairs
                    pairs={[
                      { label: "Arrival", value: formatDateTime(visit.detailsJson?.arrivalAt ?? null) },
                      { label: "Departure", value: formatDateTime(visit.detailsJson?.departureAt ?? null) },
                      { label: "GPS", value: visit.detailsJson?.gps ?? "Not captured" },
                      { label: "Confidence", value: visit.confidenceScore != null ? `${visit.confidenceScore}%` : "Not scored" },
                    ]}
                  />
                  <InfoPairs
                    pairs={[
                      { label: "Customer notes", value: visit.detailsJson?.customerNotes ?? "No customer notes" },
                      { label: "Materials needed", value: joinList(visit.detailsJson?.materialsNeeded) },
                      { label: "Safety notes", value: joinList(visit.detailsJson?.safetyNotes) },
                      { label: "Punch list", value: joinList(visit.detailsJson?.punchList) },
                    ]}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      );
    case "tasks":
      return (
        <div className="grid gap-6">
          <ProjectTaskForm projectId={project.id} />
          <div className="grid gap-4">
            {tasks.length === 0 ? (
              <EmptyState
                title="No tasks yet"
                description="Add the first field or office task so the team knows what must happen next on this job."
              />
            ) : (
              tasks.map((task) => (
                <Card key={task.id} className="border-border/70">
                  <CardContent className="flex flex-col gap-4 pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{task.title}</span>
                          <StatusBadge status={task.status} />
                          <StatusBadge status={task.priority} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Assigned to {task.assignedTo ?? "unassigned"} • due {formatDate(task.dueDate)} • created {formatDate(task.createdAt)}
                        </div>
                        {task.notes && <p className="text-sm text-muted-foreground">{task.notes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={updateProjectTaskStatusAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="status" value="in_progress" />
                          <button type="submit" className={buttonVariants({ variant: "outline" })}>
                            Start
                          </button>
                        </form>
                        <form action={updateProjectTaskStatusAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="status" value="completed" />
                          <button type="submit" className={buttonVariants({ variant: "outline" })}>
                            Complete
                          </button>
                        </form>
                        <form action={deleteProjectTaskAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="taskId" value={task.id} />
                          <button type="submit" className={buttonVariants({ variant: "ghost" })}>
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      );
    case "change-orders":
      return (
        <div className="grid gap-6">
          <ChangeOrderCreateForm
            projectId={project.id}
            estimateOptions={estimates.map((estimate) => ({ id: estimate.id, label: `Estimate v${estimate.version} • ${formatCurrency(estimate.totalPrice)}` }))}
          />
          {changeOrders.length === 0 ? (
            <EmptyState
              title="No change orders yet"
              description="If the scope changes after approval or work starts, create a change order here so price and schedule impacts stay documented."
            />
          ) : (
            changeOrders.map((changeOrder) => {
              const baseEstimate = estimates.find((estimate) => estimate.id === changeOrder.estimateId) ?? null;
              return (
                <Card key={changeOrder.id} className="border-border/70">
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>CO-{changeOrder.coNumber}</span>
                        <StatusBadge status={changeOrder.status} />
                      </div>
                      <div className="text-sm font-normal text-muted-foreground">{formatCurrency(changeOrder.amount)}</div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <InfoPairs
                      pairs={[
                        { label: "Description", value: changeOrder.description },
                        { label: "Original estimate", value: baseEstimate ? formatCurrency(baseEstimate.totalPrice) : "Not linked" },
                        { label: "Cost delta", value: formatCurrency(changeOrder.amount) },
                        { label: "Schedule impact", value: changeOrder.scheduleImpactDays != null ? `${changeOrder.scheduleImpactDays} day(s)` : "No impact recorded" },
                        { label: "Approval history", value: changeOrder.approvedAt ? `Approved ${formatDateTime(changeOrder.approvedAt)}` : changeOrder.rejectedAt ? `Rejected ${formatDateTime(changeOrder.rejectedAt)}` : "Draft" },
                      ]}
                    />
                    <div className="grid gap-3">
                      {changeOrder.lineItems.length === 0 ? (
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">No line items yet.</div>
                      ) : (
                        changeOrder.lineItems.map((lineItem) => (
                          <div key={lineItem.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-medium text-foreground">{lineItem.description}</div>
                                <div className="text-sm text-muted-foreground">
                                  {lineItem.quantity} × {formatCurrency(lineItem.unitCost)}
                                </div>
                              </div>
                              <div className="font-medium text-foreground">{formatCurrency(lineItem.lineCost)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {changeOrder.status === "draft" && <ChangeOrderLineItemForm projectId={project.id} changeOrderId={changeOrder.id} />}
                    <div className="flex flex-wrap gap-2">
                      {changeOrder.status === "draft" && (
                        <>
                          <form action={approveChangeOrderAction}>
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="changeOrderId" value={changeOrder.id} />
                            <button type="submit" className={buttonVariants()}>
                              Approve
                            </button>
                          </form>
                          <form action={rejectChangeOrderAction}>
                            <input type="hidden" name="projectId" value={project.id} />
                            <input type="hidden" name="changeOrderId" value={changeOrder.id} />
                            <button type="submit" className={buttonVariants({ variant: "outline" })}>
                              Reject
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      );
    case "timeline":
      return <ActivityTimeline title="Project timeline" items={activity} />;
    case "warranty":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Closeout and warranty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Use this tab to prepare the job for closeout, store handoff documents, and keep warranty-supporting records together for the customer file.</p>
              <p>It is the final checkpoint before archiving the project: confirm closeout status, signed paperwork, and final billing readiness in one place.</p>
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="font-medium text-foreground">Current closeout snapshot</div>
                <div className="mt-1">Project status: {project.status.replaceAll("_", " ")}</div>
                <div>Contracts signed: {contracts.filter((contract) => contract.status === "signed").length}</div>
                <div>Final invoices paid: {invoices.filter((invoice) => getInvoiceDisplayStatus(invoice) === "paid").length}</div>
              </div>
            </CardContent>
          </Card>
          <DocumentBucket
            title="Warranty-related files"
            items={nonPhotoFiles
              .filter((file) => ["contracts", "specifications", "permits", "document"].includes(file.fileType))
              .map((file) => ({
                id: file.id,
                title: file.fileName,
                subtitle: file.fileType,
                href: file.fileUrl,
              }))}
            empty="No warranty-supporting documents uploaded yet."
          />
        </div>
      );
    case "notes":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Project notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Simple scope</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{project.simpleScope ?? "No simple scope yet."}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest field notes</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{latestVisit?.notes ?? "No site visit notes yet."}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Customer notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{latestVisit?.detailsJson?.customerNotes ?? customer?.notes ?? "No customer notes saved yet."}</p>
              <Link href={`/projects/${project.id}/intake`} className={buttonVariants({ variant: "outline" })}>
                Update through site visit
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    case "activity":
      return (
        <div className="grid gap-6">
          <NotificationCenter title="Operational activity" items={notifications} />
          <ActivityTimeline title="Recent activity" items={activity.slice(0, 10)} />
        </div>
      );
    default:
      return null;
  }
}

function FieldDashboard({ projectId }: { projectId: string }) {
  const actions = [
    { label: "Take photo", href: `/projects/${projectId}/intake` },
    { label: "Add note", href: `/projects/${projectId}?tab=notes` },
    { label: "Start visit", href: `/projects/${projectId}/intake` },
    { label: "End visit", href: `/projects/${projectId}/intake` },
    { label: "Record change", href: `/projects/${projectId}?tab=change-orders` },
    { label: "Generate change order", href: `/projects/${projectId}?tab=change-orders` },
    { label: "View estimate", href: `/projects/${projectId}?tab=estimate-history` },
  ];

  return (
    <Card className="border-border/70 bg-gradient-to-br from-card via-card to-muted/25">
      <CardHeader>
        <CardTitle>Field dashboard</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex min-h-20 items-center justify-center rounded-2xl border border-border/70 bg-background px-4 py-5 text-center text-base font-semibold text-foreground transition-colors hover:bg-muted/60"
          >
            {action.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function ListSection({
  title,
  description,
  empty,
  items,
  action,
}: {
  title: string;
  description: string;
  empty: string;
  items: Array<{ id: string; title: string; subtitle: string; href: string; badge?: string }>;
  action?: ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:bg-muted/40">
              <div>
                <div className="font-medium text-foreground">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.subtitle}</div>
              </div>
              {item.badge ? <StatusBadge status={item.badge} /> : null}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function DocumentBucket({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; title: string; subtitle: string; href: string }>;
  empty: string;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <a key={item.id} href={item.href} className="block rounded-xl border border-border/60 bg-muted/20 p-4 hover:bg-muted/40">
              <div className="font-medium text-foreground">{item.title}</div>
              <div className="text-sm text-muted-foreground">{item.subtitle}</div>
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function InfoPairs({ pairs }: { pairs: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3">
      {pairs.map((pair) => (
        <div key={pair.label} className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{pair.label}</div>
          <div className="mt-2 text-sm text-foreground">{pair.value}</div>
        </div>
      ))}
    </div>
  );
}

function joinList(values: string[] | undefined) {
  if (!values || values.length === 0) return "None recorded";
  return values.join(", ");
}
