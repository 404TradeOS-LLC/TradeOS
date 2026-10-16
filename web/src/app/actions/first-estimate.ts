"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ApiClientError, apiFetch, getOrganizationSettings, getProject } from "@/lib/api";
import { canStartFirstEstimate } from "@/lib/first-estimate-access";
import { getSessionToken } from "@/lib/session";
import { runFirstEstimateWorkflow, type FirstEstimateState } from "./first-estimate-workflow";

export async function createFirstEstimateAction(previous: FirstEstimateState, form: FormData): Promise<FirstEstimateState> {
  const result = await runFirstEstimateWorkflow(previous, form, {
    getSessionToken,
    // Known application validation/auth/conflict/rate-limit rejections occur
    // before creation. Timeouts (408), gateway/cancel and server failures remain
    // ambiguous and must not unlock another non-idempotent Project POST.
    isDefinitiveRejection: (error) => error instanceof ApiClientError && [400, 401, 403, 404, 409, 422, 429].includes(error.status),
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
  return { error: result.error, projectId: result.projectId, locked: result.locked };
}
