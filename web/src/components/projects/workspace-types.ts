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
// record (null whenever there is no record). Each request's availability is
// tracked separately — a failed fetch must never collapse into an empty
// list or an absent record: `closeoutUnavailable` is true only when the
// closeout fetch failed for a reason other than 404 (a 404 means no
// record yet), and the punch/warranty flags say the same for their lists,
// so the tab can report the section as unavailable instead of pretending
// there is nothing to close out or no warranty recorded.
export interface ProjectCloseoutData {
  closeout: ProjectCloseout | null;
  checklist: CloseoutChecklist | null;
  punchItems: PunchItem[];
  warranties: WarrantyRecord[];
  closeoutUnavailable: boolean;
  punchItemsUnavailable: boolean;
  warrantiesUnavailable: boolean;
}
