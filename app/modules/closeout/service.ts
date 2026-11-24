import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { ActivityTimelineService } from "../intelligence/service";
import type { IntelligenceEntityType } from "../intelligence/types";
import { getDocumentBrand } from "../documents/branding";
import { renderCloseoutFrameHtml, renderWarrantyFrameHtml } from "../documents/templates";
import {
  CloseoutChecklist,
  CloseoutDocumentData,
  CreateCloseoutInput,
  CreatePunchItemInput,
  CreateWarrantyRecordInput,
  GetCloseoutResult,
  ProjectCloseoutDTO,
  PunchItemDTO,
  PunchItemPriority,
  PunchItemStatus,
  UpdatePunchItemInput,
  UpdateWarrantyRecordInput,
  WarrantyRecordDTO,
} from "./types";

/**
 * S069 closeout and warranty workspace.
 *
 * Mirrors ChangeOrdersService: organization scoping on every query,
 * ApiError 404/409 guards, and attributable ActivityTimelineService events
 * for creates and transitions. No method here writes a Contract, Proposal,
 * Invoice, or Estimate row — closeout records are new, attributable
 * records; historical snapshots are read, never rewritten.
 *
 * Roles (reused permission strings only — see the controller): reads and
 * punch/warranty writes ride `crm.read` / `crm.write`; punch resolve is
 * the one field-staff write and is role-checked in the service (manager
 * roles, or the assigned technician); verify/reopen and closeout
 * ready/handoff are manager-only (owner/admin/dispatcher).
 */
const MANAGER_ROLES = new Set(["owner", "admin", "dispatcher"]);

/**
 * Portal callers pass their verified customer id so the completed-job
 * evidence comes from the org/customer-scoped probe
 * (app_completed_job_ids_for_project) instead of the staff-only jobs
 * read — a portal_customer session cannot read jobs at all, so the plain
 * read would always report the completed-job artifact missing. Staff
 * callers omit this and keep the plain jobs read; the probe is never
 * used on a staff path.
 */
export interface CloseoutPortalOptions {
  portalCustomerId?: string;
}

function isManagerRole(role?: string | null): boolean {
  return !!role && MANAGER_ROLES.has(role);
}

export class CloseoutService {
  private readonly activityService = new ActivityTimelineService();

  // ---- Punch items ----

  /**
   * Active-membership check mirroring ProjectTasksService.validateAssignee.
   * Deliberately WITHOUT that service's technician-job-assignment rule:
   * it requires an active, non-completed job, and punch items attach to
   * jobs at (and after) field completion — the rule could never hold for
   * closeout punch work. Membership in this organization is the check.
   */
  private async validateAssignee(orgId: string | undefined, userId: string | null | undefined) {
    if (!userId) return null;
    if (!orgId) throw new ApiError(400, "Organization is required for punch item assignment");
    const membership = await prisma.organizationMembership.findFirst({
      where: { orgId, userId, status: "active", user: { isActive: true } },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!membership) throw new ApiError(400, "Choose an active member of this organization");
    return membership;
  }

  async createPunchItem(input: CreatePunchItemInput): Promise<PunchItemDTO> {
    if (!input.orgId) throw new ApiError(400, "Organization is required");
    if (!input.title?.trim()) throw new ApiError(400, "title is required");
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);
    if (input.jobId) {
      const job = await prisma.job.findFirst({ where: { id: input.jobId, orgId: input.orgId, projectId: input.projectId } });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }
    const assignee = await this.validateAssignee(input.orgId, input.assignedUserId);
    const row = await prisma.punchItem.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        title: input.title.trim(),
        description: input.description ?? "",
        priority: input.priority ?? "medium",
        assignedUserId: input.assignedUserId ?? null,
        assignedTo: input.assignedTo ?? assignee?.user?.fullName ?? assignee?.user?.email ?? input.assignedUserId ?? null,
        dueDate: input.dueDate ?? null,
        createdById: input.createdById,
      },
    });
    const created = toPunchDTO(row);
    await this.recordEvent({
      orgId: input.orgId,
      entityType: "punch_item",
      entityId: created.id,
      eventType: "punch_item.created",
      title: `Punch item created: ${created.title}`,
      actorUserId: input.createdById,
      metadata: { projectId: created.projectId, jobId: created.jobId, status: created.status, priority: created.priority, assignedUserId: created.assignedUserId },
    });
    return created;
  }

  async listPunchItemsByProject(projectId: string, orgId?: string): Promise<PunchItemDTO[]> {
    const rows = await prisma.punchItem.findMany({
      where: { projectId, ...(orgId ? { orgId } : {}) },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toPunchDTO);
  }

  async getPunchItemById(id: string, orgId?: string): Promise<PunchItemDTO> {
    const row = await prisma.punchItem.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!row) throw new ApiError(404, `PunchItem ${id} not found`);
    return toPunchDTO(row);
  }

  async updatePunchItem(id: string, input: UpdatePunchItemInput): Promise<PunchItemDTO> {
    const existing = await prisma.punchItem.findFirst({ where: { id, ...(input.orgId ? { orgId: input.orgId } : {}) } });
    if (!existing) throw new ApiError(404, `PunchItem ${id} not found`);
    if (existing.status === "verified") throw new ApiError(409, `PunchItem ${id} is verified and cannot be edited`);
    if (input.title !== undefined && !input.title.trim()) throw new ApiError(400, "title is required");

    let assignee: Awaited<ReturnType<CloseoutService["validateAssignee"]>> | undefined = undefined;
    if (input.assignedUserId !== undefined) {
      assignee = await this.validateAssignee(input.orgId, input.assignedUserId);
    }
    const nextAssignedUserId = input.assignedUserId !== undefined ? input.assignedUserId : existing.assignedUserId;
    // The verified-status check above and this write must be atomic: a
    // concurrent verify between the read and the write must not leave a
    // verified item edited. The write matches only a still-unverified row
    // and reports 409 when nothing matches.
    const result = await prisma.punchItem.updateMany({
      where: { id, status: { not: "verified" } },
      data: {
        title: input.title !== undefined ? input.title.trim() : existing.title,
        description: input.description ?? existing.description,
        priority: input.priority ?? existing.priority,
        assignedUserId: nextAssignedUserId,
        assignedTo:
          input.assignedTo !== undefined
            ? input.assignedTo
            : input.assignedUserId !== undefined
              ? input.assignedUserId
                ? assignee?.user?.fullName ?? assignee?.user?.email ?? input.assignedUserId
                : null
              : existing.assignedTo,
        dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
      },
    });
    if (result.count === 0) throw new ApiError(409, `PunchItem ${id} is verified and cannot be edited`);
    const row = await prisma.punchItem.findFirst({ where: { id } });
    if (!row) throw new ApiError(404, `PunchItem ${id} not found`);
    const updated = toPunchDTO(row);
    await this.recordEvent({
      orgId: input.orgId,
      entityType: "punch_item",
      entityId: updated.id,
      eventType: "punch_item.updated",
      title: `Punch item updated: ${updated.title}`,
      actorUserId: input.actorUserId,
      metadata: { projectId: updated.projectId, jobId: updated.jobId, status: updated.status, priority: updated.priority, assignedUserId: updated.assignedUserId },
    });
    return updated;
  }

  async resolvePunchItem(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<PunchItemDTO> {
    const existing = await prisma.punchItem.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `PunchItem ${id} not found`);
    const assignedTechnician = actorRole === "technician" && !!actorUserId && existing.assignedUserId === actorUserId;
    if (!isManagerRole(actorRole) && !assignedTechnician) {
      throw new ApiError(403, "Only the assigned technician or a manager can resolve this punch item");
    }
    if (existing.status !== "open" && existing.status !== "in_progress") {
      throw new ApiError(409, `PunchItem ${id} cannot be resolved from status ${existing.status}`);
    }
    const row = await prisma.punchItem.update({
      where: { id },
      data: { status: "resolved", resolvedAt: new Date(), resolvedById: actorUserId ?? existing.resolvedById },
    });
    const resolved = toPunchDTO(row);
    await this.recordEvent({
      orgId,
      entityType: "punch_item",
      entityId: resolved.id,
      eventType: "punch_item.resolved",
      title: `Punch item resolved: ${resolved.title}`,
      actorUserId,
      metadata: { projectId: resolved.projectId, jobId: resolved.jobId, previousStatus: existing.status, newStatus: "resolved" },
    });
    return resolved;
  }

  async verifyPunchItem(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<PunchItemDTO> {
    const existing = await prisma.punchItem.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `PunchItem ${id} not found`);
    if (!isManagerRole(actorRole)) throw new ApiError(403, "Only a manager can verify a punch item");
    if (existing.status !== "resolved") {
      throw new ApiError(409, `PunchItem ${id} cannot be verified from status ${existing.status}`);
    }
    // The resolved-status check above and this write must be atomic: a
    // concurrent reopen between the read and the write must not be
    // silently overwritten with verified. The write matches only a
    // still-resolved row and reports 409 when nothing matches.
    const result = await prisma.punchItem.updateMany({
      where: { id, status: "resolved" },
      data: { status: "verified" },
    });
    if (result.count !== 1) throw new ApiError(409, `PunchItem ${id} was reopened before it could be verified`);
    const row = await prisma.punchItem.findFirst({ where: { id } });
    if (!row) throw new ApiError(404, `PunchItem ${id} not found`);
    const verified = toPunchDTO(row);
    await this.recordEvent({
      orgId,
      entityType: "punch_item",
      entityId: verified.id,
      eventType: "punch_item.verified",
      title: `Punch item verified: ${verified.title}`,
      actorUserId,
      metadata: { projectId: verified.projectId, jobId: verified.jobId, previousStatus: "resolved", newStatus: "verified" },
    });
    return verified;
  }

  async reopenPunchItem(id: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<PunchItemDTO> {
    const existing = await prisma.punchItem.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `PunchItem ${id} not found`);
    if (!isManagerRole(actorRole)) throw new ApiError(403, "Only a manager can reopen a punch item");
    if (existing.status !== "resolved" && existing.status !== "verified") {
      throw new ApiError(409, `PunchItem ${id} cannot be reopened from status ${existing.status}`);
    }
    const row = await prisma.punchItem.update({
      where: { id },
      data: { status: "open", resolvedAt: null, resolvedById: null },
    });
    const reopened = toPunchDTO(row);
    await this.recordEvent({
      orgId,
      entityType: "punch_item",
      entityId: reopened.id,
      eventType: "punch_item.reopened",
      title: `Punch item reopened: ${reopened.title}`,
      actorUserId,
      metadata: { projectId: reopened.projectId, jobId: reopened.jobId, previousStatus: existing.status, newStatus: "open" },
    });
    return reopened;
  }

  // ---- Project closeout ----

  async createCloseoutForProject(input: CreateCloseoutInput): Promise<ProjectCloseoutDTO> {
    if (!input.orgId) throw new ApiError(400, "Organization is required");
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);
    const existing = await prisma.projectCloseout.findFirst({ where: { projectId: input.projectId, orgId: input.orgId } });
    if (existing) throw new ApiError(409, `Project ${input.projectId} already has a closeout`);
    const completedJobs = await prisma.job.findMany({
      where: { projectId: input.projectId, orgId: input.orgId, status: "completed" },
      orderBy: { completedAt: "desc" },
    });
    if (!completedJobs.length) {
      throw new ApiError(409, `Project ${input.projectId} has no completed job; closeout starts at field completion`);
    }
    const row = await prisma.projectCloseout.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        jobId: completedJobs[0].id,
        status: "draft",
        notes: input.notes ?? null,
      },
    });
    const created = toCloseoutDTO(row);
    await this.recordEvent({
      orgId: input.orgId,
      entityType: "project_closeout",
      entityId: created.id,
      eventType: "project_closeout.created",
      title: `Closeout created for project ${project.name}`,
      actorUserId: input.actorUserId,
      metadata: { projectId: created.projectId, jobId: created.jobId, status: "draft" },
    });
    return created;
  }

  async getCloseoutByProject(projectId: string, orgId?: string, options?: CloseoutPortalOptions): Promise<GetCloseoutResult> {
    const row = await prisma.projectCloseout.findFirst({ where: { projectId, ...(orgId ? { orgId } : {}) } });
    if (!row) throw new ApiError(404, `Project ${projectId} has no closeout`);
    return { closeout: toCloseoutDTO(row), checklist: await this.computeChecklist(projectId, orgId, options) };
  }

  async markCloseoutReady(projectId: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<GetCloseoutResult> {
    const existing = await prisma.projectCloseout.findFirst({ where: { projectId, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `Project ${projectId} has no closeout`);
    if (!isManagerRole(actorRole)) throw new ApiError(403, "Only a manager can mark a closeout ready");
    if (existing.status !== "draft") {
      throw new ApiError(409, `ProjectCloseout ${existing.id} cannot be marked ready from status ${existing.status}`);
    }
    const checklist = await this.computeChecklist(projectId, orgId);
    if (!checklist.ready) {
      throw new ApiError(409, `Closeout is not ready: missing ${checklist.missing.join(", ")}`);
    }
    const row = await prisma.projectCloseout.update({
      where: { id: existing.id },
      data: { status: "ready", completedAt: new Date(), completedById: actorUserId ?? existing.completedById },
    });
    const ready = toCloseoutDTO(row);
    await this.recordEvent({
      orgId,
      entityType: "project_closeout",
      entityId: ready.id,
      eventType: "project_closeout.ready",
      title: `Closeout ready for project ${projectId}`,
      actorUserId,
      metadata: { projectId: ready.projectId, jobId: ready.jobId, previousStatus: "draft", newStatus: "ready" },
    });
    return { closeout: ready, checklist };
  }

  async markCloseoutHandedOff(projectId: string, orgId?: string, actorUserId?: string, actorRole?: string): Promise<ProjectCloseoutDTO> {
    const existing = await prisma.projectCloseout.findFirst({ where: { projectId, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `Project ${projectId} has no closeout`);
    if (!isManagerRole(actorRole)) throw new ApiError(403, "Only a manager can hand off a closeout");
    if (existing.status !== "ready") {
      throw new ApiError(409, `ProjectCloseout ${existing.id} cannot be handed off from status ${existing.status}`);
    }
    // Reopen/create of a punch item does not move the closeout out of
    // ready, so recheck readiness here: a handoff must never land while
    // punch items are open, whatever path reached it. The recheck gives
    // the detailed 409 message, but it is NOT the atomic guard — a
    // punch reopen between the recheck and the write must not hand off
    // with an open punch item. The write below is therefore conditional
    // in a single statement (same pattern as updatePunchItem's
    // still-unverified write): it matches only a still-ready closeout
    // whose project has no open or in_progress punch item, so the
    // readiness check and the handed_off write commit atomically.
    const checklist = await this.computeChecklist(projectId, orgId);
    if (!checklist.ready) {
      throw new ApiError(409, `Closeout is not ready: missing ${checklist.missing.join(", ")}`);
    }
    const write = await prisma.projectCloseout.updateMany({
      where: {
        id: existing.id,
        ...(orgId ? { orgId } : {}),
        status: "ready",
        project: { punchItems: { none: { status: { in: ["open", "in_progress"] } } } },
      },
      data: { status: "handed_off", handedOffAt: new Date(), handedOffById: actorUserId ?? existing.handedOffById },
    });
    if (write.count === 0) {
      // Something moved between the recheck and the write: either the
      // closeout left ready (a concurrent handoff) or a punch item was
      // reopened/created. Re-read to explain which, rather than
      // reporting success for a write that did not land.
      const fresh = await prisma.projectCloseout.findFirst({ where: { id: existing.id } });
      if (!fresh || fresh.status !== "ready") {
        throw new ApiError(409, `ProjectCloseout ${existing.id} cannot be handed off from status ${fresh?.status ?? "unknown"}`);
      }
      const freshChecklist = await this.computeChecklist(projectId, orgId);
      if (!freshChecklist.ready) {
        throw new ApiError(409, `Closeout is not ready: missing ${freshChecklist.missing.join(", ")}`);
      }
      throw new ApiError(409, "Closeout is no longer ready");
    }
    const row = await prisma.projectCloseout.findFirst({ where: { id: existing.id } });
    if (!row) throw new ApiError(404, `Project ${projectId} has no closeout`);
    const handedOff = toCloseoutDTO(row);
    await this.recordEvent({
      orgId,
      entityType: "project_closeout",
      entityId: handedOff.id,
      eventType: "project_closeout.handed_off",
      title: `Closeout handed off for project ${projectId}`,
      actorUserId,
      metadata: { projectId: handedOff.projectId, jobId: handedOff.jobId, previousStatus: "ready", newStatus: "handed_off" },
    });
    return handedOff;
  }

  /**
   * Completed-job ids for the readiness checklist. Staff callers read
   * jobs directly (unchanged). Portal callers cannot: jobs_select_policy
   * permits only administrators and actively assigned users, so a plain
   * read under a portal_customer session returns zero jobs and the
   * checklist would always report the completed-job artifact missing.
   * The portal path therefore reads through
   * app_completed_job_ids_for_project — a narrow, read-only, STABLE,
   * SECURITY DEFINER probe that answers only for the caller's own org,
   * and for a portal session only for a project owned by the portal
   * customer. jobs RLS itself is untouched.
   */
  private async completedJobIds(projectId: string, orgId: string | undefined, portalCustomerId?: string): Promise<string[]> {
    if (!portalCustomerId) {
      const jobs = await prisma.job.findMany({
        where: { projectId, ...(orgId ? { orgId } : {}), status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { id: true },
      });
      return jobs.map((job) => job.id);
    }
    const rows = await prisma.$queryRaw<Array<{ job_ids: string[] }>>(
      Prisma.sql`SELECT public.app_completed_job_ids_for_project(${projectId}::uuid) AS job_ids`,
    );
    return rows[0]?.job_ids ?? [];
  }

  /**
   * The readiness checklist. A signed contract is present when a Contract
   * has signedAt set (the stored status vocabulary keeps the legacy
   * `pending_signature` value until sign(), so signedAt is the reliable
   * signal — see ContractsService.sign()). A final invoice is present
   * when any non-draft Invoice exists. An accepted proposal is present
   * when one is accepted, and not_applicable when the project has no
   * proposal at all. Ready requires a completed job, every applicable
   * artifact present, and zero open punch items.
   */
  async computeChecklist(projectId: string, orgId?: string, options?: CloseoutPortalOptions): Promise<CloseoutChecklist> {
    const orgScope = orgId ? { orgId } : {};
    const [completedJobIds, signedContracts, finalInvoices, proposals, openPunchCount] = await Promise.all([
      this.completedJobIds(projectId, orgId, options?.portalCustomerId),
      prisma.contract.findMany({ where: { projectId, signedAt: { not: null }, project: orgId ? { orgId } : undefined }, select: { id: true } }),
      prisma.invoice.findMany({ where: { projectId, status: { not: "draft" }, project: orgId ? { orgId } : undefined }, select: { id: true } }),
      prisma.proposal.findMany({ where: { projectId, project: orgId ? { orgId } : undefined }, select: { id: true, status: true } }),
      prisma.punchItem.count({ where: { projectId, ...orgScope, status: { in: ["open", "in_progress"] } } }),
    ]);
    const completedJobs = completedJobIds.map((id) => ({ id }));
    const acceptedProposal = proposals.find((proposal) => proposal.status === "accepted");
    const acceptedStatus = acceptedProposal ? "present" : proposals.length === 0 ? "not_applicable" : "missing";
    const missing: string[] = [];
    if (!completedJobs.length) missing.push("completed job");
    if (!signedContracts.length) missing.push("signed contract");
    if (!finalInvoices.length) missing.push("final invoice");
    if (acceptedStatus === "missing") missing.push("accepted proposal");
    if (openPunchCount > 0) missing.push(`open punch items (${openPunchCount})`);
    return {
      completedJobs: { count: completedJobs.length, ids: completedJobs.map((job) => job.id) },
      signedContract: { present: signedContracts.length > 0, contractId: signedContracts[0]?.id ?? null },
      finalInvoice: { present: finalInvoices.length > 0, invoiceId: finalInvoices[0]?.id ?? null },
      acceptedProposal: { status: acceptedStatus, proposalId: acceptedProposal?.id ?? null },
      openPunchCount,
      missing,
      ready: missing.length === 0,
    };
  }

  // ---- Warranty records ----

  async createWarrantyRecord(input: CreateWarrantyRecordInput): Promise<WarrantyRecordDTO> {
    if (!input.orgId) throw new ApiError(400, "Organization is required");
    if (!input.title?.trim()) throw new ApiError(400, "title is required");
    if (!input.coverageText?.trim()) throw new ApiError(400, "coverageText is required");
    if (!["contract", "invoice", "other"].includes(input.sourceType)) throw new ApiError(400, "sourceType must be contract, invoice, or other");
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);
    if (input.jobId) {
      const job = await prisma.job.findFirst({ where: { id: input.jobId, orgId: input.orgId, projectId: input.projectId } });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }
    if (input.contractId) {
      const contract = await prisma.contract.findFirst({ where: { id: input.contractId, projectId: input.projectId, project: { orgId: input.orgId } } });
      if (!contract) throw new ApiError(404, `Contract ${input.contractId} not found`);
    }
    if (input.invoiceId) {
      const invoice = await prisma.invoice.findFirst({ where: { id: input.invoiceId, projectId: input.projectId, project: { orgId: input.orgId } } });
      if (!invoice) throw new ApiError(404, `Invoice ${input.invoiceId} not found`);
    }
    const row = await prisma.warrantyRecord.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        contractId: input.contractId ?? null,
        invoiceId: input.invoiceId ?? null,
        title: input.title.trim(),
        coverageText: input.coverageText.trim(),
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        createdById: input.createdById,
      },
    });
    const created = toWarrantyDTO(row);
    await this.recordEvent({
      orgId: input.orgId,
      entityType: "warranty_record",
      entityId: created.id,
      eventType: "warranty_record.created",
      title: `Warranty record created: ${created.title}`,
      actorUserId: input.createdById,
      metadata: { projectId: created.projectId, jobId: created.jobId, contractId: created.contractId, invoiceId: created.invoiceId, sourceType: created.sourceType },
    });
    return created;
  }

  async listWarrantyRecordsByProject(projectId: string, orgId?: string): Promise<WarrantyRecordDTO[]> {
    const rows = await prisma.warrantyRecord.findMany({
      where: { projectId, ...(orgId ? { orgId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toWarrantyDTO);
  }

  async getWarrantyRecordById(id: string, orgId?: string): Promise<WarrantyRecordDTO> {
    const row = await prisma.warrantyRecord.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!row) throw new ApiError(404, `WarrantyRecord ${id} not found`);
    return toWarrantyDTO(row);
  }

  async updateWarrantyRecord(id: string, input: UpdateWarrantyRecordInput): Promise<WarrantyRecordDTO> {
    const existing = await prisma.warrantyRecord.findFirst({ where: { id, ...(input.orgId ? { orgId: input.orgId } : {}) } });
    if (!existing) throw new ApiError(404, `WarrantyRecord ${id} not found`);
    if (input.title !== undefined && !input.title.trim()) throw new ApiError(400, "title is required");
    if (input.coverageText !== undefined && !input.coverageText.trim()) throw new ApiError(400, "coverageText is required");
    const row = await prisma.warrantyRecord.update({
      where: { id },
      data: {
        title: input.title !== undefined ? input.title.trim() : existing.title,
        coverageText: input.coverageText !== undefined ? input.coverageText.trim() : existing.coverageText,
        startsAt: input.startsAt !== undefined ? input.startsAt : existing.startsAt,
        endsAt: input.endsAt !== undefined ? input.endsAt : existing.endsAt,
      },
    });
    const updated = toWarrantyDTO(row);
    const changedFields: string[] = [];
    if (input.title !== undefined && input.title.trim() !== existing.title) changedFields.push("title");
    if (input.coverageText !== undefined && input.coverageText.trim() !== existing.coverageText) changedFields.push("coverageText");
    if (input.startsAt !== undefined && (input.startsAt?.toISOString() ?? null) !== (existing.startsAt?.toISOString() ?? null)) changedFields.push("startsAt");
    if (input.endsAt !== undefined && (input.endsAt?.toISOString() ?? null) !== (existing.endsAt?.toISOString() ?? null)) changedFields.push("endsAt");
    await this.recordEvent({
      orgId: input.orgId,
      entityType: "warranty_record",
      entityId: updated.id,
      eventType: "warranty_record.updated",
      title: `Warranty record updated: ${updated.title}`,
      actorUserId: input.actorUserId,
      metadata: { projectId: updated.projectId, jobId: updated.jobId, sourceType: updated.sourceType, changedFields },
    });
    return updated;
  }

  async deleteWarrantyRecord(id: string, orgId?: string, actorUserId?: string): Promise<void> {
    const existing = await prisma.warrantyRecord.findFirst({ where: { id, ...(orgId ? { orgId } : {}) } });
    if (!existing) throw new ApiError(404, `WarrantyRecord ${id} not found`);
    await prisma.warrantyRecord.delete({ where: { id } });
    await this.recordEvent({
      orgId,
      entityType: "warranty_record",
      entityId: id,
      eventType: "warranty_record.deleted",
      title: `Warranty record deleted: ${existing.title}`,
      actorUserId,
      metadata: { projectId: existing.projectId, jobId: existing.jobId, sourceType: existing.sourceType },
    });
  }

  // ---- Closeout document data ----

  /**
   * Assembles the closeout document from REAL project records and renders
   * it through the existing document templates. Nothing here invents
   * coverage: each warranty frame quotes the record's own coverageText,
   * and manufacturer coverage / exclusions / support process are stated
   * as not recorded in this workspace (see the source document) when the
   * record does not carry them — which it never does, by design. When the
   * project has no warranty record, warrantyHtml is empty and
   * warrantyMessage says so explicitly.
   */
  async getCloseoutDocumentData(projectId: string, orgId?: string, options?: CloseoutPortalOptions): Promise<CloseoutDocumentData> {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...(orgId ? { orgId } : {}) },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!project) throw new ApiError(404, `Project ${projectId} not found`);
    const closeoutRow = await prisma.projectCloseout.findFirst({ where: { projectId, ...(orgId ? { orgId } : {}) } });
    if (!closeoutRow) throw new ApiError(404, `Project ${projectId} has no closeout`);
    const closeout = toCloseoutDTO(closeoutRow);
    const checklist = await this.computeChecklist(projectId, orgId, options);
    const [jobs, invoices, contracts, punchItems, warranties] = await Promise.all([
      prisma.job.findMany({ where: { projectId, ...(orgId ? { orgId } : {}), status: "completed" }, orderBy: { completedAt: "desc" } }),
      prisma.invoice.findMany({ where: { projectId, project: orgId ? { orgId } : undefined }, orderBy: { invoiceNumber: "asc" } }),
      prisma.contract.findMany({ where: { projectId, project: orgId ? { orgId } : undefined }, orderBy: { createdAt: "asc" } }),
      prisma.punchItem.findMany({ where: { projectId, ...(orgId ? { orgId } : {}) }, orderBy: { createdAt: "asc" } }),
      prisma.warrantyRecord.findMany({ where: { projectId, ...(orgId ? { orgId } : {}) }, orderBy: { createdAt: "asc" } }),
    ]);

    const customerName = project.customer?.name ?? "Customer";
    const customerEmail = project.customer?.email ?? "";
    const projectAddress = project.siteAddress ?? null;
    const completionDate = jobs[0]?.completedAt ?? closeoutRow.completedAt ?? project.updatedAt;
    const signedContracts = contracts.filter((contract) => contract.signedAt);
    const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
    const openPunchItems = punchItems.filter((item) => item.status === "open" || item.status === "in_progress");
    // Under a portal session the jobs read above returns zero rows
    // (jobs_select_policy is staff-only), so the summary count comes from
    // the checklist's probe-backed completed-job count on the portal path
    // — the same evidence the checklist itself uses. Staff paths keep the
    // direct jobs read.
    const completedJobCount = options?.portalCustomerId ? checklist.completedJobs.count : jobs.length;
    const handoffDocuments: string[] = [];
    if (signedContracts.length) handoffDocuments.push("Signed contract");
    if (checklist.finalInvoice.present) handoffDocuments.push("Final invoice");
    if (checklist.acceptedProposal.status === "present") handoffDocuments.push("Accepted proposal");
    for (const warranty of warranties) handoffDocuments.push(`Warranty: ${warranty.title}`);
    const closeoutSummary = [
      `Closeout for ${project.name}: ${completedJobCount} completed job${completedJobCount === 1 ? "" : "s"},`,
      `${signedContracts.length} signed contract${signedContracts.length === 1 ? "" : "s"},`,
      `${paidInvoices.length} paid invoice${paidInvoices.length === 1 ? "" : "s"},`,
      `${openPunchItems.length} open punch item${openPunchItems.length === 1 ? "" : "s"},`,
      `${warranties.length} warranty record${warranties.length === 1 ? "" : "s"}.`,
    ].join(" ");

    const brand = await getDocumentBrand(orgId ?? project.orgId ?? undefined);
    const closeoutHtml = renderCloseoutFrameHtml({
      brand,
      closeout: {
        projectName: project.name,
        projectAddress: projectAddress ?? "",
        customerName,
        customerEmail,
        completionDate,
        contractsSignedCount: signedContracts.length,
        finalInvoicesPaidCount: paidInvoices.length,
        punchListItems: openPunchItems.map((item) => item.title),
        handoffDocuments,
        closeoutSummary,
      },
    });
    const warrantyHtml = warranties.map((warranty) =>
      renderWarrantyFrameHtml({
        brand,
        warranty: {
          projectName: project.name,
          projectAddress: projectAddress ?? "",
          customerName,
          customerEmail,
          effectiveDate: warranty.startsAt ?? null,
          // The recorded expiry, passed through exactly as stored: null
          // renders "Not recorded" — never a substituted date.
          expiryDate: warranty.endsAt ?? null,
          workmanshipCoverage: warranty.coverageText,
          manufacturerCoverage: "Not recorded in this workspace — see the source document.",
          exclusions: ["No exclusions recorded in this workspace — see the source document."],
          supportProcess: "See the source document for how to request support.",
          requiredDocuments: [`Source document: ${warranty.sourceType}`],
        },
      }),
    );

    return {
      project: { id: project.id, name: project.name, siteAddress: projectAddress, customerName, customerEmail },
      closeout,
      checklist,
      completedJobs: jobs.map((job) => ({ id: job.id, title: job.title, completedAt: job.completedAt?.toISOString() ?? null })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate?.toISOString() ?? null,
        paidAt: invoice.paidAt?.toISOString() ?? null,
      })),
      contracts: contracts.map((contract) => ({ id: contract.id, status: contract.status, signedAt: contract.signedAt?.toISOString() ?? null })),
      punchSummary: {
        total: punchItems.length,
        open: punchItems.filter((item) => item.status === "open").length,
        inProgress: punchItems.filter((item) => item.status === "in_progress").length,
        resolved: punchItems.filter((item) => item.status === "resolved").length,
        verified: punchItems.filter((item) => item.status === "verified").length,
        items: punchItems.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status as PunchItemStatus,
          priority: item.priority as PunchItemPriority,
          assignedTo: item.assignedTo,
        })),
      },
      warrantyRecords: warranties.map(toWarrantyDTO),
      hasWarrantyRecords: warranties.length > 0,
      warrantyMessage: warranties.length > 0 ? null : "No warranty was given for this project — no warranty record exists.",
      closeoutHtml,
      warrantyHtml,
    };
  }

  /**
   * Serves the closeout packet as one real HTML document: the rendered
   * closeout frame, with each rendered warranty frame's page appended.
   * Each frame is a complete document from the same template, so the
   * packet takes the closeout frame as the shell and moves each warranty
   * frame's `<article>` into it verbatim — no re-rendering, no invented
   * content, and no HTML-to-PDF converter in the pipeline (the pdfkit
   * pipeline draws proposals programmatically; it cannot render these
   * HTML frames). A warranty frame without an article is skipped rather
   * than breaking the packet.
   */
  async getCloseoutDocumentHtml(projectId: string, orgId?: string, options?: CloseoutPortalOptions): Promise<{ html: string; filename: string }> {
    const data = await this.getCloseoutDocumentData(projectId, orgId, options);
    const warrantyArticles = data.warrantyHtml
      .map((frameHtml) => frameHtml.match(/<article class="frame-page">[\s\S]*?<\/article>/)?.[0] ?? null)
      .filter((article): article is string => article !== null);
    const html = warrantyArticles.length
      ? data.closeoutHtml.replace("</body>", `${warrantyArticles.join("\n")}\n  </body>`)
      : data.closeoutHtml;
    return {
      html,
      filename: `closeout-${data.project.name.replace(/\s+/g, "-").toLowerCase()}.html`,
    };
  }

  /**
   * Records the attributable audit event for a closeout/punch/warranty
   * transition (same pattern as ChangeOrdersService.recordDecision): the
   * event is written after the status update, and no event is recorded
   * when the caller supplies no organization scope, because the
   * activity_events row requires an orgId.
   */
  private async recordEvent(input: {
    orgId?: string;
    entityType: IntelligenceEntityType;
    entityId: string;
    eventType: string;
    title: string;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!input.orgId) return;
    await this.activityService.record({
      orgId: input.orgId,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      title: input.title,
      actorUserId: input.actorUserId,
      metadata: input.metadata,
    });
  }
}

function toPunchDTO(row: {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedUserId: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  resolvedAt: Date | null;
  resolvedById: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): PunchItemDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    jobId: row.jobId,
    title: row.title,
    description: row.description,
    status: row.status as PunchItemStatus,
    priority: row.priority as PunchItemPriority,
    assignedUserId: row.assignedUserId,
    assignedTo: row.assignedTo,
    dueDate: row.dueDate?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedById: row.resolvedById,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCloseoutDTO(row: {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  status: string;
  notes: string | null;
  completedAt: Date | null;
  completedById: string | null;
  handedOffAt: Date | null;
  handedOffById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectCloseoutDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    jobId: row.jobId,
    status: row.status as ProjectCloseoutDTO["status"],
    notes: row.notes,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedById: row.completedById,
    handedOffAt: row.handedOffAt?.toISOString() ?? null,
    handedOffById: row.handedOffById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toWarrantyDTO(row: {
  id: string;
  orgId: string;
  projectId: string;
  jobId: string | null;
  contractId: string | null;
  invoiceId: string | null;
  title: string;
  coverageText: string;
  sourceType: string;
  sourceId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}): WarrantyRecordDTO {
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    jobId: row.jobId,
    contractId: row.contractId,
    invoiceId: row.invoiceId,
    title: row.title,
    coverageText: row.coverageText,
    sourceType: row.sourceType as WarrantyRecordDTO["sourceType"],
    sourceId: row.sourceId,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
