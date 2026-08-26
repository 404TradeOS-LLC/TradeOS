import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { AuthContext } from "../../backend/auth/context";
import { ApiError } from "../../backend/middleware/errorHandler";
import { MaterialDatabaseService } from "../material-database/service";
import { normalizeRole } from "../../domain";
import {
  OrganizationDTO,
  OrganizationMembershipAuditDTO,
  OrganizationMemberDTO,
  OrganizationMembershipSnapshot,
  OrganizationMembershipAuditFilters,
  OrganizationMembershipAuditPage,
  PricingUpdateSummary,
  UpdateOrganizationMemberInput,
  UpdateOrganizationInput,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  UpsertOrganizationMemberInput,
  MaterialPriceAuditDTO,
  MaterialPriceAuditFilters,
} from "./types";

// Admin Dashboard module: the control plane for organization-wide settings and
// pricing maintenance. Per the Architecture doc's Pricing Update Strategy
// (Deliverable 6), this module surfaces the monthly/quarterly review queue
// rather than auto-applying changes.
//
// NOTE (Phase 2 scope): user management, roles/permissions, and a persisted
// membership audit log now have backing tables in the schema scaffold. The
// read-side UI is still intentionally lightweight, but the service below now
// focuses on org member provisioning, membership state management, and audit
// writes for those changes.
export class AdminDashboardService {
  private readonly materialDatabase = new MaterialDatabaseService();

  async getOrganization(id: string): Promise<OrganizationDTO> {
    const row = await prisma.organization.findUnique({ where: { id } });
    if (!row) throw new ApiError(404, `Organization ${id} not found`);
    return toOrgDTO(row);
  }

  async updateOrganization(id: string, input: UpdateOrganizationInput): Promise<OrganizationDTO> {
    const exists = await prisma.organization.findUnique({ where: { id } });
    if (!exists) throw new ApiError(404, `Organization ${id} not found`);
    const row = await prisma.organization.update({ where: { id }, data: { name: input.name, regionCode: input.regionCode } });
    return toOrgDTO(row);
  }

  /** Surfaces the monthly/quarterly pricing review queue (Deliverable 6). */
  async getPricingUpdateSummary(orgId: string, staleSinceDays = 30): Promise<PricingUpdateSummary> {
    const stale = await this.materialDatabase.findStalePrices(staleSinceDays, orgId);
    return {
      staleMaterialsCount: stale.length,
      staleMaterials: stale.map((m) => ({ id: m.id, name: m.name, lastPriceUpdate: m.lastPriceUpdate })),
    };
  }

  async listOrganizationMembers(orgId: string): Promise<OrganizationMemberDTO[]> {
    await this.assertOrganizationExists(orgId);
    const rows = await prisma.organizationMembership.findMany({
      where: { orgId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { user: true },
    });
    return rows.map(toMemberDTO);
  }

  async listMaterialPriceHistory(
    orgId: string,
    filters: MaterialPriceAuditFilters = {}
  ): Promise<MaterialPriceAuditDTO[]> {
    await this.assertOrganizationExists(orgId);
    const rows = await prisma.materialPriceAudit.findMany({
      where: {
        orgId,
        materialId: filters.materialId,
        materialName: filters.materialQuery
          ? { contains: filters.materialQuery, mode: "insensitive" }
          : undefined,
        source: filters.source,
        createdAt: { gte: filters.dateFrom, lte: filters.dateTo },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(filters.limit ?? 50, 1), 100),
    });
    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      materialId: row.materialId,
      materialName: row.materialName,
      oldUnitCost: Number(row.oldUnitCost),
      newUnitCost: Number(row.newUnitCost),
      source: row.source,
      actorUserId: row.actorUserId,
      actorRole: row.actorRole,
      createdAt: row.createdAt,
    }));
  }

  async listRecentMembershipHistory(orgId: string, limit = 8): Promise<OrganizationMembershipAuditDTO[]> {
    await this.assertOrganizationExists(orgId);
    const rows = await prisma.organizationMembershipAudit.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 25),
    });
    return rows.map(toMembershipAuditDTO);
  }

  async listOrganizationMemberHistory(
    orgId: string,
    membershipId: string,
    filters: OrganizationMembershipAuditFilters = {}
  ): Promise<OrganizationMembershipAuditDTO[]> {
    await this.assertOrganizationExists(orgId);
    const membership = await prisma.organizationMembership.findFirst({
      where: { id: membershipId, orgId },
      include: { user: true },
    });
    if (!membership) {
      throw new ApiError(404, `Membership ${membershipId} not found`);
    }

    const rows = await prisma.organizationMembershipAudit.findMany({
      where: {
        orgId,
        membershipId,
        action: filters.actionType,
        createdAt: {
          gte: filters.dateFrom,
          lte: filters.dateTo,
        },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    return rows.map(toMembershipAuditDTO);
  }

  async listOrganizationMemberHistoryPage(
    orgId: string,
    membershipId: string,
    filters: OrganizationMembershipAuditFilters = {},
    requestedPage = 1,
    requestedPageSize = 20
  ): Promise<OrganizationMembershipAuditPage> {
    await this.assertOrganizationExists(orgId);
    const membership = await prisma.organizationMembership.findFirst({
      where: { id: membershipId, orgId },
      include: { user: true },
    });
    if (!membership) {
      throw new ApiError(404, `Membership ${membershipId} not found`);
    }

    const where: Prisma.OrganizationMembershipAuditWhereInput = {
      orgId,
      membershipId,
      action: filters.actionType,
      createdAt: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
    };
    const pageSize = Math.min(Math.max(requestedPageSize, 1), 100);
    const total = await prisma.organizationMembershipAudit.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(requestedPage, 1), totalPages);
    const rows = await prisma.organizationMembershipAudit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: rows.map(toMembershipAuditDTO),
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async upsertOrganizationMember(orgId: string, input: UpsertOrganizationMemberInput, actor: AuthContext): Promise<OrganizationMemberDTO> {
    await this.assertOrganizationExists(orgId);
    this.assertActorMatchesOrg(actor, orgId);
    this.assertCanGrantRole(actor, input.role);

    const existingUser = await prisma.appUser.findUnique({ where: { authSubject: input.authSubject } });
    const existing = existingUser
      ? await prisma.organizationMembership.findFirst({
          where: { orgId, userId: existingUser.id },
          include: { user: true },
        })
      : null;
    if (existing) {
      await this.assertCanManageMembership(
        actor,
        orgId,
        existing,
        input.role,
        (input.status ?? "active") as OrganizationMemberStatus
      );
    }

    const user = existingUser
      ? await prisma.appUser.update({
          where: { id: existingUser.id },
          data: { email: input.email.toLowerCase(), fullName: input.fullName, isActive: true },
        })
      : await prisma.appUser.create({
          data: {
            authSubject: input.authSubject,
            email: input.email.toLowerCase(),
            fullName: input.fullName,
          },
        });

    const membership = await prisma.organizationMembership.upsert({
      where: {
        orgId_userId: {
          orgId,
          userId: user.id,
        },
      },
      update: {
      role: input.role,
      status: input.status ?? "active",
      },
      create: {
        orgId,
        userId: user.id,
        role: input.role,
        status: input.status ?? "active",
      },
      include: { user: true },
    });
    await this.recordMembershipAudit(orgId, {
      action: existing ? "updated" : "created",
      actor,
      beforeState: existing ? toMembershipSnapshot(existing) : null,
      afterState: toMembershipSnapshot(membership),
    });
    return toMemberDTO(membership);
  }

  async updateOrganizationMember(orgId: string, membershipId: string, input: UpdateOrganizationMemberInput, actor: AuthContext): Promise<OrganizationMemberDTO> {
    this.assertActorMatchesOrg(actor, orgId);
    const existing = await prisma.organizationMembership.findFirst({ where: { id: membershipId, orgId }, include: { user: true } });
    if (!existing) throw new ApiError(404, `Membership ${membershipId} not found`);
    if (!input.role && !input.status) {
      throw new ApiError(400, "At least one field must be provided");
    }
    await this.assertCanManageMembership(
      actor,
      orgId,
      existing,
      (input.role ?? existing.role) as OrganizationMemberRole,
      (input.status ?? existing.status) as OrganizationMemberStatus
    );
    const row = await prisma.organizationMembership.update({
      where: { id: membershipId },
      data: {
        role: input.role,
        status: input.status,
      },
      include: { user: true },
    });
    await this.recordMembershipAudit(orgId, {
      action: "updated",
      actor,
      beforeState: toMembershipSnapshot(existing),
      afterState: toMembershipSnapshot(row),
    });
    return toMemberDTO(row);
  }

  async removeOrganizationMember(orgId: string, membershipId: string, actor: AuthContext): Promise<void> {
    this.assertActorMatchesOrg(actor, orgId);
    const existing = await prisma.organizationMembership.findFirst({ where: { id: membershipId, orgId }, include: { user: true } });
    if (!existing) throw new ApiError(404, `Membership ${membershipId} not found`);
    await this.assertCanManageMembership(actor, orgId, existing, existing.role as OrganizationMemberRole, "disabled");
    const row = await prisma.organizationMembership.update({ where: { id: membershipId }, data: { status: "disabled" }, include: { user: true } });
    await this.recordMembershipAudit(orgId, {
      action: "disabled",
      actor,
      beforeState: toMembershipSnapshot(existing),
      afterState: toMembershipSnapshot(row),
    });
  }

  private async assertOrganizationExists(orgId: string): Promise<void> {
    const row = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!row) throw new ApiError(404, `Organization ${orgId} not found`);
  }

  private assertActorMatchesOrg(actor: AuthContext, orgId: string): void {
    if (actor.orgId !== orgId) {
      throw new ApiError(403, "Cross-organization access is not allowed");
    }
  }

  private assertCanGrantRole(actor: AuthContext, role: OrganizationMemberRole): void {
    if (role === "owner" && actor.role !== "owner") {
      throw new ApiError(403, "Only owners can assign owner memberships");
    }
  }

  private async assertCanManageMembership(
    actor: AuthContext,
    orgId: string,
    existing: {
      id: string;
      userId: string;
      role: string;
      status: string;
    },
    nextRole: OrganizationMemberRole,
    nextStatus: OrganizationMemberStatus
  ): Promise<void> {
    const currentRole = existing.role as OrganizationMemberRole;
    const currentStatus = existing.status as OrganizationMemberStatus;

    if (actor.role !== "owner" && (currentRole === "owner" || nextRole === "owner")) {
      throw new ApiError(403, "Only owners can manage owner memberships");
    }

    if (existing.userId === actor.userId) {
      throw new ApiError(403, "You cannot modify your own membership");
    }

    const isLeavingOwnerRole = currentRole === "owner" && currentStatus === "active" && (nextRole !== "owner" || nextStatus !== "active");
    if (isLeavingOwnerRole) {
      await this.ensureAnotherActiveOwnerExists(orgId, existing.id);
    }
  }

  private async ensureAnotherActiveOwnerExists(orgId: string, membershipId: string): Promise<void> {
    const remainingOwners = await prisma.organizationMembership.count({
      where: {
        orgId,
        status: "active",
        role: "owner",
        id: { not: membershipId },
      },
    });
    if (remainingOwners < 1) {
      throw new ApiError(409, "Organization must retain at least one active owner");
    }
  }

  private async recordMembershipAudit(
    orgId: string,
    entry: {
      action: "created" | "updated" | "disabled";
      actor: AuthContext;
      beforeState: OrganizationMembershipSnapshot | null;
      afterState: OrganizationMembershipSnapshot | null;
    }
  ): Promise<void> {
    await prisma.organizationMembershipAudit.create({
      data: {
        orgId,
        membershipId: entry.afterState?.membershipId ?? entry.beforeState?.membershipId ?? "",
        userId: entry.afterState?.userId ?? entry.beforeState?.userId ?? entry.actor.userId,
        action: entry.action,
        actorUserId: entry.actor.userId,
        actorRole: entry.actor.role,
        beforeState: (entry.beforeState ?? undefined) as Prisma.InputJsonValue | undefined,
        afterState: (entry.afterState ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

function toOrgDTO(row: { id: string; name: string; regionCode: string | null }): OrganizationDTO {
  return { id: row.id, name: row.name, regionCode: row.regionCode };
}

function toMemberDTO(row: {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    authSubject: string;
    email: string;
    fullName: string | null;
  };
}): OrganizationMemberDTO {
  return {
    membershipId: row.id,
    userId: row.userId,
    authSubject: row.user.authSubject,
    email: row.user.email,
    fullName: row.user.fullName,
    role: normalizeRole(row.role),
    sourceRole: row.role as OrganizationMemberDTO["sourceRole"],
    status: row.status as OrganizationMemberStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMembershipSnapshot(row: {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    authSubject: string;
    email: string;
    fullName: string | null;
  };
}): OrganizationMembershipSnapshot {
  return {
    membershipId: row.id,
    userId: row.userId,
    authSubject: row.user.authSubject,
    email: row.user.email,
    fullName: row.user.fullName,
    role: normalizeRole(row.role),
    sourceRole: row.role as OrganizationMembershipSnapshot["sourceRole"],
    status: row.status as OrganizationMemberStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMembershipAuditDTO(row: {
  id: string;
  orgId: string;
  membershipId: string;
  userId: string;
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  beforeState: unknown | null;
  afterState: unknown | null;
  createdAt: Date;
}): OrganizationMembershipAuditDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    membershipId: row.membershipId,
    userId: row.userId,
    action: row.action as "created" | "updated" | "disabled",
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    beforeState: row.beforeState ? (row.beforeState as OrganizationMembershipSnapshot) : null,
    afterState: row.afterState ? (row.afterState as OrganizationMembershipSnapshot) : null,
    createdAt: row.createdAt,
  };
}
