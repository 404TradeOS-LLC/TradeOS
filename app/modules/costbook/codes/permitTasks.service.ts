import { Prisma } from "@prisma/client";
import { prisma } from "../../../db/client";
import { ApiError } from "../../../backend/middleware/errorHandler";
import {
  isPermitStatus,
  isPermitTaskKind,
  type CodesPermitTaskDTO,
  type CreatePermitTaskInput,
  type PermitEvidenceItem,
  type PermitHistoryEntry,
  type PermitStatus,
  type SubmitPermitTaskInput,
  type UpdatePermitTaskInput,
} from "./types";

/**
 * Owner-assigned permit/inspection tasks (issue #946, TODO 5).
 *
 * Rules enforced here, not just in the UI:
 * - Only owner/admin may create, reassign, delete, or submit a task.
 * - A technician may update ONLY a task assigned to them, and only its
 *   explicit permit status and official evidence refs.
 * - permit_status is EXPLICIT ONLY. Nothing in this service infers a
 *   status from an address, a source link, or an AI message.
 * - Submitting requires an explicit confirm step (confirm: true) and a
 *   task currently in 'not_submitted'. There is no auto-submit path.
 * - Evidence holds official attachment references only, never full
 *   code text. History is append-only.
 */
function requireOwnerOrAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Only an owner or admin may manage permit tasks");
  }
}

function historyEntry(action: string, by: string, detail?: string): PermitHistoryEntry {
  return { action, by, at: new Date().toISOString(), ...(detail ? { detail } : {}) };
}

function toDTO(row: {
  id: string;
  orgId: string;
  projectId: string;
  assessmentId: string | null;
  taskKind: string;
  title: string;
  permitNumber: string | null;
  permitStatus: string;
  assigneeId: string | null;
  dueDate: Date | null;
  evidence: unknown;
  history: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CodesPermitTaskDTO {
  if (!isPermitTaskKind(row.taskKind) || !isPermitStatus(row.permitStatus)) {
    throw new ApiError(500, "Stored permit task has an unsupported kind or status");
  }
  return {
    id: row.id,
    orgId: row.orgId,
    projectId: row.projectId,
    assessmentId: row.assessmentId,
    taskKind: row.taskKind,
    title: row.title,
    permitNumber: row.permitNumber,
    permitStatus: row.permitStatus,
    assigneeId: row.assigneeId,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    evidence: (Array.isArray(row.evidence) ? row.evidence : []) as PermitEvidenceItem[],
    history: (Array.isArray(row.history) ? row.history : []) as PermitHistoryEntry[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function validateEvidence(items: PermitEvidenceItem[] | undefined): PermitEvidenceItem[] {
  if (!items) return [];
  for (const item of items) {
    if (
      !item ||
      typeof item.label !== "string" ||
      item.label.trim().length < 1 ||
      item.label.length > 200 ||
      typeof item.reference !== "string" ||
      item.reference.trim().length < 1 ||
      item.reference.length > 500
    ) {
      throw new ApiError(
        400,
        "Evidence entries need a label and an official reference (receipt number, filing ID, or official URL)",
      );
    }
  }
  return items;
}

export class CodesPermitTasksService {
  constructor(private readonly db: typeof prisma = prisma) {}

  private async requireProject(orgId: string, projectId: string) {
    const project = await this.db.project.findFirst({ where: { id: projectId, orgId } });
    if (!project) throw new ApiError(404, "Project not found");
    return project;
  }

  private async validateAssignee(orgId: string, assigneeId: string | null | undefined) {
    if (!assigneeId) return;
    const membership = await this.db.organizationMembership.findFirst({
      where: { orgId, userId: assigneeId, status: "active", user: { isActive: true } },
    });
    if (!membership) throw new ApiError(400, "Choose an active member of this organization");
  }

  async list(orgId: string, role: string, actorId: string, projectId: string): Promise<CodesPermitTaskDTO[]> {
    await this.requireProject(orgId, projectId);
    const where: Prisma.CodesPermitTaskWhereInput =
      role === "technician"
        ? { orgId, projectId, assigneeId: actorId }
        : { orgId, projectId };
    const rows = await this.db.codesPermitTask.findMany({
      where,
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toDTO);
  }

  async get(orgId: string, role: string, actorId: string, taskId: string): Promise<CodesPermitTaskDTO> {
    const row = await this.db.codesPermitTask.findFirst({ where: { id: taskId, orgId } });
    if (!row) throw new ApiError(404, "Permit task not found");
    if (role === "technician" && row.assigneeId !== actorId) {
      throw new ApiError(404, "Permit task not found");
    }
    return toDTO(row);
  }

  async create(input: CreatePermitTaskInput): Promise<CodesPermitTaskDTO> {
    requireOwnerOrAdmin(input.role);
    if (!input.orgId || !input.actorId) throw new ApiError(401, "Authenticated permit-task scope is required");
    if (!isPermitTaskKind(input.taskKind)) throw new ApiError(400, "taskKind must be 'permit' or 'inspection'");
    if (!input.title || input.title.trim().length < 1 || input.title.length > 300) {
      throw new ApiError(400, "Title is required (max 300 characters)");
    }
    if (input.permitNumber !== undefined && input.permitNumber !== null && input.permitNumber.length > 120) {
      throw new ApiError(400, "Permit number is too long (max 120 characters)");
    }
    await this.requireProject(input.orgId, input.projectId);
    await this.validateAssignee(input.orgId, input.assigneeId);
    const row = await this.db.codesPermitTask.create({
      data: {
        orgId: input.orgId,
        projectId: input.projectId,
        assessmentId: input.assessmentId ?? null,
        taskKind: input.taskKind,
        title: input.title.trim(),
        permitNumber: input.permitNumber?.trim() ? input.permitNumber.trim() : null,
        // Explicit default only: a new task has NOT been submitted.
        permitStatus: "not_submitted",
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        evidence: [] as unknown as Prisma.InputJsonValue,
        history: [historyEntry("created", input.actorId, `Task created as ${input.taskKind}`)] as unknown as Prisma.InputJsonValue,
      },
    });
    return toDTO(row);
  }

  async update(input: UpdatePermitTaskInput): Promise<CodesPermitTaskDTO> {
    if (!input.orgId || !input.actorId || !Number.isFinite(input.expectedUpdatedAt.getTime())) {
      throw new ApiError(400, "Task identity and revision are required");
    }
    const existing = await this.db.codesPermitTask.findFirst({ where: { id: input.taskId, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, "Permit task not found");

    const isAdmin = input.role === "owner" || input.role === "admin";
    const isAssignedTechnician = input.role === "technician" && existing.assigneeId === input.actorId;
    if (!isAdmin && !isAssignedTechnician) {
      throw new ApiError(403, "Only an owner, an admin, or the assigned technician may update this task");
    }
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new ApiError(409, "This task changed. Refresh before saving again.");
    }
    if (input.permitStatus !== undefined && !isPermitStatus(input.permitStatus)) {
      throw new ApiError(400, "permitStatus is not a recognized explicit status");
    }
    if (input.title !== undefined && (input.title.trim().length < 1 || input.title.length > 300)) {
      throw new ApiError(400, "Title is required (max 300 characters)");
    }
    // Technicians may change only the explicit status and evidence on
    // their own task — never title, assignee, due date, or permit number.
    if (isAssignedTechnician && !isAdmin) {
      const forbidden = [
        input.title !== undefined,
        input.permitNumber !== undefined,
        input.assigneeId !== undefined,
        input.dueDate !== undefined,
      ].some(Boolean);
      if (forbidden) throw new ApiError(403, "An assigned technician may update only status and evidence");
    }
    if (input.assigneeId !== undefined) await this.validateAssignee(input.orgId, input.assigneeId);

    const addedEvidence = validateEvidence(input.addEvidence).map((item) => ({
      ...item,
      addedBy: input.actorId,
      addedAt: new Date().toISOString(),
    }));
    const priorEvidence = (Array.isArray(existing.evidence) ? existing.evidence : []) as unknown as PermitEvidenceItem[];
    const priorHistory = (Array.isArray(existing.history) ? existing.history : []) as unknown as PermitHistoryEntry[];
    const changes: string[] = [];
    if (input.permitStatus !== undefined && input.permitStatus !== existing.permitStatus) {
      // Explicit human-set status only. No inference happens here.
      changes.push(`status ${existing.permitStatus} -> ${input.permitStatus}`);
    }
    if (addedEvidence.length) changes.push(`${addedEvidence.length} evidence reference(s) added`);
    if (input.title !== undefined) changes.push("title updated");
    if (input.permitNumber !== undefined) changes.push("permit number updated");
    if (input.assigneeId !== undefined) changes.push("assignee updated");
    if (input.dueDate !== undefined) changes.push("due date updated");

    const data: Prisma.CodesPermitTaskUpdateInput = {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.permitNumber !== undefined
        ? { permitNumber: input.permitNumber?.trim() ? input.permitNumber.trim() : null }
        : {}),
      ...(input.permitStatus !== undefined ? { permitStatus: input.permitStatus } : {}),
      ...(input.assigneeId !== undefined ? { assignee: input.assigneeId ? { connect: { id: input.assigneeId } } : { disconnect: true } } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      evidence: [...priorEvidence, ...addedEvidence] as unknown as Prisma.InputJsonValue,
      history: [
        ...priorHistory,
        historyEntry("updated", input.actorId, changes.join("; ") || "no field changes"),
      ] as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
    };
    const row = await this.db.codesPermitTask
      .update({ where: { id: input.taskId, updatedAt: input.expectedUpdatedAt }, data })
      .catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          throw new ApiError(409, "This task changed. Refresh before saving again.");
        }
        throw error;
      });
    return toDTO(row);
  }

  /**
   * The only submit path. Requires an explicit confirm step and a task
   * in 'not_submitted'. There is no auto-submit anywhere in this slice:
   * creating a task, attaching evidence, or receiving an Athena answer
   * never changes permit_status.
   */
  async submit(input: SubmitPermitTaskInput): Promise<CodesPermitTaskDTO> {
    requireOwnerOrAdmin(input.role);
    if (!input.confirm) {
      throw new ApiError(400, "Submitting a permit requires an explicit confirmation step");
    }
    if (!input.orgId || !input.actorId || !Number.isFinite(input.expectedUpdatedAt.getTime())) {
      throw new ApiError(400, "Task identity and revision are required");
    }
    const existing = await this.db.codesPermitTask.findFirst({ where: { id: input.taskId, orgId: input.orgId } });
    if (!existing) throw new ApiError(404, "Permit task not found");
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
      throw new ApiError(409, "This task changed. Refresh before saving again.");
    }
    if (existing.permitStatus !== "not_submitted") {
      throw new ApiError(409, `Only a not_submitted task can be submitted (current: ${existing.permitStatus})`);
    }
    const priorHistory = (Array.isArray(existing.history) ? existing.history : []) as unknown as PermitHistoryEntry[];
    const row = await this.db.codesPermitTask
      .update({
        where: { id: input.taskId, updatedAt: input.expectedUpdatedAt },
        data: {
          permitStatus: "submitted" as PermitStatus,
          history: [
            ...priorHistory,
            historyEntry("submitted", input.actorId, "Explicit owner/admin confirmation; no permit is granted by this step"),
          ] as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
        },
      })
      .catch((error: unknown) => {
        if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
          throw new ApiError(409, "This task changed. Refresh before saving again.");
        }
        throw error;
      });
    return toDTO(row);
  }

  async remove(orgId: string, role: string, taskId: string): Promise<void> {
    requireOwnerOrAdmin(role);
    const existing = await this.db.codesPermitTask.findFirst({ where: { id: taskId, orgId } });
    if (!existing) throw new ApiError(404, "Permit task not found");
    await this.db.codesPermitTask.delete({ where: { id: taskId } });
  }
}
