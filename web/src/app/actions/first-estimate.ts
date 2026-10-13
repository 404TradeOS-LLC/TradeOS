"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { apiFetch, getOrganizationSettings, getProject } from "@/lib/api";
import { canStartFirstEstimate } from "@/lib/first-estimate-access";
import { getSessionToken } from "@/lib/session";
import { runFirstEstimateWorkflow, type FirstEstimateState } from "./first-estimate-workflow";

export async function createFirstEstimateAction(previous: FirstEstimateState, form: FormData): Promise<FirstEstimateState> {
  const result = await runFirstEstimateWorkflow(previous, form, {
    getSessionToken,
    canCreate: async (token) => canStartFirstEstimate((await getOrganizationSettings(token)).currentRole),
    getProject,
    createProject: (token, input) => apiFetch<{ id: string }>("/api/v1/projects", {
      token, method: "POST", body: JSON.stringify(input),
    }),
    createEstimate: (token, projectId) => apiFetch<{ id: string }>("/api/v1/estimates", {
      token, method: "POST", body: JSON.stringify({ projectId }),
    }),
  });

  if (result.projectId) {
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${result.projectId}`);
  }
  if (result.destination) redirect(result.destination);
  return { error: result.error, projectId: result.projectId };
}
