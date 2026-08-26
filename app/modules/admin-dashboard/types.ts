import type { CanonicalRole, OrganizationMemberStatus, SupportedRole } from "../../domain";
export type { OrganizationMemberStatus } from "../../domain";
export { organizationMemberStatuses } from "../../domain";

interface CreateOrganizationInput {
  name: string;
  regionCode?: string;
}

export type UpdateOrganizationInput = Partial<CreateOrganizationInput>;

export interface OrganizationDTO {
  id: string;
  name: string;
  regionCode: string | null;
}

export interface PricingUpdateSummary {
  staleMaterialsCount: number;
  staleMaterials: { id: string; name: string; lastPriceUpdate: Date | null }[];
}

export const organizationMemberRoles = ["owner", "admin", "dispatcher", "technician"] as const;
export type OrganizationMemberRole = (typeof organizationMemberRoles)[number];

export interface OrganizationMemberDTO {
  membershipId: string;
  userId: string;
  authSubject: string;
  email: string;
  fullName: string | null;
  role: CanonicalRole;
  sourceRole: SupportedRole;
  status: OrganizationMemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertOrganizationMemberInput {
  authSubject: string;
  email: string;
  fullName?: string;
  role: OrganizationMemberRole;
  status?: OrganizationMemberStatus;
}

export interface UpdateOrganizationMemberInput {
  role?: OrganizationMemberRole;
  status?: OrganizationMemberStatus;
}

export interface OrganizationMembershipSnapshot {
  membershipId: string;
  userId: string;
  authSubject: string;
  email: string;
  fullName: string | null;
  role: CanonicalRole;
  sourceRole: SupportedRole;
  status: OrganizationMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembershipAuditDTO {
  id: string;
  orgId: string;
  membershipId: string;
  userId: string;
  action: "created" | "updated" | "disabled";
  actorUserId: string | null;
  actorRole: string | null;
  beforeState: OrganizationMembershipSnapshot | null;
  afterState: OrganizationMembershipSnapshot | null;
  createdAt: Date;
}

export interface OrganizationMembershipAuditFilters {
  actionType?: "created" | "updated" | "disabled";
  dateFrom?: Date;
  dateTo?: Date;
}

export interface OrganizationMembershipAuditPage {
  items: OrganizationMembershipAuditDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MaterialPriceAuditFilters {
  materialId?: string;
  materialQuery?: string;
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

export interface MaterialPriceAuditDTO {
  id: string;
  orgId: string;
  materialId: string;
  materialName: string;
  oldUnitCost: number;
  newUnitCost: number;
  source: string;
  actorUserId: string | null;
  actorRole: string | null;
  createdAt: Date;
}
