export type PunchItemStatus = "open" | "in_progress" | "resolved" | "verified";
export type PunchItemPriority = "low" | "medium" | "high";
export type ProjectCloseoutStatus = "draft" | "ready" | "handed_off";
export type WarrantySourceType = "contract" | "invoice" | "other";

export interface CreatePunchItemInput {
  orgId?: string;
  projectId: string;
  jobId?: string | null;
  title: string;
  description?: string;
  priority?: PunchItemPriority;
  assignedUserId?: string | null;
  assignedTo?: string;
  dueDate?: Date;
  createdById: string;
}

export interface UpdatePunchItemInput {
  orgId?: string;
  title?: string;
  description?: string;
  priority?: PunchItemPriority;
  assignedUserId?: string | null;
  assignedTo?: string | null;
  dueDate?: Date | null;
  actorUserId?: string;
}

export interface PunchItemDTO {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  title: string;
  description: string;
  status: PunchItemStatus;
  priority: PunchItemPriority;
  assignedUserId: string | null;
  assignedTo: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCloseoutInput {
  orgId?: string;
  projectId: string;
  notes?: string;
  actorUserId?: string;
}

export interface ProjectCloseoutDTO {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  status: ProjectCloseoutStatus;
  notes: string | null;
  completedAt: string | null;
  completedById: string | null;
  handedOffAt: string | null;
  handedOffById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CloseoutChecklist {
  completedJobs: { count: number; ids: string[] };
  signedContract: { present: boolean; contractId: string | null };
  finalInvoice: { present: boolean; invoiceId: string | null };
  acceptedProposal: { status: "present" | "missing" | "not_applicable"; proposalId: string | null };
  openPunchCount: number;
  missing: string[];
  ready: boolean;
}

export interface GetCloseoutResult {
  closeout: ProjectCloseoutDTO;
  checklist: CloseoutChecklist;
}

export interface CreateWarrantyRecordInput {
  orgId?: string;
  projectId: string;
  jobId?: string | null;
  contractId?: string | null;
  invoiceId?: string | null;
  title: string;
  coverageText: string;
  sourceType: WarrantySourceType;
  sourceId?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdById: string;
}

export interface UpdateWarrantyRecordInput {
  orgId?: string;
  title?: string;
  coverageText?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  actorUserId?: string;
}

export interface WarrantyRecordDTO {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  contractId: string | null;
  invoiceId: string | null;
  title: string;
  coverageText: string;
  sourceType: WarrantySourceType;
  sourceId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloseoutDocumentData {
  project: {
    id: string;
    name: string;
    siteAddress: string | null;
    customerName: string;
    customerEmail: string;
  };
  closeout: ProjectCloseoutDTO;
  checklist: CloseoutChecklist;
  completedJobs: Array<{ id: string; title: string; completedAt: string | null }>;
  invoices: Array<{ id: string; invoiceNumber: number; status: string; amount: number; dueDate: string | null; paidAt: string | null }>;
  contracts: Array<{ id: string; status: string; signedAt: string | null }>;
  punchSummary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    verified: number;
    items: Array<{ id: string; title: string; status: PunchItemStatus; priority: PunchItemPriority; assignedTo: string | null }>;
  };
  warrantyRecords: WarrantyRecordDTO[];
  hasWarrantyRecords: boolean;
  warrantyMessage: string | null;
  closeoutHtml: string;
  warrantyHtml: string[];
}
