export const projectCreateIntents = ["job", "invoice", "change-order"] as const;
export type ProjectCreateIntent = (typeof projectCreateIntents)[number];

export const universalCreateKinds = ["estimate", "job", "customer", "invoice", "change-order", "schedule", "athena"] as const;
export type UniversalCreateKind = (typeof universalCreateKinds)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROJECT_CREATE_INTENT_COPY: Record<ProjectCreateIntent, { title: string; description: string; rowAction: string; rowHelper: string }> = {
  job: {
    title: "Create field job",
    description: "Choose the Project this field Job belongs to. Customer and service-address requirements remain enforced before creation.",
    rowAction: "Create job",
    rowHelper: "Open this Project’s field Job workflow.",
  },
  invoice: {
    title: "Create invoice",
    description: "Choose the Project to bill. The Invoice form still requires an eligible non-draft Estimate.",
    rowAction: "Create invoice",
    rowHelper: "Open this Project’s Invoice workflow.",
  },
  "change-order": {
    title: "Create change order",
    description: "Choose the Project whose approved or active scope is changing.",
    rowAction: "Open changes",
    rowHelper: "Open this Project’s Change Orders workspace.",
  },
};

export function resolveProjectCreateIntent(value?: string | null): ProjectCreateIntent | null {
  return projectCreateIntents.includes(value as ProjectCreateIntent) ? (value as ProjectCreateIntent) : null;
}

export type NewProjectCreateIntent = "estimate" | "job";

export function resolveNewProjectCreateIntent(value?: string | null): NewProjectCreateIntent | null {
  if (value === "estimate") return "estimate";
  return resolveProjectCreateIntent(value) === "job" ? "job" : null;
}

export function extractProjectIdFromPath(pathname: string): string | null {
  const match = /^\/projects\/([^/?#]+)(?:\/|$)/.exec(pathname);
  return match && UUID_PATTERN.test(match[1]) ? match[1] : null;
}

export function buildProjectIntentDestination(projectId: string, intent: ProjectCreateIntent): string {
  if (!UUID_PATTERN.test(projectId)) return "/projects";
  switch (intent) {
    case "job":
      return `/projects/${projectId}/jobs/new`;
    case "invoice":
      return `/projects/${projectId}/invoices/new`;
    case "change-order":
      return `/projects/${projectId}?tab=change-orders`;
  }
}

export function buildUniversalCreateHref(kind: UniversalCreateKind, pathname: string): string {
  const projectId = extractProjectIdFromPath(pathname);
  switch (kind) {
    case "estimate":
      return "/projects/new?intent=estimate#simpleScope";
    case "job":
      return projectId ? buildProjectIntentDestination(projectId, "job") : "/projects?intent=job";
    case "customer":
      return "/customers/new";
    case "invoice":
      return projectId ? buildProjectIntentDestination(projectId, "invoice") : "/projects?intent=invoice";
    case "change-order":
      return projectId ? buildProjectIntentDestination(projectId, "change-order") : "/projects?intent=change-order";
    case "schedule":
      return "/dispatch?view=all&status=unscheduled";
    case "athena": {
      const params = new URLSearchParams();
      params.set("page", pathname);
      if (projectId) params.set("projectId", projectId);
      return `/athena?${params.toString()}`;
    }
  }
}
