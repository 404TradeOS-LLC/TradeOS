export const projectTaskStatuses = ["todo", "in_progress", "blocked", "completed"] as const;
export type ProjectTaskStatus = (typeof projectTaskStatuses)[number];

export const projectTaskPriorities = ["low", "medium", "high"] as const;
export type ProjectTaskPriority = (typeof projectTaskPriorities)[number];

export interface CreateProjectTaskInput {
  orgId?: string;
  projectId: string;
  jobId?: string | null;
  title: string;
  assignedUserId?: string | null;
  assignedTo?: string;
  dueDate?: Date;
  priority?: ProjectTaskPriority;
  notes?: string;
}

export interface UpdateProjectTaskInput {
  expectedUpdatedAt?: Date;
  orgId?: string;
  jobId?: string | null;
  title?: string;
  status?: ProjectTaskStatus;
  assignedUserId?: string | null;
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
  assignedUserId?: string | null;
  assignedTo: string | null;
  dueDate: string | null;
  priority: ProjectTaskPriority;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListAssignedJobTasksInput { orgId: string; userId: string; limit?: number }

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

export interface UpdateAssignedTaskStatusInput {
  orgId: string; userId: string; jobId: string; taskId: string;
  status: ProjectTaskStatus; expectedUpdatedAt: Date;
}
