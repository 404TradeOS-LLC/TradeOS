import type { ChangeOrder, Contract, Customer, Estimate, Invoice, Project, ProjectFile, ProjectTask, Proposal, SiteVisit } from "@/lib/api";

export interface ProjectWorkspaceData {
  project: Project;
  customer: Customer | null;
  estimates: Estimate[];
  siteVisits: SiteVisit[];
  projectFiles: ProjectFile[];
  proposals: Proposal[];
  invoices: Invoice[];
  contracts: Contract[];
  changeOrders: ChangeOrder[];
  tasks: ProjectTask[];
}
