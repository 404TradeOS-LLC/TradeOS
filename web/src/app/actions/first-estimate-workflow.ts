import { isSafeProjectId } from "../../lib/projectFileStorage.ts";

export type FirstEstimateState = { error?: string; projectId?: string; locked?: boolean } | undefined;
type FirstEstimateResult = NonNullable<FirstEstimateState> & { destination?: string };
type ProjectInput = { name: string; simpleScope: string; customerId?: string };

export type FirstEstimateDependencies = {
  getSessionToken: () => Promise<string | null>;
  canCreate: (token: string) => Promise<boolean>;
  createProject: (token: string, input: ProjectInput) => Promise<{ id: string }>;
  getProject: (token: string, id: string) => Promise<{ id: string; estimates: Array<{ id: string; status: string }> }>;
  createEstimate: (token: string, projectId: string) => Promise<{ id: string }>;
};

export async function runFirstEstimateWorkflow(
  previous: FirstEstimateState,
  form: FormData,
  dependencies: FirstEstimateDependencies,
): Promise<FirstEstimateResult> {
  if (previous?.locked) return { locked: true, error: "Open Projects to find your saved work before starting another estimate." };
  let projectId = previous?.projectId;
  if (projectId && !isSafeProjectId(projectId)) {
    return { locked: true, error: "Invalid saved project reference. Open Projects to find your saved work." };
  }
  const token = await dependencies.getSessionToken();
  if (!token) return { projectId, error: "Sign in again before starting or resuming your estimate." };
  try {
    if (!await dependencies.canCreate(token)) return { projectId, error: "Your role cannot create projects or estimates. Return to Today or ask an owner or administrator." };
  } catch {
    return { projectId, error: "Could not verify your access. Retry when the connection is available; no creation request was made." };
  }

  if (projectId) {
    try {
      // Action state is untrusted input. The current authenticated API/RLS
      // boundary must authorize it again before resuming any write.
      const project = await dependencies.getProject(token, projectId);
      if (project.id !== projectId) throw new Error("Project reference mismatch");
      const draft = project.estimates.find((estimate) => estimate.status === "draft");
      if (draft) return { projectId, destination: `/projects/${projectId}/estimates/${draft.id}` };
      // A failed POST may still commit after our read. Never issue a second
      // estimate POST on resume; hand off to the authorized project instead.
      return { projectId, destination: `/projects/${projectId}` };
    } catch {
      return { projectId, error: "Could not reopen your saved project. Check your access or retry; no new project was created." };
    }
  } else {
    const name = String(form.get("name") ?? "").trim();
    const simpleScope = String(form.get("simpleScope") ?? "").trim();
    const customerId = String(form.get("customerId") ?? "").trim();
    if (!name || name.length > 160) return { error: "Enter a job name of 1–160 characters." };
    if (simpleScope.length < 12 || simpleScope.length > 10000) return { error: "Describe the work in 12–10,000 characters." };
    try {
      const project = await dependencies.createProject(token, { name, simpleScope, customerId: customerId || undefined });
      projectId = project.id;
    } catch {
      return { locked: true, error: "Could not confirm that your project was saved. Check Projects before starting another estimate." };
    }
  }

  try {
    const estimate = await dependencies.createEstimate(token, projectId);
    return { projectId, destination: `/projects/${projectId}/estimates/${estimate.id}` };
  } catch {
    return { projectId, error: "Your project is saved, but the draft estimate could not be confirmed. Retry to reopen the saved project, or continue from its workspace." };
  }
}
