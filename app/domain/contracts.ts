export const canonicalRoles = ["owner", "admin", "dispatcher", "technician"] as const;
export type CanonicalRole = (typeof canonicalRoles)[number];

export const legacyRoles = ["estimator", "viewer"] as const;
export type LegacyRole = (typeof legacyRoles)[number];

export const supportedRoles = [...canonicalRoles, ...legacyRoles] as const;
export type SupportedRole = (typeof supportedRoles)[number];

export const compatibilityRoleMap: Record<LegacyRole, CanonicalRole> = {
  estimator: "dispatcher",
  viewer: "technician",
};

export const organizationMemberStatuses = ["active", "invited", "disabled"] as const;
export type OrganizationMemberStatus = (typeof organizationMemberStatuses)[number];

export const domainPermissions = [
  "team.manage",
  "company.manage",
  "settings.manage",
  "crm.read",
  "crm.write",
  "dispatch.manage",
  "billing.read",
  "billing.write",
  "documents.manage",
  "notes.write",
  "activity.read",
  "costbook.read",
  "costbook.write",
  "costbook.manage",
] as const;
export type DomainPermission = (typeof domainPermissions)[number];

const rolePermissions: Record<SupportedRole, readonly DomainPermission[]> = {
  owner: domainPermissions,
  admin: [
    "team.manage",
    "company.manage",
    "settings.manage",
    "crm.read",
    "crm.write",
    "dispatch.manage",
    "billing.read",
    "billing.write",
    "documents.manage",
    "notes.write",
    "activity.read",
    "costbook.read",
    "costbook.write",
    "costbook.manage",
  ],
  dispatcher: [
    "company.manage",
    "settings.manage",
    "crm.read",
    "crm.write",
    "dispatch.manage",
    "billing.read",
    "billing.write",
    "documents.manage",
    "notes.write",
    "activity.read",
    "costbook.read",
  ],
  technician: ["crm.read", "billing.read", "notes.write", "activity.read", "costbook.read"],
  estimator: [
    "company.manage",
    "settings.manage",
    "crm.read",
    "crm.write",
    "dispatch.manage",
    "billing.read",
    "billing.write",
    "documents.manage",
    "notes.write",
    "activity.read",
    "costbook.read",
  ],
  viewer: ["crm.read", "billing.read", "activity.read"],
};

export function isSupportedRole(value: string): value is SupportedRole {
  return (supportedRoles as readonly string[]).includes(value);
}

export function normalizeRole(role: string): CanonicalRole {
  if ((canonicalRoles as readonly string[]).includes(role)) {
    return role as CanonicalRole;
  }
  if ((legacyRoles as readonly string[]).includes(role)) {
    return compatibilityRoleMap[role as LegacyRole];
  }
  return "technician";
}

export function isLegacyRole(role: string): role is LegacyRole {
  return (legacyRoles as readonly string[]).includes(role);
}

export function getRolePermissions(role: string): readonly DomainPermission[] {
  return rolePermissions[isSupportedRole(role) ? role : "technician"];
}

export function hasPermission(role: string, permission: DomainPermission): boolean {
  return getRolePermissions(role).includes(permission);
}

export function hasAnyPermission(role: string, permissions: readonly DomainPermission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export const projectStatuses = ["lead", "estimating", "awarded", "active", "on_hold", "completed", "archived"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export const legacyProjectStatusMap: Record<string, ProjectStatus> = {
  lead: "lead",
  opportunity: "lead",
  estimate: "estimating",
  estimating: "estimating",
  site_visit: "estimating",
  proposal: "estimating",
  proposal_draft: "estimating",
  proposal_sent: "estimating",
  proposed: "estimating",
  accepted: "awarded",
  awarded: "awarded",
  contract: "awarded",
  won: "awarded",
  active: "active",
  active_job: "active",
  field_execution: "active",
  in_production: "active",
  change_orders: "active",
  closeout: "active",
  on_hold: "on_hold",
  completed: "completed",
  complete: "completed",
  warranty: "completed",
  archived: "archived",
  lost: "archived",
};

export const jobStatuses = ["unscheduled", "scheduled", "dispatched", "traveling", "on_site", "paused", "completed", "cancelled"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const estimateStatuses = ["draft", "ready", "sent", "viewed", "approved", "declined", "expired", "superseded"] as const;
export type EstimateStatus = (typeof estimateStatuses)[number];
export const legacyEstimateStatusMap: Record<string, EstimateStatus> = {
  draft: "draft",
  ready: "ready",
  sent: "ready",
  viewed: "viewed",
  approved: "approved",
  rejected: "declined",
  declined: "declined",
  expired: "expired",
  superseded: "superseded",
};

export const proposalStatuses = ["draft", "generated", "sent", "viewed", "accepted", "declined", "expired"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];
export const legacyProposalStatusMap: Record<string, ProposalStatus> = {
  draft: "draft",
  generated: "generated",
  sent: "sent",
  viewed: "viewed",
  accepted: "accepted",
  rejected: "declined",
  declined: "declined",
  expired: "expired",
};

export const contractStatuses = ["draft", "sent", "viewed", "signed", "voided"] as const;
export type ContractStatus = (typeof contractStatuses)[number];
export const legacyContractStatusMap: Record<string, ContractStatus> = {
  draft: "draft",
  pending_signature: "sent",
  sent: "sent",
  viewed: "viewed",
  signed: "signed",
  voided: "voided",
};

export const invoiceStatuses = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "voided"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export const legacyInvoiceStatusMap: Record<string, InvoiceStatus> = {
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  partially_paid: "partially_paid",
  paid: "paid",
  overdue: "overdue",
  void: "voided",
  voided: "voided",
  cancelled: "voided",
};

export const changeOrderStatuses = ["draft", "approved", "rejected"] as const;
export type ChangeOrderStatus = (typeof changeOrderStatuses)[number];

export const taskStatuses = ["todo", "in_progress", "blocked", "completed"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const siteVisitStatuses = ["captured"] as const;
export type SiteVisitStatus = (typeof siteVisitStatuses)[number];

export const siteVisitVoiceNoteStatuses = ["not_recorded", "captured_later"] as const;
export type SiteVisitVoiceNoteStatus = (typeof siteVisitVoiceNoteStatuses)[number];

export const lifecycleStatusLabels: Record<string, string> = {
  active: "Active",
  admin: "Admin",
  approved: "Approved",
  archived: "Archived",
  awarded: "Awarded",
  blocked: "Blocked",
  cancelled: "Cancelled",
  captured: "Captured",
  completed: "Completed",
  declined: "Declined",
  dispatcher: "Dispatcher",
  draft: "Draft",
  estimating: "Estimating",
  expired: "Expired",
  generated: "Generated",
  in_progress: "In Progress",
  lead: "Lead",
  on_hold: "On Hold",
  on_site: "On Site",
  overdue: "Overdue",
  owner: "Owner",
  paid: "Paid",
  partially_paid: "Partially Paid",
  paused: "Paused",
  ready: "Ready",
  rejected: "Rejected",
  scheduled: "Scheduled",
  sent: "Sent",
  signed: "Signed",
  superseded: "Superseded",
  technician: "Technician",
  todo: "To Do",
  traveling: "Traveling",
  unscheduled: "Unscheduled",
  viewed: "Viewed",
  voided: "Voided",
};

const terminalStatuses = new Set<string>([
  "archived",
  "completed",
  "cancelled",
  "approved",
  "declined",
  "expired",
  "superseded",
  "signed",
  "voided",
  "paid",
  "rejected",
]);

export function getStatusLabel(status: string): string {
  return lifecycleStatusLabels[status] ?? status.replaceAll("_", " ");
}

export function isTerminalStatus(status: string): boolean {
  return terminalStatuses.has(status);
}

function normalizeFromMap<T extends string>(status: string, map: Record<string, T>, fallback: T): T {
  return map[status] ?? fallback;
}

export function normalizeProjectStatus(status: string): ProjectStatus {
  return normalizeFromMap(status, legacyProjectStatusMap, "lead");
}

export function normalizeEstimateStatus(status: string): EstimateStatus {
  return normalizeFromMap(status, legacyEstimateStatusMap, "draft");
}

export function normalizeProposalStatus(status: string): ProposalStatus {
  return normalizeFromMap(status, legacyProposalStatusMap, "draft");
}

export function normalizeContractStatus(status: string): ContractStatus {
  return normalizeFromMap(status, legacyContractStatusMap, "draft");
}

export function normalizeInvoiceStatus(status: string): InvoiceStatus {
  return normalizeFromMap(status, legacyInvoiceStatusMap, "draft");
}

export function normalizeDisplayStatus(status: string): string {
  if (status in legacyProjectStatusMap) return normalizeProjectStatus(status);
  if (status in legacyEstimateStatusMap) return normalizeEstimateStatus(status);
  if (status in legacyProposalStatusMap) return normalizeProposalStatus(status);
  if (status in legacyContractStatusMap) return normalizeContractStatus(status);
  if (status in legacyInvoiceStatusMap) return normalizeInvoiceStatus(status);
  return status;
}

const projectTransitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  lead: ["estimating", "archived"],
  estimating: ["awarded", "on_hold", "archived"],
  awarded: ["active", "on_hold", "archived"],
  active: ["on_hold", "completed", "archived"],
  on_hold: ["estimating", "awarded", "active", "archived"],
  completed: ["archived"],
  archived: [],
};

const estimateTransitions: Record<EstimateStatus, readonly EstimateStatus[]> = {
  draft: ["ready", "expired", "superseded"],
  ready: ["sent", "expired", "superseded"],
  sent: ["viewed", "approved", "declined", "expired", "superseded"],
  viewed: ["approved", "declined", "expired", "superseded"],
  approved: [],
  declined: [],
  expired: [],
  superseded: [],
};

const proposalTransitions: Record<ProposalStatus, readonly ProposalStatus[]> = {
  draft: ["generated", "sent", "declined"],
  generated: ["sent", "declined"],
  sent: ["viewed", "accepted", "declined", "expired"],
  viewed: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

const contractTransitions: Record<ContractStatus, readonly ContractStatus[]> = {
  draft: ["sent", "voided"],
  sent: ["viewed", "signed", "voided"],
  viewed: ["signed", "voided"],
  signed: [],
  voided: [],
};

const invoiceTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "voided"],
  sent: ["viewed", "partially_paid", "paid", "overdue", "voided"],
  viewed: ["partially_paid", "paid", "overdue", "voided"],
  partially_paid: ["paid", "overdue", "voided"],
  paid: [],
  overdue: ["partially_paid", "paid", "voided"],
  voided: [],
};

const changeOrderTransitions: Record<ChangeOrderStatus, readonly ChangeOrderStatus[]> = {
  draft: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["in_progress", "blocked", "completed"],
  in_progress: ["todo", "blocked", "completed"],
  blocked: ["todo", "in_progress", "completed"],
  completed: [],
};

export function canTransitionProjectStatus(from: ProjectStatus, to: ProjectStatus): boolean {
  return from === to || projectTransitions[from].includes(to);
}

export function canTransitionEstimateStatus(from: EstimateStatus, to: EstimateStatus): boolean {
  return from === to || estimateTransitions[from].includes(to);
}

export function canTransitionProposalStatus(from: ProposalStatus, to: ProposalStatus): boolean {
  return from === to || proposalTransitions[from].includes(to);
}

export function canTransitionContractStatus(from: ContractStatus, to: ContractStatus): boolean {
  return from === to || contractTransitions[from].includes(to);
}

export function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return from === to || invoiceTransitions[from].includes(to);
}

export function canTransitionChangeOrderStatus(from: ChangeOrderStatus, to: ChangeOrderStatus): boolean {
  return from === to || changeOrderTransitions[from].includes(to);
}

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || taskTransitions[from].includes(to);
}

export const canonicalActivityEventTypes = [
  "attachment.uploaded",
  "comment.created",
  "customer.created",
  "estimate.status_changed",
  "invoice.payment_recorded",
  "project.created",
  "project.status_changed",
  "proposal.accepted",
  "proposal.declined",
  "proposal.sent",
  "proposal.viewed",
  "site_visit.created",
] as const;
export type CanonicalActivityEventType = (typeof canonicalActivityEventTypes)[number];

const legacyActivityEventMap: Record<string, CanonicalActivityEventType> = {
  "project_file.uploaded": "attachment.uploaded",
};

export function normalizeActivityEventType(eventType: string): string {
  return legacyActivityEventMap[eventType] ?? eventType;
}
