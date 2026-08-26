import { Card, CardContent } from "@/components/ui/card";
import { ProjectQuickActions } from "@/components/projects/project-quick-actions";
import { ProjectMetricsCard } from "@/components/projects/project-metrics-card";
import { CustomerHeaderCard } from "@/components/projects/customer-header-card";
import { ProjectOverviewCard } from "@/components/projects/project-overview-card";
import { ProjectActivityFeed } from "@/components/projects/project-activity-feed";
import { ProjectNotesCard } from "@/components/projects/project-notes-card";
import { RecentDocumentsCard } from "@/components/projects/recent-documents-card";
import type { ChangeOrder, Contract, Customer, Invoice, JobSummary, Project, ProjectTask, SiteVisit, Proposal, Estimate, ProjectFile } from "@/lib/api";
import { ProjectPhotoGallery } from "@/components/projects/project-photo-gallery";
import { buildProjectActivity, getInvoiceDisplayStatus } from "@/lib/document-workflow";

interface ProjectSidebarProps {
  project: Project;
  customer: Customer | null;
  siteVisits: SiteVisit[];
  proposals: Proposal[];
  estimates: Estimate[];
  projectFiles: ProjectFile[];
  invoices: Array<Invoice & { lineItems?: unknown[] }>;
  contracts: Contract[];
  changeOrders: ChangeOrder[];
  tasks: ProjectTask[];
  jobs?: JobSummary[];
}

export function ProjectSidebar({ project, customer, siteVisits, proposals, estimates, projectFiles, invoices, contracts, changeOrders, tasks, jobs = [] }: ProjectSidebarProps) {
  const activity = buildProjectActivity({ ...project, customer, estimates, siteVisits, projectFiles, proposals, invoices, contracts, changeOrders, tasks }).slice(0, 6);

  return (
    <div className="grid gap-6">
      <Card className="border-border/70">
        <CardContent className="pt-6">
          <ProjectQuickActions projectId={project.id} />
        </CardContent>
      </Card>
      <CustomerHeaderCard customer={customer} />
      <ProjectOverviewCard project={project} />
      <ProjectMetricsCard
        metrics={[
          { label: "Estimates", value: String(estimates.length) },
          { label: "Visits", value: String(siteVisits.length) },
          { label: "Jobs", value: String(jobs.length) },
          { label: "Proposals", value: String(proposals.length) },
          { label: "Contracts", value: String(contracts.length) },
          { label: "Invoices", value: String(invoices.length) },
          { label: "Change orders", value: String(changeOrders.length) },
        ]}
      />
      <ProjectActivityFeed items={activity} />
      <ProjectNotesCard title="Project notes" notes={project.simpleScope} />
      <ProjectPhotoGallery projectFiles={projectFiles} />
      <RecentDocumentsCard
        documents={[
          ...proposals.map((proposal) => ({ id: proposal.id, href: `/projects/${project.id}/proposals/${proposal.id}`, label: proposal.estimateId ? "Estimate-based proposal" : "Project draft proposal", status: proposal.status })),
          ...contracts.map((contract) => ({ id: contract.id, href: `/projects/${project.id}/contracts/${contract.id}`, label: "Customer contract", status: contract.status })),
          ...invoices.map((invoice) => ({ id: invoice.id, href: `/projects/${project.id}/invoices/${invoice.id}`, label: `Invoice #${invoice.invoiceNumber}`, status: getInvoiceDisplayStatus(invoice) })),
          ...projectFiles.slice(0, 3).map((file) => ({ id: file.id, href: file.fileUrl, label: file.fileName })),
        ]}
      />
    </div>
  );
}
