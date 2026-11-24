import type { ChangeOrder, CloseoutChecklist, Contract, Customer, Estimate, Invoice, Project, ProjectFile, ProjectTask, Proposal, SiteVisit, ProjectCloseout, PunchItem, WarrantyRecord } from "@/lib/api";

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

// Closeout data loaded for the project workspace's Closeout tab. `closeout`
// is null when no closeout record exists yet; `checklist` is the backend's
// separately computed readiness checklist and arrives with the closeout
// record (null whenever there is no record). `closeoutUnavailable` is true
// when the closeout endpoints could not be reached at all, so the tab can
// say so instead of pretending there is nothing to close out.
export interface ProjectCloseoutData {
  closeout: ProjectCloseout | null;
  checklist: CloseoutChecklist | null;
  punchItems: PunchItem[];
  warranties: WarrantyRecord[];
  closeoutUnavailable: boolean;
}
