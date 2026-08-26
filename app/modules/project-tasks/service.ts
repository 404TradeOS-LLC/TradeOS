import { prisma } from "../../db/client";
import { ApiError } from "../../backend/middleware/errorHandler";
import { CreateProjectTaskInput, ListProjectTasksInput, ProjectTaskDTO, ProjectTaskListItemDTO, ProjectTaskStatus, UpdateProjectTaskInput } from "./types";

const TASK_PRIORITY_WEIGHT: Record<ProjectTaskListItemDTO["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};
const DEFAULT_ORGANIZATION_TASK_LIMIT = 24;

function toSortableDate(value: Date | null) {
  return value ? value.getTime() : Number.POSITIVE_INFINITY;
}

export class ProjectTasksService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByOrganization(input: ListProjectTasksInput): Promise<ProjectTaskListItemDTO[]> {
    const limit = input.limit ? Math.max(1, Math.min(input.limit, 50)) : DEFAULT_ORGANIZATION_TASK_LIMIT;
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

    const row = await this.db.projectTask.create({
      data: {
        projectId: input.projectId,
        jobId: input.jobId ?? null,
        title: input.title,
        assignedTo: input.assignedTo,
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

    const nextStatus = input.status ?? (existing.status as ProjectTaskStatus);
    const row = await this.db.projectTask.update({
      where: { id },
      data: {
        jobId: input.jobId !== undefined ? input.jobId : existing.jobId,
        title: input.title ?? existing.title,
        status: nextStatus,
        assignedTo: input.assignedTo !== undefined ? input.assignedTo : existing.assignedTo,
        dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
        priority: input.priority ?? existing.priority,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        completedAt: nextStatus === "completed" ? existing.completedAt ?? new Date() : null,
      },
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