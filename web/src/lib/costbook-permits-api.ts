import { apiFetch } from "./api";
import type { FeeReview, PermitTask } from "./costbook-permits";

/** Server-only fetchers for Codes & Permits tasks and fee reviews (issue #946, TODO 5). */

export async function getPermitTasks(token: string, projectId: string): Promise<PermitTask[]> {
  const params = new URLSearchParams({ projectId });
  return apiFetch<PermitTask[]>(`/api/v1/costbook/codes/permit-tasks?${params.toString()}`, { token });
}

export async function getFeeReviews(token: string, projectId: string): Promise<FeeReview[]> {
  const params = new URLSearchParams({ projectId });
  return apiFetch<FeeReview[]>(`/api/v1/costbook/codes/fee-reviews?${params.toString()}`, { token });
}
