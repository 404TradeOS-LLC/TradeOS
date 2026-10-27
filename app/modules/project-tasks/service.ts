import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CreateProjectTaskInput, ListAssignedJobTasksInput, ListProjectTasksInput, ProjectTaskDTO, ProjectTaskListItemDTO, ProjectTaskStatus, UpdateProjectTaskInput, UpdateAssignedTaskStatusInput } from "./types";

const TASK_PRIORITY_WEIGHT: Record<ProjectTaskListItemDTO["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const DEFAULT_ORGANIZATION_TASK_LIMIT = 24;

function toSortableDate(value: Date | null) {
  return value ? value.getTime() : Number.POSITIVE_INFINITY;
}

const sharedInclude = {
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
  },
  job: {
    select: {
      title: true,
    },
  },
} as const;


export class ProjectTasksService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Shared job tasks, not personal task assignment inferred from a display name. */
  private async validateAssignee(orgId: string | undefined, userId: string | null | undefined, jobId: string | null | undefined) {
    if (!userId) return;
    if (!orgId) throw new ApiError(400, "Organization is required for task assignment");
    const membership = await this.db.organizationMembership.findFirst({ where: { orgId, userId, status: "active", user: { isActive: true } }, include: { user: { select: { fullName: true, email: true } } } });
    if (!membership) throw new ApiError(400, "Choose an active member of this organization");
    if (membership.role === "technician") {
      const assignment = jobId && await this.db.jobAssignment.findFirst({ where: { orgId, userId, jobId, removedAt: null, declinedAt: null, job: { orgId, archivedAt: null, status: { notIn: ["completed", "cancelled"] } } } });
      if (!assignment) throw new ApiError(400, "A technician task must be linked to their active assigned job");
    }
    return membership;
  }

  async listAssignableMembers(orgId: string, projectId: string) {
    if (!await this.db.project.findFirst({ where: { id: projectId, orgId } })) throw new ApiError(404, "Project not found");
    const members = await this.db.organizationMembership.findMany({ where: { orgId, status: "active", user: { isActive: true } }, select: { user: { select: { id: true, fullName: true, email: true } } }, orderBy: { userId: "asc" } });
    return members.map(({ user }) => ({ userId: user.id, fullName: user.fullName, email: user.email, status: "active" }));
  }

  async updateAssignedStatus(input: UpdateAssignedTaskStatusInput): Promise<ProjectTaskDTO> {
    // Called only inside the authenticated controller transaction. Row locks
    // serialize assignment revocation and Job closure with this narrow save.
    if (!input.orgId || !input.userId || !Number.isFinite(input.expectedUpdatedAt.getTime())) throw new ApiError(400, "Task identity and revision are required");
    const locks = await this.db.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      select j.id from jobs j join job_assignments a on a.job_id = j.id
      where j.id = ${input.jobId}::uuid and j.org_id = ${input.orgId}::uuid
        and j.archived_at is null and j.status not in ('completed', 'cancelled')
        and a.org_id = ${input.orgId}::uuid and a.user_id = ${input.userId}::uuid
        and a.removed_at is null and a.declined_at is null
      for share of j, a
    `);
    if (!locks.length) throw new ApiError(404, "Assigned task not found");
    const where = { id: input.taskId, jobId: input.jobId, assignedUserId: input.userId, project: { orgId: input.orgId } };
    const existing = await this.db.projectTask.findFirst({ where });
    if (!existing) throw new ApiError(404, "Assigned task not found");
    const conflict = () => new ApiError(409, "This task changed. Refresh before saving again.");
    if (existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw conflict();
    const row = await this.db.projectTask.update({
      where: { ...where, updatedAt: input.expectedUpdatedAt },
      data: { status: input.status, completedAt: input.status === "completed" ? existing.completedAt ?? new Date() : null,
        updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)) },
    }).catch((error: unknown) => { if (error && typeof error === "object" && "code" in error && error.code === "P2025") throw conflict(); throw error; });
    return toDTO(row);
  }

  async listByAssignedJobs(input: ListAssignedJobTasksInput): Promise<ProjectTaskListItemDTO[]> {
    if (!input.orgId || !input.userId) throw new ApiError(401, "Authenticated task scope is required");
    const rows = await this.db.projectTask.findMany({
      where: {
        project: { orgId: input.orgId }, status: { not: "completed" },
        job: {
          orgId: input.orgId, archivedAt: null, status: { notIn: ["completed", "cancelled"] },
          assignments: { some: { orgId: input.orgId, userId: input.userId, removedAt: null, declinedAt: null } },
        },
      },
      include: sharedInclude,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
      take: Math.max(1, Math.min(input.limit ?? 50, 50)),
    });
    return rows.map(toListItemDTO);
  }

  async listByOrganization(input: ListProjectTasksInput): Promise<ProjectTaskListItemDTO[]> {
    const limit = input.limit ? Math.max(1, Math.min(input.limit, 50)) : DEFAULT_ORGANIZATION_TASK_LIMIT;
    const openRows = await this.db.projectTask.findMany({
      where: {
        project: { orgId: input.orgId },
        status: { not: "completed" },
      },
      include: sharedInclude,
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    const completedRows =
      input.includeCompleted && openRows.length < limit
        ? await this.db.projectTask.findMany({
            where: {
              project: { orgId: input.orgId },
              status: "completed",
            },
            include: sharedInclude,
            orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
            take: limit - openRows.length,
          })
        : [];

    const rows = [...openRows, ...completedRows];

    const prioritizedRows = rows
      .sort((left, right) => {
        if (left.status === "completed" && right.status !== "completed") return 1;
        if (left.status !== "completed" && right.status === "completed") return -1;

        const dueDateDelta = toSortableDate(left.dueDate) - toSortableDate(right.dueDate);
        if (dueDateDelta !== 0) return dueDateDelta;

        const priorityDelta = TASK_PRIORITY_WEIGHT[left.priority as ProjectTaskListItemDTO["priority"]] - TASK_PRIORITY_WEIGHT[right.priority as ProjectTaskListItemDTO["priority"]];
        if (priorityDelta !== 0) return priorityDelta;

        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });

    return prioritizedRows.slice(0, limit).map((row) => toListItemDTO(row));
  }

  async listByProject(projectId: string, orgId?: string): Promise<ProjectTaskDTO[]> {
    const rows = await this.db.projectTask.findMany({
      where: { projectId, project: orgId ? { orgId } : undefined },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toDTO);
  }

  async getById(id: string, orgId?: string): Promise<ProjectTaskDTO> {
    const row = await this.db.projectTask.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
    });
    if (!row) throw new ApiError(404, `Project task ${id} not found`);
    return toDTO(row);
  }

  async create(input: CreateProjectTaskInput): Promise<ProjectTaskDTO> {
    const project = await this.db.project.findFirst({ where: { id: input.projectId, orgId: input.orgId } });
    if (!project) throw new ApiError(404, `Project ${input.projectId} not found`);
    if (input.jobId) {
      const job = await this.db.job.findFirst({ where: { id: input.jobId, orgId: input.orgId, projectId: input.projectId, archivedAt: null } });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }

    const assignee = await this.validateAssignee(input.orgId, input.assignedUserId, input.jobId);
    const row = await this.db.projectTask.create({
      data: {
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        title: input.title,
        assignedTo: input.assignedTo ?? assignee?.user?.fullName ?? assignee?.user?.email ?? input.assignedUserId ?? undefined,
        ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId } : {}),
        dueDate: input.dueDate,
        priority: input.priority ?? "medium",
        notes: input.notes,
      },
    });
    return toDTO(row);
  }

  async update(id: string, input: UpdateProjectTaskInput): Promise<ProjectTaskDTO> {
    const existing = await this.db.projectTask.findFirst({
      where: { id, project: input.orgId ? { orgId: input.orgId } : undefined },
    });
    if (!existing) throw new ApiError(404, `Project task ${id} not found`);

    if (input.jobId) {
      const job = await this.db.job.findFirst({
        where: {
          id: input.jobId,
          projectId: existing.projectId,
          archivedAt: null,
          ...(input.orgId ? { orgId: input.orgId } : {}),
        },
      });
      if (!job) throw new ApiError(404, `Job ${input.jobId} not found`);
    }

    const assignee = input.assignedUserId !== undefined || input.jobId !== undefined ? await this.validateAssignee(input.orgId, input.assignedUserId !== undefined ? input.assignedUserId : existing.assignedUserId, input.jobId !== undefined ? input.jobId : existing.jobId) : undefined;
    const conflict = () => new ApiError(409, "This task changed since you opened it. Refresh the source workspace before saving again.");
    if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw conflict();
    const nextStatus = input.status ?? (existing.status as ProjectTaskStatus);
    // Include the revision in the write predicate: checking it only on the
    // preceding read would allow two requests to overwrite each other.
    const row = await this.db.projectTask.update({
      where: {
        id,
        ...(input.expectedUpdatedAt ? { updatedAt: input.expectedUpdatedAt, project: input.orgId ? { orgId: input.orgId } : undefined } : {}),
      },
      data: {
        jobId: input.jobId !== undefined ? input.jobId : existing.jobId,
        title: input.title ?? existing.title,
        status: nextStatus,
        assignedTo: input.assignedTo !== undefined ? input.assignedTo : input.assignedUserId !== undefined && input.assignedUserId !== existing.assignedUserId ? (input.assignedUserId ? assignee?.user?.fullName ?? assignee?.user?.email ?? input.assignedUserId : null) : existing.assignedTo,
        ...(input.assignedUserId !== undefined || input.jobId !== undefined
          ? { assignedUserId: input.assignedUserId !== undefined ? input.assignedUserId : existing.assignedUserId }
          : {}),
        dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        priority: input.priority ?? existing.priority,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        completedAt: nextStatus === "completed" ? existing.completedAt ?? new Date() : null,
        // Preserve revision identity even for writes within one millisecond.
        updatedAt: new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1)),
      },
    }).catch((error: unknown) => {
      if (input.expectedUpdatedAt && typeof error === "object" && error !== null && "code" in error && error.code === "P2025") throw conflict();
      throw error;
    });
    return toDTO(row);
  }

  async remove(id: string, orgId?: string): Promise<void> {
    const existing = await this.db.projectTask.findFirst({
      where: { id, project: orgId ? { orgId } : undefined },
    });
    if (!existing) throw new ApiError(404, `Project task ${id} not found`);
    await this.db.projectTask.delete({ where: { id } });
  }
}

function toDTO(row: {
  id: string;
  projectId: string;
  jobId: string | null;
  title: string;
  status: string;
  assignedUserId?: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  priority: string;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectTaskDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    jobId: row.jobId,
    title: row.title,
    status: row.status as ProjectTaskStatus,
    assignedTo: row.assignedTo,
    assignedUserId: row.assignedUserId ?? null,
    dueDate: row.dueDate?.toISOString() ?? null,
    priority: row.priority as ProjectTaskDTO["priority"],
    notes: row.notes,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toListItemDTO(row: {
  id: string;
  projectId: string;
  jobId: string | null;
  title: string;
  status: string;
  assignedUserId?: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  priority: string;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    name: string;
    status: string;
    customer: {
      name: string;
    } | null;
  };
  job: {
    title: string;
  } | null;
}): ProjectTaskListItemDTO {
  return {
    ...toDTO(row),
    projectName: row.project.name,
    projectStatus: row.project.status,
    customerName: row.project.customer?.name ?? null,
    jobTitle: row.job?.title ?? null,
  };
}
