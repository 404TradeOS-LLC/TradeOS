import { clientFetch } from "./clientApi.ts";

export type EstimateClarificationAnswer =
  | { kind: "details"; detail: string }
  | { kind: "site_check_assumption" };

export interface EstimateScopeClarification {
  questionKey: string;
  question: string;
  revision: number;
  answer: EstimateClarificationAnswer | null;
}

const endpoint = (estimateId: string) => `/estimates/${encodeURIComponent(estimateId)}/ai-estimator/clarification`;

export async function getEstimateScopeClarification(estimateId: string) {
  const response = await clientFetch<{ clarification: EstimateScopeClarification | null }>(endpoint(estimateId), {
    cache: "no-store",
  });
  return response.clarification;
}

export async function saveEstimateScopeClarification(
  estimateId: string,
  clarification: EstimateScopeClarification,
  answer: EstimateClarificationAnswer,
) {
  const response = await clientFetch<{ clarification: EstimateScopeClarification }>(endpoint(estimateId), {
    method: "PUT",
    body: JSON.stringify({ questionKey: clarification.questionKey, expectedRevision: clarification.revision, answer }),
  });
  return response.clarification;
}
