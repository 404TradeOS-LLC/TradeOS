export const projectTaskStatuses = ["todo", "in_progress", "blocked", "completed"] as const;
export type ProjectTaskStatus = (typeof projectTaskStatuses)[number];

export const projectTaskPriorities = ["low", "medium", "high"] as const;
export type ProjectTaskPriority = (typeof projectTaskPriorities)[number];

export interface CreateProjectTaskInput {
  orgId?: string;
  projectId: string;
  jobId?: string | null;
  title: string;
  assignedTo?: string;
  dueDate?: Date;
  priority?: ProjectTaskPriority;
  notes?: string;
}

export interface UpdateProjectTaskInput {
  orgId?: string;
  jobId?: string | null;
  title?: string;
  status?: ProjectTaskStatus;
  assignedTo?: string | null;
  dueDate?: Date | null;
  priority?: ProjectTaskPriority;
  notes?: string | null;
}

export interface ProjectTaskDTO {
  id: string;
  projectId: string;
  jobId: string | null;
  title: string;
  status: ProjectTaskStatus;
  assignedTo: string | null;
  dueDate: string | null;
  priority: ProjectTaskPriority;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListProjectTasksInput {
  orgId: string;
  limit?: number;
  includeCompleted?: boolean;
}

export interface ProjectTaskListItemDTO extends ProjectTaskDTO {
  projectName: string;
  projectStatus: string;
  customerName: string | null;
  jobTitle: string | null;
}
